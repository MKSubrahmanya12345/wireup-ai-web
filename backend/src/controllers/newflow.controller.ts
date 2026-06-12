// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import { Request, Response } from "express";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
// ??$$$ newer code
import fs from "fs";
import path from "path";
import Groq from "groq-sdk"; // ??$$$
import { getOllamaModel } from "../agents/shared/adapters/ollama"; // ??$$$ newer code
import rotationService from "../services/keyRotation.service";
// ??$$$ newer code
import NewFlowSession from "../models/newFlowSession.model";
import Project from "../models/project.model";
import { runAgent2 } from "../services/newflow.agent";
import { resolvePartByDesiredPart } from "../services/registry.services"; // ??$$$ newer code

const safeId = (value: any, fallback: string) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return normalized || fallback;
};

const pickPinPosition = (index: number) => {
  const col = index % 6;
  const row = Math.floor(index / 6);
  return {
    x: -0.75 + col * 0.32,
    y: 0.02,
    z: -0.45 + row * 0.24
  };
};


// ??$$ newer code
const ARDUINO_UNO_PINS = [
  { id: "RESET", x: -0.6, y: 0.1, z: 1.05, type: "system" },
  { id: "3.3V", x: -0.4, y: 0.1, z: 1.05, type: "power" },
  { id: "5V", x: -0.2, y: 0.1, z: 1.05, type: "power" },
  { id: "GND", x: 0.0, y: 0.1, z: 1.05, type: "gnd" },
  { id: "GND.2", x: 0.2, y: 0.1, z: 1.05, type: "gnd" },
  { id: "VIN", x: 0.4, y: 0.1, z: 1.05, type: "power" },
  { id: "A0", x: 0.6, y: 0.1, z: 1.05, type: "analog" },
  { id: "A1", x: 0.75, y: 0.1, z: 1.05, type: "analog" },
  { id: "A2", x: 0.9, y: 0.1, z: 1.05, type: "analog" },
  { id: "A3", x: 1.05, y: 0.1, z: 1.05, type: "analog" },
  { id: "A4", x: 1.2, y: 0.1, z: 1.05, type: "analog" },
  { id: "A5", x: 1.35, y: 0.1, z: 1.05, type: "analog" },
  { id: "RX", x: 1.4, y: 0.1, z: -1.05, type: "serial" },
  { id: "TX", x: 1.25, y: 0.1, z: -1.05, type: "serial" },
  { id: "D2", x: 1.1, y: 0.1, z: -1.05, type: "digital" },
  { id: "D3", x: 0.95, y: 0.1, z: -1.05, type: "digital" },
  { id: "D4", x: 0.8, y: 0.1, z: -1.05, type: "digital" },
  { id: "D5", x: 0.65, y: 0.1, z: -1.05, type: "digital" },
  { id: "D6", x: 0.5, y: 0.1, z: -1.05, type: "digital" },
  { id: "D7", x: 0.35, y: 0.1, z: -1.05, type: "digital" },
  { id: "D8", x: 0.2, y: 0.1, z: -1.05, type: "digital" },
  { id: "D9", x: 0.05, y: 0.1, z: -1.05, type: "digital" },
  { id: "D10", x: -0.1, y: 0.1, z: -1.05, type: "digital" },
  { id: "D11", x: -0.25, y: 0.1, z: -1.05, type: "digital" },
  { id: "D12", x: -0.4, y: 0.1, z: -1.05, type: "digital" },
  { id: "D13", x: -0.55, y: 0.1, z: -1.05, type: "digital" },
  { id: "SDA", x: -0.7, y: 0.1, z: -1.05, type: "i2c" },
  { id: "SCL", x: -0.85, y: 0.1, z: -1.05, type: "i2c" }
];

