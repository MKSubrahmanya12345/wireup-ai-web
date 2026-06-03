// ??$$$ non-important
const { spawn } = require('child_process');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];
let shuttingDown = false;

function startService(label, cwd) {
  const child = spawn(`${npmCommand} run dev`, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const otherChild of children) {
      if (otherChild !== child && !otherChild.killed) {
        otherChild.kill();
      }
    }

    process.exit(code ?? (signal ? 1 : 0));
  });

  children.push(child);
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startService('root-frontend', path.join(workspaceRoot, 'frontend'));
startService('root-backend', path.join(workspaceRoot, 'backend'));
startService('playground-frontend', path.join(workspaceRoot, 'virtual-playground', 'frontend'));
startService('playground-backend', path.join(workspaceRoot, 'virtual-playground', 'backend'));