// ??$$$ newer code - SSE pipeline generation controller
import { Request, Response } from "express";
import { IUser } from "../models/user.model";
// ??$$$ newer code
import { callLLM, MODEL_MAP, DEFAULT_MODEL, DEFAULT_MODEL_ID, streamTokenLB } from "../lib/llm";
import Project from "../models/project.model";

interface AuthRequest extends Request {
  user?: IUser;
}

const STAGES = [
  {
    key:   "requirements",
    label: "Requirements Analysis",
    prompt: (idea: string) =>
      `You are an expert hardware/software architect. The user wants to build: "${idea}".
List 3-5 clear requirements in bullet points: functional goals, constraints, user needs, and success criteria. Be specific. No preamble.`,
    fileKey: null,
  },
  {
    key:   "architecture",
    label: "Architecture Planning",
    prompt: (idea: string) =>
      `You are an expert systems architect. The user wants to build: "${idea}".
Outline the high-level system architecture in 3-5 bullet points: major subsystems, how they connect, key technologies, and data flow. Be technical and specific.`,
    fileKey: null,
  },
  {
    key:   "components",
    label: "Component Selection",
    prompt: (idea: string) =>
      `You are an expert hardware engineer. The user wants to build: "${idea}".
List the key hardware components with specific part numbers in 4-5 bullet points. For each: name, purpose, and why it was chosen. Include microcontrollers, sensors, power, and communication modules.`,
    fileKey: null,
  },
  {
    key:      "circuit",
    label:    "Circuit Generation",
    prompt: (idea: string) =>
      `You are an expert electrical engineer. The user wants to build: "${idea}".
Describe the circuit design in 4-5 bullet points: power supply, signal connections, communication buses (I2C/SPI/UART), pin assignments, and any protection circuits. Reference specific pins and voltages.`,
    fileKey: null,
  },
  {
    key:   "firmware",
    label: "Firmware Generation",
    prompt: (idea: string) =>
      `You are an expert embedded systems engineer. The user wants to build: "${idea}".
Outline the firmware architecture in 3-5 bullet points: programming language, key libraries/frameworks, main control loop, interrupt handlers, and communication protocols. Be specific about implementation.`,
    fileKey: null,
  },
  {
    key:   "validation",
    label: "Simulation Validation",
    prompt: (idea: string) =>
      `You are an expert hardware validation engineer. The user wants to build: "${idea}".
Describe the validation approach in 3-4 bullet points: what to test, how to simulate, expected behavior, and success criteria.`,
    fileKey: null,
  },
  {
    key:   "documentation",
    label: "Documentation Creation",
    prompt: (idea: string) =>
      `You are a technical documentation expert. The user wants to build: "${idea}".
Outline the documentation package in 3-4 bullet points: README sections, BOM format, assembly instructions, and usage guide.`,
    fileKey: null,
  },
  {
    key:   "summary",
    label: "Summary",
    prompt: (idea: string) =>
      `The user wants to build: "${idea}".
Write a 2-3 sentence project summary. State: what it does, the main components, and one key implementation note. Be direct. No markdown. No bullet points. Maximum 60 words.`,
    fileKey: null,
  },
] as const;