const getFallbackPinsForComponent = (displayName: string, wokwiPartType?: string) => {
  const name = displayName.toLowerCase();
  if (name.includes("soil") || name.includes("moisture")) {
    return [
      { id: "VCC", x: -0.3, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: -0.1, y: 0.02, z: -0.2, type: "power" },
      { id: "SIG", x: 0.1, y: 0.02, z: -0.2, type: "signal" },
      { id: "D0", x: 0.3, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("dht") || name.includes("temp") || name.includes("humidity")) {
    return [
      { id: "VCC", x: -0.2, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: 0.0, y: 0.02, z: -0.2, type: "power" },
      { id: "SDA", x: 0.2, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("mpu") || name.includes("gyro") || name.includes("accelerometer")) {
    return [
      { id: "VCC", x: -0.3, y: 0.02, z: -0.2, type: "power" },
      { id: "GND", x: -0.15, y: 0.02, z: -0.2, type: "power" },
      { id: "SDA", x: 0.0, y: 0.02, z: -0.2, type: "i2c" },
      { id: "SCL", x: 0.15, y: 0.02, z: -0.2, type: "i2c" },
      { id: "INT", x: 0.3, y: 0.02, z: -0.2, type: "signal" }
    ];
  }
  if (name.includes("led")) {
    return [
      { id: "A", x: -0.1, y: 0.02, z: 0.0, type: "signal" },
      { id: "C", x: 0.1, y: 0.02, z: 0.0, type: "signal" }
    ];
  }
  if (name.includes("button") || name.includes("switch")) {
    return [
      { id: "1.l", x: -0.2, y: 0.02, z: -0.2, type: "signal" },
      { id: "2.l", x: 0.2, y: 0.02, z: -0.2, type: "signal" },
      { id: "1.r", x: -0.2, y: 0.02, z: 0.2, type: "signal" },
      { id: "2.r", x: 0.2, y: 0.02, z: 0.2, type: "signal" }
    ];
  }
  return [
    { id: "VCC", x: -0.2, y: 0.02, z: -0.2, type: "power" },
    { id: "GND", x: 0.0, y: 0.02, z: -0.2, type: "power" },
    { id: "SIG", x: 0.2, y: 0.02, z: -0.2, type: "signal" }
  ];
};

const normalizeMcuPin = (pinStr: string): string => {
  const parts = String(pinStr || "").split(".");
  if (parts.length < 2) return pinStr;
  const partKey = parts[0];
  const pinId = parts[1];

  if (partKey.toLowerCase() === "mcu" || partKey.toLowerCase() === "arduino") {
    let pin = pinId.toUpperCase().trim();
    if (pin === "GPIO21" || pin === "SDA" || pin === "I2C_SDA") return "mcu.SDA";
    if (pin === "GPIO22" || pin === "SCL" || pin === "I2C_SCL") return "mcu.SCL";
    if (pin === "GPIO13" || pin === "13") return "mcu.D13";
    if (pin === "GPIO12" || pin === "12") return "mcu.D12";
    if (pin === "GPIO11" || pin === "11") return "mcu.D11";
    if (pin === "GPIO10" || pin === "10") return "mcu.D10";
    if (pin === "GPIO9" || pin === "9") return "mcu.D9";
    if (pin === "GPIO8" || pin === "8") return "mcu.D8";
    if (pin === "GPIO7" || pin === "7") return "mcu.D7";
    if (pin === "GPIO6" || pin === "6") return "mcu.D6";
    if (pin === "GPIO5" || pin === "5") return "mcu.D5";
    if (pin === "GPIO4" || pin === "4") return "mcu.D4";
    if (pin === "GPIO3" || pin === "3") return "mcu.D3";
    if (pin === "GPIO2" || pin === "2") return "mcu.D2";
    if (pin === "GPIO1" || pin === "1" || pin === "TX") return "mcu.TX";
    if (pin === "GPIO0" || pin === "0" || pin === "RX") return "mcu.RX";
    if (pin === "3V3" || pin === "3.3V") return "mcu.3.3V";
    if (pin === "5V" || pin === "VCC") return "mcu.5V";
    if (pin === "GND") return "mcu.GND";
    return `mcu.${pin}`;
  }
  return pinStr;
};

// ??$$$ newer code - resolve full details from MongoDB for legacy representation
const populateBomDetails = async (bomItems: any[]): Promise<any[]> => {
  if (!Array.isArray(bomItems)) return [];
  return await Promise.all(bomItems.map(async (item: any) => {
    const resolved = await resolvePartByDesiredPart(item.partId || item.mpn || item.key);
    return {
      ...item,
      mpn: resolved.mpn || item.mpn || "",
      displayName: resolved.name || item.displayName || "",
      purpose: item.purpose || resolved.description || "Auxiliary component",
      pins: resolved.pins || [],
      wokwiPartType: resolved.wokwiPartType || "",
      glbUrl: resolved.glbUrl || item.glbUrl || "",
      type: resolved.category || item.type || "module"
    };
  }));
};

// const mapSessionToVirtualProject = (session: any) => { // ??$$$ old code
//   const bom = Array.isArray(session?.bom) ? session.bom : []; // ??$$$ old code
const mapSessionToVirtualProject = async (session: any) => { // ??$$$ newer code
  const rawBom = Array.isArray(session?.bom) ? session.bom : []; // ??$$$ newer code
  const bom = await populateBomDetails(rawBom); // ??$$$ newer code
  const wiring = Array.isArray(session?.wiring) ? session.wiring : [];
  const milestones = Array.isArray(session?.milestones) ? session.milestones : [];
  const context = session?.context || {};

  const circleRadius = 2.4;
  const componentCount = Math.max(bom.length, 1);

  const mappedBom = bom.map((item: any, index: number) => {
    const angle = (index / componentCount) * Math.PI * 2;
    const displayName = String(item?.displayName || item?.mpn || `Component ${index + 1}`);
    const purpose = String(item?.purpose || "");
    const typeHint = `${displayName} ${purpose}`.toLowerCase();

    // ??$$$ newer code - strictly data-driven component classification with safety net
    let componentType = item?.type || "module";

    // Temporary safety net: map wokwiPartType to correct category if item.type is not set yet
    if (componentType === "module" || !item?.type) {
      const wokwiType = String(item?.wokwiPartType || "").toLowerCase();
      if (wokwiType === "wokwi-servo") {
        componentType = "motor";
      } else if (wokwiType.includes("led") || wokwiType.includes("neopixel") || /\bled\b|neopixel|ws2812/.test(typeHint)) {
        componentType = "led";
      } else if (wokwiType.includes("button") || wokwiType.includes("pushbutton") || /button|switch|push/.test(typeHint)) {
        componentType = "button";
      } else if (wokwiType.includes("lcd") || wokwiType.includes("ssd1306") || wokwiType.includes("ili9341")) {
        componentType = "display";
      } else if (wokwiType.includes("dht") || wokwiType.includes("hc-sr04") || wokwiType.includes("photoresistor") || wokwiType.includes("potentiometer") || wokwiType.includes("mpu6050")) {
        componentType = "sensor";
      } else if (item?.key === "mcu" || wokwiType.includes("arduino") || wokwiType.includes("esp32") || wokwiType.includes("pi-pico") || wokwiType.includes("nodemcu") || /arduino|esp32|pico|teensy|controller|microcontroller/.test(typeHint)) {
        componentType = "microcontroller";
      }
    }

    // ??$$ newer code
    const pins = Array.isArray(item?.pins) && item.pins.length > 0
      ? item.pins.map((pin: any, pinIndex: number) => {
        const fallback = pickPinPosition(pinIndex);
        return {
          id: String(pin?.id || pin?.name || `P${pinIndex + 1}`),
          x: Number.isFinite(pin?.x_mm) ? Number(pin.x_mm) / 10 : fallback.x,
          y: Number.isFinite(pin?.z_mm) ? Number(pin.z_mm) / 10 : fallback.y,
          z: Number.isFinite(pin?.y_mm) ? Number(pin.y_mm) / 10 : fallback.z,
          type: String(pin?.type || "signal")
        };
      })
      : (componentType === "microcontroller"
        ? ARDUINO_UNO_PINS
        : getFallbackPinsForComponent(displayName, item?.wokwiPartType));

    const key = safeId(item?.key || item?.displayName, `component-${index + 1}`);

    return {
      key,
      displayName,
      type: componentType,
      glbUrl: item?.glbUrl || "",
      position: [
        Number((Math.cos(angle) * circleRadius).toFixed(2)),
        0.08,
        Number((Math.sin(angle) * circleRadius).toFixed(2))
      ],
      rotation: [0, Number((angle * -1).toFixed(2)), 0],
      pins
    };
  });

  // ??$$ newer code
  const mappedWiring = wiring
    .map((wire: any) => {
      const from = normalizeMcuPin(String(wire?.from || ""));
      const to = normalizeMcuPin(String(wire?.to || ""));
      return {
        from,
        to,
        color: String(wire?.color || "#1d4ed8")
      };
    })
    .filter((wire: any) => wire.from && wire.to);

  // ??$$$
  const byOrder = [...milestones].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0));
  const latestCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
  const sketch = session.finalSketch
    || latestCodeMilestone?.code
    || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";

  const additionalTools = Array.from(new Set([
    "Soldering iron",
    "Solder wire",
    "Wire stripper",
    "Wire cutter",
    "Multimeter",
    ...byOrder.flatMap((m: any) => Array.isArray(m?.requiredLibraries) ? m.requiredLibraries : [])
      .filter((lib: any) => lib?.type === "manual")
      .map((lib: any) => `${lib.name}${lib.installCommand ? ` (${lib.installCommand})` : ""}`)
  ]));

  return {
    id: String(session?._id || "virtual-project"),
    name: context?.corePurpose || session?.idea || "Wireup Project",
    description: session?.idea || context?.corePurpose || "AI formulated electronics build",
    author: "Wireup AI",
    createdAt: new Date(session?.createdAt || Date.now()).toISOString().slice(0, 10),
    bom: mappedBom,
    wiring: mappedWiring,
    editableJson: {
      simulationSpeed: 1,
      ledInitialState: false,
      buttonInitialState: false
    },
    sketch,
    // ??$$$ newer code
    context: {
      mcu: context?.mcu || "",
      powerSource: context?.powerSource || "",
      connectivity: Array.isArray(context?.connectivity) ? context.connectivity.join(", ") : (context?.connectivity || ""),
      constraints: Array.isArray(context?.constraints) ? context.constraints : []
    },
    phases: Array.isArray(context?.subsystems)
      ? context.subsystems
      : [
        ...(context?.subsystems?.inputs || []),
        ...(context?.subsystems?.outputs || []),
        ...(context?.subsystems?.communication || []),
        ...(context?.subsystems?.storage || []),
        ...(context?.subsystems?.power || [])
      ],
    milestones: byOrder.map((m: any) => ({
      id: m?.id,
      order: m?.order,
      title: m?.title,
      objective: m?.objective,
      expectedOutput: m?.expectedOutput,
      passCondition: m?.passCondition
    })),
    additionalTools
  };
};

export const AGENT1_SYSTEM_PROMPT = `You are a product discovery agent. Your goal is to guide the user to extract their initial project requirements and compile them into a detailed plain-text Markdown Project Requirements Document (PRD).

// ??$$$ newer code - ask up to 3 questions at once, optimize Q&A speed
Ask the user at most 3 questions at once (typically 1, 2, or 3, grouped logically) to discover their project ideas, requirements, constraints, environment, and user interactions. Do not ask more than 3 questions at once. Format them as a numbered list.
Only ask questions a non-engineer/end-user can answer.
Never ask technical questions about microcontrollers, protocols, interfaces, pin numbers, or specific ICs — those will be handled by the backend formulation agent. Focus exclusively on the behavioral features, purpose, target audience, budget, power environment (battery vs wall plug), and physical form.

After each answer, assess if you have enough information to write the requirements document. If not, generate the next question (or set of up to 3 questions) and provide 3 suggested options (Option A, Option B, Option C) that represent cohesive packages answering the questions collectively (e.g. Option A: 'Indoors, USB powered, Sound alerts', Option B: 'Outdoors, Battery powered, LED blink alerts'), plus letting the user type their own custom answer.

OPTIMIZATIONS FOR SPEED:
1. Fast-Pathing: If the user's initial idea is detailed enough or the Q&A history gives you enough context to establish the behavior and features, set "done" to true immediately. Do not ask redundant questions. Finish the Q&A in 1-2 turns if the user's intent is clear.
2. Lazy PRD Compilation: Do NOT generate the full Markdown Project Requirements Document in 'requirementsDoc' during intermediate turns (set it to an empty string or a very brief draft under 50 words). Only generate the comprehensive, detailed Markdown PRD in 'requirementsDoc' when 'done' is true. This saves significant generation time.
3. Proactive Defaults: Assume standard defaults for non-critical features (e.g., USB powered, indoor usage, standard temperature/humidity range) rather than asking for confirmation on every detail.

Reply ONLY with this JSON structure, no markdown wrap, no backticks:
{
  "question": "next question(s) to ask or empty string if done",
  "options": ["Option A", "Option B", "Option C"],
  "done": false,
  "requirementsDoc": "full markdown PRD text here when done is true, otherwise empty"
}`;

// ??$$$ newer code - Helper to call LLM for Discovery Agent with robust failover
// ??$$$ newer code - QnA / Discovery Session default model uses Groq Llama 4 Scout with Ollama fallback
/* old code
async function executeDiscoveryCall(modelName: string, promptText: string): Promise<any> {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean) as string[];

  let lastError: any = null;
  const actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";

  if (keys.length > 0) {
    for (const apiKey of keys) {
      try {
        console.log(`[Discovery QnA] Calling Groq with key starting: ${apiKey.substring(0, 8)}...`);
        const client = new Groq({ apiKey });
        const completion = await client.chat.completions.create({
          model: actualModel,
          messages: [
            { role: "system", content: AGENT1_SYSTEM_PROMPT },
            { role: "user", content: promptText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        });

        const text = completion.choices[0]?.message?.content?.trim() || "";
        const clean = text.replace(/```json|```/g, "").trim();
        return JSON.parse(clean);
      } catch (err) {
        console.error(`[Discovery QnA Groq Attempt failed with key starting ${apiKey.substring(0, 8)}]:`, err);
        lastError = err;
      }
    }
  }

  // ??$$$ newer code - Fallback to local Ollama if Groq fails or no keys exist
  try {
    const localModel = (await getOllamaModel()) || "qwen2.5:3b";
    console.log(`[Discovery QnA Fallback] Calling Ollama local model: ${localModel}...`);
    const response = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: localModel,
        messages: [
          { role: "system", content: AGENT1_SYSTEM_PROMPT },
          { role: "user", content: promptText }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });
    if (response.ok) {
      const json = await response.json() as any;
      const text = json?.choices?.[0]?.message?.content?.trim() || "";
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } else {
      const txt = await response.text();
      throw new Error(`Ollama fallback returned status ${response.status}: ${txt}`);
    }
  } catch (ollamaErr: any) {
    console.error(`[Discovery QnA Ollama Fallback failed]:`, ollamaErr);
    throw new Error(`Groq QnA call failed (${lastError?.message || 'No Groq keys'}) and Ollama fallback failed: ${ollamaErr.message || ollamaErr}`);
  }
}
*/
// ??$$$ newer code
async function executeDiscoveryCall(modelName: string, promptText: string): Promise<any> {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean) as string[];

  let lastError: any = null;
  const actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";

  if (keys.length > 0) {
    for (const apiKey of keys) {
      try {
        console.log(`[Discovery QnA] Calling Groq with key starting: ${apiKey.substring(0, 8)}...`);
        const client = new Groq({ apiKey });
        const completion = await client.chat.completions.create({
          model: actualModel,
          messages: [
            { role: "system", content: AGENT1_SYSTEM_PROMPT },
            { role: "user", content: promptText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        });

        const text = completion.choices[0]?.message?.content?.trim() || "";
        const clean = text.replace(/```json|```/g, "").trim();
        return JSON.parse(clean);
      } catch (err) {
        console.error(`[Discovery QnA Groq Attempt failed with key starting ${apiKey.substring(0, 8)}]:`, err);
        lastError = err;
      }
    }
  }

  throw lastError || new Error("Discovery QnA failed: Groq keys missing or exhausted.");
}

// ??$$$ newer code - Helper to call LLM for Discovery Agent directly
async function callDiscovery(modelName: string, promptText: string): Promise<any> {
  return await executeDiscoveryCall(modelName, promptText);
}

// ??$$$ newer code - Helper to ensure session & project ownership is synchronized with logged-in user
async function ensureSessionOwnership(session: any, req: any) {
  const userId = req.user?._id;
  if (userId && session && session.owner?.toString() !== userId.toString()) {
    console.log(`[Ownership] Transferring session ${session._id} ownership from ${session.owner} to user ${userId}`);
    session.owner = userId;
    await session.save();

    if (session.projectId) {
      try {
        const project = await Project.findById(session.projectId);
        if (project) {
          console.log(`[Ownership] Transferring project ${project._id} ownership from ${project.owner} to user ${userId}`);
          project.owner = userId;
          await project.save();
        }
      } catch (err) {
        console.error("[Ownership] Failed to update project owner:", err);
      }
    }
  }
}

// 1. POST /api/new-flow/start
export const startSession = async (req: Request, res: Response) => {
  try {
    const { idea, model = "qwen/qwen3-32b" } = req.body;
    if (!idea) {
      return res.status(400).json({ error: "Original project idea is required." });
    }

    const userId = (req as any).user?._id;

    // ??$$$ newer code
    const project = new Project({
      owner: userId,
      description: idea,
      meta: {
        stage: "ideation",
        isAgentic: true
      },
      stageStatus: {
        // ??$$$ newer code
        ideation: "ready",
        components: "locked",
        build: "locked",
        simulation: "locked",
        assembly: "locked",
        shopping: "locked"
      },
      ideation: {
        messages: [],
        brief: idea,
        objective: idea,
        compute: "",
        phases: {},
        constraints: "",
        open: "",
        readyForComponents: false,
        validatorApproved: false,
        validationAttempts: 0
      }
    });

    await project.save();

    const session = new NewFlowSession({
      owner: userId,
      selectedModel: model,
      idea,
      qaHistory: [],
      phase1Complete: false,
      phase2Complete: false,
      projectId: project._id
    });

    await session.save();

    // Call Discovery Agent for first question
    const promptText = `Original Project Idea: ${idea}\nNo previous Q&A history. Get the first question.`;
    const response = await callDiscovery(model, promptText);

    // Save initial requirements doc and first question/options to state
    session.requirementsDoc = response.requirementsDoc || "";
    session.phase1Complete = !!response.done;
    if (session.phase1Complete) {
      // ??$$$ newer code
      session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    }

    session.pipelineStages = {
      ideation: {
        status: response.done ? "done" : "running",
        inputs: { idea, model },
        process: ["Requirement extraction", "Subsystem identification"],
        outputs: { requirementsDoc: response.requirementsDoc, nextQuestion: response.question },
        consumers: ["Formulation Agent", "BOM Generator"]
      }
    };

    await session.save();

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: !!response.done,
      requirementsDoc: session.requirementsDoc,
      qaHistory: session.qaHistory || [],
      context: session.context || {}
    });
  } catch (err: any) {
    console.error("startSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to start session." });
  }
};

