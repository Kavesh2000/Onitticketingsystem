const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function testLogins() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(data);
        const expectedHash = hashPassword('1234');

        console.log('Testing all users...\n');
        console.log('Expected password hash: ' + expectedHash);
        console.log('Actual password hash in JSON: ' + (users[0]?.password || 'MISSING'));
        console.log('---\n');

        const byDept = {};
        users.forEach(u => {
            const dept = u.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = [];
            byDept[dept].push(`${u.email} (${u.role})`);
            
            // Verify password hash
            if (u.password !== expectedHash) {
                console.log(`⚠️ MISMATCH: ${u.email}`);
                console.log(`   Expected: ${expectedHash}`);
                console.log(`   Got:      ${u.password}\n`);
            }
        });

        // Print users by department
        Object.keys(byDept).sort().forEach(dept => {
            console.log(`\n${dept}:`);
            byDept[dept].forEach(user => console.log(`  - ${user}`));
        });

        console.log('\n✅ Total users:', users.length);
        console.log('✅ All password hashes correct:', users.every(u => u.password === expectedHash));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testLogins();
