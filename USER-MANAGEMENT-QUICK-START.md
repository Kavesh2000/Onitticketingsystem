# User Management Quick Start

## What Was Implemented

### Backend (Node.js)
✅ **seed_users()** function - Populates database with 25 bank staff across multiple departments (includes HR/HOD/Admin accounts)
✅ **API Endpoints**:
- `POST /api/seed-users` - Load initial users
- `GET /api/users` - Get all users
- `POST /api/users` - Create/update user
- `DELETE /api/users/:id` - Delete user

### Frontend (Admin Panel)
✅ **User Management Form** with fields:
- Full Name
- Email  
- Username
- Department (dropdown)
- Role (dropdown)
- Password

✅ **Functions**:
- `loadUsers()` - Load users from server
- `showNewUserForm()` - Display form
- `saveUser()` - Create/update user
- `editUser()` - Edit existing user
- `deleteUser()` - Remove user
- `seedUsersFromBackend()` - Seed initial users

## Quick Test

### 1. Run Standalone Seed
```bash
cd "c:\Users\Admin\Desktop\Onit"
node seed-users-standalone.js
```
✅ Creates/updates `users.json` with 25 test users (all passwords "1234")

### 2. Start Server
```bash
node server.js
```
Server runs on port 3003 with user management endpoints

### 3. Access Admin Panel
Open `admin.html` in browser → Go to "Manage Users" section
- Click "Seed Initial Users" to load users
- Click "+ New User" to create new user
- Click "Edit" to modify user
- Click "Delete" to remove user

## Default Users Created

The standalone seed script now loads a fixed set of 25 users used throughout the demos. All accounts use the simple password `1234`.

Sample breakdown (not exhaustive):
- **Customer Service**: Alice Martin, Bob Lee, Mohamed Ali
- **ICT**: Cathy Nguyen, David Kim, Nina Schmidt (+ HOD/ICT account)
- **Finance**: Eva Patel, Frank O'Connor, Oscar Pérez (+ HOD/Finance account)
- **HR**: Grace Liu, Henry Adams, Priya Singh, Helen HR
- **Support**: Ian Wright, Jasmine Torres, Quentin Blake
- **Branch**: Kyle Brown, Lena Svensson, Ryan Johnson
- **Admins/Management**: Admin One, Admin Two, Henry (HOD Management)

Additional HR/HOD/Operations accounts are included for testing role‑based login.  The exact list is defined in `seed-users-standalone.js`.

## Files Modified

1. **server.js** - Added seed_users() and 4 API endpoints
2. **admin.html** - Enhanced user form with new fields and buttons
3. **script.js** - Added 8 user management functions
4. **users.json** - Auto-created with 19 users (19 users by default, 23 in code)

## Error Handling

All operations include:
- Duplicate username/email prevention
- Form validation (required fields)
- Error messages on failure
- Success confirmations

---

**Status**: ✅ Complete and Tested
