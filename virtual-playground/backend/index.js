// ??$$$ non-important
// ??$$$
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

const allowedOrigins = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// Mock project database store
const mockProject = {
  id: "starter-project",
  name: "Virtual Playground Starter",
  description: "Load a formulated project payload to simulate its real sketch, wiring, and components.",
  author: "Virtual Playground",
  createdAt: "2026-06-06",
  bom: [],
  wiring: [],
  editableJson: {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false
  },
  sketch: `// Starter sketch placeholder.
// Real behavior should come from the loaded project payload.

void setup() {
}

void loop() {
}
`
};

// ??$$$ old code
/*
app.get('/api/project', (req, res) => {
  console.log('[API] GET /api/project requested - serving hardware project schema');
  res.json(mockProject);
});
*/
// ??$$$ newer code
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

app.get('/api/project', (req, res) => {
  const sessionId = req.query.sessionId;
  if (sessionId) {
    const exportDir = process.env.EXPORT_DIR ? path.join(process.env.EXPORT_DIR, `session_${sessionId}`) : path.join(process.cwd(), "exports", `session_${sessionId}`);
    if (fs.existsSync(exportDir)) {
      try {
        console.log(`[API] Serving dynamic session project for session: ${sessionId}`);
        const bom = JSON.parse(fs.readFileSync(path.join(exportDir, "bom.json"), "utf8") || "[]");
        const wiring = JSON.parse(fs.readFileSync(path.join(exportDir, "wiring.json"), "utf8") || "[]");
        const milestones = JSON.parse(fs.readFileSync(path.join(exportDir, "milestones.json"), "utf8") || "[]");
        const context = JSON.parse(fs.readFileSync(path.join(exportDir, "context.json"), "utf8") || "{}");
        const sketch = fs.readFileSync(path.join(exportDir, "sketch.ino"), "utf8") || "";

        // Build normalized projectData structure as expected by the frontend
        const projectPayload = {
          id: sessionId,
          name: context.corePurpose || "Wireup Project",
          description: "AI-formulated project loaded from E: drive",
          author: "Wireup AI",
          createdAt: new Date().toISOString().slice(0, 10),
          bom,
          wiring,
          editableJson: {
            simulationSpeed: 1,
            ledInitialState: false,
            buttonInitialState: false
          },
          sketch,
          context,
          phases: context.subsystems || [],
          milestones,
          additionalTools: [
            "Soldering iron",
            "Solder wire",
            "Wire stripper",
            "Wire cutter",
            "Multimeter"
          ]
        };
        return res.json(projectPayload);
      } catch (err) {
        console.error(`[API] Error reading session exports for ${sessionId}:`, err);
      }
    } else {
      console.warn(`[API] Export directory not found for session: ${sessionId}`);
    }
  }

  console.log('[API] GET /api/project requested - serving fallback mockProject');
  res.json(mockProject);
});

const resolveArduinoCliPath = () => {
  if (process.env.ARDUINO_CLI_PATH?.trim()) {
    return process.env.ARDUINO_CLI_PATH.trim();
  }

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const windowsLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli.exe');
  const unixLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli');

  if (fs.existsSync(windowsLocal)) return windowsLocal;
  if (fs.existsSync(unixLocal)) return unixLocal;

  return 'arduino-cli';
};

const runArduinoCli = (args, cwd = process.cwd()) =>
  new Promise((resolve) => {
    const child = spawn(resolveArduinoCliPath(), args, {
      cwd,
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });
  });

const liquidCrystalHeader = /#include\s*[<"]LiquidCrystal_I2C\.h[>"]/;
const liquidCrystalCandidates = ['LiquidCrystal_I2C', 'LiquidCrystal I2C'];
const installedLibraries = new Set();

const isLibraryInstalled = async (name) => {
  if (installedLibraries.has(name)) {
    return true;
  }

  const result = await runArduinoCli(['lib', 'list']);
  if (!result.ok) {
    return false;
  }

  const found = result.stdout.toLowerCase().includes(name.toLowerCase());
  if (found) {
    installedLibraries.add(name);
  }

  return found;
};

const ensureSketchLibraries = async (sketch) => {
  if (!liquidCrystalHeader.test(sketch || '')) {
    return;
  }

  for (const candidate of liquidCrystalCandidates) {
    if (await isLibraryInstalled(candidate)) {
      return;
    }
  }

  let lastError = null;
  for (const candidate of liquidCrystalCandidates) {
    const result = await runArduinoCli(['lib', 'install', candidate]);
    if (result.ok) {
      installedLibraries.add(candidate);
      return;
    }

    lastError = result.stderr || result.stdout || `Failed to install ${candidate}`;
  }

  throw new Error(lastError || 'LiquidCrystal_I2C is required but could not be installed');
};

app.post('/api/compile', async (req, res) => {
  const sketch = String(req.body?.sketch || '');
  const fqbn = String(req.body?.fqbn || 'arduino:avr:uno');

  if (!sketch.trim()) {
    return res.status(400).json({ error: 'sketch is required' });
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wireup-vp-compile-'));
  const sketchDir = path.join(tempRoot, 'sketch');
  const buildDir = path.join(tempRoot, 'build');

  try {
    await ensureSketchLibraries(sketch);

    fs.mkdirSync(sketchDir, { recursive: true });
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), sketch, 'utf8');

    const result = await runArduinoCli(
      ['compile', '--fqbn', fqbn, '--output-dir', buildDir, sketchDir],
      sketchDir
    );

    if (!result.ok) {
      return res.status(400).json({
        error: result.stderr || result.stdout || 'Compilation failed'
      });
    }

    const firmwareName = fs.readdirSync(buildDir).find((name) => name.endsWith('.ino.hex'));
    if (!firmwareName) {
      return res.status(500).json({
        error: 'Compilation succeeded but firmware hex was not found'
      });
    }

    const hex = fs.readFileSync(path.join(buildDir, firmwareName), 'utf8');
    return res.json({ hex });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to compile sketch'
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'mock-local-memory', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 MERN BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/project`);
  console.log(`==================================================`);
});
