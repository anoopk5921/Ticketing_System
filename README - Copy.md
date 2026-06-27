# Complaint & Ticketing Management System

A simple web application for managing complaints and support tickets, built with **React**, **Python (FastAPI)**, and **MariaDB**.

## Features

### Master Data
- **Department** — Dept ID, Description
- **Role** — Role ID, Role Name
- **Employee** — Emp ID, Name, Dept ID, Role ID
- **Complaint Category** — ID, Category Description
- **Location** — ID, Location Name

### Ticket Management
- Create new tickets with all required fields and picture uploads
- View ticket list and details
- Assigned staff can **update**, **forward**, or **close** tickets
- Upload images during ticket creation and all follow-up actions
- Full ticket history tracking

## Project Structure

```
Ticketing System/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # App entry point
│   │   ├── database.py       # DB connection
│   │   ├── models.py         # Database tables
│   │   ├── schemas.py        # Request/response shapes
│   │   └── routers/          # API endpoints
│   ├── init_db.sql           # Sample data script
│   └── requirements.txt
├── frontend/         # React frontend
│   └── src/
│       ├── App.jsx           # Main layout & routing
│       ├── api.js            # API calls
│       ├── components/       # Reusable components
│       └── pages/            # Screen pages
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MariaDB (or MySQL)

## Setup Instructions

### Option A — Quick start (recommended, no npm build needed)

The UI is served without Vite/npm. Open **one or two terminals**:

**Terminal 1 — UI (port 5173):**
```powershell
cd "E:\Cursor WD\Ticketing System"
node serve.js
```

**Terminal 2 — API (port 8000):**
```powershell
cd "E:\Cursor WD\Ticketing System\backend"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:5173** in your browser.

> You can also open **http://localhost:8000** after starting only the backend — it serves the same UI.

### Option B — Vite dev server (requires npm install to succeed)

If `npm install` works on your machine (no antivirus blocking esbuild):

```powershell
cd frontend
npm install
npm run dev
```

### 1. Database Setup

Create the database in MariaDB:

```sql
CREATE DATABASE ticketing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Optionally run the sample data script (after starting the backend once to create tables):

```bash
mysql -u root -p ticketing_db < backend/init_db.sql
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set database credentials (optional - defaults: root / root123)
set DB_USER=root
set DB_PASSWORD=root123
set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=ticketing_db

# Start the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
API docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage Flow

1. **Set up masters first** — Add Departments, Roles, Employees, Categories, and Locations from the sidebar.
2. **Create a ticket** — Go to "New Ticket", fill in all fields, assign to a staff member, and optionally upload pictures.
3. **Manage tickets** — Open a ticket from the list. The assigned staff can update details, forward to another employee, or close the ticket. Images can be uploaded with each action.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/departments/` | List / Create departments |
| GET/POST | `/api/roles/` | List / Create roles |
| GET/POST | `/api/employees/` | List / Create employees |
| GET/POST | `/api/categories/` | List / Create categories |
| GET/POST | `/api/locations/` | List / Create locations |
| GET/POST | `/api/tickets/` | List / Create tickets |
| GET | `/api/tickets/{id}` | Get ticket details |
| PUT | `/api/tickets/{id}` | Update ticket |
| POST | `/api/tickets/{id}/forward` | Forward ticket |
| POST | `/api/tickets/{id}/close` | Close ticket |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DB_USER | root | Database username |
| DB_PASSWORD | root123 | Database password |
| DB_HOST | localhost | Database host |
| DB_PORT | 3306 | Database port |
| DB_NAME | ticketing_db | Database name |
| UPLOAD_DIR | uploads | Folder for uploaded images |