// 2. POST /api/new-flow/answer
export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const { sessionId, answer, currentQuestion, currentOptions = [] } = req.body;
    if (!sessionId || answer === undefined) {
      return res.status(400).json({ error: "SessionId and answer are required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    // Save previous Q&A to history
    session.qaHistory.push({
      question: currentQuestion || "Clarification",
      options: currentOptions,
      answer,
      timestamp: new Date()
    });

    await session.save();

    /* old code
    // Reconstruct entire prompt context with Q&A history
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nGenerate the next question based on history, or finalize and output the full Markdown requirementsDoc if done.`;
    */
    // ??$$$ newer code
    const prunedHistory = session.qaHistory.slice(-3);
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History (Pruned to last 3 turns):\n`;
    prunedHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nGenerate the next question based on history, or finalize and output the full Markdown requirementsDoc if done.`;

    const response = await callDiscovery(session.selectedModel, promptText);

    // Update session state
    session.requirementsDoc = response.requirementsDoc || session.requirementsDoc || "";
    session.phase1Complete = !!response.done;
    if (session.phase1Complete) {
      // ??$$$ newer code
      session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    }

    session.pipelineStages = {
      ...session.pipelineStages,
      ideation: {
        status: response.done ? "done" : "running",
        inputs: { idea: session.idea, qaHistory: session.qaHistory },
        process: ["Requirement extraction", "Subsystem identification"],
        outputs: { requirementsDoc: session.requirementsDoc, nextQuestion: response.question },
        consumers: ["Formulation Agent", "BOM Generator"]
      }
    };
    session.markModified("pipelineStages");

    await session.save();

    // ??$$$ newer code — Sync Q&A and PRD to Project document in real-time
    if (session.projectId) {
      try {
        const project = await Project.findById(session.projectId);
        if (project) {
          project.ideation.messages = session.qaHistory.map(q => ([
            { role: "model" as const, content: q.question, timestamp: q.timestamp },
            { role: "user" as const, content: q.answer, timestamp: q.timestamp }
          ])).flat();
          project.ideation.brief = session.requirementsDoc || session.idea;
          project.ideation.objective = session.requirementsDoc || session.idea;
          project.ideation.readyForComponents = session.phase1Complete;
          if (session.phase1Complete) {
            project.stageStatus.ideation = "done";
            project.stageStatus.components = "ready";
          }
          await project.save();
        }
      } catch (err) {
        console.error("Failed to sync project in answerQuestion:", err);
      }
    }

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: session.phase1Complete,
      requirementsDoc: session.requirementsDoc,
      qaHistory: session.qaHistory || [],
      context: session.context || {}
    });
  } catch (err: any) {
    console.error("answerQuestion failed:", err);
    return res.status(500).json({ error: err.message || "Failed to submit answer." });
  }
};

