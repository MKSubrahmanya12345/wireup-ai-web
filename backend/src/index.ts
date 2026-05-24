console.log("🔥 INDEX FILE STARTED");

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import Groq from "groq-sdk";

import { connectDB } from "./lib/db";

import projectRoutes from "./routes/project.routes";
import authRoutes from "./routes/auth.route";

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

      if (allowedOrigins.has(origin)) return callback(null, true);

      if (origin.endsWith(".vercel.app")) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));

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
        model = "llama-3.3-70b-versatile",
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

/**
 * -----------------------
 * START SERVER
 * -----------------------
 */
const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();