import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { compileWokwiSketch } from '../services/wokwi-local.service';

const router = express.Router();

const DEFAULT_FQBN = 'arduino:avr:uno';
const LIQUID_CRYSTAL_HEADER = /#include\s*[<"]LiquidCrystal_I2C\.h[>"]/;
const LIQUID_CRYSTAL_CANDIDATES = ['LiquidCrystal_I2C', 'LiquidCrystal I2C'];

const resolveArduinoCliPath = () => {
  if (process.env.ARDUINO_CLI_PATH?.trim()) {
    return process.env.ARDUINO_CLI_PATH.trim();
  }

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const windowsLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli.exe');
  const unixLocal = path.join(home, '.arduino-cli', 'bin', 'arduino-cli');

  if (existsSync(windowsLocal)) return windowsLocal;
  if (existsSync(unixLocal)) return unixLocal;

  return 'arduino-cli';
};

const runArduinoCli = (args: string[], cwd = process.cwd()) =>
  new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
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
      resolve({
        ok: code === 0,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim()
      });
    });
  });

const installedLibraries = new Set<string>();
const installPromises = new Map<string, Promise<void>>();

const isLibraryInstalled = async (name: string) => {
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

const ensureLibraryInstalled = async (name: string) => {
  if (await isLibraryInstalled(name)) {
    return;
  }

  if (!installPromises.has(name)) {
    installPromises.set(
      name,
      (async () => {
        const result = await runArduinoCli(['lib', 'install', name]);
        if (!result.ok) {
          throw new Error(result.stderr || result.stdout || `Failed to install ${name}`);
        }

        installedLibraries.add(name);
      })()
    );
  }

  return installPromises.get(name);
};

const ensureSketchLibraries = async (sketch: string) => {
  if (!LIQUID_CRYSTAL_HEADER.test(sketch)) {
    return;
  }

  for (const candidate of LIQUID_CRYSTAL_CANDIDATES) {
    if (await isLibraryInstalled(candidate)) {
      return;
    }
  }

  let lastError: unknown = null;
  for (const candidate of LIQUID_CRYSTAL_CANDIDATES) {
    try {
      await ensureLibraryInstalled(candidate);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('LiquidCrystal_I2C is required but could not be installed');
};

router.post('/compile', async (req, res) => {
  const sketch = String(req.body?.sketch || '');
  const fqbn = String(req.body?.fqbn || DEFAULT_FQBN);

  if (!sketch.trim()) {
    return res.status(400).json({ error: 'sketch is required' });
  }

  let tempDir = '';

  try {
    await ensureSketchLibraries(sketch);

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'wireup-public-compile-'));
    await mkdir(tempDir, { recursive: true });
    await writeFile(path.join(tempDir, 'sketch.ino'), sketch, 'utf8');

    const compileResult = await compileWokwiSketch({
      projectPath: tempDir,
      sketchFile: 'sketch.ino',
      fqbn
    });

    if (!compileResult.ok) {
      return res.status(400).json({
        error: compileResult.stderrTail || compileResult.stdoutTail || 'Compilation failed'
      });
    }

    const firmwarePath = String((compileResult.metadata as any)?.firmwarePath || '').trim();
    if (!firmwarePath || !existsSync(firmwarePath)) {
      return res.status(500).json({
        error: 'Compilation succeeded but firmware hex was not found'
      });
    }

    const hex = await readFile(firmwarePath, 'utf8');
    return res.json({ hex });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Failed to compile sketch'
    });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

export default router;