// 3. POST /api/new-flow/proceed
export const proceedSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    /* old code
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nThe user has decided to skip further questions. Please compile and output the final Project Requirements Document (Markdown PRD) in requirementsDoc based on the idea and history so far. Set "done" to true.`;
    */
    // ??$$$ newer code
    const prunedHistory = session.qaHistory.slice(-3);
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History (Pruned to last 3 turns):\n`;
    prunedHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nThe user has decided to skip further questions. Please compile and output the final Project Requirements Document (Markdown PRD) in requirementsDoc based on the idea and history so far. Set "done" to true.`;

    try {
      const response = await callDiscovery(session.selectedModel, promptText);
      if (response && response.requirementsDoc) {
        session.requirementsDoc = response.requirementsDoc;
      }
    } catch (e) {
      console.error("[proceedSession] Failed to run final discovery extraction:", e);
    }

    session.phase1Complete = true;
    // ??$$$ newer code
    session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    await session.save();

    // ??$$$ newer code — Sync skip/proceed state and PRD to Project document in real-time
    if (session.projectId) {
      try {
        const project = await Project.findById(session.projectId);
        if (project) {
          project.ideation.messages = session.qaHistory.map(q => ([
            { role: "model" as const, content: q.question, timestamp: q.timestamp },
            { role: "user" as const, content: q.answer, timestamp: q.timestamp }
          ])).flat();
          project.ideation.brief = session.requirementsDoc || session.idea;
          project.ideation.objective = session.requirementsDoc || session.idea;
          project.ideation.readyForComponents = true;
          project.stageStatus.ideation = "done";
          project.stageStatus.components = "ready";
          await project.save();
        }
      } catch (err) {
        console.error("Failed to sync project in proceedSession:", err);
      }
    }

    return res.json({
      success: true,
      requirementsDoc: session.requirementsDoc,
      qaHistory: session.qaHistory || [],
      context: session.context || {}
    });
  } catch (err: any) {
    console.error("proceedSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to proceed session." });
  }
};

