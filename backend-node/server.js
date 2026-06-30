const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const STATIC_DIR = path.join(__dirname, '..', 'backend', 'static');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'ticketing_db',
};

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

function getUploadGroups(req) {
  const all = req.files || [];
  return {
    images: all.filter((f) => f.fieldname === 'images'),
    documents: all.filter((f) => f.fieldname === 'files'),
  };
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(STATIC_DIR, 'assets')));

let pool;

async function initDb() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();

  pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10, multipleStatements: true });

  const tables = [
    `CREATE TABLE IF NOT EXISTS departments (
      dept_id INT AUTO_INCREMENT PRIMARY KEY,
      description VARCHAR(200) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS roles (
      role_id INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      emp_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      user_id VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      dept_id INT NOT NULL,
      role_id INT NOT NULL,
      FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
      FOREIGN KEY (role_id) REFERENCES roles(role_id)
    )`,
    `CREATE TABLE IF NOT EXISTS complaint_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_description VARCHAR(200) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      location_name VARCHAR(150) NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_no VARCHAR(50) NOT NULL UNIQUE,
      ticket_date DATE NOT NULL,
      raising_dept_id INT NOT NULL,
      raising_employee_id INT NOT NULL,
      complaint_category_id INT NOT NULL,
      location_id INT NOT NULL,
      ticket_description VARCHAR(300) NOT NULL,
      details TEXT,
      assigned_to INT NOT NULL,
      priority ENUM('normal','moderate','urgent','critical') NOT NULL DEFAULT 'normal',
      status ENUM('open','in_progress','closed','forwarded') NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_type VARCHAR(20) NOT NULL DEFAULT 'image',
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      uploaded_by INT,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      action_by INT NOT NULL,
      remarks TEXT,
      forwarded_to INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INT PRIMARY KEY,
      can_create TINYINT(1) NOT NULL DEFAULT 1,
      can_view TINYINT(1) NOT NULL DEFAULT 1,
      can_view_all TINYINT(1) NOT NULL DEFAULT 0,
      can_edit TINYINT(1) NOT NULL DEFAULT 0,
      can_manage_permissions TINYINT(1) NOT NULL DEFAULT 0,
      can_manage_masters TINYINT(1) NOT NULL DEFAULT 0,
      can_view_schedules TINYINT(1) NOT NULL DEFAULT 1,
      can_manage_schedules TINYINT(1) NOT NULL DEFAULT 1,
      FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_name VARCHAR(200) NOT NULL,
      schedule_type ENUM('once','daily','weekly','monthly','periodic') NOT NULL,
      run_date DATE NULL,
      day_of_week TINYINT NULL,
      day_of_month TINYINT NULL,
      interval_days INT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      next_run_date DATE NOT NULL,
      last_run_date DATE NULL,
      complaint_category_id INT NOT NULL,
      location_id INT NOT NULL,
      ticket_description VARCHAR(300) NOT NULL,
      details TEXT,
      assigned_to INT NOT NULL,
      priority ENUM('normal','moderate','urgent','critical') NOT NULL DEFAULT 'normal',
      raising_dept_id INT NOT NULL,
      raising_employee_id INT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  // Add new columns to existing databases
  const [userCol] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'user_id'`,
    [dbConfig.database]
  );
  if (userCol[0].cnt === 0) {
    await pool.query('ALTER TABLE employees ADD COLUMN user_id VARCHAR(50) UNIQUE');
    await pool.query('ALTER TABLE employees ADD COLUMN password VARCHAR(255)');
  }

  const [fileTypeCol] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ticket_attachments' AND COLUMN_NAME = 'file_type'`,
    [dbConfig.database]
  );
  if (fileTypeCol[0].cnt === 0) {
    await pool.query("ALTER TABLE ticket_attachments ADD COLUMN file_type VARCHAR(20) NOT NULL DEFAULT 'image'");
  }

  const [priorityCol] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'priority'`,
    [dbConfig.database]
  );
  if (priorityCol[0].cnt === 0) {
    await pool.query("ALTER TABLE tickets ADD COLUMN priority ENUM('normal','moderate','urgent','critical') NOT NULL DEFAULT 'normal'");
  }

  const [scheduleViewCol] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'role_permissions' AND COLUMN_NAME = 'can_view_schedules'`,
    [dbConfig.database]
  );
  if (scheduleViewCol[0].cnt === 0) {
    await pool.query('ALTER TABLE role_permissions ADD COLUMN can_view_schedules TINYINT(1) NOT NULL DEFAULT 1');
    await pool.query('ALTER TABLE role_permissions ADD COLUMN can_manage_schedules TINYINT(1) NOT NULL DEFAULT 1');
  }

  const [empCount] = await pool.query('SELECT COUNT(*) AS cnt FROM employees');
  if (empCount[0].cnt === 0) {
    const [dept] = await pool.query("INSERT INTO departments (description) VALUES ('Administration')");
    const [role] = await pool.query("INSERT INTO roles (role_name) VALUES ('Admin')");
    await pool.query(
      'INSERT INTO employees (name, user_id, password, dept_id, role_id) VALUES (?, ?, ?, ?, ?)',
      ['System Admin', 'admin', 'po', dept.insertId, role.insertId]
    );
    console.log('Default login created — User ID: admin  Password: po');
  }

  await seedAllRolePermissions();
}

const DEFAULT_PERMISSIONS = {
  can_create: 1,
  can_view: 1,
  can_view_all: 0,
  can_edit: 0,
  can_manage_permissions: 0,
  can_manage_masters: 0,
  can_view_schedules: 1,
  can_manage_schedules: 1,
};

const ADMIN_PERMISSIONS = {
  can_create: 1,
  can_view: 1,
  can_view_all: 1,
  can_edit: 1,
  can_manage_permissions: 1,
  can_manage_masters: 1,
  can_view_schedules: 1,
  can_manage_schedules: 1,
};

function isAdminRole(roleName) {
  return String(roleName || '').toLowerCase() === 'admin';
}

function isAdminUser(user) {
  return isAdminRole(user?.role_name) || hasPerm(user, 'can_view_all');
}

function isDeptViewerRole(user) {
  const name = String(user?.role_name || '').toLowerCase();
  return name === 'manager' || name.includes('supervisor');
}

function canAccessTicketByDept(user, ticket) {
  if (!isDeptViewerRole(user) || user.dept_id == null) return false;
  const deptId = Number(user.dept_id);
  if (Number(ticket.raising_dept_id) === deptId) return true;
  if (Number(ticket.raising_employee_dept_id) === deptId) return true;
  if (Number(ticket.assignee_dept_id) === deptId) return true;
  return false;
}

function normalizePermissions(row) {
  if (!row) {
    return {
      can_create: true,
      can_view: true,
      can_view_all: false,
      can_edit: false,
      can_manage_permissions: false,
      can_manage_masters: false,
      can_view_schedules: true,
      can_manage_schedules: true,
    };
  }
  return {
    can_create: !!row.can_create,
    can_view: !!row.can_view,
    can_view_all: !!row.can_view_all,
    can_edit: !!row.can_edit,
    can_manage_permissions: !!row.can_manage_permissions,
    can_manage_masters: !!row.can_manage_masters,
    can_view_schedules: row.can_view_schedules !== undefined ? !!row.can_view_schedules : true,
    can_manage_schedules: row.can_manage_schedules !== undefined ? !!row.can_manage_schedules : true,
  };
}

