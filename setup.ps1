# Ticketing System — one-time setup (Windows)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "`n=== Ticketing System Setup ===`n" -ForegroundColor Cyan

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed. Install Node.js 18+ from https://nodejs.org"
}
Write-Host "[OK] Node.js $(node -v)"

# MariaDB / MySQL client (optional check)
$mysqlPaths = @(
  "C:\Program Files\MariaDB*\bin\mysql.exe",
  "C:\Program Files\MySQL\*\bin\mysql.exe"
)
$mysql = $null
foreach ($pattern in $mysqlPaths) {
  $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $mysql = $found.FullName; break }
}
if ($mysql) {
  Write-Host "[OK] MariaDB/MySQL client found"
} else {
  Write-Host "[WARN] MariaDB client not found in default paths. Ensure MariaDB is installed and running." -ForegroundColor Yellow
}

# API dependencies
Write-Host "`nInstalling API dependencies..."
Push-Location (Join-Path $Root "backend-node")
if (-not (Test-Path "node_modules")) {
  npm install
} else {
  Write-Host "[OK] backend-node/node_modules already exists"
}
Pop-Location

# Uploads folder
$uploads = Join-Path $Root "uploads"
if (-not (Test-Path $uploads)) {
  New-Item -ItemType Directory -Path $uploads | Out-Null
  Write-Host "[OK] Created uploads folder"
} else {
  Write-Host "[OK] uploads folder exists"
}

# Database connectivity test
Write-Host "`nTesting database connection..."
Push-Location $Root
node -e @"
const mysql = require('./backend-node/node_modules/mysql2/promise');
(async () => {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'ticketing_db',
  };
  try {
    const conn = await mysql.createConnection({ ...cfg, database: undefined });
    await conn.query('CREATE DATABASE IF NOT EXISTS \`' + cfg.database + '\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await conn.end();
    const pool = await mysql.createPool(cfg);
    const [[row]] = await pool.query('SELECT COUNT(*) AS c FROM employees');
    console.log('[OK] Database ready — employees:', row.c);
    await pool.end();
  } catch (e) {
    console.error('[FAIL]', e.message);
    console.error('Start MariaDB service and check DB_USER / DB_PASSWORD.');
    process.exit(1);
  }
})();
"@
Pop-Location

Write-Host "`n=== Setup complete ===" -ForegroundColor Green
Write-Host "Start the app:  npm start"
Write-Host "Open browser:   http://localhost:5173"
Write-Host "Default login:  Admin / 2496  (or see your employee master)`n"
