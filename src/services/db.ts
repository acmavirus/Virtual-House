// Copyright by AcmaTvirus
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Max number of connections in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
    console.error('[DB] Unexpected error on idle client', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
