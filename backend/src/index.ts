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
// ??$$$ newer code
import libraryRoutes from "./routes/library.route";
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

/**
 * -----------------------
 * CORS CONFIG
 * -----------------------
 */
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    process.env.FRONTEND_URL,
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
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
  })
);


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
app.use("/api", libraryRoutes);

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

/**
 * -----------------------
 * FORGE3D PROMPT
 * -----------------------
 */
const FORGE3D_SYSTEM_PROMPT = `
You are a professional 3D CAD designer and model generator.
Output ONLY valid JSON. No markdown, no explanation.

Schema:
{
  "name": "string",
  "objects": [
    {
      "id": "string",
      "type": "box|sphere|cylinder|cone|torus",
      "dimensions": [],
      "position": [x,y,z],
      "rotation": [x,y,z],
      "color": "#HEX",
      "material": "standard|metal|glass|glowing|toon",
      "isElectronic": boolean,
      "physics": {
        "isStatic": boolean,
        "mass": number,
        "restitution": number,
        "velocity": [vx,vy,vz]
      }
    }
  ]
}
`;

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
app.post(
  "/api/generate",
  async (req: Request<{}, {}, GenerateRequestBody>, res: Response) => {
    try {
      const {
        prompt,
        model = "qwen/qwen3-32b",
        apiKey,
        existingObjects = [],
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      let groq;

      try {
        groq = getGroqClient(apiKey);
      } catch (err: any) {
        return res.status(401).json({ error: err.message });
      }

      let userMessage = `Generate 3D layout for: "${prompt}".\n`;

      if (existingObjects.length > 0) {
        userMessage +=
          "Arrange components without overlap:\n";

        existingObjects.forEach((obj) => {
          userMessage += `- ${obj.name} (${obj.id}) size=${obj.dimensions.join(
            ","
          )} pos=${obj.position.join(",")}\n`;
        });
      } else {
        userMessage += "Create full standalone assembly.";
      }

      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: FORGE3D_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        return res.status(500).json({ error: "Empty response from Groq" });
      }

      const parsed = JSON.parse(content);
      return res.json(parsed);
    } catch (err: any) {
      console.error("Generate error:", err);
      return res.status(500).json({
        error: err.message || "Internal server error",
      });
    }
  }
);

/**
 * -----------------------
 * GENERATE HEALTH
 * -----------------------
 */
app.get("/api/generate/health", (_req, res) => {
  res.json({
    status: "OK",
    hasEnvKey: !!process.env.GROQ_API_KEY,
  });
});

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

// ??$$$
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    credentials: true
  }
});
(global as any).io = io;

io.on("connection", (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

/**
 * -----------------------
 * START SERVER
 * -----------------------
 */
// ??$$$ newer code
// ??$$$ newer code - resolve arduino-cli path based on environments
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

async function ensureBoardCoresInstalled() {
  const arduinoCliPath = resolveArduinoCliPath();
  const cores = [
    "arduino:avr",      // Arduino Uno, Nano
    "esp32:esp32",      // ESP32 family
    "rp2040:rp2040",    // Raspberry Pi Pico
    "teensy:avr",       // Teensy
  ];
  
  // Quick precheck
  try {
    await exec(`"${arduinoCliPath}" version`);
  } catch (err) {
    console.warn(`[BoardCoreInstaller] 'arduino-cli' is not installed or not found in system PATH or default home directory. Background core sync skipped.`);
    return;
  }
  
  for (const core of cores) {
    try {
      console.log(`[BoardCoreInstaller] Verifying core: ${core}`);
      const { stdout } = await exec(`"${arduinoCliPath}" core list`);
      if (!stdout.includes(core.split(":")[0])) {
        console.log(`[BoardCoreInstaller] Core not found. Installing core: ${core}`);
        await exec(`"${arduinoCliPath}" core install ${core}`);
        console.log(`[BoardCoreInstaller] Successfully installed core: ${core}`);
      } else {
        console.log(`[BoardCoreInstaller] Core already installed: ${core}`);
      }
    } catch (err) {
      console.error(`[BoardCoreInstaller] Error verifying/installing core ${core}:`, err);
    }
  }
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

startServer();