// 4. GET /api/new-flow/session/:sessionId
export const getSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    return res.json(session);
  } catch (err: any) {
    console.error("getSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch session." });
  }
};

// 5. POST /api/new-flow/formulate
export const formulateSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    // ??$$$ newer code
    session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    await session.save();

    // ??$$$ newer code — Sync components generation state to Project
    if (session.projectId) {
      try {
        const project = await Project.findById(session.projectId);
        if (project) {
          project.stageStatus.components = "generating";
          await project.save();
        }
      } catch (err) {
        console.error("Failed to sync project in formulateSession:", err);
      }
    }

    // ??$$$ newer code — detect existing progress and resume from where it stopped
    const hasProgress = !!(
      (session.bom && session.bom.length > 0) ||
      (session.wiring && session.wiring.length > 0) ||
      (session.milestones && session.milestones.length > 0)
    );

    // Run Agent 2 formulation loop in the background
    // ??$$$ newer code
    runAgent2(sessionId, "meta-llama/llama-4-scout-17b-16e-instruct", hasProgress).catch(err => {
      console.error("[Agent2 Background Execution Error]:", err);
    });

    return res.json({
      success: true,
      message: "Agent 2 formulation initiated in the background."
    });
  } catch (err: any) {
    console.error("formulateSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to formulate session." });
  }
};

