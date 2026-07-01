# Complaint & Ticketing Management System

Web app for managing complaints and support tickets.

**Stack:** Node.js (Express) API + static UI (no npm build required) + MariaDB

## Prerequisites

- **Node.js** 18+ — [https://nodejs.org](https://nodejs.org)
- **MariaDB** (or MySQL) running on `localhost:3306`
- Default DB credentials (can be changed via environment variables):
  - User: `root`
  - Password: `root123`
  - Database: `ticketing_db` (created automatically on first run)

## Quick start (Windows)

Open PowerShell in the project folder:

```powershell
cd "E:\Cursor WD\Ticketing System"

# One-time setup (install deps, check DB)
npm run setup

# Start API (port 8000) + UI (port 5173)
npm start
```

Open **http://localhost:5173** in your browser.

You can also open **http://localhost:8000** — the API serves the same UI.

## Login

Use an employee from **Employee Master**, for example:

| User ID | Password | Role |
|---------|----------|------|
| Admin | 2496 | Admin |
| reji | 1120 | Supervisor |
| ragesh | 1119 | Manager |
| arun | 1217 | Technician |

On a **fresh empty database**, the API creates a default admin: `admin` / `po`.

## Project structure

```
Ticketing System/
├── backend-node/       # Node.js Express API (main backend)
├── backend/static/     # App UI (HTML, app.js, style.css)
├── serve.js            # UI server + API proxy (port 5173)
├── start.js            # Starts API + UI together
├── setup.ps1           # One-time setup script
├── uploads/            # Ticket attachments (created automatically)
└── backups/            # Database backup samples
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Install dependencies and verify database |
| `npm start` | Start API + UI together |
| `npm run api` | API only (port 8000) |
| `npm run ui` | UI only (port 5173; needs API running) |
| `npm test` | Run API integration tests |

## Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | root | Database username |
| `DB_PASSWORD` | root123 | Database password |
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 3306 | Database port |
| `DB_NAME` | ticketing_db | Database name |
| `PORT` | 8000 | API port |

Example (PowerShell):

```powershell
$env:DB_PASSWORD = "your_password"
npm start
```

## Restore database from backup

```powershell
& "C:\Program Files\MariaDB 12.3\bin\mysql.exe" -u root -p ticketing_db < "F:\Nipun\ticketing_db_20260701_102848.sql"
```

## Troubleshooting

**Port already in use (8000 or 5173)**  
Close the old terminal running the app, or stop the process using that port, then run `npm start` again.

**API not reachable / 502 errors**  
Ensure MariaDB is running and credentials are correct. Run `npm run setup` to test the connection.

**Stale UI after code changes**  
Hard refresh the browser: `Ctrl+F5`.

**MariaDB not running**  
Start the MariaDB service from Windows Services, or from an admin command prompt:

```powershell
net start MariaDB
```

## Features

- Dashboard with month filter
- Ticket create, update, forward, close, comments, attachments
- Schedule Jobs (recurring tickets)
- Role-based access (Admin, Supervisor, Manager, Technician)
- Masters: Departments, Roles, Employees, Categories, Locations
- Role Permissions (Admin)
