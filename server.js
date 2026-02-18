const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();

// Configure Outlook SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
        // user: 'automation@maishabank.com',
        // pass: 'test.test700'
    }
});
const PORT = 3003;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

console.log('[INIT] Server initializing on port', PORT);

// Hash password utility
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Load users from PostgreSQL
async function loadUsers() {
    try {
        const result = await db.query('SELECT * FROM users ORDER BY id');
        return result.rows;
    } catch (error) {
        console.error('[ERROR] Loading users:', error.message);
    }
    return [];
}

// Save users to PostgreSQL
async function saveUsers(users) {
    try {
        for (const user of users) {
            await db.query(
                `INSERT INTO users (id, full_name, username, email, role, department, password, created_at, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET 
                 full_name=$2, username=$3, email=$4, role=$5, department=$6, password=$7, active=$9`,
                [user.id, user.full_name, user.username, user.email, user.role, user.department, user.password, user.created_at, user.active]
            );
        }
        console.log('[SUCCESS] Saved', users.length, 'users');
    } catch (error) {
        console.error('[ERROR] Saving users:', error.message);
    }
}

// Load assets from PostgreSQL
async function loadAssets() {
    try {
        const result = await db.query('SELECT * FROM asset_register ORDER BY owner_id');
        return result.rows;
    } catch (error) {
        console.error('[ERROR] Loading assets:', error.message);
    }
    return [];
}

// Save assets to PostgreSQL
async function saveAssets(assets) {
    try {
        for (const asset of assets) {
            await db.query(
                `INSERT INTO asset_register (owner_id, owner_name, owner_email, assets) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (owner_id) DO UPDATE SET 
                 owner_name=$2, owner_email=$3, assets=$4`,
                [asset.owner_id, asset.owner_name, asset.owner_email, JSON.stringify(asset.assets || [])]
            );
        }
        console.log('[SUCCESS] Saved', assets.length, 'asset owners');
    } catch (error) {
        console.error('[ERROR] Saving assets:', error.message);
    }
}

// Ensure asset register entries exist for each user
// Load tickets from PostgreSQL
async function loadTickets() {
    try {
        const result = await db.query('SELECT * FROM tickets ORDER BY timestamp DESC');
        return result.rows;
    } catch (error) {
        console.error('[ERROR] Loading tickets:', error.message);
    }
    return [];
}

// Save tickets to PostgreSQL
async function saveTickets(tickets) {
    try {
        for (const ticket of tickets) {
            await db.query(
                `INSERT INTO tickets (id, timestamp, priority, to_dept, assigned_to, sla_due, status, escalated, name, email, from_dept, ticket_type, issue_type, description, attachment, category) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (id) DO UPDATE SET 
                 priority=$3, to_dept=$4, assigned_to=$5, sla_due=$6, status=$7, escalated=$8, name=$9, email=$10, from_dept=$11, ticket_type=$12, issue_type=$13, description=$14, attachment=$15, category=$16`,
                [ticket.id, ticket.timestamp, ticket.priority, ticket.toDept, ticket.assigned_to, ticket.sla_due, ticket.status, ticket.escalated, ticket.name, ticket.email, ticket.fromDept, ticket.ticketType, ticket.issueType, ticket.description, ticket.attachment, ticket.category]
            );
        }
        console.log('[SUCCESS] Saved', tickets.length, 'tickets');
    } catch (error) {
        console.error('[ERROR] Saving tickets:', error.message);
    }
}

// Audit log storage
function addAuditEntry(action, req, details) {
    try {
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
        
        db.query(
            `INSERT INTO audit_logs (timestamp, action, method, path, ip, details) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [entry.timestamp, entry.action, entry.method, entry.path, entry.ip, JSON.stringify(entry.details)]
        ).catch(e => console.error('[DB ERROR] Audit:', e.message));
        
        console.log('[AUDIT] Recorded', action, entry.id);
    } catch (e) {
        console.error('[ERROR] addAuditEntry', e.message);
    }
}

// Email log storage
const EMAIL_LOG_FILE = path.join(__dirname, 'email-log.json');
const ADMIN_EMAIL = 'automation@maishabank.com';

function logEmail(to, subject, body, req) {
    try {
        const id = crypto.randomUUID ? crypto.randomUUID() : crypto.createHash('sha1').update(String(Date.now()) + to).digest('hex');
        
        // Send email via Outlook SMTP
        const mailOptions = {
            from: ADMIN_EMAIL,
            to: to,
            subject: subject,
            html: body
        };
        
        /* EMAIL SENDING DISABLED
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
                db.query(
                    `INSERT INTO email_logs (id, timestamp, "from", "to", subject, body, status) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, new Date().toISOString(), ADMIN_EMAIL, to, subject, body.substring(0, 500), 'failed']
                ).catch(e => console.error('[DB ERROR]', e.message));
            } else {
                console.log('[EMAIL] Sent successfully to', to, 'Subject:', subject);
                // Log successful email
                db.query(
                    `INSERT INTO email_logs (id, timestamp, "from", "to", subject, body, status) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, new Date().toISOString(), ADMIN_EMAIL, to, subject, body.substring(0, 500), 'sent']
                ).catch(e => console.error('[DB ERROR]', e.message));
            }
        });
        */
        
        // Log email attempt to database
        db.query(
            `INSERT INTO email_logs (id, timestamp, "from", "to", subject, body, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, new Date().toISOString(), ADMIN_EMAIL, to, subject, body.substring(0, 500), 'pending']
        ).catch(e => console.error('[DB ERROR] Logging email:', e.message));
        
        // Also audit the email send
        addAuditEntry('email-sent', req, { to, subject, from: ADMIN_EMAIL });
    } catch (e) {
        console.error('[ERROR] logEmail', e.message);
    }
}