// ??$$$ NEW FLOW
// 6. POST /api/new-flow/restart
export const restartSession = async (req: Request, res: Response) => {
  try {
    const { sessionId, context, requirementsDoc, model } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    if (!context) {
      // Clear Q&A and restart discovery from the beginning
      session.qaHistory = [];
      session.requirementsDoc = "";
      session.phase1Complete = false;
      session.phase2Complete = false;
      session.agentLog = [];
      session.bom = [];
      session.wiring = [];
      session.milestones = [];
      session.diagram = {};
      session.context = {};

      const promptText = `Original Project Idea: ${session.idea}\nNo previous Q&A history. Get the first question.`;
      const response = await callDiscovery(session.selectedModel, promptText);

      session.requirementsDoc = response.requirementsDoc || "";
      session.phase1Complete = !!response.done;
      if (session.phase1Complete) {
        // ??$$$ newer code
        session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
      }

      await session.save();

      return res.json({
        sessionId: session._id,
        question: response.question,
        options: response.options || [],
        done: !!response.done,
        requirementsDoc: session.requirementsDoc,
        qaHistory: session.qaHistory || [],
        context: session.context || {}
      });
    }

    // ??$$$ newer code
    session.selectedModel = "meta-llama/llama-4-scout-17b-16e-instruct";

    if (requirementsDoc) {
      session.requirementsDoc = requirementsDoc;
    }

    session.context = {
      corePurpose: context.corePurpose || "",
      mcu: context.mcu || "",
      subsystems: {
        inputs: context.subsystems?.inputs || [],
        outputs: context.subsystems?.outputs || [],
        communication: context.subsystems?.communication || [],
        storage: context.subsystems?.storage || [],
        power: context.subsystems?.power || []
      },
      formFactor: context.formFactor || "",
      powerSource: context.powerSource || "",
      connectivity: Array.isArray(context.connectivity)
        ? context.connectivity
        : (context.connectivity ? [context.connectivity] : []),
      estimatedBudget: context.estimatedBudget || "",
      constraints: Array.isArray(context.constraints) ? context.constraints : [],
      openQuestions: Array.isArray(context.openQuestions) ? context.openQuestions : []
    };


    // ??$$$ newer code
    session.agentLog = [];
    session.bom = [];
    session.wiring = [];
    session.milestones = [];
    session.phase2Complete = false;

    await session.save();

    if (session.projectId) {
      try {
        const project = await Project.findById(session.projectId);
        if (project) {
          project.bom = [];
          project.wiring = [];
          project.milestones = [];
          project.diagram = {};
          project.stageStatus.components = "generating";
          project.stageStatus.build = "locked";
          project.stageStatus.simulation = "locked";
          await project.save();
          console.log(`[newflow.controller.ts] Reset project ${project._id} on session restart`);
        }
      } catch (err) {
        console.error("Failed to reset project on session restart:", err);
      }
    }

    // Trigger fresh Agent 2 loop
    // ??$$$ newer code
    runAgent2(sessionId, "meta-llama/llama-4-scout-17b-16e-instruct").catch(err => {
      console.error("[Agent2 Restart Background Execution Error]:", err);
    });

    return res.json({
      success: true,
      message: "Agent 2 formulation restarted.",
      context: session.context
    });
  } catch (err: any) {
    console.error("restartSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to restart formulation." });
  }
};

// ??$$$ NEW FLOW
// 7. GET /api/new-flow/project-session/:projectId
export const getSessionByProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?._id;

    let session = await NewFlowSession.findOne({ projectId });
    if (!session) {
      const ProjectModel = mongoose.model("Project");
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }

      // Create a new session linked to this project
      session = new NewFlowSession({
        owner: userId,
        selectedModel: "qwen/qwen3-32b",
        idea: project.description,
        requirementsDoc: (project as any).ideation.objective || project.description || "",
        qaHistory: [],
        phase1Complete: true,
        phase2Complete: false,
        projectId: project._id
      });

      // Populate context from project details
      // ??$$$ newer code
      session.context = {
        corePurpose: (project as any).ideation.objective || project.description || "",
        mcu: (project as any).ideation.compute || "",
        subsystems: {
          inputs: [],
          outputs: [],
          communication: [],
          storage: [],
          power: []
        },
        formFactor: "",
        powerSource: "",
        connectivity: [],
        estimatedBudget: "",
        constraints: (project as any).ideation.constraints ? [(project as any).ideation.constraints] : [],
        openQuestions: (project as any).ideation.open ? [(project as any).ideation.open] : []
      };

      await session.save();
    }

    return res.json(session);
  } catch (err: any) {
    console.error("getSessionByProject failed:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch project session." });
  }
};

