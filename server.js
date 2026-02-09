const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();

// Configure Outlook SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
        user: 'automation@maishabank.com',
        pass: 'test.test700'
    }
});
const PORT = 3003;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

console.log('[INIT] Server initializing on port', PORT);

// Ticket storage
const TICKETS_FILE = path.join(__dirname, 'tickets.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const ASSETS_FILE = path.join(__dirname, 'asset-register.json');

// Hash password utility
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Load users from file
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

// Save users to file
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('[SUCCESS] Saved', users.length, 'users');
    } catch (error) {
        console.error('[ERROR] Saving users:', error.message);
    }
}

// Load assets from file
function loadAssets() {
    try {
        if (fs.existsSync(ASSETS_FILE)) {
            const data = fs.readFileSync(ASSETS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Loading assets:', error.message);
    }
    return [];
}

// Save assets to file
function saveAssets(assets) {
    try {
        fs.writeFileSync(ASSETS_FILE, JSON.stringify(assets, null, 2));
        console.log('[SUCCESS] Saved', assets.length, 'asset owners');
    } catch (error) {
        console.error('[ERROR] Saving assets:', error.message);
    }
}

// Ensure asset register entries exist for each user
function syncAssetsWithUsers(users) {
    try {
        const assets = loadAssets();
        const ownersMap = new Map(assets.map(a => [String(a.owner_id), a]));
        let changed = false;

        for (const u of users) {
            const key = String(u.id);
            if (!ownersMap.has(key)) {
                const newOwner = {
                    owner_id: u.id,
                    owner_name: u.full_name,
                    owner_email: u.email,
                    assets: []
                };
                assets.push(newOwner);
                ownersMap.set(key, newOwner);
                changed = true;
                console.log('[ASSET] Created asset owner for user:', u.username, 'id=', u.id);
            }
        }

        if (changed) saveAssets(assets);
        return assets;
    } catch (e) {
        console.error('[ERROR] syncAssetsWithUsers', e.message);
        return [];
    }
}

// Get next numeric user ID (start from 123)
function getNextUserId() {
    try {
        const users = loadUsers();
        let max = 0; // start point so first id will be 1
        for (const u of users) {
            const idNum = Number(u.id);
            if (!Number.isNaN(idNum) && idNum > max) max = idNum;
        }
        return max + 1;
    } catch (e) {
        return 1;
    }
}

// Load tickets from file
function loadTickets() {
    try {
        if (fs.existsSync(TICKETS_FILE)) {
            const data = fs.readFileSync(TICKETS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Loading tickets:', error.message);
    }
    return [];
}

// Save tickets to file
function saveTickets(tickets) {
    try {
        fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
        console.log('[SUCCESS] Saved', tickets.length, 'tickets');
    } catch (error) {
        console.error('[ERROR] Saving tickets:', error.message);
    }
}

// Audit log storage
const AUDIT_FILE = path.join(__dirname, 'audit.json');

function loadAudit() {
    try {
        if (fs.existsSync(AUDIT_FILE)) {
            const data = fs.readFileSync(AUDIT_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Loading audit:', error.message);
    }
    return [];
}

function saveAudit(auditEntries) {
    try {
        fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditEntries, null, 2));
        console.log('[AUDIT] Saved', auditEntries.length, 'entries');
    } catch (error) {
        console.error('[ERROR] Saving audit:', error.message);
    }
}

function addAuditEntry(action, req, details) {
    try {
        const audits = loadAudit();
        const id = (crypto.randomUUID && crypto.randomUUID()) || crypto.createHash('sha1').update(String(Date.now()) + action).digest('hex');
        const entry = {
            id,
            timestamp: new Date().toISOString(),
            action,
            method: req?.method || 'unknown',
            path: req?.originalUrl || req?.path || 'unknown',
            ip: (req && (req.headers?.['x-forwarded-for'] || req.ip || (req.connection && req.connection.remoteAddress))) || 'unknown',
            details: details || {}
        };
        audits.push(entry);
        saveAudit(audits);
        console.log('[AUDIT] Recorded', action, entry.id);
    } catch (e) {
        console.error('[ERROR] addAuditEntry', e.message);
    }
}

// Email log storage
const EMAIL_LOG_FILE = path.join(__dirname, 'email-log.json');
const ADMIN_EMAIL = 'automation@maishabank.com';

function loadEmailLog() {
    try {
        if (fs.existsSync(EMAIL_LOG_FILE)) {
            const data = fs.readFileSync(EMAIL_LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Loading email log:', error.message);
    }
    return [];
}

function saveEmailLog(emails) {
    try {
        fs.writeFileSync(EMAIL_LOG_FILE, JSON.stringify(emails, null, 2));
        console.log('[EMAIL] Logged', emails.length, 'emails');
    } catch (error) {
        console.error('[ERROR] Saving email log:', error.message);
    }
}

function logEmail(to, subject, body, req) {
    try {
        const emails = loadEmailLog();
        const id = crypto.randomUUID ? crypto.randomUUID() : crypto.createHash('sha1').update(String(Date.now()) + to).digest('hex');
        
        // Send email via Outlook SMTP
        const mailOptions = {
            from: ADMIN_EMAIL,
            to: to,
            subject: subject,
            html: body
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('[EMAIL ERROR] Failed to send to', to, ':', error.message);
                // Log failed attempt
                const failedEntry = {
                    id,
                    timestamp: new Date().toISOString(),
                    from: ADMIN_EMAIL,
                    to,
                    subject,
                    body,
                    status: 'failed',
                    error: error.message
                };
                emails.push(failedEntry);
                saveEmailLog(emails);
            } else {
                console.log('[EMAIL] Sent successfully to', to, 'Subject:', subject);
                // Log successful email
                const entry = {
                    id,
                    timestamp: new Date().toISOString(),
                    from: ADMIN_EMAIL,
                    to,
                    subject,
                    body,
                    status: 'sent',
                    response: info.response
                };
                emails.push(entry);
                saveEmailLog(emails);
            }
        });
        
        // Also audit the email send
        addAuditEntry('email-sent', req, { to, subject, from: ADMIN_EMAIL });
    } catch (e) {
        console.error('[ERROR] logEmail', e.message);
    }
}

// Seed users function
function seed_users() {
    const users = [
        // ICT Department
        {"full_name": "Stevaniah Kavela", "username": "stevaniah", "email": "stevaniah@maishabank.com", "role": "ICT", "department": "ICT"},
        {"full_name": "Mercy Mukhwana", "username": "mercy", "email": "mercy@maishabank.com", "role": "ICT", "department": "ICT"},
        {"full_name": "Eric Mokaya", "username": "eric", "email": "eric@maishabank.com", "role": "ICT", "department": "ICT"},
        
        // Branch Department
        {"full_name": "Caroline Ngugi", "username": "caroline", "email": "caroline@maishabank.com", "role": "Operations", "department": "Branch"},
        {"full_name": "Lilian Kimani", "username": "lilian", "email": "lilian@maishabank.com", "role": "Operations", "department": "Branch"},
        {"full_name": "Maureen Kerubo", "username": "maureen", "email": "maureen@maishabank.com", "role": "Operations", "department": "Branch"},
        {"full_name": "Alice Muthoni", "username": "alice", "email": "alice@maishabank.com", "role": "Operations", "department": "Branch"},
        {"full_name": "Michael Mureithi", "username": "michael", "email": "michael@maishabank.com", "role": "Operations", "department": "Branch"},

        // Finance Department
        {"full_name": "Patrick Ndegwa", "username": "patrick", "email": "patrick@maishabank.com", "role": "Finance Officer", "department": "Finance"},
        {"full_name": "Margaret Njeri", "username": "margaret", "email": "margaret@maishabank.com", "role": "Finance Officer", "department": "Finance"},
        {"full_name": "Elizabeth Mungai", "username": "elizabeth", "email": "elizabeth@maishabank.com", "role": "Finance Officer", "department": "Finance"},

        // Customer Service
        {"full_name": "Ebby Gesare", "username": "ebby", "email": "ebby@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Vivian Orisa", "username": "vivian", "email": "vivian@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Juliana Jeptoo", "username": "juliana", "email": "juliana@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Faith Bonareri", "username": "faith", "email": "faith@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Patience Mutunga", "username": "patience", "email": "patience@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Eva Mukami", "username": "eva", "email": "eva@maishabank.com", "role": "Customer Service", "department": "Customer Service"},
        {"full_name": "Peter Kariuki", "username": "peter", "email": "peter@maishabank.com", "role": "Customer Service", "department": "Customer Service"},

        // Admin
        {"full_name": "Admin", "username": "admin", "email": "admin@maishabank.com", "role": "Admin", "department": "Admin"}
    ];

    const existingUsers = loadUsers();
    const existingUsernames = new Set(existingUsers.map(u => u.username));
    
    let addedCount = 0;
    const defaultPassword = "Password123!";
    const hashedPassword = hashPassword(defaultPassword);

    for (const userData of users) {
        // Ensure email follows first.last@maishabank.com
        const parts = (userData.full_name || '').trim().toLowerCase().split(/\s+/);
        const emailLocal = parts.join('.');
        userData.email = `${emailLocal}@maishabank.com`;

        // Check if user already exists
        if (!existingUsernames.has(userData.username)) {
            const newId = getNextUserId();
            const userObj = {
                id: newId,
                ...userData,
                password: hashedPassword,
                created_at: new Date().toISOString(),
                active: true
            };
            existingUsers.push(userObj);
            addedCount++;
            console.log('[SEED] Added user:', userData.username, 'id=', newId);
        } else {
            console.log('[SKIP] User already exists:', userData.username);
        }
    }

    if (addedCount > 0) {
        saveUsers(existingUsers);
        // ensure asset register entries exist for seeded users
        syncAssetsWithUsers(existingUsers);
        console.log('[SEED] Successfully added', addedCount, 'new users');
    } else {
        console.log('[SEED] No new users to add');
    }

    return { success: true, added: addedCount, total: existingUsers.length };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('[HEALTH] Health check');
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Get all tickets
app.get('/api/tickets', (req, res) => {
    try {
        console.log('[GET] Fetching tickets');
        const tickets = loadTickets();
        console.log('[GET] Returning', tickets.length, 'tickets');
        res.json({
            success: true,
            tickets: tickets
        });
    } catch (error) {
        console.error('[ERROR] Getting tickets:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get tickets'
        });
    }
});

// Create ticket
app.post('/api/tickets', (req, res) => {
    try {
        console.log('[POST] Creating new ticket');
        const ticketData = req.body;
        console.log('[DATA] Received ticket:', ticketData.id);
        
        // Load existing tickets
        const tickets = loadTickets();
        console.log('[DB] Loaded', tickets.length, 'existing tickets');
        
        // Add new ticket
        tickets.push(ticketData);
        console.log('[ADD] Added ticket, new count:', tickets.length);
        
        // Save to file
        saveTickets(tickets);
        
        // Return success
        console.log('[SUCCESS] Ticket created:', ticketData.id);
        res.status(201).json({
            success: true,
            ticket: ticketData,
            message: 'Ticket created successfully'
        });
    } catch (error) {
        console.error('[ERROR] Creating ticket:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket',
            error: error.message
        });
    }
});

// Update ticket
app.put('/api/tickets/:id', (req, res) => {
    try {
        const ticketId = req.params.id;
        const updates = req.body;
        console.log('[PUT] Updating ticket:', ticketId);
        
        const tickets = loadTickets();
        const index = tickets.findIndex(t => t.id === ticketId);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }
        
        tickets[index] = { ...tickets[index], ...updates };
        saveTickets(tickets);
        
        console.log('[SUCCESS] Ticket updated:', ticketId);
        res.json({
            success: true,
            ticket: tickets[index],
            message: 'Ticket updated successfully'
        });
    } catch (error) {
        console.error('[ERROR] Updating ticket:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to update ticket'
        });
    }
});

// ===== USER MANAGEMENT ENDPOINTS =====

// Seed users
app.post('/api/seed-users', (req, res) => {
    try {
        console.log('[SEED] Starting user seeding');
        const result = seed_users();
        // audit seed action
        addAuditEntry('seed-users', req, { added: result.added, total: result.total });

        res.json({
            success: true,
            message: `Seeding complete: ${result.added} users added, ${result.total} total users`,
            ...result
        });
    } catch (error) {
        console.error('[ERROR] Seeding users:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to seed users',
            error: error.message
        });
    }
});

