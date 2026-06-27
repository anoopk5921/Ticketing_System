// Simple static server — no npm build required.
// Serves the app UI and proxies API calls to the Node backend on port 8000.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const STATIC_DIR = path.join(__dirname, 'backend', 'static');
const API_HOST = 'localhost';
const API_PORT = 8000;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function proxy(req, res) {
  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
  delete headers.connection;

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      detail: `API server not reachable on port ${API_PORT}. From the project folder run: npm start`,
    }));
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(STATIC_DIR, filePath);

  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return proxy(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`App UI:  http://localhost:${PORT}`);
  console.log(`API proxy -> http://${API_HOST}:${API_PORT}`);
  console.log('(Run npm start from the project folder to start API + UI together)');
});
