// database.js - PostgreSQL connection and schema management
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
        `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'maisha_bank'}`
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('[DB ERROR] Unexpected error on idle client', err);
});

// Initialize database schema
async function initializeSchema() {
    const client = await pool.connect();
    try {
        console.log('[DB] Initializing schema...');

        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                role VARCHAR(50) NOT NULL,
                department VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                active BOOLEAN DEFAULT true
            )
        `);
        console.log('[DB] Users table ready');

        // Tickets table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id VARCHAR(50) PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                priority VARCHAR(10),
                to_dept VARCHAR(100),
                assigned_to VARCHAR(100),
                sla_due TIMESTAMP,
                status VARCHAR(50),
                escalated VARCHAR(10),
                name VARCHAR(255),
                email VARCHAR(100),
                from_dept VARCHAR(100),
                ticket_type VARCHAR(50),
                issue_type VARCHAR(100),
                description TEXT,
                attachment TEXT,
                category VARCHAR(50)
            )
        `);
        console.log('[DB] Tickets table ready');

        // Audit logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action VARCHAR(255),
                method VARCHAR(10),
                path VARCHAR(255),
                ip VARCHAR(45),
                details JSONB
            )
        `);
        console.log('[DB] Audit logs table ready');

        // Email logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "from" VARCHAR(100),
                "to" VARCHAR(100),
                subject VARCHAR(255),
                body TEXT,
                status VARCHAR(50)
            )
        `);
        console.log('[DB] Email logs table ready');

        // Asset register table
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_register (
                owner_id SERIAL PRIMARY KEY,
                owner_name VARCHAR(255),
                owner_email VARCHAR(100),
                assets JSONB DEFAULT '[]'
            )
        `);
        console.log('[DB] Asset register table ready');

        // Leave requests table
        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id VARCHAR(100) PRIMARY KEY,
                type VARCHAR(50),
                days INTEGER,
                email VARCHAR(100),
                applicant_name VARCHAR(255),
                department VARCHAR(100),
                approvals JSONB,
                current_stage INTEGER,
                status VARCHAR(50),
                viewers JSONB,
                primary_hod VARCHAR(100),
                returned_to_applicant BOOLEAN DEFAULT false,
                timestamp TIMESTAMP
            )
        `);
        console.log('[DB] Leave requests table ready');

        // Expense claims table
        await client.query(`
            CREATE TABLE IF NOT EXISTS expense_claims (
                id VARCHAR(100) PRIMARY KEY,
                claimant VARCHAR(255),
                email VARCHAR(100),
                type VARCHAR(50),
                amount NUMERIC(14,2),
                description TEXT,
                status VARCHAR(50),
                workflow_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] Expense claims table ready');

        // Claim disbursements table
        await client.query(`
            CREATE TABLE IF NOT EXISTS claim_disbursements (
                id VARCHAR(100) PRIMARY KEY,
                claim_id VARCHAR(100) REFERENCES expense_claims(id) ON DELETE SET NULL,
                amount NUMERIC(14,2),
                teller VARCHAR(255),
                branch VARCHAR(100),
                status VARCHAR(50),
                completed_date TIMESTAMP,
                metadata JSONB
            )
        `);
        console.log('[DB] Claim disbursements table ready');

        // Leave balances table
        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_balances (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                balance NUMERIC(10,2) DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id)
            )
        `);
        console.log('[DB] Leave balances table ready');

        // Ensure JSONB balances column exists for multi-type balances
        await client.query(`ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS balances JSONB DEFAULT '{}'`);
        console.log('[DB] Leave balances JSON column ensured');

        console.log('[DB] Schema initialization complete');
    } catch (error) {
        console.error('[DB ERROR] Schema initialization failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Migrate data from JSON files to PostgreSQL (one-time operation)
async function migrateFromJSON() {
    console.log('[MIGRATION] Starting data migration from JSON files...');
    const client = await pool.connect();

    try {
        // Migrate users
        const usersFile = path.join(__dirname, 'users.json');
        if (fs.existsSync(usersFile)) {
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            for (const user of users) {
                try {
                    // Skip if a user with this email already exists
                    const exists = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [user.email]);
                    if (exists.rows.length > 0) {
                        continue;
                    }

                    // If the user.id is a numeric value, insert it explicitly; otherwise let the DB assign an id
                    const idNum = Number(user.id);
                    if (!Number.isNaN(idNum) && Number.isInteger(idNum)) {
                        await client.query(
                            `INSERT INTO users (id, full_name, username, email, role, department, password, created_at, active) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                             ON CONFLICT (id) DO NOTHING`,
                            [idNum, user.full_name, user.username, user.email, user.role, user.department, user.password, user.created_at, user.active]
                        );
                    } else {
                        // Insert without id; rely on unique email constraint to avoid duplicates
                        await client.query(
                            `INSERT INTO users (full_name, username, email, role, department, password, created_at, active) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                             ON CONFLICT (email) DO NOTHING`,
                            [user.full_name, user.username, user.email, user.role, user.department, user.password, user.created_at, user.active]
                        );
                    }
                } catch (uerr) {
                    console.warn('[MIGRATION] Skipping user due to error:', user.email, uerr.message);
                    continue;
                }
            }
            console.log(`[MIGRATION] Migrated ${users.length} users`);
        }

        // Migrate tickets
        const ticketsFile = path.join(__dirname, 'tickets.json');
        if (fs.existsSync(ticketsFile)) {
            const tickets = JSON.parse(fs.readFileSync(ticketsFile, 'utf8'));
            for (const ticket of tickets) {
                await client.query(
                    `INSERT INTO tickets (id, timestamp, priority, to_dept, assigned_to, sla_due, status, escalated, name, email, from_dept, ticket_type, issue_type, description, attachment, category) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                     ON CONFLICT (id) DO NOTHING`,
                    [ticket.id, ticket.timestamp, ticket.priority, ticket.toDept, ticket.assigned_to, ticket.sla_due, ticket.status, ticket.escalated, ticket.name, ticket.email, ticket.fromDept, ticket.ticketType, ticket.issueType, ticket.description, ticket.attachment, ticket.category]
                );
            }
            console.log(`[MIGRATION] Migrated ${tickets.length} tickets`);
        }

        // Migrate assets
        const assetsFile = path.join(__dirname, 'asset-register.json');
        if (fs.existsSync(assetsFile)) {
            const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));
            for (const asset of assets) {
                await client.query(
                    `INSERT INTO asset_register (owner_id, owner_name, owner_email, assets) 
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (owner_id) DO NOTHING`,
                    [asset.owner_id, asset.owner_name, asset.owner_email, JSON.stringify(asset.assets || [])]
                );
            }
            console.log(`[MIGRATION] Migrated ${assets.length} asset records`);
            }

            // Migrate audit logs if present
            const auditFile = path.join(__dirname, 'audit.json');
            if (fs.existsSync(auditFile)) {
                const audits = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
                for (const a of audits) {
                    try {
                        await client.query(
                            `INSERT INTO audit_logs (id, timestamp, action, method, path, ip, details) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
                            [a.id, a.timestamp, a.action, a.method, a.path, a.ip, a.details || {}]
                        );
                    } catch (aerr) {
                        console.warn('[MIGRATION] Skipping audit entry due to error:', a.id, aerr.message);
                        continue;
                    }
                }
                console.log(`[MIGRATION] Migrated ${audits.length} audit log entries`);
            }

            // Migrate email logs if present
            const emailFile = path.join(__dirname, 'email-log.json');
            if (fs.existsSync(emailFile)) {
                const emails = JSON.parse(fs.readFileSync(emailFile, 'utf8'));
                for (const e of emails) {
                    try {
                        await client.query(
                            `INSERT INTO email_logs (id, timestamp, "from", "to", subject, body, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
                            [e.id, e.timestamp, e.from || null, e.to || null, e.subject || null, e.body || null, e.status || null]
                        );
                    } catch (eerr) {
                        console.warn('[MIGRATION] Skipping email entry due to error:', e.id, eerr.message);
                        continue;
                    }
                }
                console.log(`[MIGRATION] Migrated ${emails.length} email log entries`);
            }

            // Migrate leave requests if present
            const leaveFile = path.join(__dirname, 'leaveRequests.sim.json');
            if (fs.existsSync(leaveFile)) {
                const leaves = JSON.parse(fs.readFileSync(leaveFile, 'utf8'));
                for (const l of leaves) {
                    try {
                        await client.query(
                            `INSERT INTO leave_requests (id, type, days, email, applicant_name, department, approvals, current_stage, status, viewers, primary_hod, returned_to_applicant, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
                            [l.id, l.type || null, l.days || null, l.email || null, l.applicantName || l.applicant_name || null, l.department || null, JSON.stringify(l.approvals || []), l.currentStage || l.current_stage || 0, l.status || null, JSON.stringify(l.viewers || []), l.primaryHOD || l.primary_hod || null, l.returnedToApplicant || l.returned_to_applicant || false, l.timestamp || null]
                        );
                    } catch (lerr) {
                        console.warn('[MIGRATION] Skipping leave request due to error:', l.id, lerr.message);
                        continue;
                    }
                }
                console.log(`[MIGRATION] Migrated ${leaves.length} leave request records`);
            }

            console.log('[MIGRATION] Data migration complete');
    } catch (error) {
        console.error('[MIGRATION ERROR]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Recompute leave balances for all users by merging stored balances and approved leave requests
async function recomputeLeaveBalances() {
    const client = await pool.connect();
    try {
        console.log('[DB] Recomputing leave balances from leave_requests...');

        // fetch users
        const usersRes = await client.query('SELECT id, email FROM users');
        const users = usersRes.rows;

        let updated = 0;

        for (const u of users) {
            try {
                // Get stored balances if any
                const lbRes = await client.query('SELECT balances FROM leave_balances WHERE user_id = $1', [u.id]);
                let base = { annual: 0, sick: 0, personal: 0, maternity: 0, paternity: 0 };
                if (lbRes.rows.length > 0 && lbRes.rows[0].balances) {
                    base = Object.assign(base, lbRes.rows[0].balances);
                }

                // Sum approved leave requests per type for this user's email
                const leavesRes = await client.query(
                    `SELECT type, SUM(COALESCE(days,0)) AS total_days FROM leave_requests WHERE LOWER(email) = LOWER($1) AND LOWER(status) = 'approved' GROUP BY type`,
                    [u.email]
                );

                // subtract used days from base
                for (const row of leavesRes.rows) {
                    const t = (row.type || '').toLowerCase();
                    const days = Number(row.total_days) || 0;
                    if (t.includes('annual')) base.annual = Math.max(0, (Number(base.annual) || 0) - days);
                    else if (t.includes('sick')) base.sick = Math.max(0, (Number(base.sick) || 0) - days);
                    else if (t.includes('personal')) base.personal = Math.max(0, (Number(base.personal) || 0) - days);
                    else if (t.includes('maternity')) base.maternity = Math.max(0, (Number(base.maternity) || 0) - days);
                    else if (t.includes('paternity')) base.paternity = Math.max(0, (Number(base.paternity) || 0) - days);
                    else {
                        // if unknown type, store under a generic key
                        base[t] = Math.max(0, (Number(base[t]) || 0) - days);
                    }
                }

                // Upsert into leave_balances with balances JSONB
                await client.query(
                    `INSERT INTO leave_balances (user_id, balance, last_updated, balances) VALUES ($1, $2, NOW(), $3)
                     ON CONFLICT (user_id) DO UPDATE SET balances = EXCLUDED.balances, last_updated = NOW()`,
                    [u.id, 0, base]
                );

                updated++;
            } catch (inner) {
                console.warn('[DB] Skipping recompute for user', u.email, inner.message);
                continue;
            }
        }

        console.log(`[DB] Recomputed leave balances for ${updated} users`);
        return { updated };
    } finally {
        client.release();
    }
}

// Test database connection
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('[DB] Connection successful:', result.rows[0]);
        return true;
    } catch (error) {
        console.error('[DB ERROR] Connection failed:', error.message);
        return false;
    }
}

// Close database connection
async function closePool() {
    await pool.end();
    console.log('[DB] Connection pool closed');
}

module.exports = {
    pool,
    initializeSchema,
    migrateFromJSON,
    recomputeLeaveBalances,
    testConnection,
    closePool,
    // Shorthand query functions
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect()
};