async function refreshSessionUser(session) {
  const [[row]] = await pool.query(
    `SELECT e.emp_id, e.name, e.user_id, e.dept_id, e.role_id,
            r.role_name, d.description AS department_name
     FROM employees e
     LEFT JOIN roles r ON e.role_id = r.role_id
     LEFT JOIN departments d ON e.dept_id = d.dept_id
     WHERE e.emp_id = ?`,
    [session.emp_id]
  );
  if (!row) return session;
  session.name = row.name;
  session.dept_id = Number(row.dept_id);
  session.role_id = row.role_id;
  session.role_name = row.role_name;
  session.department_name = row.department_name;
  session.permissions = await loadPermissionsForRole(session.role_id);
  return session;
}

async function loadPermissionsForRole(roleId) {
  const [[role]] = await pool.query('SELECT role_name FROM roles WHERE role_id = ?', [roleId]);
  if (role && isAdminRole(role.role_name)) {
    return normalizePermissions(ADMIN_PERMISSIONS);
  }
  const [rows] = await pool.query('SELECT * FROM role_permissions WHERE role_id = ?', [roleId]);
  const perms = normalizePermissions(rows[0]);
  perms.can_view_all = false;
  perms.can_manage_permissions = false;
  perms.can_manage_masters = false;
  return perms;
}