// ??$$$ newer code — Export formulation data to local folder on E:
export const exportLocalSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    // Define export path — respects FORMULATION_EXPORTS_DIR env var (same as playground.route.ts)
    const exportsBaseDir = process.env.FORMULATION_EXPORTS_DIR || "E:\\wireup_formulation_exports";
    const exportDir = path.join(exportsBaseDir, `session_${sessionId}`);

    // Ensure directory exists
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8"); // ??$$$ old code
    // ??$$$ newer code - populate BOM details dynamically before local export
    const populatedBom = await populateBomDetails(session.bom || []);
    fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(populatedBom, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "requirements.md"), session.requirementsDoc || "", "utf8");

    // ??$$$ newer code
    const sketchCode = session.finalSketch || (
      [...(session.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0))
        .find((m: any) => String(m?.code || "").trim().length > 0)?.code
    ) || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
    fs.writeFileSync(path.join(exportDir, "sketch.ino"), sketchCode, "utf8");

    // Also write a sketch.json wrapper containing code, as expected by the compilation service
    fs.writeFileSync(path.join(exportDir, "sketch.json"), JSON.stringify({
      code: sketchCode,
      filename: "sketch.ino"
    }, null, 2), "utf8");

    return res.json({
      success: true,
      message: `Formulation data successfully exported to local folder.`,
      exportPath: exportDir
    });
  } catch (err: any) {
    console.error("exportLocalSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to export session to local folder." });
  }
};

// ??$$$ newer code — Virtual playground payload endpoint from AI formulation session
export const getVirtualProjectData = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // const payload = mapSessionToVirtualProject(session); // ??$$$ old code
    const payload = await mapSessionToVirtualProject(session); // ??$$$ newer code
    return res.json({ success: true, project: payload });
  } catch (err: any) {
    console.error("getVirtualProjectData failed:", err);
    return res.status(500).json({ error: err.message || "Failed to build virtual project payload." });
  }
};

// ??$$$ newer code — POST /new-flow/resume route handler
export const resumeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);


    // Trigger runAgent2 in the background with isResume = true
    const model = session.selectedModel || "gemini-2.5-flash";
    runAgent2(sessionId, model, true).catch(err => {
      console.error("[NewFlowController] Background runAgent2 resume failed:", err);
    });

    const io = (global as any).io;
    if (io) {
      io.to(sessionId).emit("agent2:resumed", { success: true });
    }

    return res.json({
      success: true,
      message: "Formulation resumption triggered successfully."
    });
  } catch (err: any) {
    console.error("resumeSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to resume formulation session." });
  }
};

// ??$$$ newer code — API Rescue to bypass Ollama and use Groq/Cerebras/Gemini sequentially
export const rescueSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    // ??$$$ newer code
    await ensureSessionOwnership(session, req);

    // Trigger runAgent2 in the background with isResume = true AND isRescue = true
    const model = session.selectedModel || "qwen/qwen3-32b";
    runAgent2(sessionId, model, true, true).catch(err => {
      console.error("[NewFlowController] Background runAgent2 rescue failed:", err);
    });

    const io = (global as any).io;
    if (io) {
      io.to(sessionId).emit("agent2:resumed", { success: true });
    }

    return res.json({
      success: true,
      message: "API Rescue triggered successfully."
    });
  } catch (err: any) {
    console.error("rescueSession failed:", err);
    return res.status(500).json({ error: err.message || "Failed to rescue formulation session." });
  }
};


