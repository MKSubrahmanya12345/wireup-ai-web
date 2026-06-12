// ??$$$ group 8 - Core Platform & Shared Infrastructure
console.log("🔥 INDEX FILE STARTED");

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import Groq from "groq-sdk";
// ??$$$
import { createServer } from "http";
import { Server } from "socket.io";

import { connectDB } from "./lib/db";

import projectRoutes from "./routes/project.routes";
import authRoutes from "./routes/auth.route";
import assemblyRoutes from "./routes/assembly.route";
import buildRoutes from "./routes/build.route";
import componentsRoutes from "./routes/components.route";
import ideationRoutes from "./routes/ideation.route";
import pipelineRoutes from "./routes/pipeline.route";
import shoppingRoutes from "./routes/shopping.route";
import voiceRoutes from "./routes/voice.route";
import compileRoutes from "./routes/compile.route";
// ??$$$ newer code
import libraryRoutes from "./routes/library.route";
// ??$$$ NEW FLOW
import newflowRoutes from "./routes/newflow.route";
import partRoutes from "./routes/part.route";
import playgroundRoutes from "./routes/playground.route";
// ??$$$ newer code
import simulationRoutes from "./routes/simulation.routes";
// ??$$$ newer code
import generateRoutes from "./routes/generate.route";
import questionRoutes from "./routes/questions.route"; // ??$$$ newer code
import { exec as cbExec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
const exec = promisify(cbExec);

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught Exception:", err);
});

const app = express();
const port = Number(process.env.PORT) || 5000;

// ??$$$ newer code: Configure allowedOrigins to explicitly permit our production Vercel apps
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:4173",
    "https://wireup-ai-web.vercel.app",
    "https://wireup-ai-web-tgsm.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean)
);

// ??$$$ newer code: Configure CORS options and handle OPTIONS preflight explicitly
const corsOptions = {
  origin(origin: any, callback: any) {
    if (!origin) return callback(null, true);

    // Check if localhost or 127.0.0.1 with any port
    if (/^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) return callback(null, true);

    if (origin.endsWith(".vercel.app")) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));

/**
 * -----------------------
 * HEALTH CHECK
 * -----------------------
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, port });
});
/**
 * -----------------------
 * ROUTES
 * -----------------------
 */

app.use("/api", projectRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ideation", ideationRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api", componentsRoutes);
app.use("/api", buildRoutes);
app.use("/api", assemblyRoutes);
app.use("/api", shoppingRoutes);
app.use("/api", voiceRoutes);
app.use("/api", compileRoutes);
app.use("/api", libraryRoutes);
app.use("/api", newflowRoutes);
app.use("/api", partRoutes);
// ??$$$ newer code
app.use("/api", simulationRoutes);
app.use("/api/playground", playgroundRoutes);
// ??$$$ newer code
app.use("/api", generateRoutes);
app.use("/api", questionRoutes); // ??$$$ newer code

// ??$$$ Serve locally cached 3D models from E: and backend storage folder
const modelsDir = "E:\\wireup_formulation_exports\\models";
import fs from "fs";
if (!fs.existsSync(modelsDir)) {
  try {
    fs.mkdirSync(modelsDir, { recursive: true });
  } catch (e) { }
}
app.use("/models", express.static(modelsDir));

const storageModelsDir = path.join(__dirname, "..", "storage", "models");
if (!fs.existsSync(storageModelsDir)) {
  try {
    fs.mkdirSync(storageModelsDir, { recursive: true });
  } catch (e) { }
}

// ??$$$ newer code — ensure fallback model assets are populated to resolve 404s
const fallbackFiles = ["generic.glb", "arduino.glb", "led.glb", "resistor.glb", "button.glb", "component_generic.glb", "servo.glb", "sensor.glb", "arduino_uno.glb", "esp32.glb"];
const sourceGlb = path.join(storageModelsDir, "tmp36.glb");
if (fs.existsSync(sourceGlb)) {
  for (const filename of fallbackFiles) {
    const dest = path.join(storageModelsDir, filename);
    if (!fs.existsSync(dest)) {
      try {
        fs.copyFileSync(sourceGlb, dest);
        console.log(`[models] Populated fallback model asset: ${filename}`);
      } catch (err: any) {
        console.error(`[models] Failed to copy fallback model ${filename}:`, err.message);
      }
    }
  }
}

app.use("/models", express.static(storageModelsDir));

// ??$$$ Expose component registry to frontend (used by Simulator3D to get pin defs + component metadata)
import { getRegistry } from "./services/registry.services";
app.get("/api/wokwi/registry", (_req: Request, res: Response) => {
  try {
    const registry = getRegistry();
    res.json(registry);
  } catch (err: any) {
    console.error("[registry] Failed to load registry:", err.message);
    res.status(500).json({ error: "Failed to load component registry" });
  }
});

/**
 * -----------------------
 * GROQ CLIENT HELPERS
 * -----------------------
 */
const getGroqClient = (customKey?: string) => {
  const apiKey = customKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API Key is missing in environment variables.");
  }

  return new Groq({ apiKey });
};


interface ExistingObject {
  id: string;
  name: string;
  type: string;
  dimensions: number[];
  position: number[];
}

interface GenerateRequestBody {
  prompt: string;
  model?: string;
  apiKey?: string;
  existingObjects?: ExistingObject[];
}

/**
 * -----------------------
 * GENERATE ROUTE
 * -----------------------
 */



/**
 * -----------------------
 * 404 HANDLER
 * -----------------------
 */
app.use((req: Request, res: Response) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    error: "Route not found",
    method: req.method,
    url: req.originalUrl,
  });
});

