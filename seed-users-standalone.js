const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Loading users:', error.message);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('[SUCCESS] Saved', users.length, 'users');
    } catch (error) {
        console.error('[ERROR] Saving users:', error.message);
    }
}

function seed_users() {
    const users = [
        // Real staff users – only these should appear in the system
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

    const existingUsers = loadUsers();
    const existingUsernames = new Set(existingUsers.map(u => u.username));
    
    let addedCount = 0;
    // simple password for all accounts during demo
    const defaultPassword = "1234";
    const hashedPassword = hashPassword(defaultPassword);

    for (const userData of users) {
        // Check if user already exists
        if (!existingUsernames.has(userData.username)) {
            const userObj = {
                id: crypto.randomBytes(8).toString('hex'),
                ...userData,
                password: hashedPassword,
                created_at: new Date().toISOString(),
                active: true
            };
            existingUsers.push(userObj);
            addedCount++;
            console.log('[SEED] Added user:', userData.username);
        } else {
            console.log('[SKIP] User already exists:', userData.username);
        }
    }

    if (addedCount > 0) {
        saveUsers(existingUsers);
        console.log('[SEED] Successfully added', addedCount, 'new users');
    } else {
        console.log('[SEED] No new users to add');
    }

    return { success: true, added: addedCount, total: existingUsers.length };
}

// Run the seed
console.log('Starting user seeding...');
const result = seed_users();
console.log('Result:', result);
console.log('Users file location:', USERS_FILE);
console.log('File exists:', fs.existsSync(USERS_FILE));
