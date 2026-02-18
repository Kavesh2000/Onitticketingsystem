# PostgreSQL Migration - Quick Start

## 🎯 What Changed

Your system **no longer loses data** - everything is now stored in a PostgreSQL database instead of volatile JSON files.

### Before (JSON Files)
```
tickets.json ❌ Lost on server restart
users.json ❌ Lost on server restart  
audit.json ❌ Lost on server restart
```

### After (PostgreSQL) ✅
```
Persistent Database ✅ Data survives restarts
Scalable ✅ Handles millions of records
Backup Ready ✅ Professional backup solutions
```

---

## 📦 Installation Steps (5 minutes)

### 1️⃣ Install Node Packages
```bash
npm install
```

### 2️⃣ Get PostgreSQL Credentials
Choose one (all have **free tiers**):
- **Supabase** (Easiest) → supabase.com
- **Railway** → railway.app
- **Render** → render.com
- **Local** → Install PostgreSQL locally

### 3️⃣ Create .env File
Copy from `.env.example` and add your credentials:
```
DATABASE_URL=postgresql://user:password@host:port/database
PORT=3003
```

### 4️⃣ Start Server
```bash
npm start
```

Server will:
- ✅ Connect to PostgreSQL
- ✅ Create tables automatically
- ✅ Migrate your JSON data
- ✅ Start listening on port 3003

---

## ✅ Verify It Works

1. **Check logs for**: `[DB] Connection successful`
2. **Test in browser**: `http://localhost:3003/api/health`
3. **Create test ticket** in the UI
4. **Server restart** - Data persists! 🎉

---

## 🆘 Common Issues

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running or wrong host |
| `permission denied` | Check DATABASE_URL credentials |
| `Error: server does not support SSL` | Add `?sslmode=disable` to URL |
| `Tables already exist` | Safe to ignore - schema creation is idempotent |

---

## 📚 Full Setup Guide

See [POSTGRESQL-SETUP.md](POSTGRESQL-SETUP.md) for:
- Detailed cloud provider setup
- Database structure
- Security best practices
- Troubleshooting guide

---

## 🎓 Learn More

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Supabase Getting Started](https://supabase.com/docs/guides/getting-started)
- [Railway PostgreSQL](https://railway.app/template/postgresql)

**Your data is now safe!** 🔒