/**
 * -----------------------
 * GLOBAL ERROR HANDLER
 * -----------------------
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ERROR] Global handler:", err);

  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (/^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin) || allowedOrigins.has(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked by Socket.IO"));
    },
    credentials: true
  }
});
(global as any).io = io;

io.on("connection", (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // ??$$$ NEW FLOW - Support room joining for agentic pipeline updates
  socket.on("join", (roomId) => {
    socket.join(roomId);
    console.log(`[socket] Client ${socket.id} joined room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

/**
 * -----------------------
 * START SERVER
 * -----------------------
 */

function resolveArduinoCliPath() {
  if (process.env.ARDUINO_CLI_PATH?.trim()) {
    return process.env.ARDUINO_CLI_PATH.trim();
  }
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const windowsLocal = path.join(home, ".arduino-cli", "bin", "arduino-cli.exe");
  const unixLocal = path.join(home, ".arduino-cli", "bin", "arduino-cli");

  if (existsSync(windowsLocal)) return windowsLocal;
  if (existsSync(unixLocal)) return unixLocal;

  return "arduino-cli";
}


// async function ensureBoardCoresInstalled() {
//   const arduinoCliPath = resolveArduinoCliPath();
//   const cores = [
//     "arduino:avr",      // Arduino Uno, Nano
//     "esp32:esp32",      // ESP32 family
//     "rp2040:rp2040",    // Raspberry Pi Pico
//     "teensy:avr",       // Teensy
//   ];
//   
//   // Quick precheck
//   try {
//     await exec(`"${arduinoCliPath}" version`);
//   } catch (err) {
//     console.warn(`[BoardCoreInstaller] 'arduino-cli' is not installed or not found in system PATH or default home directory. Background core sync skipped.`);
//     return;
//   }
//   
//   for (const core of cores) {
//     try {
//       console.log(`[BoardCoreInstaller] Verifying core: ${core}`);
//       const { stdout } = await exec(`"${arduinoCliPath}" core list`);
//       if (!stdout.includes(core.split(":")[0])) {
//         console.log(`[BoardCoreInstaller] Core not found. Installing core: ${core}`);
//         await exec(`"${arduinoCliPath}" core install ${core}`);
//         console.log(`[BoardCoreInstaller] Successfully installed core: ${core}`);
//       } else {
//         console.log(`[BoardCoreInstaller] Core already installed: ${core}`);
//       }
//     } catch (err) {
//       console.error(`[BoardCoreInstaller] Error verifying/installing core ${core}:`, err);
//     }
//   }
// }

// ??$$$ NEW FLOW
async function ensureBoardCoresInstalled() {
  const arduinoCliPath = resolveArduinoCliPath();
  const cores = [
    "arduino:avr",      // Arduino Uno, Nano
    "esp32:esp32",      // ESP32 family
    "rp2040:rp2040",    // Raspberry Pi Pico
    "teensy:avr",       // Teensy
  ];

  console.log(`[BoardCoreInstaller Debugger] Starting core sync...`);
  console.log(`[BoardCoreInstaller Debugger] Using arduino-cli path: "${arduinoCliPath}"`);

  // Quick precheck
  try {
    const { stdout: verOut } = await exec(`"${arduinoCliPath}" version`);
    console.log(`[BoardCoreInstaller Debugger] arduino-cli check passed: ${verOut.trim()}`);
  } catch (err: any) {
    console.warn(`[BoardCoreInstaller Debugger] 'arduino-cli' not available: ${err.message || err}. Sync skipped.`);
    return;
  }

  const urls = [
    "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json",
    "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json",
    "https://www.pjrc.com/teensy/package_teensy_index.json"
  ].join(",");

  try {
    console.log(`[BoardCoreInstaller Debugger] Syncing package index with additional URLs...`);
    const updateCmd = `"${arduinoCliPath}" core update-index --additional-urls "${urls}"`;
    console.log(`[BoardCoreInstaller Debugger] Running: ${updateCmd}`);
    await exec(updateCmd);
    console.log(`[BoardCoreInstaller Debugger] Index update complete.`);
  } catch (err: any) {
    console.error(`[BoardCoreInstaller Debugger] Warning: failed to update package index:`, err.message || err);
  }

  for (const core of cores) {
    try {
      console.log(`[BoardCoreInstaller Debugger] Checking status of core: ${core}`);
      const { stdout } = await exec(`"${arduinoCliPath}" core list`);
      const coreFamily = core.split(":")[0];

      if (!stdout.includes(coreFamily)) {
        console.log(`[BoardCoreInstaller Debugger] Core ${core} not found. Attempting install...`);

        const installCmd = `"${arduinoCliPath}" core install ${core} --additional-urls "${urls}"`;
        console.log(`[BoardCoreInstaller Debugger] Running: ${installCmd}`);
        const { stdout: installOut, stderr: installErr } = await exec(installCmd);
        if (installOut) console.log(`[BoardCoreInstaller Debugger] Install stdout:\n${installOut}`);
        if (installErr) console.warn(`[BoardCoreInstaller Debugger] Install stderr:\n${installErr}`);
        console.log(`[BoardCoreInstaller Debugger] Core ${core} sync successful!`);
      } else {
        console.log(`[BoardCoreInstaller Debugger] Core ${core} is already installed.`);
      }
    } catch (err: any) {
      console.error(`[BoardCoreInstaller Debugger] Error verifying/installing core ${core}:`, err.message || err);
    }
  }
  console.log(`[BoardCoreInstaller Debugger] Core sync completed.`);
}

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(port, () => {
      console.log(`Server (with Socket.IO) is running on port ${port}`);
    });

    // Run core verification/installer in the background
    ensureBoardCoresInstalled().catch(err => {
      console.error("Board core installer background error:", err);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer(); // ??$$$
