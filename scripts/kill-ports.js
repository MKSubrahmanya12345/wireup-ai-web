// ??$$$ non-important
const { execSync } = require('child_process');

const PORTS = [5000, 5001, 5173, 5174];

console.log(`🧹 Scanning and killing processes on ports: ${PORTS.join(', ')}`);

const pids = new Set();

if (process.platform === 'win32') {
  try {
    const output = execSync('netstat -ano').toString();
    const lines = output.split('\n');
    for (const line of lines) {
      for (const port of PORTS) {
        // Match specific port in local address column (e.g. 0.0.0.0:5000 or [::]:5000 or 127.0.0.1:5000)
        const regex = new RegExp(`[:\\]]${port}\\s+`);
        if (regex.test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid) && pid !== '0') {
            pids.add(parseInt(pid, 10));
          }
        }
      }
    }
  } catch (err) {
    console.error('Error running netstat:', err.message);
  }
} else {
  for (const port of PORTS) {
    try {
      const pidStr = execSync(`lsof -t -i:${port}`).toString().trim();
      if (pidStr) {
        pidStr.split('\n').forEach(pid => {
          if (pid && !isNaN(pid)) {
            pids.add(parseInt(pid, 10));
          }
        });
      }
    } catch (err) {
      // lsof exits with 1 when no process is found
    }
  }
}

if (pids.size === 0) {
  console.log('✅ No active processes found on those ports.');
  process.exit(0);
}

console.log(`Killing PIDs: ${Array.from(pids).join(', ')}`);

for (const pid of pids) {
  try {
    process.kill(pid, 'SIGKILL');
    console.log(` Killed PID ${pid}`);
  } catch (err) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(` Killed PID ${pid} via taskkill`);
      } catch (tkErr) {
        console.error(` Failed to kill PID ${pid}:`, tkErr.message);
      }
    } else {
      console.error(` Failed to kill PID ${pid}:`, err.message);
    }
  }
}

console.log('✅ Port cleanup finished!');