async function ensureRolePermissions(roleId, roleName) {
  const [existing] = await pool.query('SELECT role_id FROM role_permissions WHERE role_id = ?', [roleId]);
  if (existing.length) return;
  const isAdmin = String(roleName || '').toLowerCase() === 'admin';
  const p = isAdmin ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS;
  await pool.query(
    `INSERT INTO role_permissions
      (role_id, can_create, can_view, can_view_all, can_edit, can_manage_permissions, can_manage_masters,
       can_view_schedules, can_manage_schedules)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [roleId, p.can_create, p.can_view, p.can_view_all, p.can_edit, p.can_manage_permissions, p.can_manage_masters,
      p.can_view_schedules, p.can_manage_schedules]
  );
}

async function seedAllRolePermissions() {
  const [roles] = await pool.query('SELECT role_id, role_name FROM roles');
  for (const role of roles) {
    await ensureRolePermissions(role.role_id, role.role_name);
    if (isAdminRole(role.role_name)) {
      await pool.query(
        `UPDATE role_permissions SET
          can_create = 1, can_view = 1, can_view_all = 1, can_edit = 1,
          can_manage_permissions = 1, can_manage_masters = 1,
          can_view_schedules = 1, can_manage_schedules = 1
         WHERE role_id = ?`,
        [role.role_id]
      );
    } else {
      await pool.query(
        `UPDATE role_permissions SET
          can_view_all = 0, can_manage_permissions = 0, can_manage_masters = 0,
          can_view_schedules = 1, can_manage_schedules = 1
         WHERE role_id = ?`,
        [role.role_id]
      );
    }
  }
}

function hasPerm(user, key) {
  return !!(user.permissions && user.permissions[key]);
}

function canAccessTicket(user, ticket) {
  if (isAdminUser(user)) return true;
  if (canAccessTicketByDept(user, ticket)) return true;
  return Number(ticket.raising_employee_id) === Number(user.emp_id)
    || Number(ticket.assigned_to) === Number(user.emp_id);
}

async function canAccessAttachment(user, attachmentId) {
  const [[row]] = await pool.query(`
    SELECT a.id, a.file_name, a.file_path, a.file_type, a.ticket_id,
      t.raising_dept_id, t.raising_employee_id, t.assigned_to,
      re.dept_id AS raising_employee_dept_id,
      ae.dept_id AS assignee_dept_id
    FROM ticket_attachments a
    JOIN tickets t ON a.ticket_id = t.id
    LEFT JOIN employees re ON t.raising_employee_id = re.emp_id
    LEFT JOIN employees ae ON t.assigned_to = ae.emp_id
    WHERE a.id = ?
  `, [attachmentId]);

  if (!row) return { ok: false, status: 404, detail: 'Attachment not found' };
  if (isAdminUser(user)) return { ok: true, attachment: row };
  if (canAccessTicketByDept(user, row)) return { ok: true, attachment: row };
  if (row.raising_employee_id === user.emp_id || row.assigned_to === user.emp_id) {
    return { ok: true, attachment: row };
  }
  return { ok: false, status: 403, detail: 'You do not have access to this document' };
}

function isAssignee(user, ticket) {
  return Number(ticket.assigned_to) === Number(user.emp_id);
}

function canModifyTicket(user, ticket) {
  if (!canAccessTicket(user, ticket)) return false;
  if (isAdminUser(user)) return true;
  if (isAssignee(user, ticket)) return true;
  if (hasPerm(user, 'can_edit')) return true;
  return false;
}

function requireRemarks(body, res) {
  const remarks = String(body?.remarks || '').trim();
  if (!remarks) {
    res.status(400).json({ detail: 'Comment is required' });
    return null;
  }
  return remarks;
}

const HISTORY_SQL = `
  SELECT h.id, h.action, h.action_by, h.remarks, h.forwarded_to, h.created_at,
    e.name AS action_by_name
  FROM ticket_history h
  LEFT JOIN employees e ON h.action_by = e.emp_id
`;

function attachmentMime(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] || 'application/octet-stream';
}

function requirePerm(user, key, res) {
  if (!hasPerm(user, key)) {
    res.status(403).json({ detail: 'You do not have permission for this action' });
    return false;
  }
  return true;
}

function requireAdminUser(user, res) {
  if (!isAdminUser(user)) {
    res.status(403).json({ detail: 'Only Admin users can access role master' });
    return false;
  }
  return true;
}

function saveUpload(file) {
  const ext = path.extname(file.originalname);
  const unique = crypto.randomBytes(16).toString('hex') + ext;
  const dest = path.join(UPLOAD_DIR, unique);
  fs.renameSync(file.path, dest);
  return { origName: file.originalname, webPath: `uploads/${unique}` };
}

const VALID_PRIORITIES = ['normal', 'moderate', 'urgent', 'critical'];

function normalizePriority(value) {
  const priority = String(value || 'normal').toLowerCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error('Invalid priority value');
  }
  return priority;
}

async function saveAttachments(ticketId, fileList, fileType, uploadedBy) {
  for (const file of fileList || []) {
    const { origName, webPath } = saveUpload(file);
    await pool.query(
      'INSERT INTO ticket_attachments (ticket_id, file_name, file_path, uploaded_by, file_type) VALUES (?, ?, ?, ?, ?)',
      [ticketId, origName, webPath, uploadedBy, fileType]
    );
  }
}

async function getTicketDetail(id) {
  const [rows] = await pool.query(`
    SELECT t.*,
      d.description AS raising_dept_name,
      re.name AS raising_employee_name,
      c.category_description AS category_name,
      l.location_name,
      ae.name AS assignee_name,
      re.dept_id AS raising_employee_dept_id,
      ae.dept_id AS assignee_dept_id
    FROM tickets t
    LEFT JOIN departments d ON t.raising_dept_id = d.dept_id
    LEFT JOIN employees re ON t.raising_employee_id = re.emp_id
    LEFT JOIN complaint_categories c ON t.complaint_category_id = c.id
    LEFT JOIN locations l ON t.location_id = l.id
    LEFT JOIN employees ae ON t.assigned_to = ae.emp_id
    WHERE t.id = ?
  `, [id]);

  if (!rows.length) return null;
  const ticket = rows[0];

  const [attachments] = await pool.query(
    'SELECT id, file_name, file_path, file_type, uploaded_at FROM ticket_attachments WHERE ticket_id = ?', [id]
  );
  const [history] = await pool.query(
    `${HISTORY_SQL} WHERE h.ticket_id = ? ORDER BY h.id`,
    [id]
  );

  ticket.ticket_date = ticket.ticket_date?.toISOString?.().split('T')[0] || ticket.ticket_date;
  ticket.attachments = attachments;
  ticket.history = history;
  return ticket;
}

async function generateTicketNo() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `TKT-${y}${m}${d}-`;
  const [rows] = await pool.query(
    'SELECT ticket_no FROM tickets WHERE ticket_no LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length) {
    const part = rows[0].ticket_no.split('-').pop();
    const n = parseInt(part, 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// --- Auth ---
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-auth-token'] || '';
}

function createSession(employee, permissions) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    emp_id: employee.emp_id,
    name: employee.name,
    user_id: employee.user_id,
    dept_id: employee.dept_id,
    role_id: employee.role_id,
    role_name: employee.role_name || null,
    department_name: employee.department_name || null,
    permissions: permissions || normalizePermissions(null),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function publicUser(session) {
  return {
    emp_id: session.emp_id,
    name: session.name,
    user_id: session.user_id,
    dept_id: session.dept_id,
    role_id: session.role_id,
    role_name: session.role_name,
    department_name: session.department_name,
    permissions: session.permissions || normalizePermissions(null),
  };
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { user_id, password } = req.body || {};
    if (!user_id || !password) {
      return res.status(400).json({ detail: 'User ID and Password are required' });
    }
    const [rows] = await pool.query(
      `SELECT e.emp_id, e.name, e.user_id, e.password, e.dept_id, e.role_id,
              r.role_name, d.description AS department_name
       FROM employees e
       LEFT JOIN roles r ON e.role_id = r.role_id
       LEFT JOIN departments d ON e.dept_id = d.dept_id
       WHERE e.user_id = ?`,
      [user_id]
    );
    if (!rows.length || rows[0].password !== password) {
      return res.status(401).json({ detail: 'Invalid User ID or Password' });
    }
    const permissions = await loadPermissionsForRole(rows[0].role_id);
    const token = createSession(rows[0], permissions);
    res.json({ token, user: publicUser(getSession(token)) });
  } catch (err) {
    res.status(500).json({ detail: err.message || 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) sessions.delete(token);
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', async (req, res) => {
  const session = getSession(extractToken(req));
  if (!session) return res.status(401).json({ detail: 'Not authenticated' });
  await refreshSessionUser(session);
  const user = publicUser(session);
  const [[schedRow]] = await pool.query(
    'SELECT id FROM scheduled_jobs WHERE raising_employee_id = ? LIMIT 1',
    [session.emp_id]
  );
  user.has_schedule_jobs = !!schedRow;
  res.json({ user });
});

app.use('/api', async (req, res, next) => {
  if (req.path === '/auth/login') return next();
  const session = getSession(extractToken(req));
  if (!session) return res.status(401).json({ detail: 'Not authenticated' });
  await refreshSessionUser(session);
  req.user = session;
  next();
});

// --- Departments ---
app.get('/api/departments/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM departments ORDER BY dept_id');
  res.json(rows);
});

app.post('/api/departments/', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  const [r] = await pool.query('INSERT INTO departments (description) VALUES (?)', [req.body.description]);
  const [rows] = await pool.query('SELECT * FROM departments WHERE dept_id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/departments/:id', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('UPDATE departments SET description = ? WHERE dept_id = ?', [req.body.description, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM departments WHERE dept_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Department not found' });
  res.json(rows[0]);
});

app.delete('/api/departments/:id', async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('DELETE FROM departments WHERE dept_id = ?', [req.params.id]);
  res.json({ message: 'Department deleted' });
});

// --- Roles (Admin only) ---
app.get('/api/roles/', async (req, res) => {
  if (!requireAdminUser(req.user, res)) return;
  const [rows] = await pool.query('SELECT * FROM roles ORDER BY role_id');
  res.json(rows);
});

app.post('/api/roles/', express.json(), async (req, res) => {
  if (!requireAdminUser(req.user, res)) return;
  if (isAdminRole(req.body.role_name)) {
    const [existing] = await pool.query("SELECT role_id FROM roles WHERE LOWER(role_name) = 'admin'");
    if (existing.length) {
      return res.status(400).json({ detail: 'Only one Admin role is allowed' });
    }
  }
  const [r] = await pool.query('INSERT INTO roles (role_name) VALUES (?)', [req.body.role_name]);
  await ensureRolePermissions(r.insertId, req.body.role_name);
  const [rows] = await pool.query('SELECT * FROM roles WHERE role_id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/roles/:id', express.json(), async (req, res) => {
  if (!requireAdminUser(req.user, res)) return;
  const [current] = await pool.query('SELECT role_name FROM roles WHERE role_id = ?', [req.params.id]);
  if (!current.length) return res.status(404).json({ detail: 'Role not found' });
  if (isAdminRole(current[0].role_name) && !isAdminRole(req.body.role_name)) {
    return res.status(400).json({ detail: 'The Admin role cannot be renamed' });
  }
  if (isAdminRole(req.body.role_name) && !isAdminRole(current[0].role_name)) {
    const [existing] = await pool.query(
      "SELECT role_id FROM roles WHERE LOWER(role_name) = 'admin' AND role_id != ?",
      [req.params.id]
    );
    if (existing.length) {
      return res.status(400).json({ detail: 'Only one Admin role is allowed' });
    }
  }
  await pool.query('UPDATE roles SET role_name = ? WHERE role_id = ?', [req.body.role_name, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM roles WHERE role_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Role not found' });
  res.json(rows[0]);
});

app.delete('/api/roles/:id', async (req, res) => {
  if (!requireAdminUser(req.user, res)) return;
  const [role] = await pool.query('SELECT role_name FROM roles WHERE role_id = ?', [req.params.id]);
  if (role.length && isAdminRole(role[0].role_name)) {
    return res.status(400).json({ detail: 'The Admin role cannot be deleted' });
  }
  await pool.query('DELETE FROM roles WHERE role_id = ?', [req.params.id]);
  res.json({ message: 'Role deleted' });
});

// --- Employees ---
app.get('/api/employees/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT e.emp_id, e.name, e.user_id, e.dept_id, e.role_id,
      d.description AS department_name, r.role_name
    FROM employees e
    LEFT JOIN departments d ON e.dept_id = d.dept_id
    LEFT JOIN roles r ON e.role_id = r.role_id
    ORDER BY e.emp_id
  `);
  res.json(rows);
});

