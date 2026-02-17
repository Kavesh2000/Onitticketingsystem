const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');
const LEAVE_FILE = path.join(__dirname, 'leaveRequests.sim.json');

function loadUsers(){
  return JSON.parse(fs.readFileSync(USERS_FILE,'utf8'));
}

function saveLeaves(leaves){
  fs.writeFileSync(LEAVE_FILE, JSON.stringify(leaves, null, 2));
}

function loadLeaves(){
  if(!fs.existsSync(LEAVE_FILE)) return [];
  return JSON.parse(fs.readFileSync(LEAVE_FILE,'utf8'));
}

function findUserByEmail(users, email){
  return users.find(u => u.email === email || u.email === (email+'') );
}

function createLeave(users, applicantEmail){
  const appl = findUserByEmail(users, applicantEmail);
  if(!appl) throw new Error('Applicant not found: '+applicantEmail);
  const dept = appl.department || 'General';
  // related departments mapping per app
  const relatedMap = { 'Finance': ['Finance','ICT','Branch','Customer Service'] };
  const related = relatedMap[dept] || [dept];
  // find HODs in related departments
  const hods = users.filter(u => (u.role === 'HOD' || u.role === 'Head of Finance') && related.includes(u.department));
  const viewers = hods.map(h=>h.email);
  const primary = users.find(u => (u.role === 'HOD' || u.role === 'Head of Finance') && u.department === dept);
  const primaryEmail = primary ? primary.email : null;

  const leave = {
    id: 'LEAVE-'+Math.random().toString(36).slice(2,9).toUpperCase(),
    type: 'Annual',
    days: 3,
    email: applicantEmail,
    applicantName: appl.full_name || appl.name || '',
    department: dept,
    approvals: [null, null],
    currentStage: 0,
    status: 'Pending',
    viewers,
    primaryHOD: primaryEmail,
    returnedToApplicant: false,
    timestamp: new Date().toISOString()
  };
  const leaves = loadLeaves();
  leaves.push(leave);
  saveLeaves(leaves);
  return leave;
}

function approveByHOD(id, hodEmail){
  const leaves = loadLeaves();
  const idx = leaves.findIndex(l=>l.id===id);
  if(idx===-1) throw new Error('Leave not found');
  const l = leaves[idx];
  if(l.currentStage!==0) throw new Error('Not at HOD stage');
  if(l.primaryHOD && l.primaryHOD !== hodEmail) throw new Error('Not primary HOD');
  l.approvals[0] = 'Approved';
  l.currentStage = 1;
  l.status = 'Pending';
  l.returnedToApplicant = false;
  leaves[idx]=l;
  saveLeaves(leaves);
  return l;
}

function rejectByHOD(id, hodEmail){
  const leaves = loadLeaves();
  const idx = leaves.findIndex(l=>l.id===id);
  if(idx===-1) throw new Error('Leave not found');
  const l = leaves[idx];
  if(l.currentStage!==0) throw new Error('Not at HOD stage');
  if(l.primaryHOD && l.primaryHOD !== hodEmail) throw new Error('Not primary HOD');
  l.approvals[0] = 'Rejected';
  l.status = 'Rejected';
  l.returnedToApplicant = true;
  leaves[idx]=l;
  saveLeaves(leaves);
  return l;
}

function approveByAdmin(id, adminEmail){
  const leaves = loadLeaves();
  const idx = leaves.findIndex(l=>l.id===id);
  if(idx===-1) throw new Error('Leave not found');
  const l = leaves[idx];
  if(l.currentStage!==1) throw new Error('Not at Admin stage');
  l.approvals[1] = 'Approved';
  l.status = 'Approved';
  leaves[idx]=l;
  saveLeaves(leaves);
  return l;
}

function simulate(){
  // Clear any previous sim file
  if(fs.existsSync(LEAVE_FILE)) fs.unlinkSync(LEAVE_FILE);

  const users = loadUsers();
  // choose a finance user (pick first non-HOD finance user)
  const applicant = users.find(u=>u.department==='Finance' && u.role !== 'HOD' && u.role !== 'Head of Finance');
  if(!applicant) throw new Error('No finance applicant found');
  console.log('Applicant chosen:', applicant.email, applicant.full_name || applicant.name);

  const leave = createLeave(users, applicant.email);
  console.log('\nCreated leave request:');
  console.log(JSON.stringify(leave, null, 2));

  // show leaves file
  console.log('\nAll leaves after creation:');
  console.log(JSON.stringify(loadLeaves(), null, 2));

  // simulate HOD approve if exists
  if(leave.primaryHOD) {
    console.log('\nSimulating HOD approval by', leave.primaryHOD);
    const afterHOD = approveByHOD(leave.id, leave.primaryHOD);
    console.log(JSON.stringify(afterHOD, null, 2));

    // simulate Admin approval (find an admin user)
    const admin = users.find(u=>u.role==='Admin') || users.find(u=>u.username==='admin');
    if(admin) {
      console.log('\nSimulating Admin approval by', admin.email || admin.username);
      const afterAdmin = approveByAdmin(leave.id, admin.email||admin.username);
      console.log(JSON.stringify(afterAdmin, null, 2));
    } else {
      console.log('\nNo admin user found for final approval simulation');
    }
  } else {
    console.log('\nNo primary HOD found; request should be routed to Admin directly in app.');
  }

  // Now simulate a separate leave that is rejected by HOD
  console.log('\n--- Simulate HOD rejection flow ---');
  const leave2 = createLeave(users, applicant.email);
  console.log('Created leave2 id:', leave2.id, 'primaryHOD:', leave2.primaryHOD);
  if(leave2.primaryHOD) {
    console.log('Simulating HOD rejection by', leave2.primaryHOD);
    const rejected = rejectByHOD(leave2.id, leave2.primaryHOD);
    console.log(JSON.stringify(rejected, null, 2));
  } else {
    console.log('No primary HOD for leave2; cannot simulate HOD rejection');
  }

  console.log('\nFinal leaves file:');
  console.log(JSON.stringify(loadLeaves(), null, 2));
}

try{
  simulate();
  console.log('\nSimulation complete. Leave data saved to', LEAVE_FILE);
} catch(e){
  console.error('Simulation error:', e.message);
  process.exit(1);
}
