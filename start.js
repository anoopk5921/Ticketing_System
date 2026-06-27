const { spawn } = require('child_process');

const root = __dirname;
const isWin = process.platform === 'win32';
const children = [];

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] stopped (exit ${code})`);
    }
  });
  children.push(child);
  return child;
}

console.log('Starting Ticketing System...\n');
start('API', 'node', ['backend-node/server.js']);

setTimeout(() => {
  start('UI', 'node', ['serve.js']);
  console.log('\nOpen http://localhost:5173 (or http://localhost:8000)\n');
}, 1500);

function shutdown() {
  for (const child of children) child.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