app.post('/api/employees/', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  const { name, user_id, password, dept_id, role_id } = req.body;
  if (!user_id || !password) {
    return res.status(400).json({ detail: 'User ID and Password are required' });
  }
  const [r] = await pool.query(
    'INSERT INTO employees (name, user_id, password, dept_id, role_id) VALUES (?, ?, ?, ?, ?)',
    [name, user_id, password, dept_id, role_id]
  );
  const [rows] = await pool.query(
    'SELECT emp_id, name, user_id, dept_id, role_id FROM employees WHERE emp_id = ?', [r.insertId]
  );
  res.json(rows[0]);
});

app.put('/api/employees/:id', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  const { name, user_id, password, dept_id, role_id } = req.body;
  if (password) {
    await pool.query(
      'UPDATE employees SET name=?, user_id=?, password=?, dept_id=?, role_id=? WHERE emp_id=?',
      [name, user_id, password, dept_id, role_id, req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE employees SET name=?, user_id=?, dept_id=?, role_id=? WHERE emp_id=?',
      [name, user_id, dept_id, role_id, req.params.id]
    );
  }
  const [rows] = await pool.query(
    'SELECT emp_id, name, user_id, dept_id, role_id FROM employees WHERE emp_id = ?', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ detail: 'Employee not found' });
  res.json(rows[0]);
});

app.delete('/api/employees/:id', async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('DELETE FROM employees WHERE emp_id = ?', [req.params.id]);
  res.json({ message: 'Employee deleted' });
});

// --- Categories ---
app.get('/api/categories/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM complaint_categories ORDER BY id');
  res.json(rows);
});

app.post('/api/categories/', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  const [r] = await pool.query('INSERT INTO complaint_categories (category_description) VALUES (?)', [req.body.category_description]);
  const [rows] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/categories/:id', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('UPDATE complaint_categories SET category_description = ? WHERE id = ?', [req.body.category_description, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Category not found' });
  res.json(rows[0]);
});

app.delete('/api/categories/:id', async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('DELETE FROM complaint_categories WHERE id = ?', [req.params.id]);
  res.json({ message: 'Category deleted' });
});

// --- Locations ---
app.get('/api/locations/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM locations ORDER BY id');
  res.json(rows);
});

app.post('/api/locations/', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  const [r] = await pool.query('INSERT INTO locations (location_name) VALUES (?)', [req.body.location_name]);
  const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/locations/:id', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('UPDATE locations SET location_name = ? WHERE id = ?', [req.body.location_name, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Location not found' });
  res.json(rows[0]);
});

app.delete('/api/locations/:id', async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_masters', res)) return;
  await pool.query('DELETE FROM locations WHERE id = ?', [req.params.id]);
  res.json({ message: 'Location deleted' });
});

// --- Role Permissions (Admin) ---
app.get('/api/permissions/', async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_permissions', res)) return;
  const [rows] = await pool.query(`
    SELECT r.role_id, r.role_name,
      COALESCE(p.can_create, 1) AS can_create,
      COALESCE(p.can_view, 1) AS can_view,
      COALESCE(p.can_view_all, 0) AS can_view_all,
      COALESCE(p.can_edit, 0) AS can_edit,
      COALESCE(p.can_manage_permissions, 0) AS can_manage_permissions,
      COALESCE(p.can_manage_masters, 0) AS can_manage_masters,
      COALESCE(p.can_view_schedules, 1) AS can_view_schedules,
      COALESCE(p.can_manage_schedules, 1) AS can_manage_schedules
    FROM roles r
    LEFT JOIN role_permissions p ON r.role_id = p.role_id
    ORDER BY r.role_id
  `);
  res.json(rows.map((row) => ({
    role_id: row.role_id,
    role_name: row.role_name,
    is_admin: isAdminRole(row.role_name),
    permissions: isAdminRole(row.role_name)
      ? normalizePermissions(ADMIN_PERMISSIONS)
      : normalizePermissions({
          ...row,
          can_view_all: 0,
          can_manage_permissions: 0,
          can_manage_masters: 0,
        }),
  })));
});

app.put('/api/permissions/:roleId', express.json(), async (req, res) => {
  if (!requirePerm(req.user, 'can_manage_permissions', res)) return;
  const roleId = Number(req.params.roleId);
  const [roles] = await pool.query('SELECT role_id, role_name FROM roles WHERE role_id = ?', [roleId]);
  if (!roles.length) return res.status(404).json({ detail: 'Role not found' });

  if (isAdminRole(roles[0].role_name)) {
    await ensureRolePermissions(roleId, roles[0].role_name);
    await pool.query(
      `UPDATE role_permissions SET
        can_create = 1, can_view = 1, can_view_all = 1, can_edit = 1,
        can_manage_permissions = 1, can_manage_masters = 1,
        can_view_schedules = 1, can_manage_schedules = 1
       WHERE role_id = ?`,
      [roleId]
    );
    return res.json({
      role_id: roleId,
      role_name: roles[0].role_name,
      is_admin: true,
      permissions: normalizePermissions(ADMIN_PERMISSIONS),
    });
  }

  const b = req.body || {};
  const flags = {
    can_create: b.can_create ? 1 : 0,
    can_view: b.can_view ? 1 : 0,
    can_view_all: 0,
    can_edit: b.can_edit ? 1 : 0,
    can_manage_permissions: 0,
    can_manage_masters: 0,
    can_view_schedules: b.can_view_schedules ? 1 : 0,
    can_manage_schedules: b.can_manage_schedules ? 1 : 0,
  };

  await ensureRolePermissions(roleId, roles[0].role_name);
  await pool.query(
    `UPDATE role_permissions SET
      can_create = ?, can_view = ?, can_view_all = ?, can_edit = ?,
      can_manage_permissions = ?, can_manage_masters = ?,
      can_view_schedules = ?, can_manage_schedules = ?
     WHERE role_id = ?`,
    [flags.can_create, flags.can_view, flags.can_view_all, flags.can_edit,
      flags.can_manage_permissions, flags.can_manage_masters,
      flags.can_view_schedules, flags.can_manage_schedules, roleId]
  );

  res.json({
    role_id: roleId,
    role_name: roles[0].role_name,
    is_admin: false,
    permissions: normalizePermissions(flags),
  });
});