const FILE_PROMPTS = [
  {
    filename: "firmware.ino",
    language: "Arduino",
    folder:   "src",
    stageKey: "firmware",
    prompt: (idea: string, context: string) =>
      `Write complete, working Arduino sketch code for: "${idea}".
Context from analysis:
${context}

Requirements:
- Include all necessary #include statements for required libraries
- Add setup() and loop() functions
- Add comments explaining each section
- Use DHT22 for temperature/humidity if applicable, OLED/LCD for display
- Include proper pin definitions as constants at the top
- Handle sensor read errors gracefully
- Return ONLY the .ino code, no explanation text.`,
  },
  {
    filename: "components.md",
    language: "Markdown",
    folder:   "specs",
    stageKey: "components",
    prompt: (idea: string, context: string) =>
      `Write a components list in plain English for the project: "${idea}".
Context:
${context}

Format it like this — NO JSON, NO code blocks, just readable text:

# Components List

## Microcontroller
**Arduino Uno** — The main brain of the project. Controls all sensors and the display.
- Quantity: 1
- Key pins used: D2 (sensor data), SDA/SCL (I2C display), GND, 5V

## Sensors
**DHT22** — Temperature and humidity sensor. Reads environmental data every 2 seconds.
- Quantity: 1
- Key pins used: DATA (D2), VCC (5V), GND

(Continue for all components in the same style)

## Passive Components
List resistors, capacitors etc.

## Power
Describe power supply requirements.

Keep it beginner-friendly. No jargon. Explain why each component is needed.`,
  },
  {
    filename: "pins.csv",
    language: "CSV",
    folder:   "specs",
    stageKey: "circuit",
    prompt: (idea: string, context: string) =>
      `Create a pin connection table CSV for: "${idea}".
Context:
${context}

Return a CSV with columns: From,FromPin,To,ToPin,SignalType,Notes
Include ALL connections: power, ground, data, communication.
Example row: Arduino Uno,D2,DHT22,DATA,Digital,10kΩ pull-up resistor to 5V
Return ONLY the CSV data including the header row, no markdown.`,
  },
  {
    filename: "diagram.json",
    language: "JSON",
    folder:   "wiring",
    stageKey: "circuit",
    prompt: (idea: string, context: string) =>
      `Create a wiring diagram JSON for: "${idea}".
Context:
${context}

Return a valid JSON with this structure:
{
  "project": "project name",
  "components": [{"id":"mcu","name":"Arduino Uno","type":"MCU"},...],
  "connections": [{"from":"mcu.D2","to":"dht22.DATA","signal":"DATA","note":"10kΩ pull-up"}],
  "powerRails": [{"label":"5V","components":["mcu.5V","dht22.VCC"]},{"label":"GND","components":["mcu.GND","dht22.GND"]}]
}
Return ONLY the JSON, no markdown.`,
  },
  {
    filename: "assembly.md",
    language: "Markdown",
    folder:   "docs",
    stageKey: "documentation",
    prompt: (idea: string, context: string) =>
      `Write assembly instructions in Markdown for: "${idea}".
Context:
${context}

Include:
# Assembly Guide
## Required Components (bulleted list)
## Tools Required
## Step-by-Step Assembly
(numbered steps with specific pin connections)
## Testing
## Troubleshooting

Be specific, practical, beginner-friendly. Use real pin numbers.`,
  },
  {
    filename: "README.md",
    language: "Markdown",
    folder:   "docs",
    stageKey: "summary",
    prompt: (idea: string, context: string) =>
      `Write a complete README.md for the hardware project: "${idea}".
Context:
${context}

Include:
# Project Name
## Overview (2-3 sentences)
## Hardware Requirements
## Software Requirements
## Quick Start
## Wiring
## Usage
## License: MIT

Keep it concise and practical.`,
  },
];

function sender(res: Response) {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if ((res as any).flush) (res as any).flush();
  };
}

async function saveFileToProject(
  projectId: string,
  userId:    string,
  filename:  string,
  language:  string,
  content:   string,
): Promise<void> {
  try {
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) return;

    const existing = (project.files || []).findIndex(f => f.name === filename);
    if (existing >= 0) {
      if (project.files) {
        project.files[existing] = { name: filename, language, content };
      }
    } else {
      if (!project.files) {
        project.files = [];
      }
      project.files.push({ name: filename, language, content });
    }
    project.markModified("files");
    await project.save();
  } catch (err) {
    console.error(`[generate] Failed to save file ${filename}:`, err);
  }
}