// ??$$$ newer code — Upgraded Llama 4 Scout Copilot with dynamic BOM/wiring/sketch/milestones mutation tools & Socket.io updates
export const chatSession = async (req: Request, res: Response) => {
  const { sessionId, message, history = [] } = req.body;
  if (!sessionId || !message?.trim()) {
    return res.status(400).json({ error: "sessionId and message are required." });
  }

  try {
    const session = await NewFlowSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found." });

    const bomSummary = Array.isArray((session as any).bom) && (session as any).bom.length > 0
      ? (session as any).bom.map((b: any) => `- ${b.displayName || b.key} (${b.purpose || ""})`).join("\n")
      : "BOM not yet finalised.";

    const wiringSummary = Array.isArray((session as any).wiring) && (session as any).wiring.length > 0
      ? (session as any).wiring.map((w: any) => `  ${w.from} → ${w.to}`).join("\n")
      : "Wiring not yet finalised.";

    const ctx: any = (session as any).context || {};
    const prd: string = (session as any).requirementsDoc || "";

    const systemPrompt = [
      "You are an expert hardware engineer assistant and copilot embedded inside WireUp.AI.",
      "You have full knowledge of the current project being formulated and you can directly perform changes using your tools.",
      "",
      `Project Idea: ${(session as any).idea || ctx.corePurpose || "Unknown"}`,
      `MCU / Brain: ${ctx.mcu || "Determining..."}`,
      `Power Source: ${ctx.powerSource || "Not specified"}`,
      "",
      "Current Bill of Materials (BOM):",
      bomSummary,
      "",
      "Current Wiring Connections:",
      wiringSummary,
      "",
      prd ? `Requirements Document (PRD):\n${prd.slice(0, 1200)}` : "",
      "",
      "You have the ability to make changes directly using function calls/tools:",
      "- `update_bom`: Call this if the user wants to add, remove, or modify components in their BOM.",
      "- `update_wiring`: Call this if the user wants to update, add, or remove wiring connections.",
      "- `update_sketch`: Call this to directly update the sketch code (sketch.ino).",
      "- `update_milestones`: Call this to update the project build milestones.",
      "",
      "Answer the user's hardware question or change request concisely. Keep explanations short (2–5 sentences max) unless asked for details.",
      "When performing a change, explain what was changed and call the appropriate tool with the updated state.",
    ].filter(Boolean).join("\n");

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...((history || []).slice(-10).map((h: any) => ({ role: h.role, content: h.content }))),
      { role: "user", content: message.trim() }
    ];

    let reply = "";
    try {
      const groq = await rotationService.getClient();
      const tools = [
        {
          type: "function",
          function: {
            name: "update_bom",
            description: "Updates the project Bill of Materials (BOM). Use this to add, remove, or modify components.",
            parameters: {
              type: "object",
              properties: {
                bom: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      partId: { type: "string" },
                      mpn: { type: "string" },
                      displayName: { type: "string" },
                      purpose: { type: "string" },
                      qty: { type: "number" },
                      price: { type: "number" },
                      subsystem: { type: "string" },
                      interfaces: { type: "array", items: { type: "string" } },
                      glbUrl: { type: "string" },
                      type: { type: "string" }
                    },
                    required: ["key", "displayName", "purpose"]
                  }
                }
              },
              required: ["bom"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "update_wiring",
            description: "Updates the wiring connections netlist.",
            parameters: {
              type: "object",
              properties: {
                wiring: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      from: { type: "string" },
                      to: { type: "string" },
                      net: { type: "string" },
                      color: { type: "string" }
                    },
                    required: ["from", "to", "net"]
                  }
                }
              },
              required: ["wiring"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "update_sketch",
            description: "Updates the main Arduino sketch code (sketch.ino).",
            parameters: {
              type: "object",
              properties: {
                sketch: { type: "string" }
              },
              required: ["sketch"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "update_milestones",
            description: "Updates the milestones sequence.",
            parameters: {
              type: "object",
              properties: {
                milestones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      order: { type: "number" },
                      title: { type: "string" },
                      objective: { type: "string" },
                      subsystem: { type: "string" },
                      partsInvolved: { type: "array", items: { type: "string" } },
                      wiringInstructions: { type: "string" },
                      code: { type: "string" },
                      explanation: { type: "string" },
                      expectedOutput: { type: "string" },
                      passCondition: { type: "string" },
                      commonProblems: { type: "array", items: { type: "string" } },
                      simulatable: { type: "boolean" },
                      requiredLibraries: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            type: { type: "string" },
                            version: { type: "string" },
                            installCommand: { type: "string" }
                          },
                          required: ["name"]
                        }
                      }
                    },
                    required: ["id", "order", "title", "objective", "code"]
                  }
                }
              },
              required: ["milestones"]
            }
          }
        }
      ];

      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages,
        tools: tools as any,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 1024,
      });

      const choice = completion.choices?.[0];
      reply = choice?.message?.content?.trim() || "";

      const toolCalls = choice?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        let bomUpdated = false;
        let wiringUpdated = false;
        let sketchUpdated = false;
        let milestonesUpdated = false;

        for (const call of toolCalls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments);

          if (name === "update_bom" && args.bom) {
            session.bom = args.bom;
            bomUpdated = true;
          } else if (name === "update_wiring" && args.wiring) {
            session.wiring = args.wiring;
            wiringUpdated = true;
          } else if (name === "update_sketch" && args.sketch) {
            session.finalSketch = args.sketch;
            sketchUpdated = true;
          } else if (name === "update_milestones" && args.milestones) {
            session.milestones = args.milestones;
            milestonesUpdated = true;
          }
        }

        // Save session updates
        await session.save();

        // Sync with linked Project if exists
        if (session.projectId) {
          const project = await Project.findById(session.projectId);
          if (project) {
            if (bomUpdated) {
              project.bom = session.bom as any;
              project.markModified("bom");
            }
            if (wiringUpdated) {
              project.bom.forEach((bomItem: any) => {
                const matchingConns = (session.wiring || []).filter((c: any) => c.to.startsWith(bomItem.key));
                bomItem.pinConnections = matchingConns.map((c: any) => ({
                  pin: c.to.split(".")[1] || "",
                  connectsTo: c.from
                }));
              });
              project.markModified("bom");
            }
            if (sketchUpdated) {
              project.sketch = session.finalSketch || "";
              project.markModified("sketch");
            }
            if (milestonesUpdated) {
              project.milestones = session.milestones as any;
              project.markModified("milestones");
            }
            await project.save();
          }
        }

        // Emit Socket.io updates in real time
        const io = (global as any).io;
        if (io) {
          const room = sessionId.toString();
          if (bomUpdated) {
            io.to(room).emit("agent2:bom_update", { bom: session.bom });
          }
          if (wiringUpdated) {
            io.to(room).emit("agent2:wiring_update", { wiring: session.wiring });
          }
          if (sketchUpdated) {
            io.to(room).emit("agent2:final_sketch_update", { finalSketch: session.finalSketch });
          }
          if (milestonesUpdated) {
            io.to(room).emit("agent2:milestone_update", { milestones: session.milestones, milestone: session.milestones });
          }
        }

        if (!reply) {
          reply = "I have successfully updated the project configuration as requested.";
        }
      }
    } catch (groqErr: any) {
      console.warn("[chatSession] Groq failed, trying Gemini:", groqErr.message);
      try {
        const geminiKey = process.env.GEMINI_API_KEY || "";
        if (geminiKey) {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const genModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const prompt = messages.map(m => `${m.role === "system" ? "[SYSTEM]" : m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
          const result = await genModel.generateContent(prompt);
          reply = result.response.text()?.trim() || "";
        }
      } catch (gemErr: any) {
        console.error("[chatSession] Both LLMs failed:", gemErr.message);
      }
    }

    if (!reply) {
      reply = "I'm having trouble connecting to the AI engine right now. Please try again in a moment.";
    }

    return res.json({ reply });
  } catch (err: any) {
    console.error("chatSession failed:", err);
    return res.status(500).json({ error: err.message || "Chat failed." });
  }
};