// --- Attachments (authenticated download) ---
app.get('/api/attachments/:id/file', async (req, res) => {
  try {
    const access = await canAccessAttachment(req.user, req.params.id);
    if (!access.ok) {
      return res.status(access.status || 403).json({ detail: access.detail || 'Access denied' });
    }

    const att = access.attachment;
    const diskPath = path.join(__dirname, '..', att.file_path.replace(/\//g, path.sep));
    if (!diskPath.startsWith(UPLOAD_DIR) || !fs.existsSync(diskPath)) {
      return res.status(404).json({ detail: 'File not found on server' });
    }

    res.setHeader('Content-Type', attachmentMime(att.file_name));
    res.setHeader('Content-Disposition', `inline; filename="${att.file_name.replace(/"/g, '')}"`);
    res.sendFile(diskPath);
  } catch (err) {
    console.error('GET /api/attachments/:id/file failed:', err);
    res.status(500).json({ detail: err.message || 'Failed to load file' });
  }
});

// --- Tickets ---
const TICKET_LIST_SQL = `
  SELECT t.*,
    d.description AS raising_dept_name,
    re.name AS raising_employee_name,
    c.category_description AS category_name,
    l.location_name,
    ae.name AS assignee_name,
    re.dept_id AS raising_employee_dept_id,
    ae.dept_id AS assignee_dept_id
  FROM tickets t
  LEFT JOIN departments d ON t.raising_dept_id = d.dept_id
  LEFT JOIN employees re ON t.raising_employee_id = re.emp_id
  LEFT JOIN complaint_categories c ON t.complaint_category_id = c.id
  LEFT JOIN locations l ON t.location_id = l.id
  LEFT JOIN employees ae ON t.assigned_to = ae.emp_id
`;

const DASHBOARD_TICKET_SQL = `
  SELECT t.id, t.ticket_no, t.ticket_date, t.ticket_description, t.status, t.priority,
    t.created_at, t.updated_at, t.raising_employee_id, t.assigned_to,
    re.name AS raising_employee_name,
    ae.name AS assignee_name,
    c.category_description AS category_name,
    d.description AS raising_dept_name
  FROM tickets t
  LEFT JOIN departments d ON t.raising_dept_id = d.dept_id
  LEFT JOIN employees re ON t.raising_employee_id = re.emp_id
  LEFT JOIN complaint_categories c ON t.complaint_category_id = c.id
  LEFT JOIN locations l ON t.location_id = l.id
  LEFT JOIN employees ae ON t.assigned_to = ae.emp_id
`;

function formatTicketDates(ticket) {
  ticket.ticket_date = ticket.ticket_date?.toISOString?.().split('T')[0] || ticket.ticket_date;
  if (ticket.created_at?.toISOString) ticket.created_at = ticket.created_at.toISOString();
  if (ticket.updated_at?.toISOString) ticket.updated_at = ticket.updated_at.toISOString();
  return ticket;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) {
    const now = new Date();
    return getMonthRange(now.getFullYear(), now.getMonth() + 1);
  }
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { year: y, month: m, start, end, label: `${MONTH_NAMES[m - 1]} ${y}` };
}

function parseMonthFromQuery(query) {
  const now = new Date();
  const year = query.year ? Number(query.year) : now.getFullYear();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  return getMonthRange(year, month);
}

function toDateStr(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.split('T')[0];
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (value.toISOString) return value.toISOString().split('T')[0];
  return String(value);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function canViewSchedules(user) {
  return !!(user && user.emp_id);
}

function canCreateScheduleJob(user) {
  return !!(user && user.emp_id);
}

function isScheduleJobCreator(user, job) {
  return Number(job.raising_employee_id) === Number(user.emp_id);
}

function canEditScheduleJob(user, job) {
  if (!user || !job) return false;
  if (isAdminRole(user?.role_name)) return true;
  return isScheduleJobCreator(user, job);
}

async function canAccessSchedulesApi(user) {
  return !!(user && user.emp_id);
}

function canViewScheduleJob(user, job) {
  if (!user || !job) return false;
  if (isAdminRole(user?.role_name)) return true;
  return isScheduleJobCreator(user, job);
}

function getScheduledJobFilter(user) {
  if (isAdminRole(user?.role_name)) return { clause: '', params: [] };
  return { clause: ' WHERE sj.raising_employee_id = ?', params: [Number(user.emp_id)] };
}

function formatScheduledJob(job) {
  ['run_date', 'start_date', 'end_date', 'next_run_date', 'last_run_date'].forEach((key) => {
    if (job[key]) job[key] = toDateStr(job[key]);
  });
  if (job.created_at?.toISOString) job.created_at = job.created_at.toISOString();
  if (job.updated_at?.toISOString) job.updated_at = job.updated_at.toISOString();
  job.is_active = !!job.is_active;
  return job;
}

function computeInitialNextRun(body) {
  const today = toDateStr(new Date());
  const type = body.schedule_type;
  const runDate = body.run_date || body.start_date || today;

  switch (type) {
    case 'once':
      return runDate;
    case 'daily':
      return runDate >= today ? runDate : today;
    case 'weekly': {
      const dow = Number(body.day_of_week);
      const baseStr = runDate >= today ? runDate : today;
      const start = new Date(`${baseStr}T12:00:00`);
      let diff = dow - start.getDay();
      if (diff < 0) diff += 7;
      if (diff === 0 && baseStr < today) diff = 7;
      start.setDate(start.getDate() + diff);
      return toDateStr(start);
    }
    case 'monthly': {
      const dom = Number(body.day_of_month) || 1;
      const base = new Date(`${today}T12:00:00`);
      let candidate = new Date(base.getFullYear(), base.getMonth(), dom);
      if (candidate < new Date(`${today}T00:00:00`)) {
        candidate = new Date(base.getFullYear(), base.getMonth() + 1, dom);
      }
      return toDateStr(candidate);
    }
    case 'periodic':
      return body.start_date && body.start_date >= today ? body.start_date : today;
    default:
      return today;
  }
}

function computeNextRunAfter(job, ranDate) {
  switch (job.schedule_type) {
    case 'once':
      return null;
    case 'daily':
      return addDays(ranDate, 1);
    case 'weekly':
      return addDays(ranDate, 7);
    case 'monthly': {
      const d = new Date(`${ranDate}T12:00:00`);
      const dom = job.day_of_month || d.getDate();
      d.setMonth(d.getMonth() + 1);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dom, maxDay));
      return toDateStr(d);
    }
    case 'periodic': {
      const next = addDays(ranDate, job.interval_days || 1);
      if (job.end_date && next > toDateStr(job.end_date)) return null;
      return next;
    }
    default:
      return null;
  }
}

async function createTicketFromJob(job) {
  const ticketDate = toDateStr(job.next_run_date);
  const ticketNo = await generateTicketNo();
  const details = job.details || `Auto-created from scheduled job: ${job.job_name}`;
  const [r] = await pool.query(
    `INSERT INTO tickets (ticket_no, ticket_date, raising_dept_id, raising_employee_id,
      complaint_category_id, location_id, ticket_description, details, assigned_to, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
    [ticketNo, ticketDate, job.raising_dept_id, job.raising_employee_id,
      job.complaint_category_id, job.location_id, job.ticket_description,
      details, job.assigned_to, job.priority]
  );
  await pool.query(
    'INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
    [r.insertId, 'created', job.raising_employee_id, `Scheduled job "${job.job_name}" auto-created this ticket`]
  );
  return r.insertId;
}

async function processScheduledJobs() {
  const today = toDateStr(new Date());
  const [jobs] = await pool.query(
    'SELECT * FROM scheduled_jobs WHERE is_active = 1 AND next_run_date <= ?',
    [today]
  );
  for (const job of jobs) {
    if (job.schedule_type === 'periodic' && job.end_date && today > toDateStr(job.end_date)) {
      await pool.query('UPDATE scheduled_jobs SET is_active = 0 WHERE id = ?', [job.id]);
      continue;
    }
    try {
      await createTicketFromJob(job);
      const ranOn = toDateStr(job.next_run_date);
      const nextRun = computeNextRunAfter(job, ranOn);
      if (!nextRun || job.schedule_type === 'once') {
        await pool.query(
          'UPDATE scheduled_jobs SET last_run_date = ?, is_active = 0 WHERE id = ?',
          [ranOn, job.id]
        );
      } else {
        await pool.query(
          'UPDATE scheduled_jobs SET last_run_date = ?, next_run_date = ? WHERE id = ?',
          [ranOn, nextRun, job.id]
        );
      }
      console.log(`Scheduled job #${job.id} "${job.job_name}" created ticket`);
    } catch (err) {
      console.error(`Scheduled job #${job.id} failed:`, err.message);
    }
  }
}

