const db = require('./database');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function verifyAdminPassword() {
    try {
        const result = await db.query('SELECT email, password FROM users WHERE email = $1', ['admin@maishabank.com']);
        
        if (result.rows.length === 0) {
            console.log('❌ Admin user not found in database');
            process.exit(1);
        }

        const user = result.rows[0];
        const expectedHash = hashPassword('1234');
        
        console.log('\n=== ADMIN PASSWORD VERIFICATION ===');
        console.log('Email:', user.email);
        console.log('Password in DB:', user.password.substring(0, 16) + '...');
        console.log('Expected hash for "1234":', expectedHash.substring(0, 16) + '...');
        console.log('Match:', user.password === expectedHash ? '✅ YES' : '❌ NO');
        
        if (user.password === expectedHash) {
            console.log('\n✅ Admin password is correctly set to "1234"');
            console.log('\nTo log in:');
            console.log('  1. Go to http://localhost:3003/index.html');
            console.log('  2. Click "Admin Portal"');
            console.log('  3. Enter username: admin@maishabank.com (or just "admin")');
            console.log('  4. Enter password: 1234');
            console.log('  5. Click Login');
        } else {
            console.log('\n❌ Admin password does NOT match "1234"');
            console.log('Updating password to "1234"...');
            
            const updateResult = await db.query(
                'UPDATE users SET password = $1 WHERE email = $2 RETURNING email',
                [expectedHash, 'admin@maishabank.com']
            );
            
            if (updateResult.rows.length > 0) {
                console.log('✅ Password updated successfully');
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyAdminPassword();
