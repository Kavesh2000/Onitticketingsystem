const db = require('./database');

async function run() {
  try {
    await db.initializeSchema();
    const res = await db.recomputeLeaveBalances();
    console.log('[SCRIPT] Recompute result:', res);
  } catch (e) {
    console.error('[SCRIPT ERROR]', e.message);
  } finally {
    await db.closePool();
  }
}

run();
