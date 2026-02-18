// run-migration.js - Run database schema init and JSON->Postgres migration
const db = require('./database');

async function run() {
  try {
    console.log('[MIGRATE] Testing DB connection...');
    const ok = await db.testConnection();
    if (!ok) {
      console.error('[MIGRATE] DB connection failed');
      process.exit(1);
    }

    console.log('[MIGRATE] Initializing schema...');
    await db.initializeSchema();

    console.log('[MIGRATE] Running migrateFromJSON()...');
    await db.migrateFromJSON();

    console.log('[MIGRATE] Done');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
    process.exit(1);
  }
}

run();
