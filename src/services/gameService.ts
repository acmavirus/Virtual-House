// Copyright by AcmaTvirus
import pool from './db';
import redis from './redis';

export interface LandType {
    name: string;
    price: number;
    baseRent: number;
    emoji: string;
}

// List of real estate land types (Language: English)
export const LAND_TYPES: Record<string, LandType> = {
    'empty_lot': { name: 'Empty Lot', price: 500, baseRent: 0.1, emoji: '🌱' },
    'suburbs': { name: 'Suburbs', price: 2500, baseRent: 0.5, emoji: '🏡' },
    'prime_location': { name: 'Prime Location', price: 10000, baseRent: 2.0, emoji: '🏢' },
    'private_island': { name: 'Private Island', price: 100000, baseRent: 20.0, emoji: '🏝️' },
};

export class GameService {
    // Ensure player exists in Database
    static async ensureUser(userId: string) {
        const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (res.rows.length === 0) {
            await pool.query('INSERT INTO users (id, balance, level, exp) VALUES ($1, 0, 1, 0)', [userId]);
            return { id: userId, balance: 0, level: 1, exp: 0, isNew: true };
        }
        return { ...res.rows[0], isNew: false };
    }

    // Add EXP and handle level up
    static async addExp(userId: string, amount: number) {
        const user = await this.ensureUser(userId);
        let currentExp = parseInt(user.exp) + amount;
        let currentLevel = user.level;
        let leveledUp = false;

        while (true) {
            // Formula from exp.md: 100 * Math.pow(current_level, 1.5)
            const expNeeded = Math.floor(100 * Math.pow(currentLevel, 1.5));
            if (currentExp >= expNeeded) {
                currentExp -= expNeeded;
                currentLevel++;
                leveledUp = true;
            } else {
                break;
            }
        }

        if (leveledUp) {
            await pool.query('UPDATE users SET exp = $1, level = $2 WHERE id = $3', [currentExp, currentLevel, userId]);
            return { leveledUp: true, currentLevel: currentLevel };
        } else {
            await pool.query('UPDATE users SET exp = $1 WHERE id = $2', [currentExp, userId]);
            return { leveledUp: false, currentLevel: currentLevel };
        }
    }

    // Handle work action
    static async work(userId: string) {
        await this.ensureUser(userId);
        const now = new Date();
        const res = await pool.query('SELECT last_work_time FROM users WHERE id = $1', [userId]);
        const lastWork = res.rows[0].last_work_time;

        if (lastWork) {
            const diff = (now.getTime() - new Date(lastWork).getTime()) / 1000;
            if (diff < 4) {
                return { success: false, remaining: Math.ceil(4 - diff) };
            }
        }

        const user = await this.ensureUser(userId);
        const earn = Math.floor(Math.random() * (150 - 50 + 1)) + 50;
        const expGain = 10 + (user.level * 2); // Balanced: 10 + Level*2

        await pool.query('UPDATE users SET balance = balance + $1, last_work_time = $2 WHERE id = $3', [earn, now, userId]);
        const expResult = await this.addExp(userId, expGain);

        return { success: true, earned: earn, expGain, ...expResult };
    }

