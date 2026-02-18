// setup-db.js - Creates the PostgreSQL database
const { Pool } = require('pg');

async function createDatabase() {
    const password = process.argv[2] || 'Test.test1';
    
    // Connect to default postgres database
    const pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        port: 5432,
        password: password,
        database: 'postgres' // Connect to default database first
    });

    try {
        console.log('[DB] Connecting as postgres user...');
        const client = await pool.connect();
        
        console.log('[DB] Creating database maisha_bank...');
        await client.query('CREATE DATABASE maisha_bank');
        
        console.log('[SUCCESS] Database maisha_bank created successfully!');
        client.release();
        
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('[INFO] Database maisha_bank already exists');
        } else {
            console.error('[ERROR]', error.message);
            process.exit(1);
        }
    } finally {
        await pool.end();
    }
}

createDatabase();
