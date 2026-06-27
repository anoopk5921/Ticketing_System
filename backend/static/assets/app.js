// --- API helpers ---
const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(API + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed');
  }
  return res.json();
}

async function postForm(url, formData) {
  const res = await fetch(API + url, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed');
  }
  return res.json();
}

async function putForm(url, formData) {
  const res = await fetch(API + url, { method: 'PUT', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed');
  }
  return res.json();
}

// --- Router ---
const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');

const NAV = [
  { section: 'Tickets' },
  { hash: '#/tickets', label: 'All Tickets' },
  { hash: '#/tickets/new', label: 'New Ticket' },
  { section: 'Masters' },
  { hash: '#/masters/departments', label: 'Departments' },
  { hash: '#/masters/roles', label: 'Roles' },
  { hash: '#/masters/employees', label: 'Employees' },
  { hash: '#/masters/categories', label: 'Categories' },
  { hash: '#/masters/locations', label: 'Locations' },
];

function navigate(hash) {
  location.hash = hash;
}

function renderSidebar() {
  const current = location.hash || '#/tickets';
  sidebar.innerHTML = '<h1>Ticketing System</h1>' + NAV.map(item => {
    if (item.section) return `<div class="section-title">${item.section}</div>`;
    const active = current === item.hash ? 'active' : '';
    return `<a class="${active}" href="${item.hash}">${item.label}</a>`;
  }).join('');
}

function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
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

// --- Ticket List ---
async function renderTicketList() {
  main.innerHTML = '<h2 class="page-title">Tickets</h2><p>Loading...</p>';
  try {
    const tickets = await request('/tickets/');
    const rows = tickets.map(t => `<tr>
      <td>${esc(t.ticket_no)}</td><td>${t.ticket_date}</td><td>${esc(t.ticket_description)}</td>
      <td>${esc(t.category_name)}</td><td>${esc(t.location_name)}</td>
      <td>${esc(t.raising_employee_name)}</td><td>${esc(t.assignee_name)}</td>
      <td>${badge(t.status)}</td>
      <td><a class="btn btn-sm btn-primary" href="#/tickets/${t.id}">View</a></td>
    </tr>`).join('');

    main.innerHTML = `
      <div class="header-row">
        <h2 class="page-title">Tickets</h2>
        <a class="btn btn-primary" href="#/tickets/new">+ New Ticket</a>
      </div>
      <div class="card"><table>
        <thead><tr><th>Ticket No</th><th>Date</th><th>Description</th><th>Category</th><th>Location</th><th>Raised By</th><th>Assigned To</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#888">No tickets</td></tr>'}</tbody>
      </table></div>`;
  } catch (e) {
    main.innerHTML = `<h2 class="page-title">Tickets</h2><div class="error">${esc(e.message)}</div>`;
  }
}

// --- New Ticket ---
async function renderNewTicket() {
  const [departments, employees, categories, locations] = await Promise.all([
    request('/departments/'), request('/employees/'), request('/categories/'), request('/locations/'),
  ]);

  const today = new Date().toISOString().split('T')[0];
  main.innerHTML = `
    <h2 class="page-title">Create New Ticket</h2>
    <div class="card">
      <form id="newTicketForm" onsubmit="submitNewTicket(event)">
        <div class="form-row">
          <div class="form-group"><label>Ticket No</label><input name="ticket_no" required /></div>
          <div class="form-group"><label>Date</label><input type="date" name="ticket_date" value="${today}" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Raising Department</label>
            <select name="raising_dept_id" id="raisingDept" required onchange="filterEmployees()">
              <option value="">-- Select --</option>
              ${departments.map(d => `<option value="${d.dept_id}">${esc(d.description)}</option>`).join('')}
            </select></div>
          <div class="form-group"><label>Raising Employee</label>
            <select name="raising_employee_id" id="raisingEmp" required><option value="">-- Select Dept first --</option></select></div>
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
        <div class="form-group" style="margin-bottom:14px"><label>Upload Pictures</label><input type="file" name="images" accept="image/*" multiple /></div>
        <div id="formError" class="error"></div>
        <button type="submit" class="btn btn-primary">Create Ticket</button>
        <a class="btn" href="#/tickets" style="margin-left:8px">Cancel</a>
      </form>
    </div>`;

  window._allEmployees = employees;
}

window.filterEmployees = () => {
  const deptId = document.getElementById('raisingDept').value;
  const sel = document.getElementById('raisingEmp');
  const filtered = window._allEmployees.filter(e => String(e.dept_id) === deptId);
  sel.innerHTML = '<option value="">-- Select --</option>' +
    filtered.map(e => `<option value="${e.emp_id}">${esc(e.name)}</option>`).join('');
};

window.submitNewTicket = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const files = e.target.querySelector('[name=images]').files;
  const formData = new FormData();
  ['ticket_no','ticket_date','raising_dept_id','raising_employee_id','complaint_category_id','location_id','ticket_description','details','assigned_to'].forEach(k => {
    if (fd.get(k)) formData.append(k, fd.get(k));
  });
  for (const f of files) formData.append('images', f);
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

    const imgs = ticket.attachments.map(a =>
      `<a href="/${a.file_path}" target="_blank"><img src="/${a.file_path}" alt="${esc(a.file_name)}" /></a>`
    ).join('');

    const history = ticket.history.map(h =>
      `<div class="history-item"><strong>${esc(h.action)}</strong> — ${esc(h.remarks || '')}
        <div class="time">${new Date(h.created_at).toLocaleString()}</div></div>`
    ).join('');

    const isClosed = ticket.status === 'closed';
    const empOpts = employees.map(e => `<option value="${e.emp_id}">${esc(e.name)}</option>`).join('');

    main.innerHTML = `
      <div class="header-row">
        <h2 class="page-title">Ticket: ${esc(ticket.ticket_no)}</h2>
        <a class="btn" href="#/tickets">Back to List</a>
      </div>
      <div id="ticketMsg"></div>
      <div class="card">
        <div class="form-row">
          <div class="form-group"><label>Status</label><div>${badge(ticket.status)}</div></div>
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
        ${imgs ? `<div class="form-group"><label>Attachments</label><div class="image-preview">${imgs}</div></div>` : ''}
      </div>
      ${!isClosed ? `
      <div class="card">
        <div class="form-group"><label>Action By (Your Employee)</label>
          <select id="actionBy"><option value="">-- Select --</option>${empOpts}</select></div>
        <button class="btn btn-primary" onclick="openModal('update',${id})">Update Ticket</button>
        <button class="btn btn-warning" onclick="openModal('forward',${id})">Forward Ticket</button>
        <button class="btn btn-success" onclick="openModal('close',${id})">Close Ticket</button>
      </div>` : ''}
      ${history ? `<div class="card"><h3 style="margin-bottom:12px;font-size:16px">Ticket History</h3>${history}</div>` : ''}`;

    window._ticketData = { ticket, employees, categories, locations };
  } catch (e) {
    main.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

window.openModal = (type, ticketId) => {
  const actionBy = document.getElementById('actionBy').value;
  if (!actionBy) { alert('Please select Action By employee'); return; }

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
      </div>`;
  } else if (type === 'forward') {
    body = `<div class="form-group" style="margin-bottom:10px"><label>Forward To</label>
      <select id="m_forward" required><option value="">-- Select --</option>
        ${employees.filter(e => e.emp_id !== ticket.assigned_to).map(e => `<option value="${e.emp_id}">${esc(e.name)}</option>`).join('')}
      </select></div>`;
  }

  body += `
    <div class="form-group" style="margin-bottom:10px"><label>Remarks</label><textarea id="m_remarks"></textarea></div>
    <div class="form-group" style="margin-bottom:10px"><label>Upload Pictures</label><input type="file" id="m_images" accept="image/*" multiple /></div>
    <div id="modalError" class="error"></div>`;

  const titles = { update: 'Update Ticket', forward: 'Forward Ticket', close: 'Close Ticket' };
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
    fd.append('action_by', actionBy);
    const remarks = document.getElementById('m_remarks').value;
    if (remarks) fd.append('remarks', remarks);
    const imgs = document.getElementById('m_images').files;
    for (const f of imgs) fd.append('images', f);

    try {
      if (type === 'update') {
        fd.append('ticket_description', document.getElementById('m_desc').value);
        fd.append('details', document.getElementById('m_details').value);
        fd.append('complaint_category_id', document.getElementById('m_cat').value);
        fd.append('location_id', document.getElementById('m_loc').value);
        await putForm(`/tickets/${ticketId}`, fd);
      } else if (type === 'forward') {
        const fwd = document.getElementById('m_forward').value;
        if (!fwd) { document.getElementById('modalError').textContent = 'Select employee'; return; }
        fd.append('forward_to', fwd);
        await postForm(`/tickets/${ticketId}/forward`, fd);
      } else {
        await postForm(`/tickets/${ticketId}/close`, fd);
      }
      closeModal();
      renderTicketDetail(ticketId);
      document.getElementById('ticketMsg').innerHTML = '<div class="success">Action completed successfully</div>';
    } catch (err) {
      document.getElementById('modalError').textContent = err.message;
    }
  };
};

window.closeModal = () => {
  if (ticketModal) { ticketModal.remove(); ticketModal = null; }
};

// --- Route handler ---
async function route() {
  renderSidebar();
  masterState = { editId: null, form: {}, message: '', error: '' };
  const hash = location.hash || '#/tickets';

  if (hash === '#/tickets') return renderTicketList();
  if (hash === '#/tickets/new') return renderNewTicket();
  if (hash.startsWith('#/tickets/')) {
    const id = hash.split('/')[2];
    if (id && id !== 'new') return renderTicketDetail(id);
  }
  if (hash === '#/masters/employees') return renderEmployees();
  if (hash.startsWith('#/masters/')) {
    const type = hash.replace('#/masters/', '');
    if (MASTERS[type]) return renderMaster(type);
  }
  renderTicketList();
}

window.addEventListener('hashchange', route);
route();
