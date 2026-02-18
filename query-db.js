const db = require('./database');

async function main() {
  try {
    await db.testConnection();
    const tables = ['users', 'tickets', 'asset_register', 'audit_logs', 'email_logs', 'leave_requests', 'expense_claims', 'claim_disbursements', 'leave_balances'];
    for (const t of tables) {
      try {
        const r = await db.query(`SELECT COUNT(*) AS cnt FROM ${t}`);
        console.log(`${t}: ${r.rows[0].cnt}`);
      } catch (err) {
        console.log(`${t}: error (${err.message})`);
      }
    }

    // show a few sample rows for tickets and users
    const users = await db.query('SELECT id, full_name, email, username FROM users ORDER BY id LIMIT 5');
    console.log('\nSample users:\n', users.rows);
    const tickets = await db.query('SELECT id, name, email, from_dept, to_dept, status, timestamp FROM tickets ORDER BY timestamp DESC LIMIT 5');
    console.log('\nSample tickets:\n', tickets.rows);
  } catch (error) {
    console.error('Error querying DB:', error.message);
  } finally {
    await db.closePool();
  }
}

main();
