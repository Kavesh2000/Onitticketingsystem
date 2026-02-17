const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    console.log('[DIALOG]', dialog.message());
    await dialog.accept();
  });

  console.log('[TEST] Navigating to index and setting user localStorage (regular user)');
  await page.goto('http://localhost:3003/index.html', { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('userId', '100');
    localStorage.setItem('userEmail', 'margaret.njeri@maishabank.com');
    localStorage.setItem('userName', 'Margaret Njeri');
    localStorage.setItem('userRole', 'User');
    localStorage.setItem('isAdmin', 'false');
    localStorage.setItem('userDept', 'Finance');
    // ensure demo financeUsers removed so fallback to /api/users happens
    localStorage.removeItem('financeUsers');
  });

  console.log('[TEST] Opening system page and submitting leave');
  await page.goto('http://localhost:3003/system.html', { waitUntil: 'networkidle2' });
  // diagnostic snapshot to ensure expected DOM is present
  const snap = await page.evaluate(() => ({ url: location.href, hasForm: !!document.getElementById('newLeaveForm'), snippet: document.documentElement.innerHTML.slice(0,1000) }));
  console.log('[DEBUG] page url:', snap.url);
  console.log('[DEBUG] has newLeaveForm?', snap.hasForm);
  // print small snippet to help debugging
  console.log('[DEBUG] html snippet:', snap.snippet.replace(/\n/g,' ').slice(0,400));

  // navigate to the Leave section so the form is displayed
  await page.evaluate(() => { if (typeof switchSection === 'function') switchSection('leave'); else { const leaveSec = document.getElementById('leave'); if (leaveSec) leaveSec.classList.add('active'); } });

  // fill form fields and submit via DOM operations (avoid visibility/click issues)
  await page.waitForSelector('#newLeaveForm', { timeout: 5000 });
  await page.evaluate(() => {
    const el = document.getElementById('newLeaveForm'); if (el) el.classList.remove('hidden');
    const days = document.getElementById('leaveDays'); if (days) { days.value = '2'; days.dispatchEvent(new Event('input', { bubbles: true })); }
    const type = document.getElementById('leaveType'); if (type) { type.value = 'Annual'; type.dispatchEvent(new Event('change', { bubbles: true })); }
    const form = document.getElementById('leaveFormEl'); if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  // wait a moment for JS to process
  await new Promise(r => setTimeout(r, 700));

  const leaves = await page.evaluate(() => JSON.parse(localStorage.getItem('leaveRequests') || '[]'));
  console.log('[TEST] Leaves after submit:', JSON.stringify(leaves, null, 2));

  if (leaves.length === 0) {
    console.error('[FAIL] No leave requests created');
    await browser.close();
    process.exit(2);
  }

  const leave = leaves[leaves.length - 1];
  console.log('[TEST] Latest leave id:', leave.id, 'primaryHOD:', leave.primaryHOD);

  if (!leave.primaryHOD) {
    console.error('[FAIL] primaryHOD not set - HOD routing failed');
    await browser.close();
    process.exit(3);
  }

  // Simulate HOD login as 'Head of Finance' role
  console.log('[TEST] Simulating HOD view (', leave.primaryHOD, ') as Head of Finance');
  await page.evaluate(hod => {
    localStorage.setItem('userEmail', hod);
    localStorage.setItem('userRole', 'Head of Finance');
    localStorage.setItem('isAdmin', 'false');
  }, leave.primaryHOD);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 300));

  // Ensure HOD can see the request and approve via approveLeaveById
  const hodCanApprove = await page.evaluate(id => {
    try {
      const reqs = JSON.parse(localStorage.getItem('leaveRequests') || '[]');
      const r = reqs.find(x => x.id === id);
      if (!r) return { ok: false, msg: 'not found' };
      // call approve function
      approveLeaveById(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }, leave.id);

  console.log('[TEST] HOD approve result:', hodCanApprove);
  await new Promise(r => setTimeout(r, 300));

  // Check leave progressed to stage 1
  const afterHOD = await page.evaluate(id => JSON.parse(localStorage.getItem('leaveRequests')||'[]').find(x=>x.id===id), leave.id);
  console.log('[TEST] After HOD:', JSON.stringify(afterHOD, null, 2));

  if (afterHOD.currentStage !== 1) {
    console.error('[FAIL] Leave did not advance to Admin stage');
    await browser.close();
    process.exit(4);
  }

  // Simulate Admin login
  console.log('[TEST] Simulating Admin approval');
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'admin@maishabank.com');
    localStorage.setItem('userName', 'Admin');
    localStorage.setItem('userRole', 'Admin');
    localStorage.setItem('isAdmin', 'true');
  });

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 300));

  // Approve as admin
  await page.evaluate(id => { approveLeaveById(id); }, leave.id);
  await new Promise(r => setTimeout(r, 300));

  const final = await page.evaluate(id => JSON.parse(localStorage.getItem('leaveRequests')||'[]').find(x=>x.id===id), leave.id);
  console.log('[TEST] Final leave state:', JSON.stringify(final, null, 2));

  if (final.status !== 'Approved') {
    console.error('[FAIL] Final approval failed');
    await browser.close();
    process.exit(5);
  }

  console.log('[PASS] End-to-end leave HOD→Admin flow succeeded for', leave.id);
  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error('Test error', e); process.exit(1); });