// Get all users
app.get('/api/users', (req, res) => {
    try {
        console.log('[GET] Fetching users');
        const users = loadUsers();
        // Don't send passwords to frontend
        const safeUsers = users.map(u => ({
            id: u.id,
            full_name: u.full_name,
            username: u.username,
            email: u.email,
            role: u.role,
            department: u.department,
            active: u.active,
            created_at: u.created_at
        }));
        res.json({
            success: true,
            users: safeUsers
        });
    } catch (error) {
        console.error('[ERROR] Getting users:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get users'
        });
    }
});

// Get audit log entries (admin)
app.get('/api/audit', (req, res) => {
    try {
        const audits = loadAudit();
        res.json({ success: true, audits });
    } catch (error) {
        console.error('[ERROR] Getting audit logs:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get audit logs' });
    }
});

// Get available audit activities
app.get('/api/audit/activities', (req, res) => {
    const activities = ['login', 'failed-login', 'seed-users', 'create-user', 'update-user', 'delete-user', 'update-role', 'reset-passwords', 'approval-approved', 'approval-rejected', 'workflow-created', 'email-sent'];
    res.json({ success: true, activities });
});

// Approve leave request (sends email to user)
app.post('/api/leave/approve', (req, res) => {
    try {
        const { leaveId, userEmail, userName, leaveType, days, approvalNotes } = req.body;
        console.log('[LEAVE] Approving leave for', userEmail);
        
        if (!userEmail || !leaveType) {
            return res.status(400).json({ success: false, message: 'Email and leave type required' });
        }
        
        // Send approval email to user
        const subject = `Leave Request Approved - ${leaveType}`;
        const body = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background-color: white; padding: 20px; border: 1px solid #ddd; }
                    .details { margin: 20px 0; background-color: #f0f8f0; padding: 15px; border-left: 4px solid #28a745; border-radius: 3px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { font-weight: bold; color: #555; }
                    .detail-value { color: #333; text-align: right; }
                    .status-approved { color: #28a745; font-weight: bold; font-size: 16px; }
                    .footer { text-align: center; color: #777; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
                    .logo { font-weight: bold; color: #28a745; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✓ Leave Request Approved</h2>
                    </div>
                    <div class="content">
                        <p>Dear <strong>${userName || userEmail}</strong>,</p>
                        <p>We are pleased to inform you that your leave request has been <span class="status-approved">APPROVED</span>.</p>
                        
                        <div class="details">
                            <div class="detail-row">
                                <span class="detail-label">Leave Type:</span>
                                <span class="detail-value">${leaveType}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Duration:</span>
                                <span class="detail-value">${days} day(s)</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value status-approved">APPROVED</span>
                            </div>
                            ${approvalNotes ? `<div class="detail-row">
                                <span class="detail-label">Comments:</span>
                                <span class="detail-value">${approvalNotes}</span>
                            </div>` : ''}
                        </div>
                        
                        <p>Your leave has been officially approved and recorded in the system. You may proceed with making your travel arrangements if necessary.</p>
                        <p>If you have any questions or concerns, please contact the Human Resources department.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from <span class="logo">Maisha Bank</span></p>
                        <p>Sent from: automation@maishabank.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        logEmail(userEmail, subject, body, req);
        
        // Audit the approval
        addAuditEntry('leave-approved', req, { userEmail, leaveType, days });
        
        res.json({ 
            success: true, 
            message: `Leave approved and email sent to ${userEmail}` 
        });
    } catch (error) {
        console.error('[ERROR] Approving leave:', error.message);
        res.status(500).json({ success: false, message: 'Failed to approve leave' });
    }
});

// Reject leave request (sends email to user)
app.post('/api/leave/reject', (req, res) => {
    try {
        const { leaveId, userEmail, userName, leaveType, reason } = req.body;
        console.log('[LEAVE] Rejecting leave for', userEmail);
        
        if (!userEmail || !reason) {
            return res.status(400).json({ success: false, message: 'Email and reason required' });
        }
        
        // Send rejection email to user
        const subject = `Leave Request Rejected - ${leaveType}`;
        const body = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
                    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background-color: white; padding: 20px; border: 1px solid #ddd; }
                    .details { margin: 20px 0; background-color: #ffe6e6; padding: 15px; border-left: 4px solid #dc3545; border-radius: 3px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { font-weight: bold; color: #555; }
                    .detail-value { color: #333; text-align: right; }
                    .status-rejected { color: #dc3545; font-weight: bold; font-size: 16px; }
                    .reason-box { background-color: #fff3cd; border-left: 4px solid #ff9800; padding: 12px; margin: 15px 0; border-radius: 3px; }
                    .reason-label { font-weight: bold; color: #856404; margin-bottom: 8px; }
                    .footer { text-align: center; color: #777; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
                    .logo { font-weight: bold; color: #dc3545; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✗ Leave Request Rejected</h2>
                    </div>
                    <div class="content">
                        <p>Dear <strong>${userName || userEmail}</strong>,</p>
                        <p>We regret to inform you that your leave request has been <span class="status-rejected">REJECTED</span>.</p>
                        
                        <div class="details">
                            <div class="detail-row">
                                <span class="detail-label">Leave Type:</span>
                                <span class="detail-value">${leaveType}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value status-rejected">REJECTED</span>
                            </div>
                        </div>
                        
                        <div class="reason-box">
                            <div class="reason-label">Reason for Rejection:</div>
                            <p>${reason}</p>
                        </div>
                        
                        <p>If you would like to discuss this decision or have any questions, please reach out to the Human Resources department or your line manager.</p>
                        <p>You may also consider resubmitting your leave request for alternative dates.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from <span class="logo">Maisha Bank</span></p>
                        <p>Sent from: automation@maishabank.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        logEmail(userEmail, subject, body, req);
        
        // Audit the rejection
        addAuditEntry('leave-rejected', req, { userEmail, leaveType, reason });
        
        res.json({ 
            success: true, 
            message: `Leave rejected and email sent to ${userEmail}` 
        });
    } catch (error) {
        console.error('[ERROR] Rejecting leave:', error.message);
        res.status(500).json({ success: false, message: 'Failed to reject leave' });
    }
});

// Get email log
app.get('/api/emails', (req, res) => {
    try {
        const emails = loadEmailLog();
        res.json({ success: true, emails });
    } catch (error) {
        console.error('[ERROR] Getting email logs:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get email logs' });
    }
});

// Create/update user
app.post('/api/users', (req, res) => {
    try {
        const { id, full_name, username, email, role, department, password } = req.body;
        console.log('[POST] Creating/updating user:', username);
        
        const users = loadUsers();
        const userId = id ? Number(id) : undefined;
        
        // Check for duplicate username (if new user)
        if (!userId && users.some(u => u.username === username)) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        // Check for duplicate email (if new user)
        if (!userId && users.some(u => u.email === email)) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        const existingUser = users.find(u => Number(u.id) === userId);
        const userObj = {
            id: userId || getNextUserId(),
            full_name,
            username,
            email,
            role,
            department,
            password: password ? hashPassword(password) : (existingUser?.password || hashPassword("Password123!")),
            active: true,
            created_at: existingUser?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (userId) {
            // Update existing user
            const index = users.findIndex(u => Number(u.id) === userId);
            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            users[index] = userObj;
            console.log('[UPDATE] Updated user:', username);
        } else {
            // Create new user
            users.push(userObj);
            console.log('[CREATE] Created user:', username, 'id=', userObj.id);
        }

        saveUsers(users);
        // synchronize asset register with updated users
        syncAssetsWithUsers(users);
        // audit create/update user
        addAuditEntry(userId ? 'update-user' : 'create-user', req, {
            id: userObj.id,
            username: userObj.username,
            email: userObj.email
        });

        res.json({
            success: true,
            user: {
                id: userObj.id,
                full_name: userObj.full_name,
                username: userObj.username,
                email: userObj.email,
                role: userObj.role,
                department: userObj.department
            },
            message: id ? 'User updated successfully' : 'User created successfully'
        });
    } catch (error) {
        console.error('[ERROR] Creating/updating user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to save user',
            error: error.message
        });
    }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    try {
        const userId = req.params.id;
        console.log('[DELETE] Deleting user:', userId);
        
        const users = loadUsers();
        const idNum = Number(userId);
        const index = users.findIndex(u => Number(u.id) === idNum);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const deletedUser = users.splice(index, 1)[0];
        saveUsers(users);
        // audit delete user
        addAuditEntry('delete-user', req, { id: deletedUser.id, username: deletedUser.username, email: deletedUser.email });

        console.log('[SUCCESS] User deleted:', deletedUser.username);
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('[ERROR] Deleting user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});

// Update user role
app.put('/api/users/update-role', (req, res) => {
    try {
        const { email, role } = req.body;
        console.log('[PUT] Updating role for:', email, 'to', role);
        
        if (!email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email and role required'
            });
        }
        
        const users = loadUsers();
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.role = role;
        saveUsers(users);

        // Send email notification about role change
        const subject = `Your Role Has Been Updated`;
        const body = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
                    .header { background-color: #0056b3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                    .content { background-color: white; padding: 20px; border: 1px solid #ddd; }
                    .role-box { margin: 20px 0; background-color: #e3f2fd; padding: 15px; border-left: 4px solid #0056b3; border-radius: 3px; }
                    .role-label { font-weight: bold; color: #0056b3; margin-bottom: 8px; }
                    .role-value { font-size: 18px; font-weight: bold; color: #0056b3; }
                    .footer { text-align: center; color: #777; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
                    .logo { font-weight: bold; color: #0056b3; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Role Update Notification</h2>
                    </div>
                    <div class="content">
                        <p>Dear <strong>${user.full_name || email}</strong>,</p>
                        <p>We are writing to inform you that your role in the system has been updated.</p>
                        
                        <div class="role-box">
                            <div class="role-label">Your New Role:</div>
                            <div class="role-value">${role}</div>
                        </div>
                        
                        <p><strong>Important:</strong> This change is effective immediately. Your access permissions and system capabilities have been updated accordingly.</p>
                        
                        <p>With your new role, you may have access to additional features and responsibilities. Please review your new permissions and contact your administrator if you have any questions about your updated role or any concerns.</p>
                        
                        <p>For any assistance or clarification, please reach out to the Human Resources or IT department.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from <span class="logo">Maisha Bank</span></p>
                        <p>Sent from: automation@maishabank.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        logEmail(email, subject, body, req);

        // audit role update
        addAuditEntry('update-role', req, { email: user.email, role: user.role });

        console.log('[SUCCESS] Role updated for:', email, 'to', role);
        res.json({
            success: true,
            message: 'Role updated successfully',
            user: {
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('[ERROR] Updating role:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to update role'
        });
    }
});

// Authenticate user (email + password)
app.post('/api/auth', (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

        const users = loadUsers();
        const user = users.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
        if (!user) {
            // audit failed login
            addAuditEntry('failed-login', req, { email, reason: 'User not found' });
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const hashed = hashPassword(password);
        if (user.password !== hashed) {
            // audit failed login
            addAuditEntry('failed-login', req, { email, reason: 'Invalid password' });
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // audit successful login
        addAuditEntry('login', req, { email: user.email, username: user.username, role: user.role });

        // return safe user object
        const safe = {
            id: user.id,
            full_name: user.full_name,
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department
        };

        return res.json({ success: true, user: safe });
    } catch (error) {
        console.error('[ERROR] Authenticating user:', error.message);
        res.status(500).json({ success: false, message: 'Authentication failed' });
    }
});

// Reset passwords for all users (admin endpoint)
app.post('/api/reset-passwords', (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password || String(password).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        console.log('[ADMIN] Resetting passwords for all users');
        const users = loadUsers();
        const hashed = hashPassword(String(password));

        const updated = users.map(u => ({
            ...u,
            password: hashed,
            updated_at: new Date().toISOString()
        }));

        saveUsers(updated);
        // Keep asset register in sync
        syncAssetsWithUsers(updated);

        // audit reset passwords action
        addAuditEntry('reset-passwords', req, { updated: updated.length });

        console.log('[ADMIN] Passwords reset for', updated.length, 'users');
        return res.json({ success: true, updated: updated.length, message: 'Passwords updated' });
    } catch (error) {
        console.error('[ERROR] Resetting passwords:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to reset passwords' });
    }
});

// 404 handler
app.use((req, res) => {
    console.log('[404] Not found:', req.method, req.path);
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[EXCEPTION]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('[LISTEN] Server running on port', PORT);
    console.log('[READY] Ready to accept connections');
});

// Handle server errors
server.on('error', (err) => {
    console.error('[SERVER_ERROR]', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('[CRASH]', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('[REJECTION]', err);
});

console.log('[BOOT] Server boot sequence complete');
