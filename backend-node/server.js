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
app.use('/uploads', express.static(UPLOAD_DIR));
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
      ae.name AS assignee_name
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
    'SELECT id, action, action_by, remarks, forwarded_to, created_at FROM ticket_history WHERE ticket_id = ? ORDER BY id',
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

// --- Departments ---
app.get('/api/departments/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM departments ORDER BY dept_id');
  res.json(rows);
});

app.post('/api/departments/', express.json(), async (req, res) => {
  const [r] = await pool.query('INSERT INTO departments (description) VALUES (?)', [req.body.description]);
  const [rows] = await pool.query('SELECT * FROM departments WHERE dept_id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/departments/:id', express.json(), async (req, res) => {
  await pool.query('UPDATE departments SET description = ? WHERE dept_id = ?', [req.body.description, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM departments WHERE dept_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Department not found' });
  res.json(rows[0]);
});

app.delete('/api/departments/:id', async (req, res) => {
  await pool.query('DELETE FROM departments WHERE dept_id = ?', [req.params.id]);
  res.json({ message: 'Department deleted' });
});

// --- Roles ---
app.get('/api/roles/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM roles ORDER BY role_id');
  res.json(rows);
});

app.post('/api/roles/', express.json(), async (req, res) => {
  const [r] = await pool.query('INSERT INTO roles (role_name) VALUES (?)', [req.body.role_name]);
  const [rows] = await pool.query('SELECT * FROM roles WHERE role_id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/roles/:id', express.json(), async (req, res) => {
  await pool.query('UPDATE roles SET role_name = ? WHERE role_id = ?', [req.body.role_name, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM roles WHERE role_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Role not found' });
  res.json(rows[0]);
});

app.delete('/api/roles/:id', async (req, res) => {
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
  await pool.query('DELETE FROM employees WHERE emp_id = ?', [req.params.id]);
  res.json({ message: 'Employee deleted' });
});

// --- Categories ---
app.get('/api/categories/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM complaint_categories ORDER BY id');
  res.json(rows);
});

app.post('/api/categories/', express.json(), async (req, res) => {
  const [r] = await pool.query('INSERT INTO complaint_categories (category_description) VALUES (?)', [req.body.category_description]);
  const [rows] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/categories/:id', express.json(), async (req, res) => {
  await pool.query('UPDATE complaint_categories SET category_description = ? WHERE id = ?', [req.body.category_description, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Category not found' });
  res.json(rows[0]);
});

app.delete('/api/categories/:id', async (req, res) => {
  await pool.query('DELETE FROM complaint_categories WHERE id = ?', [req.params.id]);
  res.json({ message: 'Category deleted' });
});

// --- Locations ---
app.get('/api/locations/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM locations ORDER BY id');
  res.json(rows);
});

app.post('/api/locations/', express.json(), async (req, res) => {
  const [r] = await pool.query('INSERT INTO locations (location_name) VALUES (?)', [req.body.location_name]);
  const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [r.insertId]);
  res.json(rows[0]);
});

app.put('/api/locations/:id', express.json(), async (req, res) => {
  await pool.query('UPDATE locations SET location_name = ? WHERE id = ?', [req.body.location_name, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Location not found' });
  res.json(rows[0]);
});

app.delete('/api/locations/:id', async (req, res) => {
  await pool.query('DELETE FROM locations WHERE id = ?', [req.params.id]);
  res.json({ message: 'Location deleted' });
});

// --- Tickets ---
app.get('/api/tickets/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT t.*,
      d.description AS raising_dept_name,
      re.name AS raising_employee_name,
      c.category_description AS category_name,
      l.location_name,
      ae.name AS assignee_name
    FROM tickets t
    LEFT JOIN departments d ON t.raising_dept_id = d.dept_id
    LEFT JOIN employees re ON t.raising_employee_id = re.emp_id
    LEFT JOIN complaint_categories c ON t.complaint_category_id = c.id
    LEFT JOIN locations l ON t.location_id = l.id
    LEFT JOIN employees ae ON t.assigned_to = ae.emp_id
    ORDER BY t.id DESC
  `);
  for (const t of rows) {
    t.ticket_date = t.ticket_date?.toISOString?.().split('T')[0] || t.ticket_date;
    const [attachments] = await pool.query('SELECT id, file_name, file_path, file_type, uploaded_at FROM ticket_attachments WHERE ticket_id = ?', [t.id]);
    const [history] = await pool.query('SELECT id, action, action_by, remarks, forwarded_to, created_at FROM ticket_history WHERE ticket_id = ? ORDER BY id', [t.id]);
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
  res.json(ticket);
});

app.post('/api/tickets/', upload.any(), async (req, res) => {
  try {
    const b = req.body || {};
    const { images, documents: documentFiles } = getUploadGroups(req);
    if (!documentFiles.length) {
      return res.status(400).json({ detail: 'At least one document file is required' });
    }

    const required = [
      'ticket_date', 'raising_dept_id', 'raising_employee_id',
      'complaint_category_id', 'location_id', 'ticket_description', 'assigned_to', 'priority',
    ];
    const missing = required.filter((k) => b[k] === undefined || b[k] === '');
    if (missing.length) {
      return res.status(400).json({ detail: `Missing required fields: ${missing.join(', ')}` });
    }

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
      [ticketNo, b.ticket_date, b.raising_dept_id, b.raising_employee_id,
        b.complaint_category_id, b.location_id, b.ticket_description, b.details || null, b.assigned_to, priority]
    );
    const ticketId = r.insertId;

    await saveAttachments(ticketId, images, 'image', b.raising_employee_id);
    await saveAttachments(ticketId, documentFiles, 'file', b.raising_employee_id);
    await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
      [ticketId, 'created', b.raising_employee_id, 'Ticket created']);

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
    if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Cannot update a closed ticket' });

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

    await saveAttachments(req.params.id, images, 'image', b.action_by);
    if (documentFiles.length) {
      await saveAttachments(req.params.id, documentFiles, 'file', b.action_by);
    }
    await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
      [req.params.id, 'updated', b.action_by, b.remarks || 'Ticket updated']);

    res.json(await getTicketDetail(req.params.id));
  } catch (err) {
    console.error('PUT /api/tickets/:id failed:', err);
    res.status(500).json({ detail: err.message || 'Failed to update ticket' });
  }
});

app.post('/api/tickets/:id/forward', upload.array('images'), async (req, res) => {
  const b = req.body || {};
  const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
  if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Cannot forward a closed ticket' });

  const [emp] = await pool.query('SELECT name FROM employees WHERE emp_id = ?', [b.forward_to]);
  if (!emp.length) return res.status(404).json({ detail: 'Target employee not found' });

  await pool.query('UPDATE tickets SET assigned_to = ?, status = ? WHERE id = ?', [b.forward_to, 'forwarded', req.params.id]);

  for (const file of req.files || []) {
    await saveAttachments(req.params.id, [file], 'image', b.action_by);
  }
  await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, forwarded_to, remarks) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, 'forwarded', b.action_by, b.forward_to, b.remarks || `Forwarded to ${emp[0].name}`]);

  res.json(await getTicketDetail(req.params.id));
});

app.post('/api/tickets/:id/close', upload.array('images'), async (req, res) => {
  const b = req.body || {};
  const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Ticket not found' });
  if (rows[0].status === 'closed') return res.status(400).json({ detail: 'Ticket is already closed' });

  await pool.query('UPDATE tickets SET status = ? WHERE id = ?', ['closed', req.params.id]);

  for (const file of req.files || []) {
    await saveAttachments(req.params.id, [file], 'image', b.action_by);
  }
  await pool.query('INSERT INTO ticket_history (ticket_id, action, action_by, remarks) VALUES (?, ?, ?, ?)',
    [req.params.id, 'closed', b.action_by, b.remarks || 'Ticket closed']);

  res.json(await getTicketDetail(req.params.id));
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
  .then(() => {
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
