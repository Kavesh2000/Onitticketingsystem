const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('[SUCCESS] Saved', users.length, 'users');
    } catch (error) {
        console.error('[ERROR] Saving users:', error.message);
    }
}

function reset_users() {
    const users = [
        // Real staff only - 18 staff + 1 admin = 19 users total
        { "full_name": "Stevaniah Kavela", "username": "stevaniah.kavela", "email": "stevaniah.kavela@maishabank.com", "role": "IT Support", "department": "ICT" },
        { "full_name": "Mercy Mukhwana", "username": "mercy.mukhwana", "email": "mercy.mukhwana@maishabank.com", "role": "IT Support", "department": "ICT" },
        { "full_name": "Eric Mokaya", "username": "eric.mokaya", "email": "eric.mokaya@maishabank.com", "role": "IT Support", "department": "ICT" },
        { "full_name": "Caroline Ngugi", "username": "caroline.ngugi", "email": "caroline.ngugi@maishabank.com", "role": "Branch Officer", "department": "Branch" },
        { "full_name": "Lilian Kimani", "username": "lilian.kimani", "email": "lilian.kimani@maishabank.com", "role": "Branch Officer", "department": "Branch" },
        { "full_name": "Maureen Kerubo", "username": "maureen.kerubo", "email": "maureen.kerubo@maishabank.com", "role": "Branch Officer", "department": "Branch" },
        { "full_name": "Alice Muthoni", "username": "alice.muthoni", "email": "alice.muthoni@maishabank.com", "role": "Branch Officer", "department": "Branch" },
        { "full_name": "Michael Mureithi", "username": "michael.mureithi", "email": "michael.mureithi@maishabank.com", "role": "Branch Officer", "department": "Branch" },
        { "full_name": "Patrick Ndegwa", "username": "patrick.ndegwa", "email": "patrick.ndegwa@maishabank.com", "role": "Finance Officer", "department": "Finance" },
        { "full_name": "Margaret Njeri", "username": "margaret.njeri", "email": "margaret.njeri@maishabank.com", "role": "Finance Officer", "department": "Finance" },
        { "full_name": "Elizabeth Mungai", "username": "elizabeth.mungai", "email": "elizabeth.mungai@maishabank.com", "role": "Finance Officer", "department": "Finance" },
        { "full_name": "Ebby Gesare", "username": "ebby.gesare", "email": "ebby.gesare@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Vivian Orisa", "username": "vivian.orisa", "email": "vivian.orisa@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Juliana Jeptoo", "username": "juliana.jeptoo", "email": "juliana.jeptoo@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Faith Bonareri", "username": "faith.bonareri", "email": "faith.bonareri@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Patience Mutunga", "username": "patience.mutunga", "email": "patience.mutunga@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Eva Mukami", "username": "eva.mukami", "email": "eva.mukami@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Peter Kariuki", "username": "peter.kariuki", "email": "peter.kariuki@maishabank.com", "role": "Customer Service", "department": "Customer Service" },
        { "full_name": "Admin", "username": "admin", "email": "automation@maishabank.com", "role": "Admin", "department": "Admin" }
    ];

    const defaultPassword = "1234";
    const hashedPassword = hashPassword(defaultPassword);

    const finalUsers = users.map((userData, index) => ({
        id: String(index + 1),
        ...userData,
        password: hashedPassword,
        created_at: new Date().toISOString(),
        active: true
    }));

    saveUsers(finalUsers);
    return { success: true, total: finalUsers.length };
}

console.log('Resetting users.json to real staff + admin...');
const result = reset_users();
console.log('Result:', result);
console.log('Users file location:', USERS_FILE);
console.log('File exists:', fs.existsSync(USERS_FILE));
