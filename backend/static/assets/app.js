// --- API helpers ---
const API = '/api';
const AUTH_KEY = 'ticket_auth';
const USER_KEY = 'ticket_user';
const FLASH_KEY = 'ticket_flash';

function getToken() {
  return sessionStorage.getItem(AUTH_KEY);
}

function getAuthUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setAuth(token, user) {
  sessionStorage.setItem(AUTH_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function setFlash(message, type = 'success') {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
}

function takeFlash() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized() {
  clearAuth();
  location.hash = '#/login';
  renderLogin();
}

async function parseErrorResponse(res) {
  const text = await res.text();
  try {
    const err = JSON.parse(text);
    if (typeof err.detail === 'string') return err.detail;
    if (Array.isArray(err.detail)) {
      return err.detail.map((e) => e.msg || String(e)).join(', ');
    }
  } catch {
    // not JSON
  }
  if (text && text.length < 300 && !text.includes('<html')) return text;
  return `Request failed (${res.status})`;
}

async function request(url, options = {}) {
  const res = await fetch(API + url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

async function postForm(url, formData) {
  const res = await fetch(API + url, { method: 'POST', body: formData, headers: authHeaders() });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

async function putForm(url, formData) {
  const res = await fetch(API + url, { method: 'PUT', body: formData, headers: authHeaders() });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

window.openAttachment = async (attachmentId, fileName) => {
  try {
    const res = await fetch(`${API}/attachments/${attachmentId}/file`, {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(await parseErrorResponse(res));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    alert(err.message || 'Unable to open document');
  }
};

window.loadAttachmentPreview = async (img) => {
  const id = img.dataset.attId;
  if (!id) return;
  try {
    const res = await fetch(`${API}/attachments/${id}/file`, { headers: authHeaders() });
    if (!res.ok) return;
    const blob = await res.blob();
    img.src = URL.createObjectURL(blob);
  } catch {
    // ignore preview errors
  }
};

// --- Router ---
const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const appHeader = document.getElementById('appHeader');
const contentArea = document.getElementById('contentArea');

function getPermissions() {
  return getAuthUser()?.permissions || {};
}

function can(perm) {
  return !!getPermissions()[perm];
}

function canAccessScheduleJobsNav() {
  return !!getAuthUser();
}

function canCreateScheduleJobs() {
  return !!getAuthUser();
}

function canEditScheduleJob(job) {
  const user = getAuthUser();
  if (!user || !job) return false;
  if (isAdminUser()) return true;
  return Number(job.raising_employee_id) === Number(user.emp_id);
}

function isAdminUser() {
  return String(getAuthUser()?.role_name || '').toLowerCase() === 'admin';
}

function isDeptViewer() {
  const name = String(getAuthUser()?.role_name || '').toLowerCase();
  return name === 'manager' || name.includes('supervisor');
}

function canModifyTicket(ticket) {
  if (!ticket || ticket.status === 'closed') return false;
  const user = getAuthUser();
  if (!user) return false;
  if (isAdminUser()) return true;
  if (Number(ticket.assigned_to) === Number(user.emp_id)) return true;
  if (can('can_edit')) return true;
  return false;
}

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  forwarded: 'Forwarded',
  closed: 'Closed',
  comment: 'Comment',
};

function updateStoredUser(user) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function refreshAuthUser() {
  try {
    const data = await request('/auth/me');
    if (data.user) {
      updateStoredUser(data.user);
      return data.user;
    }
  } catch {
    // ignore
  }
  return getAuthUser();
}

function getNavItems() {
  const items = [{ section: 'Main' }];
  items.push({ hash: '#/dashboard', label: 'Dashboard' });
  items.push({ section: 'Tickets' });
  if (isAdminUser() || can('can_view_all')) {
    items.push({ hash: '#/tickets', label: 'All Tickets' });
  } else {
    items.push({ hash: '#/tickets', label: 'My Tickets' });
  }
  if (can('can_create')) {
    items.push({ hash: '#/tickets/new', label: 'New Ticket' });
  }
  items.push({ hash: '#/schedule-jobs', label: 'Schedule Jobs' });
  if (isDeptViewer()) {
    items.push({ hash: '#/tickets/department', label: 'Department Tickets' });
  }
  if (can('can_manage_permissions')) {
    items.push({ section: 'Admin' });
    items.push({ hash: '#/admin/permissions', label: 'Role Permissions' });
  }
  if (can('can_manage_masters')) {
    items.push({ section: 'Masters' });
    items.push({ hash: '#/masters/departments', label: 'Departments' });
    if (isAdminUser()) {
      items.push({ hash: '#/masters/roles', label: 'Roles' });
    }
    items.push({ hash: '#/masters/employees', label: 'Employees' });
    items.push({ hash: '#/masters/categories', label: 'Categories' });
    items.push({ hash: '#/masters/locations', label: 'Locations' });
  }
  return items;
}

function navigate(hash) {
  location.hash = hash;
}

function renderSidebar() {
  const current = location.hash || '#/dashboard';
  sidebar.style.display = '';
  sidebar.innerHTML = '<h1>Ticketing System</h1>' + getNavItems().map(item => {
    if (item.section) return `<div class="section-title">${item.section}</div>`;
    const active = current === item.hash ? 'active' : '';
    return `<a class="${active}" href="${item.hash}">${item.label}</a>`;
  }).join('');
}

function renderHeader() {
  const user = getAuthUser();
  appHeader.style.display = 'flex';
  contentArea.style.display = 'flex';
  appHeader.innerHTML = `
    <div class="app-header-user">
      <span class="user-name">${esc(user?.name || '')}</span>
      <button type="button" class="btn btn-sm header-logout" onclick="logout()">Logout</button>
    </div>`;
}

function renderLogin() {
  sidebar.style.display = 'none';
  appHeader.style.display = 'none';
  contentArea.style.display = 'block';
  main.innerHTML = `
    <div class="login-page">
      <div class="login-card card">
        <h2 class="login-title">Ticketing System</h2>
        <p class="login-subtitle">Sign in with your employee credentials</p>
        <form id="loginForm" onsubmit="submitLogin(event)">
          <div class="form-group" style="margin-bottom:14px">
            <label>User ID</label>
            <input name="user_id" required autocomplete="username" />
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <div id="loginError" class="error"></div>
          <button type="submit" class="btn btn-primary" style="width:100%">Login</button>
        </form>
      </div>
    </div>`;
}

window.submitLogin = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: fd.get('user_id'),
        password: fd.get('password'),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    setAuth(data.token, data.user);
    await refreshAuthUser();
    navigate('#/dashboard');
  } catch (err) {
    errEl.textContent = err.message;
  }
};

window.logout = async () => {
  try {
    await fetch(API + '/auth/logout', { method: 'POST', headers: authHeaders() });
  } catch {
    // ignore
  }
  clearAuth();
  renderLogin();
};

function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

function priorityBadge(priority) {
  const value = priority || 'normal';
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return `<span class="badge badge-priority-${value}">${label}</span>`;
}

// --- Generic Master Page ---
const MASTERS = {
  departments: {
    title: 'Department Master',
    idKey: 'dept_id',
    fields: [{ key: 'description', label: 'Description' }],
    list: () => request('/departments/'),
    create: (d) => request('/departments/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    update: (id, d) => request(`/departments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    remove: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
  },
  roles: {
    title: 'Role Master',
    idKey: 'role_id',
    fields: [{ key: 'role_name', label: 'Role Name' }],
    list: () => request('/roles/'),
    create: (d) => request('/roles/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    update: (id, d) => request(`/roles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    remove: (id) => request(`/roles/${id}`, { method: 'DELETE' }),
  },
  categories: {
    title: 'Complaint Category Master',
    idKey: 'id',
    fields: [{ key: 'category_description', label: 'Category Description' }],
    list: () => request('/categories/'),
    create: (d) => request('/categories/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    update: (id, d) => request(`/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    remove: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  locations: {
    title: 'Location Master',
    idKey: 'id',
    fields: [{ key: 'location_name', label: 'Location Name' }],
    list: () => request('/locations/'),
    create: (d) => request('/locations/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    update: (id, d) => request(`/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    remove: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
  },
};

let masterState = { editId: null, form: {}, message: '', error: '' };

async function renderMaster(type) {
  const cfg = MASTERS[type];
  if (!cfg) return;
  const items = await cfg.list();

  const formFields = cfg.fields.map(f =>
    `<div class="form-group">
      <label>${f.label}</label>
      <input name="${f.key}" value="${esc(masterState.form[f.key] || '')}" required />
    </div>`
  ).join('');

  const tableRows = items.map(item => {
    const cells = cfg.fields.map(f => `<td>${esc(item[f.key])}</td>`).join('');
    return `<tr>
      ${cells}
      <td>
        <button class="btn btn-sm btn-primary" onclick="editMaster('${type}', ${item[cfg.idKey]})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMaster('${type}', ${item[cfg.idKey]})">Delete</button>
      </td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <h2 class="page-title">${cfg.title}</h2>
    <div class="card">
      <form id="masterForm" onsubmit="saveMaster(event, '${type}')">
        <div class="form-row">${formFields}</div>
        ${masterState.error ? `<div class="error">${esc(masterState.error)}</div>` : ''}
        ${masterState.message ? `<div class="success">${esc(masterState.message)}</div>` : ''}
        <button type="submit" class="btn btn-primary">${masterState.editId ? 'Update' : 'Save'}</button>
        ${masterState.editId ? '<button type="button" class="btn" onclick="cancelMaster()">Cancel</button>' : ''}
      </form>
    </div>
    <div class="card">
      <table>
        <thead><tr>${cfg.fields.map(f => `<th>${f.label}</th>`).join('')}<th>Actions</th></tr></thead>
        <tbody>${tableRows || `<tr><td colspan="${cfg.fields.length + 1}" style="text-align:center;color:#888">No records</td></tr>`}</tbody>
      </table>
    </div>`;
}

window.editMaster = async (type, id) => {
  const cfg = MASTERS[type];
  const items = await cfg.list();
  const item = items.find(i => i[cfg.idKey] === id);
  if (!item) return;
  masterState.editId = id;
  masterState.form = {};
  cfg.fields.forEach(f => { masterState.form[f.key] = item[f.key]; });
  masterState.message = '';
  masterState.error = '';
  renderMaster(type);
};

window.deleteMaster = async (type, id) => {
  if (!confirm('Are you sure?')) return;
  try {
    await MASTERS[type].remove(id);
    masterState.message = 'Deleted successfully';
    masterState.error = '';
    renderMaster(type);
  } catch (e) {
    masterState.error = e.message;
    renderMaster(type);
  }
};

window.cancelMaster = () => {
  masterState = { editId: null, form: {}, message: '', error: '' };
  const type = location.hash.replace('#/masters/', '');
  renderMaster(type);
};

window.saveMaster = async (e, type) => {
  e.preventDefault();
  const cfg = MASTERS[type];
  const fd = new FormData(e.target);
  const data = {};
  cfg.fields.forEach(f => { data[f.key] = fd.get(f.key); });
  try {
    if (masterState.editId) {
      await cfg.update(masterState.editId, data);
      masterState.message = 'Updated successfully';
    } else {
      await cfg.create(data);
      masterState.message = 'Created successfully';
    }
    masterState.editId = null;
    masterState.form = {};
    masterState.error = '';
    renderMaster(type);
  } catch (err) {
    masterState.error = err.message;
    renderMaster(type);
  }
};

// --- Employee Master (needs dropdowns) ---
async function renderEmployees() {
  const [employees, departments, roles] = await Promise.all([
    request('/employees/'), request('/departments/'), request('/roles/'),
  ]);

  if (!departments.length || !roles.length) {
    main.innerHTML = '<h2 class="page-title">Employee Master</h2><p>Please add Departments and Roles first.</p>';
    return;
  }

  const deptOpts = departments.map(d => `<option value="${d.dept_id}">${esc(d.description)}</option>`).join('');
  const roleOpts = roles.map(r => `<option value="${r.role_id}">${esc(r.role_name)}</option>`).join('');

  const rows = employees.map(e => `<tr>
    <td>${esc(e.name)}</td><td>${esc(e.user_id || '')}</td><td>${esc(e.department_name)}</td><td>${esc(e.role_name)}</td>
    <td>
      <button class="btn btn-sm btn-primary" onclick="editEmployee(${e.emp_id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${e.emp_id})">Delete</button>
    </td>
  </tr>`).join('');

  const f = masterState.form;
  const pwdHint = masterState.editId ? 'Leave blank to keep current password' : '';
  main.innerHTML = `
    <h2 class="page-title">Employee Master</h2>
    <div class="card">
      <form id="empForm" onsubmit="saveEmployee(event)">
        <div class="form-row">
          <div class="form-group"><label>Name</label><input name="name" value="${esc(f.name || '')}" required /></div>
          <div class="form-group"><label>User ID</label><input name="user_id" value="${esc(f.user_id || '')}" required /></div>
          <div class="form-group"><label>Password</label><input type="password" name="password" placeholder="${pwdHint}" ${masterState.editId ? '' : 'required'} /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Department</label>
            <select name="dept_id" required><option value="">-- Select --</option>${deptOpts}</select></div>
          <div class="form-group"><label>Role</label>
            <select name="role_id" required><option value="">-- Select --</option>${roleOpts}</select></div>
        </div>
        ${masterState.error ? `<div class="error">${esc(masterState.error)}</div>` : ''}
        ${masterState.message ? `<div class="success">${esc(masterState.message)}</div>` : ''}
        <button type="submit" class="btn btn-primary">${masterState.editId ? 'Update' : 'Save'}</button>
        ${masterState.editId ? '<button type="button" class="btn" onclick="cancelMaster()">Cancel</button>' : ''}
      </form>
    </div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>User ID</th><th>Department</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888">No records</td></tr>'}</tbody>
    </table></div>`;

  if (f.dept_id) document.querySelector('[name=dept_id]').value = f.dept_id;
  if (f.role_id) document.querySelector('[name=role_id]').value = f.role_id;
}

window.editEmployee = async (id) => {
  const employees = await request('/employees/');
  const emp = employees.find(e => e.emp_id === id);
  masterState = { editId: id, form: { name: emp.name, user_id: emp.user_id, dept_id: emp.dept_id, role_id: emp.role_id }, message: '', error: '' };
  renderEmployees();
};

window.deleteEmployee = async (id) => {
  if (!confirm('Are you sure?')) return;
  try {
    await request(`/employees/${id}`, { method: 'DELETE' });
    masterState.message = 'Deleted successfully';
    renderEmployees();
  } catch (e) { masterState.error = e.message; renderEmployees(); }
};

window.saveEmployee = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {
    name: fd.get('name'),
    user_id: fd.get('user_id'),
    dept_id: Number(fd.get('dept_id')),
    role_id: Number(fd.get('role_id')),
  };
  const pwd = fd.get('password');
  if (pwd) data.password = pwd;
  else if (!masterState.editId) {
    masterState.error = 'Password is required';
    return renderEmployees();
  }
  try {
    if (masterState.editId) {
      await request(`/employees/${masterState.editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else {
      await request('/employees/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    masterState = { editId: null, form: {}, message: 'Saved successfully', error: '' };
    renderEmployees();
  } catch (err) { masterState.error = err.message; renderEmployees(); }
};

// --- Dashboard ---
let dashMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

window.shiftDashMonth = (delta) => {
  let m = dashMonth.month + delta;
  let y = dashMonth.year;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  dashMonth = { year: y, month: m };
  renderDashboard();
};

window.resetDashMonth = () => {
  const now = new Date();
  dashMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
  renderDashboard();
};

function renderDashPeriodNav(period) {
  const now = new Date();
  const isCurrent = period?.year === now.getFullYear() && period?.month === now.getMonth() + 1;
  return `<div class="dash-period-nav">
    <button type="button" class="btn btn-sm" onclick="shiftDashMonth(-1)">← Previous</button>
    <span class="dash-period-label">${esc(period?.label || '')}</span>
    <button type="button" class="btn btn-sm" onclick="shiftDashMonth(1)">Next →</button>
    ${isCurrent ? '' : '<button type="button" class="btn btn-sm" onclick="resetDashMonth()">Current Month</button>'}
  </div>
  <p class="dash-period-hint">Statistics and tickets shown for this month only (by ticket date).</p>`;
}
function renderStatCards(summary, prefix = '') {
  const items = [
    { key: 'total', label: 'Total', cls: 'stat-total' },
    { key: 'open', label: 'Open', cls: 'stat-open' },
    { key: 'in_progress', label: 'In Progress', cls: 'stat-progress' },
    { key: 'forwarded', label: 'Forwarded', cls: 'stat-forwarded' },
    { key: 'closed', label: 'Completed', cls: 'stat-closed' },
  ];
  return `<div class="stat-grid">${items.map((item) =>
    `<div class="stat-card ${item.cls}">
      <div class="stat-value">${summary?.[item.key] || 0}</div>
      <div class="stat-label">${esc(item.label)}</div>
    </div>`
  ).join('')}</div>`;
}

function renderDashboardTicketTable(tickets, emptyText) {
  if (!tickets?.length) {
    return `<p class="dash-empty">${esc(emptyText)}</p>`;
  }
  const rows = tickets.map((t) => `<tr>
    <td><a href="#/tickets/${t.id}">${esc(t.ticket_no)}</a></td>
    <td>${esc(t.ticket_description)}</td>
    <td>${badge(t.status)}</td>
    <td>${priorityBadge(t.priority)}</td>
    <td>${esc(t.raising_employee_name)}</td>
    <td>${esc(t.assignee_name)}</td>
    <td>${t.ticket_date || '-'}</td>
    <td>${t.status === 'closed' ? formatDateTime(t.completed_at || t.updated_at) : '-'}</td>
    <td>${t.status === 'closed' ? esc(t.closed_by_name || '-') : '-'}</td>
    <td><a class="btn btn-sm btn-primary" href="#/tickets/${t.id}">View</a></td>
  </tr>`).join('');
  return `<div class="dash-table-wrap"><table>
    <thead><tr>
      <th>Ticket No</th><th>Description</th><th>Status</th><th>Priority</th>
      <th>Raised By</th><th>Assigned To</th><th>Date</th><th>Completed</th><th>Closed By</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

async function renderDashboard() {
  main.innerHTML = '<h2 class="page-title">Dashboard</h2><p>Loading...</p>';
  try {
    const data = await request(`/dashboard/?year=${dashMonth.year}&month=${dashMonth.month}`);
    const user = data.user || getAuthUser();
    const flash = takeFlash();
    const flashHtml = flash ? `<div class="${esc(flash.type)}">${esc(flash.message)}</div>` : '';

    let html = `
      <div class="header-row">
        <h2 class="page-title">Dashboard</h2>
      </div>
      ${flashHtml}
      <div class="card dash-period-card">
        ${renderDashPeriodNav(data.period)}
      </div>
      <div class="card dash-welcome">
        <h3>Welcome, ${esc(user?.name || '')}</h3>
        <p>${esc(user?.role_name || '')}${user?.department_name ? ` · ${esc(user.department_name)}` : ''}</p>
      </div>`;

    if (data.all_work) {
      html += `
      <div class="card">
        <h3 class="dash-section-title">All Tickets Overview</h3>
        ${renderStatCards(data.all_work.summary)}
      </div>`;
    }

    html += `
      <div class="card">
        <h3 class="dash-section-title">My Work</h3>
        ${renderStatCards(data.my_work.summary)}
      </div>
      <div class="card">
        <h3 class="dash-section-title">Assigned To Me</h3>
        ${renderDashboardTicketTable(data.my_work.assigned_to_me, 'No tickets assigned to you.')}
      </div>
      <div class="card">
        <h3 class="dash-section-title">Created By Me</h3>
        ${renderDashboardTicketTable(data.my_work.created_by_me, 'You have not created any tickets.')}
      </div>
      <div class="card">
        <h3 class="dash-section-title">My Completed Work</h3>
        ${renderDashboardTicketTable(data.my_work.completed, 'No completed tickets in your work.')}
      </div>`;

    if (data.department_work) {
      html += `
      <div class="card dash-dept-card">
        <h3 class="dash-section-title">Department Work — ${esc(data.department_work.department_name || user?.department_name || 'Department')}</h3>
        ${renderStatCards(data.department_work.summary)}
      </div>
      <div class="card">
        <h3 class="dash-section-title">Department — Assigned To Me</h3>
        ${renderDashboardTicketTable(data.department_work.assigned_to_me, 'No department tickets assigned to you.')}
      </div>
      <div class="card">
        <h3 class="dash-section-title">Department — Created By Me</h3>
        ${renderDashboardTicketTable(data.department_work.created_by_me, 'No department tickets created by you.')}
      </div>
      <div class="card">
        <h3 class="dash-section-title">All Department Tickets</h3>
        ${renderDashboardTicketTable(data.department_work.tickets, 'No tickets in your department.')}
      </div>
      <div class="card">
        <h3 class="dash-section-title">Department Completed Work</h3>
        ${renderDashboardTicketTable(data.department_work.completed, 'No completed tickets in your department.')}
      </div>`;
    }

    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = `<h2 class="page-title">Dashboard</h2><div class="error">${esc(e.message)}</div>`;
  }
}

// --- Schedule Jobs ---
const SCHEDULE_TYPE_LABELS = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  periodic: 'Periodic',
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let scheduleState = { editId: null, form: {}, message: '', error: '' };

function scheduleTypeSummary(job) {
  switch (job.schedule_type) {
    case 'once': return `Once on ${job.run_date || '-'}`;
    case 'daily': return 'Every day';
    case 'weekly': return `Weekly on ${DAY_NAMES[job.day_of_week] || '-'}`;
    case 'monthly': return `Monthly on day ${job.day_of_month || '-'}`;
    case 'periodic':
      return `Every ${job.interval_days} day(s)${job.end_date ? ` until ${job.end_date}` : ''}`;
    default: return job.schedule_type;
  }
}

function renderScheduleTypeFields(form = {}) {
  const type = form.schedule_type || 'once';
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="form-row schedule-fields schedule-once" style="display:${type === 'once' ? 'flex' : 'none'}">
      <div class="form-group"><label>Run Date</label>
        <input type="date" name="run_date" value="${esc(form.run_date || today)}" /></div>
    </div>
    <div class="form-row schedule-fields schedule-daily" style="display:${type === 'daily' ? 'flex' : 'none'}">
      <div class="form-group"><label>Start From</label>
        <input type="date" name="start_date" value="${esc(form.start_date || today)}" /></div>
    </div>
    <div class="form-row schedule-fields schedule-weekly" style="display:${type === 'weekly' ? 'flex' : 'none'}">
      <div class="form-group"><label>Day of Week</label>
        <select name="day_of_week">
          ${DAY_NAMES.map((d, i) => `<option value="${i}" ${Number(form.day_of_week) === i ? 'selected' : ''}>${d}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Start From</label>
        <input type="date" name="start_date" value="${esc(form.start_date || today)}" /></div>
    </div>
    <div class="form-row schedule-fields schedule-monthly" style="display:${type === 'monthly' ? 'flex' : 'none'}">
      <div class="form-group"><label>Day of Month</label>
        <input type="number" name="day_of_month" min="1" max="31" value="${esc(form.day_of_month || 1)}" /></div>
    </div>
    <div class="form-row schedule-fields schedule-periodic" style="display:${type === 'periodic' ? 'flex' : 'none'}">
      <div class="form-group"><label>Every (days)</label>
        <input type="number" name="interval_days" min="1" value="${esc(form.interval_days || 7)}" /></div>
      <div class="form-group"><label>Start Date</label>
        <input type="date" name="start_date" value="${esc(form.start_date || today)}" /></div>
      <div class="form-group"><label>End Date (optional)</label>
        <input type="date" name="end_date" value="${esc(form.end_date || '')}" /></div>
    </div>`;
}

window.onScheduleTypeChange = (sel) => {
  const type = sel.value;
  document.querySelectorAll('.schedule-fields').forEach((el) => { el.style.display = 'none'; });
  const target = document.querySelector(`.schedule-${type}`);
  if (target) target.style.display = 'flex';
};

async function renderScheduleJobs() {
  const [jobs, employees, categories, locations] = await Promise.all([
    request('/scheduled-jobs/'),
    request('/employees/'),
    request('/categories/'),
    request('/locations/'),
  ]);

  const form = scheduleState.form;
  const rows = jobs.map((j) => {
    const actions = canEditScheduleJob(j)
      ? `<button type="button" class="btn btn-sm" onclick="editScheduleJob(${j.id})">Edit</button>
         ${j.is_active ? `<button type="button" class="btn btn-sm btn-danger" onclick="closeScheduleJob(${j.id})">Close</button>` : ''}`
      : '';
    return `<tr>
    <td>${esc(j.job_name)}</td>
    <td>${esc(SCHEDULE_TYPE_LABELS[j.schedule_type] || j.schedule_type)}</td>
    <td>${esc(scheduleTypeSummary(j))}</td>
    <td>${esc(j.ticket_description)}</td>
    <td>${esc(j.assignee_name)}</td>
    <td>${esc(j.raising_employee_name || '-')}</td>
    <td>${j.next_run_date || '-'}</td>
    <td>${j.last_run_date || '-'}</td>
    <td>${j.is_active ? '<span class="badge badge-open">Active</span>' : '<span class="badge badge-closed">Inactive</span>'}</td>
    <td>${actions}</td>
  </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="header-row">
      <h2 class="page-title">Schedule Jobs</h2>
    </div>
    <p class="page-subtitle">Each employee can create scheduled jobs and manage only the jobs they created (view, edit, and close). Admin can manage all jobs.</p>
    <div class="card">
      <h3 class="dash-section-title">${scheduleState.editId ? 'Edit Scheduled Job' : 'New Scheduled Job'}</h3>
      ${scheduleState.error ? `<div class="error">${esc(scheduleState.error)}</div>` : ''}
      ${scheduleState.message ? `<div class="success">${esc(scheduleState.message)}</div>` : ''}
      <form id="scheduleJobForm" onsubmit="saveScheduleJob(event)">
        <div class="form-row">
          <div class="form-group"><label>Job Name</label>
            <input name="job_name" value="${esc(form.job_name || '')}" required /></div>
          <div class="form-group"><label>Schedule Type</label>
            <select name="schedule_type" onchange="onScheduleTypeChange(this)" required>
              ${Object.entries(SCHEDULE_TYPE_LABELS).map(([k, v]) =>
                `<option value="${k}" ${(form.schedule_type || 'once') === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select></div>
        </div>
        ${renderScheduleTypeFields(form)}
        <div class="form-row">
          <div class="form-group"><label>Complaint Category</label>
            <select name="complaint_category_id" required>
              <option value="">-- Select --</option>
              ${categories.map((c) => `<option value="${c.id}" ${Number(form.complaint_category_id) === c.id ? 'selected' : ''}>${esc(c.category_description)}</option>`).join('')}
            </select></div>
          <div class="form-group"><label>Location</label>
            <select name="location_id" required>
              <option value="">-- Select --</option>
              ${locations.map((l) => `<option value="${l.id}" ${Number(form.location_id) === l.id ? 'selected' : ''}>${esc(l.location_name)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Ticket Description</label>
            <input name="ticket_description" value="${esc(form.ticket_description || '')}" required /></div>
          <div class="form-group"><label>Assigned To</label>
            <select name="assigned_to" required>
              <option value="">-- Select --</option>
              ${employees.map((e) => `<option value="${e.emp_id}" ${Number(form.assigned_to) === e.emp_id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Priority</label>
            <select name="priority">
              ${['normal', 'moderate', 'urgent', 'critical'].map((p) =>
                `<option value="${p}" ${(form.priority || 'normal') === p ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
              ).join('')}
            </select></div>
          ${scheduleState.editId ? `<div class="form-group"><label>Status</label>
            <select name="is_active">
              <option value="1" ${form.is_active !== false && form.is_active !== 0 ? 'selected' : ''}>Active</option>
              <option value="0" ${form.is_active === false || form.is_active === 0 ? 'selected' : ''}>Inactive</option>
            </select></div>` : ''}
        </div>
        <div class="form-group" style="margin-bottom:14px"><label>Details (optional)</label>
          <textarea name="details">${esc(form.details || '')}</textarea></div>
        <button type="submit" class="btn btn-primary">${scheduleState.editId ? 'Update Job' : 'Create Job'}</button>
        ${scheduleState.editId ? '<button type="button" class="btn" onclick="cancelScheduleJob()" style="margin-left:8px">Cancel</button>' : ''}
      </form>
    </div>
    <div class="card">
      <h3 class="dash-section-title">Scheduled Jobs</h3>
      <div class="dash-table-wrap"><table>
        <thead><tr>
          <th>Job Name</th><th>Type</th><th>Schedule</th><th>Description</th>
          <th>Assignee</th><th>Created By</th><th>Next Run</th><th>Last Run</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#888">No scheduled jobs yet</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

window.editScheduleJob = async (id) => {
  try {
    const job = await request(`/scheduled-jobs/${id}`);
    if (!canEditScheduleJob(job)) {
      scheduleState.error = 'You do not have permission to edit this job';
      renderScheduleJobs();
      return;
    }
    scheduleState.editId = id;
    scheduleState.form = { ...job };
    scheduleState.message = '';
    scheduleState.error = '';
    renderScheduleJobs();
  } catch (e) {
    scheduleState.error = e.message;
    renderScheduleJobs();
  }
};

window.cancelScheduleJob = () => {
  scheduleState = { editId: null, form: {}, message: '', error: '' };
  renderScheduleJobs();
};

window.closeScheduleJob = async (id) => {
  if (!confirm('Close this scheduled job? No more tickets will be auto-created.')) return;
  try {
    const job = await request(`/scheduled-jobs/${id}`);
    if (!canEditScheduleJob(job)) {
      scheduleState.error = 'You do not have permission to close this job';
      renderScheduleJobs();
      return;
    }
    await request(`/scheduled-jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...job, is_active: false }),
    });
    scheduleState.message = 'Job closed successfully';
    scheduleState.error = '';
    if (scheduleState.editId === id) {
      scheduleState.editId = null;
      scheduleState.form = {};
    }
    renderScheduleJobs();
  } catch (e) {
    scheduleState.error = e.message;
    renderScheduleJobs();
  }
};

window.deleteScheduleJob = async (id) => {
  if (!confirm('Delete this scheduled job?')) return;
  try {
    await request(`/scheduled-jobs/${id}`, { method: 'DELETE' });
    scheduleState.message = 'Job deleted';
    scheduleState.error = '';
    if (scheduleState.editId === id) {
      scheduleState.editId = null;
      scheduleState.form = {};
    }
    await refreshAuthUser();
    renderSidebar();
    renderScheduleJobs();
  } catch (e) {
    scheduleState.error = e.message;
    renderScheduleJobs();
  }
};

window.saveScheduleJob = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {};
  ['job_name', 'schedule_type', 'run_date', 'start_date', 'end_date', 'day_of_week', 'day_of_month',
    'interval_days', 'complaint_category_id', 'location_id', 'ticket_description', 'details',
    'assigned_to', 'priority'].forEach((k) => {
    const v = fd.get(k);
    if (v !== null && v !== '') data[k] = v;
  });
  if (scheduleState.editId) {
    data.is_active = fd.get('is_active') === '1';
  }
  try {
    if (scheduleState.editId) {
      await request(`/scheduled-jobs/${scheduleState.editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      scheduleState.message = 'Job updated successfully';
    } else {
      await request('/scheduled-jobs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      scheduleState.message = 'Job created successfully';
    }
    scheduleState.editId = null;
    scheduleState.form = {};
    scheduleState.error = '';
    await refreshAuthUser();
    renderSidebar();
    renderScheduleJobs();
  } catch (err) {
    scheduleState.error = err.message;
    renderScheduleJobs();
  }
};

// --- Ticket List ---
async function renderTicketList(scope) {
  if (!can('can_view')) {
    main.innerHTML = '<h2 class="page-title">Tickets</h2><div class="error">You do not have permission to view tickets.</div>';
    return;
  }

  let listTitle = 'My Tickets';
  let apiUrl = '/tickets/?scope=my';
  if (isAdminUser() || can('can_view_all')) {
    listTitle = 'All Tickets';
    apiUrl = '/tickets/';
  } else if (scope === 'department' && isDeptViewer()) {
    listTitle = 'Department Tickets';
    apiUrl = '/tickets/?scope=department';
  }

  main.innerHTML = `<h2 class="page-title">${listTitle}</h2><p>Loading...</p>`;
  try {
    const tickets = await request(apiUrl);
    const rows = tickets.map(t => `<tr>
      <td>${esc(t.ticket_no)}</td><td>${t.ticket_date}</td><td>${esc(t.ticket_description)}</td>
      <td>${esc(t.category_name)}</td><td>${esc(t.location_name)}</td>
      <td>${esc(t.raising_employee_name)}</td><td>${esc(t.assignee_name)}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${badge(t.status)}</td>
      <td><a class="btn btn-sm btn-primary" href="#/tickets/${t.id}">View</a></td>
    </tr>`).join('');

    const newBtn = can('can_create')
      ? `<a class="btn btn-primary" href="#/tickets/new">+ New Ticket</a>`
      : '';

    const flash = takeFlash();
    const flashHtml = flash
      ? `<div class="${esc(flash.type)}">${esc(flash.message)}</div>`
      : '';

    main.innerHTML = `
      <div class="header-row">
        <h2 class="page-title">${listTitle}</h2>
        ${newBtn}
      </div>
      ${flashHtml}
      <div class="card"><table>
        <thead><tr><th>Ticket No</th><th>Date</th><th>Description</th><th>Category</th><th>Location</th><th>Raised By</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" style="text-align:center;color:#888">No tickets ${isAdminUser() || can('can_view_all') ? '' : scope === 'department' ? 'in your department' : 'for you'}</td></tr>`}</tbody>
      </table></div>`;
  } catch (e) {
    main.innerHTML = `<h2 class="page-title">${listTitle}</h2><div class="error">${esc(e.message)}</div>`;
  }
}

// --- New Ticket ---
async function renderNewTicket() {
  if (!can('can_create')) {
    main.innerHTML = '<h2 class="page-title">Create New Ticket</h2><div class="error">You do not have permission to create tickets.</div>';
    return;
  }
  const [employees, categories, locations] = await Promise.all([
    request('/employees/'), request('/categories/'), request('/locations/'),
  ]);

  const today = new Date().toISOString().split('T')[0];
  main.innerHTML = `
    <h2 class="page-title">Create New Ticket</h2>
    <div class="card">
      <form id="newTicketForm" onsubmit="submitNewTicket(event)">
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" name="ticket_date" value="${today}" required /></div>
          <div class="form-group"><label>Priority</label>
            <select name="priority" required>
              <option value="normal">Normal</option>
              <option value="moderate">Moderate</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Complaint Category</label>
            <select name="complaint_category_id" required>
              <option value="">-- Select --</option>
              ${categories.map(c => `<option value="${c.id}">${esc(c.category_description)}</option>`).join('')}
            </select></div>
          <div class="form-group"><label>Location</label>
            <select name="location_id" required>
              <option value="">-- Select --</option>
              ${locations.map(l => `<option value="${l.id}">${esc(l.location_name)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Ticket Description</label><input name="ticket_description" required /></div>
          <div class="form-group"><label>Assigned To</label>
            <select name="assigned_to" required>
              <option value="">-- Select --</option>
              ${employees.map(e => `<option value="${e.emp_id}">${esc(e.name)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-group" style="margin-bottom:14px"><label>Details</label><textarea name="details"></textarea></div>
        <div class="form-group" style="margin-bottom:14px"><label>Upload Document (optional)</label><input type="file" name="files" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.ppt,.pptx" multiple /></div>
        <div class="form-group" style="margin-bottom:14px"><label>Upload Pictures (optional)</label><input type="file" name="images" accept="image/*" multiple /></div>
        <div id="formError" class="error"></div>
        <button type="submit" class="btn btn-primary">Create Ticket</button>
        <a class="btn" href="#/tickets" style="margin-left:8px">Cancel</a>
      </form>
    </div>`;
}

window.submitNewTicket = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const imageFiles = e.target.querySelector('[name=images]').files;
  const documentFiles = e.target.querySelector('[name=files]').files;
  const formData = new FormData();
  ['ticket_date','priority','complaint_category_id','location_id','ticket_description','details','assigned_to'].forEach(k => {
    if (fd.get(k)) formData.append(k, fd.get(k));
  });
  for (const f of imageFiles) formData.append('images', f);
  for (const f of documentFiles) formData.append('files', f);
  try {
    await postForm('/tickets/', formData);
    navigate('#/tickets');
  } catch (err) {
    document.getElementById('formError').textContent = err.message;
  }
};

// --- Ticket Detail ---
let ticketModal = null;

async function renderTicketDetail(id) {
  main.innerHTML = '<p>Loading...</p>';
  try {
    const [ticket, employees, categories, locations] = await Promise.all([
      request(`/tickets/${id}`), request('/employees/'), request('/categories/'), request('/locations/'),
    ]);

    const imageAttachments = ticket.attachments.filter(a => a.file_type !== 'file');
    const fileAttachments = ticket.attachments.filter(a => a.file_type === 'file');

    const imgs = imageAttachments.map(a =>
      `<a href="#" onclick="openAttachment(${a.id}); return false;" class="att-image-link">
        <img class="att-thumb" data-att-id="${a.id}" alt="${esc(a.file_name)}" />
      </a>`
    ).join('');

    const docs = fileAttachments.map(a =>
      `<a href="#" onclick="openAttachment(${a.id}); return false;" class="btn" style="margin-right:8px;margin-bottom:8px;display:inline-block">${esc(a.file_name)}</a>`
    ).join('');

    const history = ticket.history.map(h => {
      const label = ACTION_LABELS[h.action] || h.action;
      const by = h.action_by_name ? ` by ${esc(h.action_by_name)}` : '';
      return `<div class="history-item"><strong>${esc(label)}</strong>${by}
        <div class="history-remarks">${esc(h.remarks || '')}</div>
        <div class="time">${new Date(h.created_at).toLocaleString()}</div></div>`;
    }).join('');

    const isClosed = ticket.status === 'closed';
    const canEdit = canModifyTicket(ticket);
    const user = getAuthUser();
    const isAssignee = user && Number(ticket.assigned_to) === Number(user.emp_id);

    main.innerHTML = `
      <div class="header-row">
        <h2 class="page-title">Ticket: ${esc(ticket.ticket_no)}</h2>
        <a class="btn" href="#/tickets">Back to List</a>
      </div>
      <div id="ticketMsg"></div>
      <div class="card">
        <div class="form-row">
          <div class="form-group"><label>Status</label><div>${badge(ticket.status)}</div></div>
          <div class="form-group"><label>Priority</label><div>${priorityBadge(ticket.priority)}</div></div>
          <div class="form-group"><label>Date</label><div>${ticket.ticket_date}</div></div>
          <div class="form-group"><label>Category</label><div>${esc(ticket.category_name)}</div></div>
          <div class="form-group"><label>Location</label><div>${esc(ticket.location_name)}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Raising Dept</label><div>${esc(ticket.raising_dept_name)}</div></div>
          <div class="form-group"><label>Raised By</label><div>${esc(ticket.raising_employee_name)}</div></div>
          <div class="form-group"><label>Assigned To</label><div>${esc(ticket.assignee_name)}</div></div>
        </div>
        <div class="form-group"><label>Description</label><div>${esc(ticket.ticket_description)}</div></div>
        <div class="form-group"><label>Details</label><div>${esc(ticket.details) || '-'}</div></div>
        ${docs ? `<div class="form-group"><label>Documents</label><div>${docs}</div></div>` : ''}
        ${imgs ? `<div class="form-group"><label>Pictures</label><div class="image-preview">${imgs}</div></div>` : ''}
      </div>
      ${canEdit ? `
      <div class="card">
        <h3 style="margin-bottom:12px;font-size:16px">Ticket Actions${isAssignee ? ' <span class="badge badge-in_progress">Assigned to you</span>' : ''}</h3>
        <button class="btn btn-primary" onclick="openModal('update',${id})">Update Ticket</button>
        <button class="btn btn-warning" onclick="openModal('forward',${id})">Reassign Ticket</button>
        <button class="btn btn-success" onclick="openModal('close',${id})">Close Ticket</button>
      </div>` : ''}
      ${!isClosed ? `
      <div class="card">
        <h3 style="margin-bottom:12px;font-size:16px">Add Comment</h3>
        <div class="form-group" style="margin-bottom:10px">
          <label>Comment *</label>
          <textarea id="ticketComment" placeholder="Enter your comment..." required></textarea>
        </div>
        <div id="commentError" class="error"></div>
        <button type="button" class="btn btn-primary" onclick="submitTicketComment(${id})">Add Comment</button>
      </div>` : ''}
      ${history ? `<div class="card"><h3 style="margin-bottom:12px;font-size:16px">Comments &amp; History</h3>${history}</div>` : ''}`;

    window._ticketData = { ticket, employees, categories, locations };
    main.querySelectorAll('img.att-thumb').forEach((img) => loadAttachmentPreview(img));
  } catch (e) {
    main.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

window.openModal = (type, ticketId) => {
  const { ticket, employees, categories, locations } = window._ticketData;
  let body = '';

  if (type === 'update') {
    body = `
      <div class="form-group" style="margin-bottom:10px"><label>Description</label>
        <input id="m_desc" value="${esc(ticket.ticket_description)}" /></div>
      <div class="form-group" style="margin-bottom:10px"><label>Details</label>
        <textarea id="m_details">${esc(ticket.details || '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Category</label>
          <select id="m_cat">${categories.map(c => `<option value="${c.id}" ${c.id===ticket.complaint_category_id?'selected':''}>${esc(c.category_description)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Location</label>
          <select id="m_loc">${locations.map(l => `<option value="${l.id}" ${l.id===ticket.location_id?'selected':''}>${esc(l.location_name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-group" style="margin-bottom:10px"><label>Priority</label>
        <select id="m_priority" required>
          <option value="normal" ${(ticket.priority||'normal')==='normal'?'selected':''}>Normal</option>
          <option value="moderate" ${ticket.priority==='moderate'?'selected':''}>Moderate</option>
          <option value="urgent" ${ticket.priority==='urgent'?'selected':''}>Urgent</option>
          <option value="critical" ${ticket.priority==='critical'?'selected':''}>Critical</option>
        </select></div>`;
  } else if (type === 'forward') {
    body = `<div class="form-group" style="margin-bottom:10px"><label>Forward To</label>
      <select id="m_forward" required><option value="">-- Select --</option>
        ${employees.filter(e => e.emp_id !== ticket.assigned_to).map(e => `<option value="${e.emp_id}">${esc(e.name)}</option>`).join('')}
      </select></div>`;
  }

  body += `
    <div class="form-group" style="margin-bottom:10px"><label>Comment *</label><textarea id="m_remarks" required placeholder="Enter a comment explaining this action..."></textarea></div>`;

  if (type === 'update') {
    body += `
    <div class="form-group" style="margin-bottom:10px"><label>Upload Document</label><input type="file" id="m_files" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.ppt,.pptx" multiple /></div>
    <div class="form-group" style="margin-bottom:10px"><label>Upload Pictures</label><input type="file" id="m_images" accept="image/*" multiple /></div>`;
  } else {
    body += `
    <div class="form-group" style="margin-bottom:10px"><label>Upload Pictures</label><input type="file" id="m_images" accept="image/*" multiple /></div>`;
  }

  body += `
    <div id="modalError" class="error"></div>`;

  const titles = { update: 'Update Ticket', forward: 'Reassign Ticket', close: 'Close Ticket' };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <h3>${titles[type]}</h3>
    ${body}
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn ${type==='close'?'btn-success':'btn-primary'}" id="modalSubmit">${titles[type]}</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  ticketModal = overlay;

  document.getElementById('modalSubmit').onclick = async () => {
    const fd = new FormData();
    const remarks = document.getElementById('m_remarks').value.trim();
    if (!remarks) {
      document.getElementById('modalError').textContent = 'Comment is required';
      return;
    }
    fd.append('remarks', remarks);
    const imgs = document.getElementById('m_images').files;
    for (const f of imgs) fd.append('images', f);

    try {
      if (type === 'update') {
        const docs = document.getElementById('m_files').files;
        for (const f of docs) fd.append('files', f);
        fd.append('ticket_description', document.getElementById('m_desc').value);
        fd.append('details', document.getElementById('m_details').value);
        fd.append('complaint_category_id', document.getElementById('m_cat').value);
        fd.append('location_id', document.getElementById('m_loc').value);
        fd.append('priority', document.getElementById('m_priority').value);
        await putForm(`/tickets/${ticketId}`, fd);
      } else if (type === 'forward') {
        const fwd = document.getElementById('m_forward').value;
        if (!fwd) { document.getElementById('modalError').textContent = 'Select employee'; return; }
        fd.append('forward_to', fwd);
        await postForm(`/tickets/${ticketId}/forward`, fd);
        closeModal();
        const user = getAuthUser();
        if (Number(fwd) !== Number(user?.emp_id)) {
          setFlash('Ticket reassigned successfully');
          navigate('#/tickets');
          return;
        }
      } else {
        await postForm(`/tickets/${ticketId}/close`, fd);
      }
      closeModal();
      await renderTicketDetail(ticketId);
      const msgEl = document.getElementById('ticketMsg');
      if (msgEl) {
        msgEl.innerHTML = '<div class="success">Action completed successfully</div>';
      }
    } catch (err) {
      document.getElementById('modalError').textContent = err.message;
    }
  };
};

window.closeModal = () => {
  if (ticketModal) { ticketModal.remove(); ticketModal = null; }
};

window.submitTicketComment = async (ticketId) => {
  const commentEl = document.getElementById('ticketComment');
  const errEl = document.getElementById('commentError');
  errEl.textContent = '';
  const remarks = commentEl.value.trim();
  if (!remarks) {
    errEl.textContent = 'Comment is required';
    return;
  }
  try {
    await request(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks }),
    });
    commentEl.value = '';
    renderTicketDetail(ticketId);
    document.getElementById('ticketMsg').innerHTML = '<div class="success">Comment added successfully</div>';
  } catch (err) {
    errEl.textContent = err.message;
  }
};

// --- Role Permissions Admin ---
const STAFF_PERM_LABELS = [
  { key: 'can_create', label: 'Create Tickets' },
  { key: 'can_view', label: 'View Tickets' },
  { key: 'can_edit', label: 'Edit / Forward / Close' },
];

const ADMIN_PERM_LABELS = [
  { key: 'can_view_all', label: 'View All Tickets' },
  { key: 'can_manage_permissions', label: 'Manage Permissions' },
  { key: 'can_manage_masters', label: 'Manage Masters' },
];

const PERM_LABELS = [...STAFF_PERM_LABELS, ...ADMIN_PERM_LABELS];

function isAdminRoleName(name) {
  return String(name || '').toLowerCase() === 'admin';
}

let permState = { rows: [], message: '', error: '' };

async function renderPermissionsAdmin() {
  if (!can('can_manage_permissions')) {
    main.innerHTML = '<h2 class="page-title">Role Permissions</h2><div class="error">You do not have permission to manage role permissions.</div>';
    return;
  }

  main.innerHTML = '<h2 class="page-title">Role Permissions</h2><p>Loading...</p>';
  try {
    permState.rows = await request('/permissions/');
    renderPermissionsTable();
  } catch (e) {
    main.innerHTML = `<h2 class="page-title">Role Permissions</h2><div class="error">${esc(e.message)}</div>`;
  }
}

function renderPermissionsTable() {
  const header = PERM_LABELS.map(p => `<th>${p.label}</th>`).join('');
  const body = permState.rows.map(row => {
    const isAdmin = row.is_admin || isAdminRoleName(row.role_name);
    const checks = PERM_LABELS.map(p => {
      const checked = isAdmin ? true : !!row.permissions[p.key];
      const disabled = isAdmin || ADMIN_PERM_LABELS.some(a => a.key === p.key);
      return `<td class="perm-cell"><input type="checkbox" data-role="${row.role_id}" data-perm="${p.key}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} /></td>`;
    }).join('');
    const tag = isAdmin ? ' <span class="badge badge-closed">Full Access</span>' : '';
    return `<tr><td><strong>${esc(row.role_name)}</strong>${tag}</td>${checks}</tr>`;
  }).join('');

  main.innerHTML = `
    <h2 class="page-title">Role Permissions</h2>
    <p class="perm-hint">Only the <strong>Admin</strong> role has full system access. Each employee can create scheduled jobs and view, edit, and close only the jobs they created.</p>
    ${permState.message ? `<div class="success">${esc(permState.message)}</div>` : ''}
    ${permState.error ? `<div class="error">${esc(permState.error)}</div>` : ''}
    <div class="card perm-table-wrap">
      <table class="perm-table">
        <thead><tr><th>Role</th>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-primary" onclick="saveAllPermissions()">Save Permissions</button>`;
}

window.saveAllPermissions = async () => {
  permState.message = '';
  permState.error = '';
  try {
    for (const row of permState.rows) {
      if (row.is_admin || isAdminRoleName(row.role_name)) continue;
      const payload = {};
      STAFF_PERM_LABELS.forEach(p => {
        const el = document.querySelector(`input[data-role="${row.role_id}"][data-perm="${p.key}"]`);
        payload[p.key] = el ? el.checked : false;
      });
      const updated = await request(`/permissions/${row.role_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      row.permissions = updated.permissions;
    }
    await refreshAuthUser();
    permState.message = 'Permissions saved successfully';
    renderPermissionsTable();
    renderSidebar();
  } catch (e) {
    permState.error = e.message;
    renderPermissionsTable();
  }
};

// --- Route handler ---
async function route() {
  const hash = location.hash || '#/dashboard';

  if (!getToken()) {
    if (hash !== '#/login') location.hash = '#/login';
    return renderLogin();
  }

  if (hash === '#/login') {
    navigate('#/dashboard');
    return;
  }

  await refreshAuthUser();
  renderSidebar();
  renderHeader();
  masterState = { editId: null, form: {}, message: '', error: '' };

  if (hash === '#/dashboard') return renderDashboard();
  if (hash === '#/schedule-jobs') return renderScheduleJobs();
  if (hash === '#/tickets/department') return renderTicketList('department');
  if (hash === '#/tickets') return renderTicketList('my');
  if (hash === '#/tickets/new') return renderNewTicket();
  if (hash.startsWith('#/tickets/')) {
    const id = hash.split('/')[2];
    if (id && id !== 'new' && id !== 'department') return renderTicketDetail(id);
  }
  if (hash === '#/admin/permissions') return renderPermissionsAdmin();
  if (hash === '#/masters/employees') {
    if (!can('can_manage_masters')) {
      main.innerHTML = '<div class="error">You do not have permission to access master data.</div>';
      return;
    }
    return renderEmployees();
  }
  if (hash.startsWith('#/masters/')) {
    if (!can('can_manage_masters')) {
      main.innerHTML = '<div class="error">You do not have permission to access master data.</div>';
      return;
    }
    const type = hash.replace('#/masters/', '');
    if (type === 'roles' && !isAdminUser()) {
      main.innerHTML = '<div class="error">Only Admin users can access the Roles master.</div>';
      return;
    }
    if (MASTERS[type]) return renderMaster(type);
  }
  renderDashboard();
}

window.addEventListener('hashchange', route);
route();