const SCHEDULED_JOB_SQL = `
  SELECT sj.*,
    c.category_description AS category_name,
    l.location_name,
    ae.name AS assignee_name,
    re.name AS raising_employee_name,
    d.description AS raising_dept_name
  FROM scheduled_jobs sj
  LEFT JOIN complaint_categories c ON sj.complaint_category_id = c.id
  LEFT JOIN locations l ON sj.location_id = l.id
  LEFT JOIN employees ae ON sj.assigned_to = ae.emp_id
  LEFT JOIN employees re ON sj.raising_employee_id = re.emp_id
  LEFT JOIN departments d ON sj.raising_dept_id = d.dept_id
`;

function summarizeByStatus(tickets) {
  const summary = { total: tickets.length, open: 0, in_progress: 0, forwarded: 0, closed: 0 };
  for (const t of tickets) {
    if (summary[t.status] !== undefined) summary[t.status]++;
  }
  return summary;
}

function getDeptTicketFilter(deptId) {
  return {
    clause: ` WHERE t.raising_dept_id = ?
      OR re.dept_id = ?
      OR ae.dept_id = ?
      OR t.assigned_to IN (SELECT emp_id FROM employees WHERE dept_id = ?)
      OR t.raising_employee_id IN (SELECT emp_id FROM employees WHERE dept_id = ?)`,
    params: [deptId, deptId, deptId, deptId, deptId],
  };
}

async function enrichTicketsWithCompletion(tickets) {
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id);
  const [closedRows] = await pool.query(
    `SELECT h.ticket_id, h.remarks, h.created_at, e.name AS closed_by_name
     FROM ticket_history h
     LEFT JOIN employees e ON h.action_by = e.emp_id
     WHERE h.action = 'closed' AND h.ticket_id IN (?)
     ORDER BY h.id DESC`,
    [ids]
  );
  const closedMap = new Map();
  for (const row of closedRows) {
    if (!closedMap.has(row.ticket_id)) closedMap.set(row.ticket_id, row);
  }
  return tickets.map((t) => {
    const closed = closedMap.get(t.id);
    const completedAt = t.status === 'closed'
      ? (closed?.created_at?.toISOString?.() || t.updated_at)
      : null;
    return {
      ...t,
      completed_at: completedAt,
      completion_remarks: closed?.remarks || null,
      closed_by_name: closed?.closed_by_name || null,
    };
  });
}

app.get('/api/dashboard/', async (req, res) => {
  if (!requirePerm(req.user, 'can_view', res)) return;

  const period = parseMonthFromQuery(req.query || {});
  const empId = Number(req.user.emp_id);
  const monthParams = [period.start, period.end];

  const [myRows] = await pool.query(
    `${DASHBOARD_TICKET_SQL} WHERE (t.raising_employee_id = ? OR t.assigned_to = ?)
      AND t.ticket_date BETWEEN ? AND ? ORDER BY t.updated_at DESC`,
    [empId, empId, ...monthParams]
  );
  const myTickets = myRows.map(formatTicketDates);
  const createdByMe = myTickets.filter((t) => Number(t.raising_employee_id) === empId);
  const assignedToMe = myTickets.filter((t) => Number(t.assigned_to) === empId);

  const payload = {
    period,
    user: {
      name: req.user.name,
      role_name: req.user.role_name,
      department_name: req.user.department_name,
    },
    my_work: {
      summary: summarizeByStatus(myTickets),
      assigned_to_me: await enrichTicketsWithCompletion(assignedToMe),
      created_by_me: await enrichTicketsWithCompletion(createdByMe),
      completed: await enrichTicketsWithCompletion(myTickets.filter((t) => t.status === 'closed')),
    },
  };

  if (isAdminUser(req.user)) {
    const [allRows] = await pool.query(
      `${DASHBOARD_TICKET_SQL} WHERE t.ticket_date BETWEEN ? AND ? ORDER BY t.updated_at DESC`,
      monthParams
    );
    const allTickets = allRows.map(formatTicketDates);
    payload.all_work = {
      summary: summarizeByStatus(allTickets),
      recent: await enrichTicketsWithCompletion(allTickets.slice(0, 20)),
      completed: await enrichTicketsWithCompletion(allTickets.filter((t) => t.status === 'closed').slice(0, 20)),
    };
  }

  if (isDeptViewerRole(req.user) && req.user.dept_id != null) {
    const deptId = Number(req.user.dept_id);
    const deptFilter = getDeptTicketFilter(deptId);
    const [deptRows] = await pool.query(
      `${DASHBOARD_TICKET_SQL}${deptFilter.clause} AND t.ticket_date BETWEEN ? AND ? ORDER BY t.updated_at DESC`,
      [...deptFilter.params, ...monthParams]
    );
    const deptTickets = deptRows.map(formatTicketDates);
    const deptAssigned = deptTickets.filter((t) => Number(t.assigned_to) === empId);
    const deptCreated = deptTickets.filter((t) => Number(t.raising_employee_id) === empId);
    payload.department_work = {
      department_name: req.user.department_name,
      summary: summarizeByStatus(deptTickets),
      tickets: await enrichTicketsWithCompletion(deptTickets),
      assigned_to_me: await enrichTicketsWithCompletion(deptAssigned),
      created_by_me: await enrichTicketsWithCompletion(deptCreated),
      completed: await enrichTicketsWithCompletion(deptTickets.filter((t) => t.status === 'closed')),
    };
  }

  res.json(payload);
});

app.get('/api/tickets/', async (req, res) => {
  if (!requirePerm(req.user, 'can_view', res)) return;

  const scope = String(req.query.scope || '').toLowerCase();
  let sql = TICKET_LIST_SQL;
  const params = [];
  if (isAdminUser(req.user)) {
    // no filter — all tickets
  } else if (scope === 'department' && isDeptViewerRole(req.user) && req.user.dept_id != null) {
    const deptFilter = getDeptTicketFilter(Number(req.user.dept_id));
    sql += deptFilter.clause;
    params.push(...deptFilter.params);
  } else {
    sql += ' WHERE t.raising_employee_id = ? OR t.assigned_to = ?';
    params.push(req.user.emp_id, req.user.emp_id);
  }
  sql += ' ORDER BY t.id DESC';

  const [rows] = await pool.query(sql, params);
  for (const t of rows) {
    t.ticket_date = t.ticket_date?.toISOString?.().split('T')[0] || t.ticket_date;
    const [attachments] = await pool.query('SELECT id, file_name, file_path, file_type, uploaded_at FROM ticket_attachments WHERE ticket_id = ?', [t.id]);
    const [history] = await pool.query(`${HISTORY_SQL} WHERE h.ticket_id = ? ORDER BY h.id`, [t.id]);
    t.attachments = attachments;
    t.history = history;
  }
  res.json(rows);
});

app.get('/api/tickets/next-number', async (req, res) => {
  res.json({ ticket_no: await generateTicketNo() });
});

app.get('/api/tickets/:id', async (req, res) => {
  const ticket = await getTicketDetail(req.params.id);
  if (!ticket) return res.status(404).json({ detail: 'Ticket not found' });
  if (!requirePerm(req.user, 'can_view', res)) return;
  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ detail: 'You do not have access to this ticket' });
  }
  res.json(ticket);
});