// Seed users function
async function seed_users() {
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

    const existingUsers = await loadUsers();
    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
    
    let addedCount = 0;
    // default password for new records (temporary). change as needed.
    const defaultPassword = "1234";
    const hashedPassword = hashPassword(defaultPassword);

    for (const userData of users) {
        // Ensure email follows first.last@maishabank.com
        const parts = (userData.full_name || '').trim().toLowerCase().split(/\s+/);
        const emailLocal = parts.join('.');
        userData.email = `${emailLocal}@maishabank.com`;

        // Check if user already exists (by email)
        if (!existingEmails.has(userData.email.toLowerCase())) {
            try {
                // Get next ID from database
                const result = await db.query('SELECT MAX(id) as max_id FROM users');
                const nextId = (result.rows[0]?.max_id || 0) + 1;
                
                const userObj = {
                    id: nextId,
                    ...userData,
                    password: hashedPassword,
                    created_at: new Date().toISOString(),
                    active: true
                };
                
                await db.query(
                    `INSERT INTO users (full_name, username, email, role, department, password, created_at, active) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [userObj.full_name, userObj.username, userObj.email, userObj.role, userObj.department, userObj.password, userObj.created_at, userObj.active]
                );
                
                addedCount++;
                console.log('[SEED] Added user:', userData.username, 'id=', nextId);
            } catch (e) {
                console.error('[SEED ERROR] Adding user', userData.username, ':', e.message);
            }
        } else {
            console.log('[SKIP] User already exists:', userData.username);
        }
    }

    const totalResult = await db.query('SELECT COUNT(*) as count FROM users');
    const totalCount = totalResult.rows[0]?.count || 0;

    console.log('[SEED] Successfully added', addedCount, 'new users');
    return { success: true, added: addedCount, total: totalCount };
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
app.get('/api/tickets', async (req, res) => {
    try {
        console.log('[GET] Fetching tickets with filters', req.query);

        // Support query params: startDate, endDate (ISO), email, name, fromDept, toDept, status
        const { startDate, endDate, email, name, fromDept, toDept, status } = req.query;
        const whereClauses = [];
        const params = [];

        if (startDate) {
            params.push(startDate);
            whereClauses.push(`timestamp >= $${params.length}`);
        }
        if (endDate) {
            params.push(endDate);
            whereClauses.push(`timestamp <= $${params.length}`);
        }
        if (email) {
            params.push(email);
            whereClauses.push(`email = $${params.length}`);
        }
        if (name) {
            params.push(`%${name}%`);
            whereClauses.push(`name ILIKE $${params.length}`);
        }
        if (fromDept) {
            params.push(fromDept);
            whereClauses.push(`from_dept = $${params.length}`);
        }
        if (toDept) {
            params.push(toDept);
            whereClauses.push(`to_dept = $${params.length}`);
        }
        if (status) {
            params.push(status);
            whereClauses.push(`status = $${params.length}`);
        }

        let sql = 'SELECT * FROM tickets';
        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        sql += ' ORDER BY timestamp DESC';

        const result = await db.query(sql, params);
        console.log('[GET] Returning', result.rows.length, 'tickets');
        res.json({ success: true, tickets: result.rows });
    } catch (error) {
        console.error('[ERROR] Getting tickets:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get tickets'
        });
    }
});

// Claims endpoints
app.get('/api/claims', async (req, res) => {
    try {
        const { email, claimant, status } = req.query;
        const where = [];
        const params = [];
        if (email) { params.push(email); where.push(`email = $${params.length}`); }
        if (claimant) { params.push(`%${claimant}%`); where.push(`claimant ILIKE $${params.length}`); }
        if (status) { params.push(status); where.push(`status = $${params.length}`); }

        let sql = 'SELECT * FROM expense_claims';
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY created_at DESC';

        const result = await db.query(sql, params);
        res.json({ success: true, claims: result.rows });
    } catch (error) {
        console.error('[ERROR] GET /api/claims', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch claims' });
    }
});

app.post('/api/claims', async (req, res) => {
    try {
        const c = req.body;
        const id = c.id || (`CLM-${Date.now().toString(36)}`);
        await db.query(
            `INSERT INTO expense_claims (id, claimant, email, type, amount, description, status, workflow_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET claimant=EXCLUDED.claimant, email=EXCLUDED.email, type=EXCLUDED.type, amount=EXCLUDED.amount, description=EXCLUDED.description, status=EXCLUDED.status, workflow_id=EXCLUDED.workflow_id, metadata=EXCLUDED.metadata`,
            [id, c.claimant || c.claimantName || null, c.email || null, c.type || null, c.amount || null, c.description || null, c.status || 'pending', c.workflow_id || c.workflowId || null, c.metadata || {}]
        );
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('[ERROR] POST /api/claims', error.message);
        res.status(500).json({ success: false, message: 'Failed to create claim' });
    }
});

// Disbursements endpoints
app.get('/api/disbursements', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM claim_disbursements ORDER BY completed_date DESC');
        res.json({ success: true, disbursements: result.rows });
    } catch (error) {
        console.error('[ERROR] GET /api/disbursements', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch disbursements' });
    }
});

app.post('/api/disbursements', async (req, res) => {
    try {
        const d = req.body;
        const id = d.id || (`DISB-${Date.now().toString(36)}`);
        await db.query(
            `INSERT INTO claim_disbursements (id, claim_id, amount, teller, branch, status, completed_date, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [id, d.claim_id, d.amount || null, d.teller || null, d.branch || null, d.status || 'pending', d.completed_date || null, d.metadata || {}]
        );
        // If disbursement is completed, update claim status
        if (d.status === 'completed' || d.status === 'disbursed') {
            await db.query('UPDATE expense_claims SET status=$2 WHERE id=$1', [d.claim_id, 'disbursed']);
        }
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('[ERROR] POST /api/disbursements', error.message);
        res.status(500).json({ success: false, message: 'Failed to create disbursement' });
    }
});

// Leave balances endpoints
app.get('/api/leave-balances', async (req, res) => {
    try {
        const result = await db.query('SELECT lb.user_id, lb.balance, lb.last_updated, u.full_name, u.email FROM leave_balances lb JOIN users u ON u.id = lb.user_id ORDER BY u.full_name');
        res.json({ success: true, balances: result.rows });
    } catch (error) {
        console.error('[ERROR] GET /api/leave-balances', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch leave balances' });
    }
});

// Recompute leave balances from approved leave requests and stored balances
app.post('/api/leave-balances/recompute', async (req, res) => {
    try {
        console.log('[POST] Recomputing leave balances on demand');
        const result = await db.recomputeLeaveBalances();
        addAuditEntry('recompute-leave-balances', req, { updated: result.updated });
        res.json({ success: true, message: 'Recomputed leave balances', updated: result.updated });
    } catch (error) {
        console.error('[ERROR] POST /api/leave-balances/recompute', error.message);
        res.status(500).json({ success: false, message: 'Failed to recompute leave balances' });
    }
});

app.put('/api/leave-balances/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { balance } = req.body;
        await db.query(`INSERT INTO leave_balances (user_id, balance, last_updated) VALUES ($1,$2,NOW()) ON CONFLICT (user_id) DO UPDATE SET balance = $2, last_updated = NOW()`, [userId, balance]);
        res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] PUT /api/leave-balances', error.message);
        res.status(500).json({ success: false, message: 'Failed to set leave balance' });
    }
});

// Create ticket
app.post('/api/tickets', async (req, res) => {
    try {
        console.log('[POST] Creating new ticket');
        const ticketData = req.body;
        console.log('[DATA] Received ticket:', ticketData.id);
        
        // Add ticket to database
        await db.query(
            `INSERT INTO tickets (id, timestamp, priority, to_dept, assigned_to, sla_due, status, escalated, name, email, from_dept, ticket_type, issue_type, description, attachment, category) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [ticketData.id, ticketData.timestamp, ticketData.priority, ticketData.toDept, ticketData.assigned_to, ticketData.sla_due, ticketData.status, ticketData.escalated, ticketData.name, ticketData.email, ticketData.fromDept, ticketData.ticketType, ticketData.issueType, ticketData.description, ticketData.attachment, ticketData.category]
        );
        
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
app.put('/api/tickets/:id', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const updates = req.body;
        console.log('[PUT] Updating ticket:', ticketId);
        
        const result = await db.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }
        
        const ticket = result.rows[0];
        const updated = { ...ticket, ...updates };
        
        await db.query(
            `UPDATE tickets SET priority=$2, to_dept=$3, assigned_to=$4, sla_due=$5, status=$6, escalated=$7, name=$8, email=$9, from_dept=$10, ticket_type=$11, issue_type=$12, description=$13, attachment=$14, category=$15 WHERE id=$1`,
            [ticketId, updated.priority, updated.to_dept || updated.toDept, updated.assigned_to, updated.sla_due, updated.status, updated.escalated, updated.name, updated.email, updated.from_dept || updated.fromDept, updated.ticket_type || updated.ticketType, updated.issue_type || updated.issueType, updated.description, updated.attachment, updated.category]
        );
        
        console.log('[SUCCESS] Ticket updated:', ticketId);
        res.json({
            success: true,
            ticket: updated,
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
// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await loadUsers();
        res.json({ success: true, users });
    } catch (error) {
        console.error('[ERROR] Getting users:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get users' });
    }
});

// Seed users
app.post('/api/seed-users', async (req, res) => {
    try {
        console.log('[SEED] Starting user seeding');
        const result = await seed_users();
        // audit seed action
        addAuditEntry('seed-users', req, { added: result.added, total: result.total });

        res.json({
            success: true,
            message: `Seeding complete: ${result.added} users added, ${result.total} total users`,
            ...result
        });
    } catch (error) {
        console.error('[ERROR] Seeding users:', error.message);
        res.status(500).json({ success: false, message: 'Failed to seed users' });
    }
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
        
        // Update leave_requests status to approved if leaveId provided
        if (leaveId) {
            db.query('UPDATE leave_requests SET status=$2 WHERE id=$1', [leaveId, 'approved']).catch(e => console.error('[DB ERROR] Updating leave_requests status:', e.message));
        }

        // Update leave_balances for the user (subtract used days from the appropriate balance type)
        (async () => {
            try {
                // Find user id by email
                const ures = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [userEmail]);
                let userId = ures.rows[0]?.id;

                // If user not in users table, try to find leave_balances by email via join
                if (!userId) {
                    console.warn('[LEAVE] User email not found in users table:', userEmail);
                }

                // Fetch existing balances (if any) by user_id
                let balances = null;
                if (userId) {
                    const lb = await db.query('SELECT balances FROM leave_balances WHERE user_id = $1', [userId]);
                    if (lb.rows.length > 0 && lb.rows[0].balances) balances = lb.rows[0].balances;
                }

                // If not found, fall back to default template
                if (!balances) balances = { annual: 25, sick: 10, personal: 5, maternity: 0, paternity: 0 };

                // Normalize leave type key
                const t = String(leaveType || '').toLowerCase();
                const used = Number(days) || 0;

                if (t.includes('annual')) balances.annual = Math.max(0, (Number(balances.annual) || 0) - used);
                else if (t.includes('sick')) balances.sick = Math.max(0, (Number(balances.sick) || 0) - used);
                else if (t.includes('personal')) balances.personal = Math.max(0, (Number(balances.personal) || 0) - used);
                else if (t.includes('maternity')) balances.maternity = Math.max(0, (Number(balances.maternity) || 0) - used);
                else if (t.includes('paternity')) balances.paternity = Math.max(0, (Number(balances.paternity) || 0) - used);
                else balances[t] = Math.max(0, (Number(balances[t]) || 0) - used);

                if (userId) {
                    await db.query(`INSERT INTO leave_balances (user_id, balance, last_updated, balances) VALUES ($1, $2, NOW(), $3) ON CONFLICT (user_id) DO UPDATE SET balances = EXCLUDED.balances, last_updated = NOW()`, [userId, 0, balances]);
                    console.log('[LEAVE] Updated leave_balances for user id', userId);
                } else {
                    console.log('[LEAVE] Skipped DB update for leave_balances because user id not found for', userEmail);
                }
            } catch (e) {
                console.error('[LEAVE ERROR] Failed to update leave balances:', e.message);
            }
        })();

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
app.get('/api/emails', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM email_logs ORDER BY timestamp DESC LIMIT 100');
        res.json({ success: true, emails: result.rows });
    } catch (error) {
        console.error('[ERROR] Getting email logs:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get email logs' });
    }
});

// Create/update user
app.post('/api/users', async (req, res) => {
    try {
        const { id, full_name, username, email, role, department, password } = req.body;
        console.log('[POST] Creating/updating user:', username);
        
        const users = await loadUsers();
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
            id: userId || (Math.max(...users.map(u => Number(u.id) || 0)) + 1),
            full_name,
            username,
            email,
            role,
            department,
            password: password ? hashPassword(password) : (existingUser?.password)
        };

        if (existingUser) {
            await db.query(
                `UPDATE users SET full_name=$2, username=$3, email=$4, role=$5, department=$6 WHERE id=$1`,
                [userObj.id, userObj.full_name, userObj.username, userObj.email, userObj.role, userObj.department]
            );
        } else {
            await db.query(
                `INSERT INTO users (full_name, username, email, role, department, password, created_at, active) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userObj.full_name, userObj.username, userObj.email, userObj.role, userObj.department, userObj.password, new Date().toISOString(), true]
            );
        }
        
        // audit create/update user
        addAuditEntry(userId ? 'update-user' : 'create-user', req, {
            id: userObj.id,
            username: userObj.username,
            email: userObj.email
        });

        // Ensure leave_balances row exists for this user with default balances
        try {
            const found = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [userObj.email]);
            const insertedId = found.rows[0]?.id;
            if (insertedId) {
                const lb = await db.query('SELECT user_id FROM leave_balances WHERE user_id = $1', [insertedId]);
                if (lb.rows.length === 0) {
                    const defaultBalances = { annual: 25, sick: 10, personal: 5, maternity: 0, paternity: 0 };
                    await db.query('INSERT INTO leave_balances (user_id, balance, last_updated, balances) VALUES ($1, $2, NOW(), $3) ON CONFLICT (user_id) DO NOTHING', [insertedId, 0, defaultBalances]);
                    console.log('[USER] Created default leave_balances for user id', insertedId);
                }
            }
        } catch (e) {
            console.error('[USER] Failed to ensure leave_balances for user', userObj.email, e.message);
        }

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
app.delete('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        console.log('[DELETE] Deleting user:', userId);
        
        const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const deletedUser = result.rows[0];
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        
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
app.put('/api/users/update-role', async (req, res) => {
    try {
        const { email, role, department } = req.body;
        console.log('[PUT] Updating role for:', email, 'to', role, department ? 'in department ' + department : '');
        
        if (!email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email and role required'
            });
        }
        
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        await db.query(
            'UPDATE users SET role = $2, department = $3 WHERE email = $1',
            [email, role, department || user.department]
        );

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
                            ${department ? `<div class="role-label" style="margin-top: 10px;">Department:</div><div class="role-value">${department}</div>` : ''}
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
        addAuditEntry('update-role', req, { email: user.email, role: user.role, department: user.department });

        console.log('[SUCCESS] Role updated for:', email, 'to', role, department ? 'in ' + department : '');
        res.json({
            success: true,
            message: 'Role updated successfully',
            user: {
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                department: user.department
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
app.post('/api/auth', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        const user = result.rows[0];
        
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
app.post('/api/reset-passwords', async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password || String(password).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        console.log('[ADMIN] Resetting passwords for all users');
        const hashed = hashPassword(String(password));
        
        const result = await db.query('UPDATE users SET password=$1, updated_at=NOW() WHERE active=true RETURNING id', [hashed]);
        const updated = result.rows.length;

        // audit reset passwords action
        addAuditEntry('reset-passwords', req, { updated: updated });

        console.log('[ADMIN] Passwords reset for', updated, 'users');
        return res.json({ success: true, updated: updated, message: 'Passwords updated' });
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
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('[LISTEN] Server running on port', PORT);
    
    // Initialize database
    try {
        console.log('[DB] Testing connection...');
        const connected = await db.testConnection();
        
        if (connected) {
            console.log('[DB] Connection successful');
            
            // Initialize schema
            await db.initializeSchema();
            
            // Optional: Run migration from JSON files on first run
            const userCount = await db.query('SELECT COUNT(*) as count FROM users');
            if (userCount.rows[0].count === 0) {
                console.log('[MIGRATION] No users found, attempting migration from JSON files...');
                try {
                    await db.migrateFromJSON();
                } catch (migrationError) {
                    console.warn('[MIGRATION] Migration failed or not needed:', migrationError.message);
                }
            }
        }
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error.message);
        console.error('[DB] Make sure PostgreSQL is running and the connection string is correct');
        console.error('[DB] Set DATABASE_URL environment variable or update .env file');
    }
    
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
