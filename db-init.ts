// Copyright by AcmaTvirus
import pool from './src/services/db';
import fs from 'fs';
import path from 'path';

async function initialize() {
    try {
        console.log('--- Initializing Database ---');
        const sqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);
        console.log('✅ Database initialization successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        process.exit(1);
    }
}

initialize();
