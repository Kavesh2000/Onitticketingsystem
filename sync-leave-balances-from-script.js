const fs = require('fs');
const path = require('path');
const db = require('./database');

async function main() {
  try {
    await db.testConnection();
    const scriptPath = path.join(__dirname, 'script.js');
    const txt = fs.readFileSync(scriptPath, 'utf8');

    // Find occurrences of employee objects with email and leaveBalances
    const objRe = /\{[^}]*?email\s*:\s*'([^']+)'[^}]*?leaveBalances\s*:\s*\{([^}]+)\}[^}]*?\}/g;
    const map = new Map();
    let m;
    while ((m = objRe.exec(txt)) !== null) {
      const email = m[1];
      const balancesStr = m[2];
      const pairs = balancesStr.split(',').map(s => s.trim()).filter(Boolean);
      const balances = {};
      for (const p of pairs) {
        const parts = p.split(':').map(x => x.trim());
        if (parts.length === 2) {
          const key = parts[0].replace(/['\"]+/g, '');
          const val = Number(parts[1].replace(/[^0-9.-]/g, ''));
          balances[key] = Number.isNaN(val) ? parts[1] : val;
        }
      }
      map.set(email, balances);
    }

    console.log('Found default balances for', map.size, 'emails in script.js');

    const usersRes = await db.query('SELECT id, email, full_name FROM users');
    let updated = 0;
    for (const u of usersRes.rows) {
      const b = map.get(u.email);
      if (b) {
        try {
          await db.query(`INSERT INTO leave_balances (user_id, balance, last_updated, balances) VALUES ($1,$2,NOW(), $3) ON CONFLICT (user_id) DO UPDATE SET balances = EXCLUDED.balances, last_updated = NOW()`, [u.id, 0, b]);
          updated++;
        } catch (err) {
          console.warn('Failed to update for', u.email, err.message);
        }
      }
    }

    console.log('Updated leave_balances for', updated, 'users based on `script.js` defaults');

    // Show sample
    const sample = await db.query('SELECT u.email, lb.balances FROM leave_balances lb JOIN users u ON u.id = lb.user_id ORDER BY u.id LIMIT 5');
    console.log('Sample rows:', sample.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.closePool();
  }
}

main();
