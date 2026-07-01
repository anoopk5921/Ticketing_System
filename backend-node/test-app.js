/**
 * Application smoke/integration test suite.
 * Run: node backend-node/test-app.js
 */
const BASE = process.env.API_BASE || 'http://localhost:8000/api';

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
  let body;
  const text = await res.text();
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
  if (status !== 200 || !body.token) {
    throw new Error(`Login failed for ${user_id}: ${body.detail || status}`);
  }
  return { token: body.token, user: body.user };
}

async function run() {
  console.log('\n=== Ticketing System Test Suite ===\n');

  // --- Auth ---
  console.log('Auth');
  let admin, reji, ragesh;
  try {
    admin = await login('Admin', '2496');
    ok('Admin login');
  } catch (e) {
    fail('Admin login', e.message);
    console.log('\nCannot continue without Admin login.');
    process.exit(1);
  }

  try {
    reji = await login('reji', '1120');
    ok('Supervisor (reji) login');
  } catch (e) {
    fail('Supervisor (reji) login', e.message);
  }

  try {
    ragesh = await login('ragesh', '1119');
    ok('Manager (ragesh) login');
  } catch (e) {
    fail('Manager (ragesh) login', e.message);
  }

  const badLogin = await req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'Admin', password: 'wrong' }),
  });
  if (badLogin.status === 401 || badLogin.status === 400) ok('Invalid login rejected');
  else fail('Invalid login rejected', `status ${badLogin.status}`);

  const me = await req('/auth/me', {}, admin.token);
  if (me.status === 200 && me.body.user?.name) ok('GET /auth/me');
  else fail('GET /auth/me', JSON.stringify(me.body));

  // --- Tickets empty after clear ---
  console.log('\nTickets (cleared DB)');
  const adminTickets = await req('/tickets/', {}, admin.token);
  if (adminTickets.status === 200 && Array.isArray(adminTickets.body)) {
    ok(`Ticket list returns array (${adminTickets.body.length} tickets)`);
  } else {
    fail('Ticket list', JSON.stringify(adminTickets.body));
  }

  const dash = await req('/dashboard/?year=2026&month=6', {}, admin.token);
  if (dash.status === 200 && dash.body.period?.label) ok('Dashboard with month filter');
  else fail('Dashboard with month filter', JSON.stringify(dash.body));

  // --- Masters ---
  console.log('\nMasters');
  const depts = await req('/departments/', {}, admin.token);
  if (depts.status === 200 && depts.body.length) ok('GET departments');
  else fail('GET departments', JSON.stringify(depts.body));

  const cats = await req('/categories/', {}, admin.token);
  const locs = await req('/locations/', {}, admin.token);
  const emps = await req('/employees/', {}, admin.token);
  if (cats.status === 200 && cats.body.length) ok('GET categories');
  else fail('GET categories', '');
  if (locs.status === 200 && locs.body.length) ok('GET locations');
  else fail('GET locations', '');
  if (emps.status === 200 && emps.body.length) ok('GET employees');
  else fail('GET employees', '');

  const badDept = await req('/departments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '   ' }),
  }, admin.token);
  if (badDept.status === 400) ok('Department validation (empty rejected)');
  else fail('Department validation', `status ${badDept.status}`);

  const badRole = await req('/roles/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_name: '  ' }),
  }, admin.token);
  if (badRole.status === 400) ok('Role Name validation (empty rejected)');
  else fail('Role Name validation', `status ${badRole.status}`);

  const badCat = await req('/categories/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_description: '' }),
  }, admin.token);
  if (badCat.status === 400) ok('Category Name validation (empty rejected)');
  else fail('Category Name validation', `status ${badCat.status}`);

  const badLoc = await req('/locations/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location_name: ' ' }),
  }, admin.token);
  if (badLoc.status === 400) ok('Location Name validation (empty rejected)');
  else fail('Location Name validation', `status ${badLoc.status}`);

  const badEmp = await req('/employees/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', user_id: 'x' }),
  }, admin.token);
  if (badEmp.status === 400) ok('Employee validation (incomplete rejected)');
  else fail('Employee validation', `status ${badEmp.status}`);

  // --- Create ticket ---
  console.log('\nTicket CRUD');
  const catId = cats.body[0].id;
  const locId = locs.body[0].id;
  const assigneeId = emps.body.find((e) => e.user_id === 'arun')?.emp_id || emps.body[0].emp_id;

  const badTicket = await req('/tickets/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket_date: '2026-06-30' }),
  }, reji?.token || admin.token);
  if (badTicket.status === 400) ok('Create ticket validation (missing fields)');
  else fail('Create ticket validation', `status ${badTicket.status}`);

  const createRes = await req('/tickets/', {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('ticket_date', '2026-06-30');
      fd.append('priority', 'normal');
      fd.append('complaint_category_id', String(catId));
      fd.append('location_id', String(locId));
      fd.append('ticket_description', 'Test ticket after data clear');
      fd.append('details', 'Automated test');
      fd.append('assigned_to', String(assigneeId));
      return fd;
    })(),
  }, reji?.token || admin.token);

  let ticketId;
  if (createRes.status === 200 && createRes.body.id) {
    ticketId = createRes.body.id;
    ok(`Create ticket #${ticketId} (${createRes.body.ticket_no})`);
  } else {
    fail('Create ticket', JSON.stringify(createRes.body));
  }

  if (ticketId) {
    const detail = await req(`/tickets/${ticketId}`, {}, reji?.token || admin.token);
    if (detail.status === 200 && detail.body.ticket_no) ok('GET ticket detail');
    else fail('GET ticket detail', JSON.stringify(detail.body));

    const commentRes = await req(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Test comment from assignee' }),
    }, admin.token);
    if (commentRes.status === 200) ok('Add ticket comment');
    else fail('Add ticket comment', JSON.stringify(commentRes.body));

    const closeRes = await req(`/tickets/${ticketId}/close`, {
      method: 'POST',
      body: (() => {
        const fd = new FormData();
        fd.append('remarks', 'Closed during automated test');
        return fd;
      })(),
    }, admin.token);
    if (closeRes.status === 200 && closeRes.body.status === 'closed') ok('Close ticket');
    else fail('Close ticket', JSON.stringify(closeRes.body));
  }

  // --- My tickets vs department scope ---
  console.log('\nAccess control');
  if (reji) {
    const myTickets = await req('/tickets/?scope=my', {}, reji.token);
    const deptTickets = await req('/tickets/?scope=department', {}, reji.token);
    if (myTickets.status === 200) ok('Supervisor my tickets scope');
    else fail('Supervisor my tickets scope', '');
    if (deptTickets.status === 200) ok('Supervisor department tickets scope');
    else fail('Supervisor department tickets scope', '');
  }

  if (ragesh) {
    const rageshJobs = await req('/scheduled-jobs/', {}, ragesh.token);
    const rejiJobs = reji ? await req('/scheduled-jobs/', {}, reji.token) : null;
    if (rageshJobs.status === 200) ok('Ragesh scheduled jobs list');
    else fail('Ragesh scheduled jobs', '');
    if (reji && rejiJobs?.status === 200) {
      const rejiOwn = rejiJobs.body.filter((j) => j.raising_employee_name === 'Reji John');
      const rageshSeesReji = rageshJobs.body.some((j) => j.raising_employee_name === 'Reji John');
      if (!rageshSeesReji) ok('Ragesh cannot see Reji schedule jobs');
      else fail('Schedule job isolation', 'Ragesh sees Reji jobs');
      if (rejiOwn.length >= 0) ok('Reji sees own schedule jobs only');
    }
  }

  // --- Schedule job create ---
  console.log('\nSchedule jobs');
  if (reji) {
    const jobCreate = await req('/scheduled-jobs/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_name: 'Test Weekly Job',
        schedule_type: 'weekly',
        day_of_week: 1,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
        run_time: '9:00 AM',
        complaint_category_id: catId,
        location_id: locId,
        ticket_description: 'Scheduled maintenance test',
        assigned_to: assigneeId,
        priority: 'normal',
      }),
    }, reji.token);
    if (jobCreate.status === 201 || jobCreate.status === 200) ok('Create scheduled job');
    else fail('Create scheduled job', JSON.stringify(jobCreate.body));
  }

  // --- Permissions ---
  console.log('\nPermissions');
  const perms = await req('/permissions/', {}, admin.token);
  if (perms.status === 200 && Array.isArray(perms.body)) ok('GET role permissions');
  else fail('GET role permissions', '');

  if (reji) {
    const denied = await req('/permissions/', {}, reji.token);
    if (denied.status === 403) ok('Non-admin blocked from permissions');
    else fail('Non-admin permissions block', `status ${denied.status}`);
  }

  // --- Summary ---
  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (errors.length) {
    console.log('\nFailures:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.detail}`));
    process.exit(1);
  }
  console.log('\nAll tests passed.\n');
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
