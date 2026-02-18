const db = require('./database');

async function main() {
  try {
    await db.testConnection();

    const res = await db.query('SELECT id, email, full_name FROM users');
    console.log('Users found:', res.rows.length);

    const defaults = { annual: 25, sick: 10, personal: 5, maternity: 0, paternity: 0 };

    let inserted = 0;
    for (const u of res.rows) {
      try {
        await db.query(`INSERT INTO leave_balances (user_id, balance, last_updated, balances) VALUES ($1,$2,NOW(), $3) ON CONFLICT (user_id) DO UPDATE SET balances = EXCLUDED.balances, last_updated = NOW()`, [u.id, 0, defaults]);
        inserted++;
      } catch (err) {
        console.warn('Failed to insert balance for', u.id, err.message);
      }
    }

    console.log('Updated leave balances for', inserted, 'users');

    const check = await db.query('SELECT lb.user_id, lb.balances, u.email FROM leave_balances lb JOIN users u ON u.id = lb.user_id ORDER BY lb.user_id LIMIT 5');
    console.log('Sample balances:', check.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.closePool();
  }
}

main();