export const generatePipeline = async (req: AuthRequest, res: Response) => {
  // ??$$$ newer code
  const { idea, projectId, model: modelKey = DEFAULT_MODEL } =
    req.body as { idea?: string; projectId?: string; model?: string };
  const targetProjectId = (projectId === "undefined" || !projectId) ? undefined : projectId;

  if (!idea?.trim()) {
    return res.status(400).json({ error: "idea is required" });
  }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send    = sender(res);
  const context: Record<string, string> = {};

  try {
    let projectName = idea.trim();
    try {
      const nameResult = await callLLM(
        [{ role: "user", content:
          `The user wants to build: "${idea.trim()}".
Generate a short, clean project name (3-5 words max). Examples: "Arduino Weather Station", "ESP32 Smart Plant Monitor", "IoT Temperature Logger".
Reply with ONLY the project name, nothing else.`
        }],
        modelKey,
        20,
      );
      projectName = nameResult.trim().replace(/^["']|["']$/g, "");

      // ??$$$ newer code
      if (targetProjectId && req.user?._id) {
        await Project.findOneAndUpdate(
          { _id: targetProjectId, owner: req.user._id },
          { description: projectName }
        );
      }

      send("project_name", { name: projectName });
    } catch {
      // Non-fatal
    }

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];

      send("stage_start", {
        index: i, key: stage.key, label: stage.label, total: STAGES.length,
      });

      const maxTok = stage.key === "summary" ? 120 : 600;
      const content_text = await callLLM(
        [{ role: "user", content: stage.prompt(idea.trim()) }],
        modelKey, maxTok,
      );

      context[stage.key] = content_text;

      const words = content_text.split(" ");
      let accumulated = "";
      for (const word of words) {
        accumulated += (accumulated ? " " : "") + word;
        send("stage_chunk", { index: i, key: stage.key, text: accumulated });
        await new Promise(r => setTimeout(r, 14));
      }

      send("stage_done", {
        index: i, key: stage.key, text: content_text,
        progress: Math.round(((i + 1) / STAGES.length) * 100),
      });

      const filesToGenerate = FILE_PROMPTS.filter(fp => fp.stageKey === stage.key);

      for (const fp of filesToGenerate) {
        send("file_start", { filename: fp.filename, folder: fp.folder, language: fp.language });

        try {
          const contextStr = Object.entries(context)
            .map(([k, v]) => `[${k}]\n${v}`)
            .join("\n\n");

          const fileContent = await callLLM(
            [{ role: "user", content: fp.prompt(idea.trim(), contextStr) }],
            modelKey,
            fp.filename.endsWith(".ino") ? 1200 : 800,
          );

          // ??$$$ newer code
          if (targetProjectId && req.user?._id) {
            await saveFileToProject(
              targetProjectId,
              req.user._id.toString(),
              fp.filename,
              fp.language,
              fileContent,
            );
          }

          send("file_created", {
            filename: fp.filename,
            folder:   fp.folder,
            language: fp.language,
            content:  fileContent,
          });
        } catch (fileErr: any) {
          console.error(`[generate] File ${fp.filename} failed:`, fileErr?.message);
        }
      }

      await new Promise(r => setTimeout(r, 280));
    }

    // ??$$$ newer code
    send("pipeline_done", { projectId: targetProjectId ?? null });
  } catch (err: any) {
    send("pipeline_error", { error: err?.message ?? "Generation failed" });
  } finally {
    res.end();
  }
};

// ??$$$ newer code - Project assistant streaming chat endpoint
export const chatEndpoint = async (req: AuthRequest, res: Response) => {
  const { messages, model = DEFAULT_MODEL, projectContext = "" } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = sender(res);

  // Prepend projectContext as a system message if provided
  const chatMessages = [...messages];
  if (projectContext) {
    chatMessages.unshift({
      role: "system",
      content: `You are a helpful electronics and firmware assistant. The current project context is:\n${projectContext}`
    });
  }

  const modelId = MODEL_MAP[model] ?? DEFAULT_MODEL_ID;

  try {
    await streamTokenLB(
      chatMessages,
      modelId,
      (token, full) => {
        send("token", { token, full });
      },
      (full) => {
        send("done", { content: full });
        res.end();
      },
      (err) => {
        send("error", { error: err });
        res.end();
      }
    );
  } catch (err: any) {
    send("error", { error: err.message || "Streaming failed" });
    res.end();
  }
};
