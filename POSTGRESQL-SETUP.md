# PostgreSQL Migration Setup Guide

Your ticketing system has been migrated from **JSON file storage** to **PostgreSQL database**. This ensures your data persists safely in a production-grade database instead of volatile JSON files.

## 🚀 Quick Setup

### Step 1: Get PostgreSQL Credentials

You have several cloud options (all with free tiers):

#### Option A: **Supabase** (Recommended - Easiest)
1. Go to [supabase.com](https://supabase.com)
2. Click "Sign up" and create an account
3. Create a new project
4. Go to **Settings → Database** and copy the connection string
5. It will look like: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`

#### Option B: **Railway**
1. Go to [railway.app](https://railway.app)
2. Create account and new project
3. Add PostgreSQL service
4. Connect and copy connection string from **Variables**

#### Option C: **Render**
1. Go to [render.com](https://render.com)
2. Create account, go to **Dashboard**
3. Create new PostgreSQL database
4. Copy **Internal Database URL**

#### Option D: **Local PostgreSQL**
- Download from [postgresql.org](https://www.postgresql.org/download/)
- Default local connection: `postgresql://postgres:password@localhost:5432/maisha_bank`

### Step 2: Configure Environment Variables

1. In the workspace root, create a `.env` file:
```bash
# Copy from .env.example and fill in your actual values
DATABASE_URL=postgresql://user:password@host:port/database_name
PORT=3003
```

Or set individual variables:
```bash
DB_HOST=your-host.com
DB_PORT=5432
DB_NAME=your_database
DB_USER=postgres_user
DB_PASSWORD=your_password
PORT=3003
```

### Step 3: Install Dependencies

```bash
npm install
```

This will install the `pg` package needed for PostgreSQL connection.

### Step 4: Start the Server

```bash
npm start
```

The server will:
✅ Test database connection
✅ Create tables automatically
✅ Migrate data from JSON files (if any exist)
✅ Listen on port 3003

### Step 5: Verify Migration

- Check the terminal for `[DB] Connection successful` message
- All existing data from JSON files will be migrated to PostgreSQL
- JSON files remain as backup (can be deleted after verification)

## 📊 Database Structure

Your PostgreSQL database now has these tables:

```
users
├── id (SERIAL PRIMARY KEY)
├── full_name
├── username
├── email
├── role
├── department
├── password
├── created_at
└── active

tickets
├── id (VARCHAR PRIMARY KEY)
├── timestamp
├── priority
├── to_dept
├── assigned_to
├── sla_due
├── status
├── escalated
├── name, email, from_dept
├── ticket_type
├── issue_type
├── description
├── attachment
└── category

audit_logs
├── id (UUID)
├── timestamp
├── action
├── method
├── path
├── ip
└── details (JSONB)

email_logs
├── id (UUID)
├── timestamp
├── from, to
├── subject
├── body
└── status

asset_register
├── owner_id (SERIAL PRIMARY KEY)
├── owner_name
├── owner_email
└── assets (JSONB)
```

## ✨ Benefits

✅ **Persistent Data** - Data survives server restarts
✅ **Scalability** - Can handle millions of records
✅ **Reliability** - Production-grade database
✅ **Cloud-Ready** - Works with cloud providers
✅ **Backup** - Easy database backups and restoration
✅ **Multi-User** - True concurrent access
✅ **Querying** - SQL-based reporting and analytics

## 🔧 Troubleshooting

### Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Test with: `psql -U user -d database`

### Permission Denied
```
Error: role "postgres" does not exist
```
- Use correct username in DATABASE_URL
- Check Supabase/Railway/Render credentials

### Table Already Exists
- Schema initialization is idempotent (safe to run multiple times)
- Existing tables won't be recreated

## 🔐 Security Tips

1. **Never commit .env file** - Already in `.gitignore`
2. **Use strong passwords** for PostgreSQL
3. **Cloud providers recommended** - They handle backups
4. **Rotate credentials** periodically
5. **Enable SSL** for database connections (cloud providers do this by default)

## 📈 Next Steps

1. Test all features in the ticketing system
2. Verify data appears in database
3. Delete JSON files once confident: `rm *.json`
4. Set up automated backups with your cloud provider
5. Monitor database performance

## 🆘 Need Help?

- Check logs in terminal for detailed error messages
- Verify `node_modules/pg` exists after `npm install`
- Test database connection: `npm run test:db` (if configured)
- Review database.js for connection details
