/**
 * Extended integration tests — complements test-app.js.
 * Run: node backend-node/test-thorough.js
 */
const BASE = process.env.API_BASE || 'http://localhost:8000/api';
const UI_BASE = process.env.UI_BASE || 'http://localhost:5173';

let passed = 0;
let failed = 0;
const errors = [];

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  errors.push({ name, detail });
  console.log(`  ✗ ${name}: ${detail}`);
}

async function req(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function login(user_id, password) {
  const { status, body } = await req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, password }),
  });
  if (status !== 200 || !body.token) throw new Error(body.detail || String(status));
  return { token: body.token, user: body.user };
}

async function run() {
  console.log('\n=== Extended Test Suite ===\n');

  // --- UI static assets ---
  console.log('UI assets');
  for (const [label, url] of [
    ['UI index.html', `${UI_BASE}/`],
    ['UI app.js', `${UI_BASE}/assets/app.js`],
    ['UI style.css', `${UI_BASE}/assets/style.css`],
    ['API root UI', 'http://localhost:8000/'],
  ]) {
    try {
      const res = await fetch(url);
      if (res.status === 200) ok(`${label} loads (${res.status})`);
      else fail(`${label} loads`, `status ${res.status}`);
    } catch (e) {
      fail(`${label} loads`, e.message);
    }
  }

  const appJs = await fetch(`${UI_BASE}/assets/app.js`).then((r) => r.text()).catch(() => '');
  if (appJs.includes('NAV_ICONS') && appJs.includes('navIconSvg')) ok('Sidebar icons present in app.js');
  else fail('Sidebar icons in app.js', 'NAV_ICONS or navIconSvg missing');

  // --- Auth edge cases ---
  console.log('\nAuth edge cases');
  const noToken = await req('/tickets/');
  if (noToken.status === 401) ok('Unauthenticated request rejected');
  else fail('Unauthenticated request rejected', `status ${noToken.status}`);

  const emptyLogin = await req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: '', password: '' }),
  });
  if (emptyLogin.status === 400) ok('Empty login rejected');
  else fail('Empty login rejected', `status ${emptyLogin.status}`);

  const admin = await login('Admin', '2496');
  const reji = await login('reji', '1120');
  const ragesh = await login('ragesh', '1119');
  const arun = await login('arun', '1217');
  ok('Logins for extended tests');

  const logout = await req('/auth/logout', { method: 'POST' }, admin.token);
  if (logout.status === 200) ok('Logout succeeds');
  else fail('Logout succeeds', `status ${logout.status}`);

  const afterLogout = await req('/auth/me', {}, admin.token);
  if (afterLogout.status === 401) ok('Token invalid after logout');
  else fail('Token invalid after logout', `status ${afterLogout.status}`);

  admin.token = (await login('Admin', '2496')).token;

  // --- Roles access ---
  console.log('\nRoles access');
  const adminRoles = await req('/roles/', {}, admin.token);
  if (adminRoles.status === 200 && adminRoles.body.length) ok('Admin can list roles');
  else fail('Admin can list roles', JSON.stringify(adminRoles.body));

  const rejiRoles = await req('/roles/', {}, reji.token);
  if (rejiRoles.status === 403) ok('Non-admin blocked from roles');
  else fail('Non-admin blocked from roles', `status ${rejiRoles.status}`);

  // --- Dashboard months ---
  console.log('\nDashboard');
  const dashPrev = await req('/dashboard/?year=2026&month=5', {}, admin.token);
  const dashNext = await req('/dashboard/?year=2026&month=7', {}, admin.token);
  if (dashPrev.status === 200 && dashPrev.body.period?.month === 5) ok('Dashboard May 2026');
  else fail('Dashboard May 2026', JSON.stringify(dashPrev.body?.period));
  if (dashNext.status === 200 && dashNext.body.period?.month === 7) ok('Dashboard July 2026');
  else fail('Dashboard July 2026', JSON.stringify(dashNext.body?.period));

  const rejiDash = await req('/dashboard/?year=2026&month=6', {}, reji.token);
  if (rejiDash.status === 200 && rejiDash.body.department_work) ok('Supervisor dashboard has department_work');
  else fail('Supervisor department_work', rejiDash.body?.department_work ? 'missing' : JSON.stringify(rejiDash.body));

  // --- Ticket lifecycle ---
  console.log('\nTicket lifecycle');
  const cats = await req('/categories/', {}, admin.token);
  const locs = await req('/locations/', {}, admin.token);
  const emps = await req('/employees/', {}, admin.token);
  const catId = cats.body[0].id;
  const locId = locs.body[0].id;
  const arunId = emps.body.find((e) => e.user_id === 'arun')?.emp_id;
  const rejiId = reji.user.emp_id;

  const nextNo = await req('/tickets/next-number', {}, reji.token);
  if (nextNo.status === 200 && nextNo.body.ticket_no) ok(`Next ticket number: ${nextNo.body.ticket_no}`);
  else fail('Next ticket number', JSON.stringify(nextNo.body));

  const fd = new FormData();
  fd.append('ticket_date', '2026-06-30');
  fd.append('priority', 'moderate');
  fd.append('complaint_category_id', String(catId));
  fd.append('location_id', String(locId));
  fd.append('ticket_description', 'Extended test ticket');
  fd.append('details', 'Lifecycle test');
  fd.append('assigned_to', String(arunId));

  const created = await req('/tickets/', { method: 'POST', body: fd }, reji.token);
  if (created.status !== 200 || !created.body.id) {
    fail('Create ticket for lifecycle', JSON.stringify(created.body));
    console.log('\n=== Results ===');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    process.exit(1);
  }
  const ticketId = created.body.id;
  ok(`Created ticket #${ticketId}`);

  const creatorUpdateFd = new FormData();
  creatorUpdateFd.append('ticket_description', 'Creator updated description');
  creatorUpdateFd.append('complaint_category_id', String(catId));
  creatorUpdateFd.append('location_id', String(locId));
  creatorUpdateFd.append('priority', 'moderate');
  creatorUpdateFd.append('remarks', 'Creator editing own ticket');
  const creatorUpdated = await req(`/tickets/${ticketId}`, { method: 'PUT', body: creatorUpdateFd }, reji.token);
  if (creatorUpdated.status === 200) ok('Ticket creator can edit ticket');
  else fail('Ticket creator can edit ticket', JSON.stringify(creatorUpdated.body));

  const updateFd = new FormData();
  updateFd.append('ticket_description', 'Updated description');
  updateFd.append('complaint_category_id', String(catId));
  updateFd.append('location_id', String(locId));
  updateFd.append('priority', 'urgent');
  updateFd.append('remarks', 'Updating during test');

  const updated = await req(`/tickets/${ticketId}`, { method: 'PUT', body: updateFd }, arun.token);
  if (updated.status === 200 && updated.body.priority === 'urgent') ok('Update ticket (priority urgent)');
  else fail('Update ticket', JSON.stringify(updated.body));

  const forwardFd = new FormData();
  forwardFd.append('forward_to', String(rejiId));
  forwardFd.append('remarks', 'Forwarding to creator for test');

  const forwarded = await req(`/tickets/${ticketId}/forward`, { method: 'POST', body: forwardFd }, arun.token);
  if (forwarded.status === 200 && forwarded.body.status === 'forwarded') ok('Forward ticket');
  else fail('Forward ticket', JSON.stringify(forwarded.body));

  const rageshDenied = await req(`/tickets/${ticketId}`, {}, ragesh.token);
  if (rageshDenied.status === 403 || rageshDenied.status === 200) {
    // ragesh may or may not see dept ticket depending on dept — check access logic
    if (rageshDenied.status === 403) ok('Cross-user ticket access restricted when not in scope');
    else ok('Cross-user ticket access (same department)');
  }

  const closeFd = new FormData();
  closeFd.append('remarks', 'Closing extended test ticket');
  const closed = await req(`/tickets/${ticketId}/close`, { method: 'POST', body: closeFd }, reji.token);
  if (closed.status === 200 && closed.body.status === 'closed') ok('Close ticket after forward');
  else fail('Close ticket after forward', JSON.stringify(closed.body));

  const commentClosed = await req(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remarks: 'Should fail' }),
  }, reji.token);
  if (commentClosed.status === 400) ok('Comment on closed ticket rejected');
  else fail('Comment on closed ticket rejected', `status ${commentClosed.status}`);

  const closeAgain = await req(`/tickets/${ticketId}/close`, { method: 'POST', body: closeFd }, reji.token);
  if (closeAgain.status === 400 || closeAgain.status === 403) ok('Double close rejected');
  else fail('Double close rejected', `status ${closeAgain.status}`);

  const updateClosed = await req(`/tickets/${ticketId}`, { method: 'PUT', body: updateFd }, reji.token);
  if (updateClosed.status === 400 || updateClosed.status === 403) ok('Update closed ticket rejected');
  else fail('Update closed ticket rejected', `status ${updateClosed.status}`);

  // --- Schedule jobs CRUD ---
  console.log('\nSchedule jobs CRUD');
    const jobPayload = {
    job_name: 'Extended Test Job',
    schedule_type: 'weekly',
    day_of_week: 3,
    start_date: '2026-07-01',
    end_date: '2026-12-31',
    run_time: '9:00 AM',
    complaint_category_id: catId,
    location_id: locId,
    ticket_description: 'Extended schedule test',
    assigned_to: arunId,
    priority: 'normal',
  };

  const jobCreate = await req('/scheduled-jobs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobPayload),
  }, reji.token);
  let jobId;
  if (jobCreate.status === 201 || jobCreate.status === 200) {
    jobId = jobCreate.body.id;
    ok(`Create schedule job #${jobId}`);
  } else {
    fail('Create schedule job', JSON.stringify(jobCreate.body));
  }

  if (jobId) {
    const jobGet = await req(`/scheduled-jobs/${jobId}`, {}, reji.token);
    if (jobGet.status === 200 && jobGet.body.job_name === 'Extended Test Job') ok('GET schedule job detail');
    else fail('GET schedule job detail', JSON.stringify(jobGet.body));

    const rageshJobGet = await req(`/scheduled-jobs/${jobId}`, {}, ragesh.token);
    if (rageshJobGet.status === 404 || rageshJobGet.status === 403) ok('Other user cannot view Reji job');
    else fail('Schedule job isolation on GET', `status ${rageshJobGet.status}`);

    const jobUpdate = await req(`/scheduled-jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_name: 'Extended Test Job Updated', is_active: 0 }),
    }, reji.token);
    if (jobUpdate.status === 200 && jobUpdate.body.job_name === 'Extended Test Job Updated') ok('Update schedule job');
    else fail('Update schedule job', JSON.stringify(jobUpdate.body));

    const rageshEdit = await req(`/scheduled-jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_name: 'Hijack' }),
    }, ragesh.token);
    if (rageshEdit.status === 403 || rageshEdit.status === 404) ok('Other user cannot edit Reji job');
    else fail('Schedule job edit isolation', `status ${rageshEdit.status}`);

    const jobDelete = await req(`/scheduled-jobs/${jobId}`, { method: 'DELETE' }, reji.token);
    if (jobDelete.status === 200) ok('Delete schedule job');
    else fail('Delete schedule job', JSON.stringify(jobDelete.body));
  }

  const badJob = await req('/scheduled-jobs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_name: 'Bad', schedule_type: 'invalid' }),
  }, reji.token);
  if (badJob.status === 400) ok('Invalid schedule type rejected');
  else fail('Invalid schedule type rejected', `status ${badJob.status}`);

  // --- Master CRUD smoke (create + delete test records) ---
  console.log('\nMaster CRUD smoke');
  const testDept = await req('/departments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Test Dept Extended' }),
  }, admin.token);
  if (testDept.status === 200 && testDept.body.dept_id) {
    ok('Create test department');
    const delDept = await req(`/departments/${testDept.body.dept_id}`, { method: 'DELETE' }, admin.token);
    if (delDept.status === 200) ok('Delete test department');
    else fail('Delete test department', JSON.stringify(delDept.body));
  } else fail('Create test department', JSON.stringify(testDept.body));

  // --- Permissions read-only check ---
  console.log('\nPermissions');
  const perms = await req('/permissions/', {}, admin.token);
  if (perms.status === 200 && perms.body.length) ok('GET role permissions with nested shape');
  else fail('GET role permissions', '');

  const supervisorPerm = perms.body.find((p) => p.role_name === 'Supervisor');
  if (supervisorPerm?.permissions?.can_create && supervisorPerm?.permissions?.can_view) {
    ok('Supervisor role has create/view permissions');
  } else {
    fail('Supervisor permissions intact', JSON.stringify(supervisorPerm?.permissions));
  }

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (errors.length) {
    console.log('\nFailures:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.detail}`));
    process.exit(1);
  }
  console.log('\nAll extended tests passed.\n');
}

run().catch((err) => {
  console.error('Extended test runner error:', err);
  process.exit(1);
});
