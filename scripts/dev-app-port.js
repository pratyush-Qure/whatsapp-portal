#!/usr/bin/env node
/**
 * Start Next.js dev server on the first available port in 3002–3010.
 * Used by dev:all so multiple runs don't conflict (e.g. previous run still on 3002).
 */
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const MIN = 3002;
const MAX = 3010;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  for (let port = MIN; port <= MAX; port++) {
    if (await isPortFree(port)) {
      console.log(`[dev-app-port] Using port ${port} (http://localhost:${port})`);
      const child = spawn('npx', ['next', 'dev', '-p', String(port)], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        shell: true,
      });
      child.on('exit', (code) => process.exit(code ?? 0));
      return;
    }
  }
  console.error('[dev-app-port] No free port in range 3002–3010. Stop existing dev servers and try again.');
  process.exit(1);
}

main();