app.post('/api/tickets/', upload.any(), async (req, res) => {
  try {
    if (!requirePerm(req.user, 'can_create', res)) return;

    const b = req.body || {};
    const { images, documents: documentFiles } = getUploadGroups(req);

    const required = [
      'ticket_date', 'complaint_category_id', 'location_id',
      'ticket_description', 'assigned_to', 'priority',
    ];
    const missing = required.filter((k) => b[k] === undefined || b[k] === '');
    if (missing.length) {
      return res.status(400).json({ detail: `Missing required fields: ${missing.join(', ')}` });
    }

    const raisingEmployeeId = req.user.emp_id;
    const raisingDeptId = req.user.dept_id;

    const ticketNo = String(b.ticket_no || '').trim() || await generateTicketNo();
    let priority;
    try {
      priority = normalizePriority(b.priority);
    } catch {
      return res.status(400).json({ detail: 'Invalid priority value' });
    }
    if (String(b.ticket_no || '').trim()) {
      const [existing] = await pool.query('SELECT id FROM tickets WHERE ticket_no = ?', [ticketNo]);
      if (existing.length) return res.status(400).json({ detail: 'Ticket number already exists' });
    }

    const [r] = await pool.query(
      `INSERT INTO tickets (ticket_no, ticket_date, raising_dept_id, raising_employee_id,
        complaint_category_id, location_id, ticket_description, details, assigned_to, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [ticketNo, b.ticket_date, raisingDeptId, raisingEmployeeId,
        b.complaint_category_id, b.location_id, b.ticket_description, b.details || null, b.assigned_to, priority]
    );
    const ticketId = r.insertId;

    if (images.length) {
      await saveAttachments(ticketId, images, 'image', raisingEmployeeId);
    }
    if (documentFiles.length) {
      await saveAttachments(ticketId, documentFiles, 'file', raisingEmployeeId);
    }
    await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
      [ticketId, 'created', raisingEmployeeId, 'Ticket created']);

    res.json(await getTicketDetail(ticketId));
  } catch (err) {
    console.error('POST /api/tickets/ failed:', err);
    res.status(500).json({ detail: err.message || 'Failed to create ticket' });
  }
});

app.put('/api/tickets/:id', upload.any(), async (req, res) => {
  try {
    const b = req.body || {};
    const { images, documents: documentFiles } = getUploadGroups(req);
    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
    if (!canModifyTicket(req.user, rows[0])) {
      return res.status(403).json({ detail: 'You do not have permission to edit this ticket' });
    }
    if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Cannot update a closed ticket' });

    const remarks = requireRemarks(b, res);
    if (!remarks) return;

    const actionBy = req.user.emp_id;

    let priority = rows[0].priority;
    if (b.priority !== undefined && b.priority !== '') {
      try {
        priority = normalizePriority(b.priority);
      } catch {
        return res.status(400).json({ detail: 'Invalid priority value' });
      }
    }

    const status = rows[0].status === 'open' ? 'in_progress' : rows[0].status;
    await pool.query(
      `UPDATE tickets SET ticket_description=?, details=?, complaint_category_id=?, location_id=?, priority=?, status=? WHERE id=?`,
      [b.ticket_description, b.details || null, b.complaint_category_id, b.location_id, priority, status, req.params.id]
    );

    if (images.length) {
      await saveAttachments(req.params.id, images, 'image', actionBy);
    }
    if (documentFiles.length) {
      await saveAttachments(req.params.id, documentFiles, 'file', actionBy);
    }
    await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
      [req.params.id, 'updated', actionBy, remarks]);

    res.json(await getTicketDetail(req.params.id));
  } catch (err) {
    console.error('PUT /api/tickets/:id failed:', err);
    res.status(500).json({ detail: err.message || 'Failed to update ticket' });
  }
});

app.post('/api/tickets/:id/comments', express.json(), async (req, res) => {
  try {
    const b = req.body || {};
    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
    if (!canAccessTicket(req.user, rows[0])) {
      return res.status(403).json({ detail: 'You do not have access to this ticket' });
    }
    if (rows[0].status === 'closed') {
      return res.status(400).json({ detail: 'Cannot add comments to a closed ticket' });
    }

    const remarks = requireRemarks(b, res);
    if (!remarks) return;

    await pool.query(
      'INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
      [req.params.id, 'comment', req.user.emp_id, remarks]
    );

    res.json(await getTicketDetail(req.params.id));
  } catch (err) {
    console.error('POST /api/tickets/:id/comments failed:', err);
    res.status(500).json({ detail: err.message || 'Failed to add comment' });
  }
});

app.post('/api/tickets/:id/forward', upload.array('images'), async (req, res) => {
  const b = req.body || {};
  const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
  if (!canModifyTicket(req.user, rows[0])) {
    return res.status(403).json({ detail: 'You do not have permission to forward this ticket' });
  }
  if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Cannot forward a closed ticket' });

  const remarks = requireRemarks(b, res);
  if (!remarks) return;

  const actionBy = req.user.emp_id;

  const [emp] = await pool.query('SELECT name FROM employees WHERE emp_id = ?', [b.forward_to]);
  if (!emp.length) return res.status(404).json({ detail: 'Target employee not found' });

  await pool.query('UPDATE tickets SET assigned_to = ?, status = ? WHERE id = ?', [b.forward_to, 'forwarded', req.params.id]);

  for (const file of req.files || []) {
    await saveAttachments(req.params.id, [file], 'image', actionBy);
  }
  await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, forwarded_to, remarks) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, 'forwarded', actionBy, b.forward_to, remarks]);

  res.json(await getTicketDetail(req.params.id));
});

app.post('/api/tickets/:id/close', upload.array('images'), async (req, res) => {
  const b = req.body || {};
  const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
  if (!canModifyTicket(req.user, rows[0])) {
    return res.status(403).json({ detail: 'You do not have permission to close this ticket' });
  }
  if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Ticket is already closed' });

  const remarks = requireRemarks(b, res);
  if (!remarks) return;

  const actionBy = req.user.emp_id;

  await pool.query('UPDATE tickets SET status = ? WHERE id = ?', ['closed', req.params.id]);

  for (const file of req.files || []) {
    await saveAttachments(req.params.id, [file], 'image', actionBy);
  }
  await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
    [req.params.id, 'closed', actionBy, remarks]);

  res.json(await getTicketDetail(req.params.id));
});

// --- Scheduled Jobs ---
app.get('/api/scheduled-jobs/', async (req, res) => {
  if (!(await canAccessSchedulesApi(req.user))) {
    return res.status(403).json({ detail: 'You do not have permission to view scheduled jobs' });
  }
  const filter = getScheduledJobFilter(req.user);
  const [rows] = await pool.query(
    `${SCHEDULED_JOB_SQL}${filter.clause} ORDER BY sj.is_active DESC, sj.next_run_date ASC, sj.id DESC`,
    filter.params
  );
  res.json(rows.map(formatScheduledJob));
});

app.get('/api/scheduled-jobs/:id', async (req, res) => {
  const filter = getScheduledJobFilter(req.user);
  const [rows] = await pool.query(
    `${SCHEDULED_JOB_SQL}${filter.clause ? filter.clause + ' AND' : ' WHERE'} sj.id = ?`,
    [...filter.params, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ detail: 'Scheduled job not found' });
  if (!canViewScheduleJob(req.user, rows[0])) {
    return res.status(403).json({ detail: 'You do not have permission to view this scheduled job' });
  }
  res.json(formatScheduledJob(rows[0]));
});

app.post('/api/scheduled-jobs/', async (req, res) => {
  if (!canCreateScheduleJob(req.user)) {
    return res.status(403).json({ detail: 'You do not have permission to create scheduled jobs' });
  }
  const b = req.body || {};
  const jobName = String(b.job_name || '').trim();
  const scheduleType = b.schedule_type;
  const validTypes = ['once', 'daily', 'weekly', 'monthly', 'periodic'];
  if (!jobName) return res.status(400).json({ detail: 'Job name is required' });
  if (!validTypes.includes(scheduleType)) {
    return res.status(400).json({ detail: 'Invalid schedule type' });
  }
  if (!b.complaint_category_id || !b.location_id || !b.ticket_description || !b.assigned_to) {
    return res.status(400).json({ detail: 'Category, location, description, and assignee are required' });
  }
  if (scheduleType === 'once' && !b.run_date) {
    return res.status(400).json({ detail: 'Run date is required for one-time jobs' });
  }
  if (scheduleType === 'weekly' && b.day_of_week == null) {
    return res.status(400).json({ detail: 'Day of week is required for weekly jobs' });
  }
  if (scheduleType === 'monthly' && !b.day_of_month) {
    return res.status(400).json({ detail: 'Day of month is required for monthly jobs' });
  }
  if (scheduleType === 'periodic') {
    if (!b.interval_days || Number(b.interval_days) < 1) {
      return res.status(400).json({ detail: 'Interval days must be at least 1 for periodic jobs' });
    }
    if (!b.start_date) return res.status(400).json({ detail: 'Start date is required for periodic jobs' });
  }

  const nextRun = computeInitialNextRun(b);
  const raisingDeptId = req.user.dept_id;
  const raisingEmployeeId = req.user.emp_id;

  const [r] = await pool.query(
    `INSERT INTO scheduled_jobs
      (job_name, schedule_type, run_date, day_of_week, day_of_month, interval_days,
       start_date, end_date, next_run_date, complaint_category_id, location_id,
       ticket_description, details, assigned_to, priority, raising_dept_id, raising_employee_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobName, scheduleType,
      b.run_date || null,
      b.day_of_week != null ? Number(b.day_of_week) : null,
      b.day_of_month ? Number(b.day_of_month) : null,
      b.interval_days ? Number(b.interval_days) : null,
      b.start_date || null,
      b.end_date || null,
      nextRun,
      b.complaint_category_id,
      b.location_id,
      String(b.ticket_description).trim(),
      b.details || null,
      b.assigned_to,
      b.priority || 'normal',
      raisingDeptId,
      raisingEmployeeId,
    ]
  );

  const [rows] = await pool.query(`${SCHEDULED_JOB_SQL} WHERE sj.id = ?`, [r.insertId]);
  res.status(201).json(formatScheduledJob(rows[0]));
});

app.put('/api/scheduled-jobs/:id', async (req, res) => {
  const filter = getScheduledJobFilter(req.user);
  const [existing] = await pool.query(
    `SELECT sj.* FROM scheduled_jobs sj${filter.clause ? filter.clause + ' AND' : ' WHERE'} sj.id = ?`,
    [...filter.params, req.params.id]
  );
  if (!existing.length) return res.status(404).json({ detail: 'Scheduled job not found' });
  if (!canEditScheduleJob(req.user, existing[0])) {
    return res.status(403).json({ detail: 'You do not have permission to edit this scheduled job' });
  }

  const b = req.body || {};
  const jobName = String(b.job_name || existing[0].job_name).trim();
  const scheduleType = b.schedule_type || existing[0].schedule_type;
  const merged = {
    schedule_type: scheduleType,
    run_date: b.run_date !== undefined ? b.run_date : toDateStr(existing[0].run_date),
    start_date: b.start_date !== undefined ? b.start_date : toDateStr(existing[0].start_date),
    day_of_week: b.day_of_week !== undefined ? b.day_of_week : existing[0].day_of_week,
    day_of_month: b.day_of_month !== undefined ? b.day_of_month : existing[0].day_of_month,
    interval_days: b.interval_days !== undefined ? b.interval_days : existing[0].interval_days,
  };
  const nextRun = b.next_run_date || computeInitialNextRun(merged);
  const isActive = b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing[0].is_active;

  await pool.query(
    `UPDATE scheduled_jobs SET
      job_name = ?, schedule_type = ?, run_date = ?, day_of_week = ?, day_of_month = ?,
      interval_days = ?, start_date = ?, end_date = ?, next_run_date = ?,
      complaint_category_id = ?, location_id = ?, ticket_description = ?, details = ?,
      assigned_to = ?, priority = ?, is_active = ?
     WHERE id = ?`,
    [
      jobName, scheduleType,
      merged.run_date || null,
      merged.day_of_week != null ? Number(merged.day_of_week) : null,
      merged.day_of_month ? Number(merged.day_of_month) : null,
      merged.interval_days ? Number(merged.interval_days) : null,
      b.start_date !== undefined ? b.start_date : toDateStr(existing[0].start_date),
      b.end_date !== undefined ? b.end_date : toDateStr(existing[0].end_date),
      nextRun,
      b.complaint_category_id || existing[0].complaint_category_id,
      b.location_id || existing[0].location_id,
      String(b.ticket_description || existing[0].ticket_description).trim(),
      b.details !== undefined ? b.details : existing[0].details,
      b.assigned_to || existing[0].assigned_to,
      b.priority || existing[0].priority,
      isActive,
      req.params.id,
    ]
  );

  const [rows] = await pool.query(`${SCHEDULED_JOB_SQL} WHERE sj.id = ?`, [req.params.id]);
  res.json(formatScheduledJob(rows[0]));
});

app.delete('/api/scheduled-jobs/:id', async (req, res) => {
  const filter = getScheduledJobFilter(req.user);
  const [existing] = await pool.query(
    `SELECT sj.* FROM scheduled_jobs sj${filter.clause ? filter.clause + ' AND' : ' WHERE'} sj.id = ?`,
    [...filter.params, req.params.id]
  );
  if (!existing.length) return res.status(404).json({ detail: 'Scheduled job not found' });
  if (!canEditScheduleJob(req.user, existing[0])) {
    return res.status(403).json({ detail: 'You do not have permission to delete this scheduled job' });
  }
  await pool.query('DELETE FROM scheduled_jobs WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Serve UI at root
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ detail: `Upload error: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ detail: err.message || 'Internal server error' });
});

initDb()
  .then(async () => {
    await processScheduledJobs();
    setInterval(() => {
      processScheduledJobs().catch((err) => console.error('Scheduled job runner failed:', err.message));
    }, 60 * 60 * 1000);
    app.listen(PORT, () => {
      console.log(`API running:  http://localhost:${PORT}`);
      console.log(`App UI:       http://localhost:${PORT}`);
      console.log(`Database:     ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err.message);
    console.error('Make sure MariaDB is running and credentials are correct (root / root123).');
    process.exit(1);
  });