    // Purchase new property
    static async buyLand(userId: string, landKey: string) {
        const user = await this.ensureUser(userId);
        const land = LAND_TYPES[landKey];

        if (!land) return { success: false, message: 'Invalid land type.' };
        if (user.balance < land.price) return { success: false, message: 'Insufficient balance.' };

        // Lucky chance to get Gold Land (1%)
        const isGold = Math.random() < 0.01;

        await pool.query('BEGIN');
        try {
            await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [land.price, userId]);
            await pool.query(
                'INSERT INTO houses (user_id, land_type, is_gold) VALUES ($1, $2, $3)',
                [userId, landKey, isGold]
            );
            await pool.query('COMMIT');

            // Buying land gives EXP: 50 - 500 based on price
            const expGain = Math.max(50, Math.min(500, Math.floor(land.price / 100)));
            await this.addExp(userId, expGain);

            return { success: true, isGold };
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }
    }

    // Calculate current rent rate per second
    static getRentRate(house: any) {
        const land = LAND_TYPES[house.land_type];
        if (!land) return 0;
        // Scaling: Base * (1.3 ^ (level - 1)) -> 30% increase per level
        let rate = land.baseRent * Math.pow(1.3, house.level - 1);
        if (house.is_gold) rate *= 2;
        return rate;
    }

    // Collect rent
    static async collectRent(userId: string) {
        const housesRes = await pool.query('SELECT * FROM houses WHERE user_id = $1', [userId]);
        if (housesRes.rows.length === 0) return { total: 0, count: 0 };

        let totalRent = 0;
        const now = new Date();

        for (const house of housesRes.rows) {
            const seconds = (now.getTime() - new Date(house.last_collect_time).getTime()) / 1000;

            if (seconds > 0) {
                let rate = this.getRentRate(house);
                let rent = rate * seconds * (house.condition / 100);

                totalRent += Math.floor(rent);
            }
        }

        if (totalRent > 0) {
            await pool.query('BEGIN');
            try {
                await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [totalRent, userId]);
                await pool.query('UPDATE houses SET last_collect_time = $1, condition = GREATEST(0, condition - 5) WHERE user_id = $2', [now, userId]);
                await pool.query('COMMIT');

                // Collecting rent gives EXP: 1 EXP per $1000
                const expGain = Math.floor(totalRent / 1000);
                if (expGain > 0) await this.addExp(userId, expGain);
            } catch (e) {
                await pool.query('ROLLBACK');
                throw e;
            }
        }

        return { total: totalRent, count: housesRes.rows.length };
    }

    // Upgrade property (1.5x price, +1 level)
    static async upgradeProperty(userId: string, houseId: number) {
        const res = await pool.query('SELECT * FROM houses WHERE id = $1 AND user_id = $2', [houseId, userId]);
        if (res.rows.length === 0) return { success: false, message: 'Property not found.' };

        const house = res.rows[0];
        const land = LAND_TYPES[house.land_type];
        const upgradeCost = Math.floor(land.price * 0.5 * house.level);

        const user = await this.ensureUser(userId);
        if (user.balance < upgradeCost) return { success: false, message: `Insufficient balance. Need $${upgradeCost}.` };

        // 1. Calculate pending rent for this specific property
        const now = new Date();
        const seconds = (now.getTime() - new Date(house.last_collect_time).getTime()) / 1000;
        const currentRate = this.getRentRate(house);
        const pendingRent = Math.floor(currentRate * seconds * (house.condition / 100));

        await pool.query('BEGIN');
        try {
            // 2. Update balance: subtract upgrade cost AND add pending rent
            await pool.query('UPDATE users SET balance = balance - $1 + $2 WHERE id = $3', [upgradeCost, pendingRent, userId]);
            // 3. Increase level and RESET last_collect_time (and also decrease condition like regular collect)
            await pool.query(
                'UPDATE houses SET level = level + 1, last_collect_time = $1, condition = GREATEST(0, condition - 5) WHERE id = $2',
                [now, houseId]
            );
            await pool.query('COMMIT');

            // Upgrading gives EXP similar to buying
            const expGain = Math.max(50, Math.min(500, Math.floor(upgradeCost / 50)));
            await this.addExp(userId, expGain);

            return { success: true, cost: upgradeCost, earned: pendingRent, newLevel: house.level + 1 };
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }
    }

    // Repair property (Cost based on missing condition)
    static async repairProperty(userId: string, houseId: number) {
        const res = await pool.query('SELECT * FROM houses WHERE id = $1 AND user_id = $2', [houseId, userId]);
        if (res.rows.length === 0) return { success: false, message: 'Property not found.' };

        const house = res.rows[0];
        if (house.condition >= 100) return { success: false, message: 'Property is in perfect condition.' };

        const repairCost = (100 - house.condition) * 10; // $10 per 1% condition
        const user = await this.ensureUser(userId);
        if (user.balance < repairCost) return { success: false, message: `Insufficient balance. Need $${repairCost}.` };

        await pool.query('BEGIN');
        try {
            await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [repairCost, userId]);
            await pool.query('UPDATE houses SET condition = 100 WHERE id = $1', [houseId]);
            await pool.query('COMMIT');

            // Repairing gives small EXP
            await this.addExp(userId, 10);

            return { success: true, cost: repairCost };
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }
    }

    // Sell property (75% refund)
    static async sellLand(userId: string, houseId: number) {
        const res = await pool.query('SELECT * FROM houses WHERE id = $1 AND user_id = $2', [houseId, userId]);
        if (res.rows.length === 0) return { success: false, message: 'Property not found.' };

        const house = res.rows[0];
        const land = LAND_TYPES[house.land_type];
        const refund = Math.floor(land.price * 0.75);

        await pool.query('BEGIN');
        try {
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [refund, userId]);
            await pool.query('DELETE FROM houses WHERE id = $1', [houseId]);
            await pool.query('COMMIT');

            // Selling gives EXP
            await this.addExp(userId, 50);

            return { success: true, refund, landName: land.name };
        } catch (e) {
            await pool.query('ROLLBACK');
            throw e;
        }
    }

    // Get asset list
    static async getAssets(userId: string) {
        const res = await pool.query('SELECT * FROM houses WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    }
}
