// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
// ??$$$ old code
/*
import mongoose from "mongoose";
*/
// ??$$$ newer code
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "./keyRotation.service";
import NewFlowSession from "../models/newFlowSession.model";
import Project from "../models/project.model";
import Part from "../models/part.model";
import { executeTool } from "./agent2tools.service";
import { GEMINI_AGENT2_TOOLS, GROQ_AGENT2_TOOLS } from "./agent2tools.declarations";
import { resolveAllPins } from "./pinResolver.service";

export interface LLMResponse {
  text(): string;
  functionCalls(): { name: string; args: any }[];
}

export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[]): Promise<LLMResponse>;
}

// Gemini Adapter implementation
export class GeminiAdapter implements LLMAdapter {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: GEMINI_AGENT2_TOOLS.functionDeclarations }] as any
    });

    // Map messages into Gemini SDK format
    // Roles in Gemini must alternate user and model, plus function roles
    const contents = messages.map(m => {
      if (m.role === "function") {
        return {
          role: "function",
          parts: [{
            functionResponse: {
              name: m.name,
              response: m.content
            }
          }]
        };
      }

      const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
      const parts: any[] = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (m.functionCalls) {
        m.functionCalls.forEach((fc: any) => {
          parts.push({
            functionCall: {
              name: fc.name,
              args: fc.args
            }
          });
        });
      }
      return { role, parts };
    });

    const result = await model.generateContent({ contents });
    const response = result.response;

    return {
      text: () => response.text() || "",
      functionCalls: () => {
        const calls = response.functionCalls();
        if (!calls) return [];
        return calls.map(c => ({
          name: c.name,
          args: c.args
        }));
      }
    };
  }
}

// Groq Adapter implementation
export class GroqAdapter implements LLMAdapter {
  private modelName: string;
  constructor(modelName: string) {
    this.modelName = modelName;
  }

  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
    const client = await rotationService.getClient();

    // Map messages into Groq format
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => {
        if (m.role === "function") {
          return {
            role: "tool",
            tool_call_id: m.tool_call_id || `call_${m.name}`,
            name: m.name,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
          };
        }

        const role = m.role === "model" || m.role === "assistant" ? "assistant" : "user";
        const msgObj: any = {
          role,
          content: m.content || ""
        };

        if (m.functionCalls && m.functionCalls.length > 0) {
          msgObj.tool_calls = m.functionCalls.map((fc: any) => ({
            id: fc.id || `call_${fc.name}`,
            type: "function",
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args)
            }
          }));
        }

        return msgObj;
      })
    ];

    const completion = await client.chat.completions.create({
      model: this.modelName,
      messages: groqMessages as any,
      tools: GROQ_AGENT2_TOOLS as any,
      tool_choice: "auto",
      temperature: 0.2
    });

    const choice = completion.choices[0];
    const message = choice.message;

    return {
      text: () => message.content || "",
      functionCalls: () => {
        if (!message.tool_calls) return [];
        return message.tool_calls.map(tc => {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch (e) {
            console.error("Failed to parse tool call args:", tc.function.arguments);
          }
          return {
            id: tc.id,
            name: tc.function.name,
            args: parsedArgs
          };
        });
      }
    };
  }
}

// ??$$$ newer code
function parseJsonRecursively(val: any): any {
  if (typeof val === "string") {
    try {
      return parseJsonRecursively(JSON.parse(val));
    } catch {
      return val;
    }
  }
  return val;
}

// Intercept and implement save_progress for NewFlowSession
async function saveSessionProgress(sessionId: string, type: string, data: any) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error("NewFlowSession not found");
  }

  // ??$$$ old code
  /*
  let parsedData = data;
  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      console.error("[Agent2] Failed to parse stringified progress data:", e);
    }
  }
  */
  // ??$$$ newer code
  let parsedData = parseJsonRecursively(data);

  const io = (global as any).io;

  /* old code
  if (type === "bom") {
    session.bom = Array.isArray(parsedData) ? parsedData : [...(session.bom || []), parsedData];
    await session.save();
    if (io) {
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "wiring") {
    // Save wiring list
    session.wiring = Array.isArray(parsedData.connections) ? parsedData.connections : parsedData;
    // Map pin connections to BOM items
    session.bom.forEach((bomItem) => {
      const matchingConns = (session.wiring || []).filter((c: any) => c.to.startsWith(bomItem.key));
      bomItem.pinConnections = matchingConns.map((c: any) => ({
        pin: c.to.split(".")[1] || "",
        connectsTo: c.from
      }));
    });
    session.markModified("bom");
    await session.save();
    if (io) {
      io.to(sessionId).emit("agent2:wiring_update", { wiring: session.wiring });
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "milestone") {
    const list = Array.isArray(parsedData) ? parsedData : [parsedData];
    list.forEach(m => {
      // Avoid duplication
      const existingIdx = session.milestones.findIndex(em => em.id === m.id);
      if (existingIdx > -1) {
        session.milestones[existingIdx] = m;
      } else {
        session.milestones.push(m);
      }
    });
    // Set status of first milestone to ready
    if (session.milestones.length > 0) {
      session.milestones.sort((a, b) => a.order - b.order);
    }
    await session.save();
    if (io) {
      io.to(sessionId).emit("agent2:milestone_update", { milestones: session.milestones });
    }
  } else if (type === "diagram") {
    // We don't have a diagram.json field directly in NewFlowSession, but we can save it as milestones or keep metadata
    // For simplicity, we just save to project diagram or log it
    // When converting to Project, we will map this.
    // Let's store the diagram json as a field on session or in milestones. Let's just log it or add support
    if (io) {
      io.to(sessionId).emit("agent2:diagram_update", { diagram: parsedData.diagramJson || parsedData });
    }
  }
  */

  // ??$$$ newer code — Robust saveSessionProgress with shape normalizations and MCU key consistency mapping
  if (type === "bom") {
    let bomList = parsedData;
    if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
      if (Array.isArray(parsedData.components)) {
        bomList = parsedData.components;
      } else if (Array.isArray(parsedData.bom)) {
        bomList = parsedData.bom;
      } else if (Array.isArray(parsedData.parts)) {
        bomList = parsedData.parts;
      }
    }

    const rawItems = Array.isArray(bomList) ? bomList : [bomList];
    const normalizedBOM = rawItems.filter(Boolean).map((item: any) => {
      // Bug 2: Ensure MCU key is always "mcu" (never "brain")
      let key = item.key || item.id || "";
      if (key.toLowerCase() === "brain" || key.toLowerCase() === "mcu") {
        key = "mcu";
      }

      // Bug 4: Keep partId as the MongoDB _id string. Ensure MPN is stored in mpn.
      let partId = item.partId || item.id || "";
      let mpn = item.mpn || item.partId || "";

      // Enforce other required fields to satisfy mongoose schema validation
      const displayName = item.displayName || item.name || mpn || "Unknown Component";
      const purpose = item.purpose || item.description || "Auxiliary component";
      const subsystem = item.subsystem || "Main";
      const qty = typeof item.qty === "number" ? item.qty : 1;
      const price = typeof item.price === "number" ? item.price : 0;
      const interfaces = Array.isArray(item.interfaces) ? item.interfaces : [];
      const pinConnections = Array.isArray(item.pinConnections)
        ? item.pinConnections.map((pc: any) => ({
          pin: pc.pin || "",
          connectsTo: pc.connectsTo || ""
        }))
        : [];

      return {
        key,
        partId,
        mpn,
        displayName,
        purpose,
        qty,
        price,
        subsystem,
        interfaces,
        pinConnections,
        glbUrl: item.glbUrl || "",
        pins: Array.isArray(item.pins) ? item.pins : []
      };
    });

    session.bom = normalizedBOM;
    await session.save();
    if (io) {
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "wiring") {
    // Save wiring list
    let rawWiring = Array.isArray(parsedData.connections) ? parsedData.connections : parsedData;
    if (!Array.isArray(rawWiring)) rawWiring = [];

    // Normalize wiring to ensure MCU is mapped to "mcu" instead of "brain"
    const normalizedWiring = rawWiring.map((c: any) => {
      let from = c.from || "";
      let to = c.to || "";

      if (from.startsWith("brain.")) {
        from = "mcu." + from.substring(6);
      }
      if (to.startsWith("brain.")) {
        to = "mcu." + to.substring(6);
      }

      return {
        from,
        to,
        net: c.net || `${from}-${to}`,
        color: c.color || "#000000"
      };
    });

    session.wiring = normalizedWiring;

    // Map pin connections to BOM items
    session.bom.forEach((bomItem) => {
      const matchingConns = (session.wiring || []).filter((c: any) => c.to.startsWith(bomItem.key));
      bomItem.pinConnections = matchingConns.map((c: any) => ({
        pin: c.to.split(".")[1] || "",
        connectsTo: c.from
      }));
    });

    session.markModified("bom");
    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:wiring_update", { wiring: session.wiring });
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "milestone") {
    // ??$$$ old code
    /*
    const list = Array.isArray(parsedData) ? parsedData : [parsedData];
    list.forEach(m => {
      // Bug 3: Avoid duplication by checking order + subsystem, title, or id
      const existingIdx = session.milestones.findIndex(em =>
        em.id === m.id ||
        em.title === m.title ||
        (em.order === m.order && em.subsystem === m.subsystem)
      );
      if (existingIdx > -1) {
        session.milestones[existingIdx] = m;
      } else {
        session.milestones.push(m);
      }
    });
    */

    // ??$$$ newer code
    let milestoneList = parsedData;
    if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
      if (Array.isArray(parsedData.milestones)) {
        milestoneList = parsedData.milestones;
      } else if (Array.isArray(parsedData.milestone)) {
        milestoneList = parsedData.milestone;
      } else if (Array.isArray(parsedData.steps)) {
        milestoneList = parsedData.steps;
      } else if (parsedData.milestone && typeof parsedData.milestone === "object") {
        milestoneList = [parsedData.milestone];
      }
    }

    const rawList = Array.isArray(milestoneList) ? milestoneList : [milestoneList];
    const normalizedMilestones = rawList
      .filter((m: any) => m && typeof m === "object")
      .map((m: any, idx: number) => {
        return {
          id: m.id || `milestone_${m.order || idx + 1 || Date.now()}`,
          order: typeof m.order === "number" ? m.order : (idx + 1),
          title: m.title || "Untitled Milestone",
          objective: m.objective || "",
          subsystem: m.subsystem || "General",
          partsInvolved: Array.isArray(m.partsInvolved) ? m.partsInvolved : (Array.isArray(m.componentsInvolved) ? m.componentsInvolved : []),
          wiringInstructions: m.wiringInstructions || "",
          code: m.code || "",
          explanation: m.explanation || "",
          expectedOutput: m.expectedOutput || m.expectedSerialOutput || "",
          passCondition: m.passCondition || "",
          commonProblems: Array.isArray(m.commonProblems) ? m.commonProblems : [],
          simulatable: typeof m.simulatable === "boolean" ? m.simulatable : true,
          requiredLibraries: Array.isArray(m.requiredLibraries) ? m.requiredLibraries : []
        };
      });

    normalizedMilestones.forEach(m => {
      const existingIdx = session.milestones.findIndex(em =>
        em.id === m.id ||
        em.title === m.title ||
        (em.order === m.order && em.subsystem === m.subsystem)
      );
      if (existingIdx > -1) {
        // ??$$$ old code
        // session.milestones[existingIdx].set(m);
        // ??$$$ newer code
        (session.milestones[existingIdx] as any).set(m);
      } else {
        session.milestones.push(m);
      }
    });

    if (session.milestones.length > 0) {
      session.milestones.sort((a, b) => a.order - b.order);
    }
    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:milestone_update", { milestones: session.milestones });
    }
  } else if (type === "diagram") {
    let diagramData = parsedData.diagramJson || parsedData;
    if (diagramData && typeof diagramData === "object") {
      // Normalize Wokwi parts and connections to map "brain" to "mcu"
      if (Array.isArray(diagramData.parts)) {
        diagramData.parts = diagramData.parts.map((p: any) => {
          if (p && (p.id === "brain" || p.id === "mcu")) {
            return { ...p, id: "mcu" };
          }
          return p;
        });
      }
      if (Array.isArray(diagramData.connections)) {
        diagramData.connections = diagramData.connections.map((c: any) => {
          if (Array.isArray(c)) {
            return c.map((val: any) => {
              if (typeof val === "string" && val.startsWith("brain:")) {
                return "mcu:" + val.substring(6);
              }
              return val;
            });
          }
          return c;
        });
      }
    }

    session.diagram = diagramData;
    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:diagram_update", { diagram: session.diagram });
    }
  }

  return {
    saved: true,
    type,
    sessionId,
    timestamp: new Date().toISOString()
  };
}

// Main autonomous loop for Formulation Agent (Agent 2)
// ??$$$
/*
export async function runAgent2(sessionId: string, modelName: string) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const io = (global as any).io;

  const logAndEmit = async (logObj: {
    type: "thinking" | "tool_call" | "decision" | "error";
    name?: string;
    status?: "running" | "done" | "failed";
    input?: any;
    output?: any;
    text?: string;
  }) => {
    const logItem = {
      ...logObj,
      timestamp: new Date()
    };
    session.agentLog.push(logItem);
    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:log", logItem);
    }
  };

  // Build the formulation agent system prompt
  const systemPrompt = `You are an autonomous hardware engineering agent working on formulating a project.
Your task is to take the finalized project context and produce:
1. A finalized Bill of Materials (BOM) using components from the library.
2. Electrical wiring connections between these components.
3. A step-by-step milestone curriculum to build the project.
4. A simulator diagram.json config.

You have access to a set of tools to search, analyze, and build.
Work step by step:
1. Search the library to find the best components for the compute and subsystems specified in the project context.
2. Get details and check compatibility for candidates.
3. Once components are finalized, save the BOM using save_progress(type="bom").
4. Generate the wiring connections using generate_wiring and validate them.
5. Save wiring using save_progress(type="wiring").
6. Generate the build milestones one by one using generate_milestone. Milestone 1 must be a bare MCU blink.
7. Save milestones using save_progress(type="milestone").
8. Generate the simulation diagram.json using generate_diagram_json.
9. Save diagram using save_progress(type="diagram").

Follow these guidelines:
- MCU pin layout and wiring must be compatible.
- All milestones must be step-by-step.
- You must call save_progress at each step to persist data and update the frontend UI.
- When done, state that formulation is complete.`;

  const contextStr = `Project Context:
Core Purpose: ${session.context.corePurpose}
Compute Brain: ${session.context.mcu}
Subsystems: ${session.context.subsystems.join(", ")}
Constraints: ${session.context.constraints.join(", ")}
Power Source: ${session.context.powerSource}
Connectivity: ${session.context.connectivity}
Open Questions Resolved: ${session.qaHistory.map(h => `Q: ${h.question} -> A: ${h.answer}`).join(" | ")}`;

  const messages: any[] = [
    { role: "user", content: `Please formulate this project: \n${contextStr}` }
  ];

  // Instantiate adapter
  let adapter: LLMAdapter;
  if (modelName.toLowerCase().includes("gemini")) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing");
    adapter = new GeminiAdapter(geminiKey);
  } else {
    // Map Llama and Qwen models
    let actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    }
    adapter = new GroqAdapter(actualModel);
  }

  let turns = 0;
  const maxTurns = 20;

  while (turns < maxTurns) {
    turns++;
    console.log(`[Agent2] Starting turn ${turns}...`);
    
    try {
      const response = await adapter.chat(systemPrompt, messages);
      const text = response.text();
      const calls = response.functionCalls();

      // Log thinking if present
      if (text) {
        console.log(`[Agent2] Thinking: ${text}`);
        await logAndEmit({
          type: "thinking",
          text
        });
      }

      if (calls.length === 0) {
        // No tools called, agent is done
        console.log("[Agent2] Formulation complete. No further tools called.");
        await logAndEmit({
          type: "decision",
          text: "Agent has finalized the project formulation."
        });
        break;
      }

      // We have tool calls
      const assistantMessage: any = {
        role: "assistant",
        content: text,
        functionCalls: calls.map(c => ({
          name: c.name,
          args: c.args,
          id: (c as any).id
        }))
      };
      messages.push(assistantMessage);

      // Execute each tool call
      for (const call of calls) {
        console.log(`[Agent2] Executing tool ${call.name} with args:`, call.args);
        await logAndEmit({
          type: "tool_call",
          name: call.name,
          status: "running",
          input: call.args
        });

        let result: any;
        try {
          if (call.name === "save_progress") {
            result = await saveSessionProgress(sessionId, call.args.type, call.args.data);
          } else {
            result = await executeTool(call.name, call.args, sessionId);
          }

          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "done",
            output: result
          });
        } catch (toolErr: any) {
          console.error(`[Agent2] Tool ${call.name} failed:`, toolErr);
          result = { error: toolErr.message || "Execution error" };
          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "failed",
            output: result
          });
        }

        messages.push({
          role: "function",
          name: call.name,
          tool_call_id: (call as any).id,
          content: result
        });
      }
    } catch (err: any) {
      console.error("[Agent2] Loop error:", err);
      await logAndEmit({
        type: "error",
        text: `Error during agent loop: ${err.message || err}`
      });
      break;
    }
  }

  // Create real Project document on completion
  let projectId: any = null;
  try {
    console.log("[Agent2] Creating Project document from session...");
    const newProject = new Project({
      owner: session.owner,
      description: session.idea,
      isAgentic: true,
      stageStatus: {
        ideation: "done",
        components: "done",
        build: "ready",
        simulation: "locked",
        assembly: "locked",
        shopping: "locked"
      },
      ideation: {
        messages: session.qaHistory.map(q => ([
          { role: "model" as const, content: q.question, timestamp: q.timestamp },
          { role: "user" as const, content: q.answer, timestamp: q.timestamp }
        ])).flat(),
        brief: session.context.corePurpose,
        objective: session.context.corePurpose,
        compute: session.context.mcu,
        phases: {},
        constraints: session.context.constraints.join("\n"),
        open: session.context.openQuestions.join("\n"),
        readyForComponents: true,
        readyAt: new Date(),
        validatorApproved: true,
        validatorFeedback: "Approved by Agent 2 formulation.",
        validationAttempts: 1
      },
      bom: session.bom.map(b => ({
        key: b.key,
        wokwiPartType: b.partId,
        displayName: b.displayName,
        qty: b.qty,
        purpose: b.purpose,
        price: b.price || 0,
        storeUrl: "",
        mpn: b.mpn || "",
        partId: b.partId || "",
        pinConnections: b.pinConnections || []
      })),
      milestones: session.milestones.map((m, idx) => ({
        id: m.id,
        order: m.order || (idx + 1),
        title: m.title,
        objective: m.objective,
        componentsInvolved: m.partsInvolved,
        wiringInstructions: m.wiringInstructions,
        code: m.code,
        explanation: m.explanation,
        test: {
          expectedSerialOutput: m.expectedOutput,
          passCondition: m.passCondition,
          commonProblems: m.commonProblems
        },
        status: idx === 0 ? ("ready" as const) : ("locked" as const),
        userConfirmed: false,
        userNotes: "",
        compiledHex: "",
        compilationErrors: [],
        serialOutput: "",
        completedAt: null,
        simulatable: m.simulatable,
        dependsOn: idx === 0 ? [] : [session.milestones[idx-1].id],
        debugMessages: [],
        requiredLibraries: m.requiredLibraries || []
      })),
      milestonesGenerated: true,
      activeMilestoneId: session.milestones[0]?.id || "",
      diagram: session.wiring
    });

    await newProject.save();
    projectId = newProject._id;
  } catch (err: any) {
    console.error("[Agent2] Failed to create project document from session:", err);
  }

  session.projectId = projectId;
  session.phase2Complete = true;
  await session.save();
  
  if (io) {
    io.to(sessionId).emit("agent2:complete", { success: true, projectId });
  }
}
*/

// ??$$$ Helper to extract Groq rate limit retry-after time in seconds from headers or message
function getRateLimitDelay(err: any): number {
  if (err.headers) {
    const retryAfter = err.headers.get?.('retry-after') || err.headers['retry-after'];
    if (retryAfter) {
      const sec = parseFloat(retryAfter);
      if (!isNaN(sec) && sec > 0) return sec;
    }
    const resetTokens = err.headers.get?.('x-ratelimit-reset-tokens') || err.headers['x-ratelimit-reset-tokens'];
    if (resetTokens) {
      const match = resetTokens.match(/([\d\.]+)\s*s/);
      if (match) {
        const sec = parseFloat(match[1]);
        if (!isNaN(sec) && sec > 0) return sec;
      }
    }
  }

  const msg = err.message || (err.error?.error?.message) || "";
  const tryAgainMatch = msg.match(/try again in (?:(\d+)m)?([\d\.]+)s/i);
  if (tryAgainMatch) {
    const minutes = tryAgainMatch[1] ? parseInt(tryAgainMatch[1], 10) : 0;
    const seconds = parseFloat(tryAgainMatch[2]);
    return minutes * 60 + seconds;
  }

  return 60; // fallback to 60 seconds
}

// ??$$$ newer code — sanitize messages to prevent consecutive same-role messages
function sanitizeMessageHistory(messages: any[]): any[] {
  const sanitized: any[] = [];
  for (const msg of messages) {
    if (sanitized.length > 0) {
      const lastMsg = sanitized[sanitized.length - 1];
      const lastRole = (lastMsg.role === "assistant" || lastMsg.role === "model") ? "model" : lastMsg.role;
      const currentRole = (msg.role === "assistant" || msg.role === "model") ? "model" : msg.role;

      if (lastRole === currentRole) {
        if (currentRole === "user") {
          sanitized.push({ role: "model", content: "Continuing..." });
        } else if (currentRole === "model") {
          sanitized.push({ role: "user", content: "Please continue." });
        }
      }
    }
    sanitized.push(msg);
  }
  return sanitized;
}

// ??$$$ NEW FLOW
// ??$$$ newer code — Added isResume flag
export async function runAgent2(sessionId: string, modelName: string, isResume = false) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const io = (global as any).io;

  const logAndEmit = async (logObj: {
    type: "thinking" | "tool_call" | "decision" | "error" | "context_received" | "rate_limit";
    name?: string;
    status?: "running" | "done" | "failed";
    input?: any;
    output?: any;
    text?: string;
  }) => {
    const logItem = {
      ...logObj,
      timestamp: new Date()
    };
    /* old code
    session.agentLog.push(logItem);
    await session.save();
    */
    // ??$$$ newer code - load fresh session document to avoid VersionError
    const freshSession = await NewFlowSession.findById(sessionId);
    if (freshSession) {
      freshSession.agentLog.push(logItem);
      await freshSession.save();
      // Keep local session fields updated
      session.agentLog = freshSession.agentLog;
      session.bom = freshSession.bom;
      session.wiring = freshSession.wiring;
      session.milestones = freshSession.milestones;
      session.diagram = freshSession.diagram;
      // Sync mongoose internal __v to avoid version error in other saves on local object
      (session as any).__v = freshSession.__v;
    }

    if (io) {
      io.to(sessionId).emit("agent2:log", logItem);
    }
  };

  // Broadcast that the AI has received the project formulation context
  console.log(`[Agent2 Debugger] Loop initialized for session: ${sessionId}`);
  console.log(`[Agent2 Debugger] Model chosen: ${modelName}`);
  console.log(`[Agent2 Debugger] Context received:`, JSON.stringify(session.context));

  await logAndEmit({
    type: "context_received",
    text: isResume ? "AI Resumed Project Formulation Context." : "AI Received Project Formulation Context.",
    input: {
      corePurpose: session.context.corePurpose,
      mcu: session.context.mcu,
      subsystems: session.context.subsystems,
      constraints: session.context.constraints,
      powerSource: session.context.powerSource,
      connectivity: session.context.connectivity,
      openQuestions: session.context.openQuestions
    }
  });

  // Build the formulation agent system prompt
  // ??$$$ newer code — refined system prompt with bug fixes for BOM shape, MCU key, milestone duplication, and partId format
  const systemPrompt = `You are an autonomous hardware engineering agent working on formulating a project.
Your task is to take the finalized project context and produce:
1. A finalized Bill of Materials (BOM) using components from the library.
2. Electrical wiring connections between these components.
3. A step-by-step milestone curriculum to build the project.
4. A simulator diagram.json config.

You have access to a set of tools to search, analyze, and build.
Work step by step:
1. Search the library to find the best components for the compute and subsystems specified in the project context.
2. Get details and check compatibility for candidates.
3. Once components are finalized, save the BOM using save_progress(type="bom").
4. Generate the wiring connections using generate_wiring and validate them.
5. Save wiring using save_progress(type="wiring").
6. Generate the build milestones one by one using generate_milestone. Milestone 1 must be a bare MCU blink.
7. Save milestones using save_progress(type="milestone").
8. Generate the simulation diagram.json using generate_diagram_json.
9. Save diagram using save_progress(type="diagram").

Follow these guidelines:
- CRITICAL: When calling save_progress(type="bom"), the data must be a JSON array of components where each component is a flat object directly containing: key, partId (use the database _id string from get_part_details, NEVER the MPN string), mpn, displayName, purpose, subsystem, qty, price, interfaces, pinConnections. Do NOT wrap under a 'components' key.
- CRITICAL: The MCU must always use the key 'mcu' everywhere — in the BOM, in generate_wiring, and in generate_diagram_json. Never use 'brain' as a key. The id field in diagram.parts must match the BOM key (which is 'mcu').
- CRITICAL: Call generate_milestone exactly once per milestone. Do not call it twice. Check the session first to see if a milestone with the same order, title, or subsystem already exists.
- CRITICAL: The partId field in save_progress for the BOM must be the exact database _id string returned by get_part_details (e.g. '6a13ec800c47f410601cfea7'), not the MPN string.
- MCU pin layout and wiring must be compatible.
- All milestones must be step-by-step.
- You must call save_progress at each step to persist data and update the frontend UI.
- When done, state that formulation is complete.`;

  const contextStr = `Project Context:
Core Purpose: ${session.context.corePurpose}
Compute Brain: ${session.context.mcu}
Subsystems: ${session.context.subsystems.join(", ")}
Constraints: ${session.context.constraints.join(", ")}
Power Source: ${session.context.powerSource}
Connectivity: ${session.context.connectivity}
Open Questions Resolved: ${session.qaHistory.map(h => `Q: ${h.question} -> A: ${h.answer}`).join(" | ")}`;

  /* old code
  const messages: any[] = [
    { role: "user", content: `Please formulate this project: \n${contextStr}` }
  ];
  */
  // ??$$$ newer code — Resume-aware prompt construction
  let initialPrompt = `Please formulate this project: \n${contextStr}`;
  if (isResume) {
    const hasBOM = session.bom && session.bom.length > 0;
    const hasWiring = session.wiring && session.wiring.length > 0;
    const hasMilestones = session.milestones && session.milestones.length > 0;
    const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;

    let resumeStr = "\n\nThis is a resumption of a previously interrupted formulation run. Here is the progress that was already saved:\n";
    if (hasBOM) {
      resumeStr += `- BOM has been saved with ${session.bom.length} items.\n`;
    } else {
      resumeStr += `- BOM is NOT saved yet.\n`;
    }
    if (hasWiring) {
      resumeStr += `- Wiring has been saved with ${session.wiring.length} connections.\n`;
    } else {
      resumeStr += `- Wiring is NOT saved yet.\n`;
    }
    if (hasMilestones) {
      resumeStr += `- Build milestones have been saved with ${session.milestones.length} milestones.\n`;
    } else {
      resumeStr += `- Build milestones are NOT saved yet.\n`;
    }
    if (hasDiagram) {
      resumeStr += `- Simulator diagram.json configuration has been saved.\n`;
    } else {
      resumeStr += `- Simulator diagram.json is NOT saved yet.\n`;
    }
    resumeStr += "\nPlease inspect the current status and resume formulation from where it stopped, calling the remaining tools to complete all pending parts.";
    initialPrompt += resumeStr;
  }

  const messages: any[] = [
    { role: "user", content: initialPrompt }
  ];

  // Instantiate adapter
  let adapter: LLMAdapter;
  if (modelName.toLowerCase().includes("gemini")) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing");
    adapter = new GeminiAdapter(geminiKey);
  } else {
    /* old code
    // Map Llama and Qwen models
    let actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    }
    adapter = new GroqAdapter(actualModel);
    */
    // ??$$$ Map Llama and Qwen models correctly to production string
    let actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
    }
    adapter = new GroqAdapter(actualModel);
  }

  let turns = 0;
  const maxTurns = 30; // ??$$$ newer code - set max turns to 30
  let capacityRetryCount = 0; // ??$$$ newer code - tracks sequential capacity retry attempts
  let formulationSuccessful = false; // ??$$$ newer code - track if formulation completed successfully

  while (turns < maxTurns) {
    turns++;
    console.log(`[Agent2 Debugger] Starting turn ${turns}...`);
    console.log(`[Agent2 Debugger] Current message history length: ${messages.length}`);

    // ??$$$ newer code — Turn limit check to prevent infinite loops
    if (turns >= maxTurns) {
      console.error("[Agent2] Exceeded maximum turns limit.");
      await logAndEmit({
        type: "error",
        text: "Formulation exceeded the maximum allowed steps (30) and was stopped to prevent an infinite loop."
      });
      if (io) {
        io.to(sessionId).emit("agent2:error", {
          message: "Agent exceeded max steps (30) to prevent infinite loop.",
          retryable: true
        });
      }
      break;
    }

    try {
      /* old code
      const response = await adapter.chat(systemPrompt, messages);
      capacityRetryCount = 0; // ??$$$ reset capacity retry count on successful response
      const text = response.text();
      const calls = response.functionCalls();
      */
      // ??$$$ newer code — Exponential backoff retry wrapper with Gemini fallback
      let response: LLMResponse | null = null;
      let lastError: any = null;
      const delays = [0, 2000, 5000];

      const sanitizedMessages = sanitizeMessageHistory(messages);

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          if (attempt > 1) {
            const delay = delays[attempt - 2] || 0;
            console.log(`[Agent2 Retry] Rate limit or error. Attempt ${attempt} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          if (attempt === 4 && !modelName.toLowerCase().includes("gemini")) {
            console.log(`[Agent2 Retry] Attempt 4: Groq failed. Falling back to Gemini 2.5 Flash...`);
            const geminiKey = process.env.GEMINI_API_KEY;
            if (geminiKey) {
              const fallbackAdapter = new GeminiAdapter(geminiKey);
              response = await fallbackAdapter.chat(systemPrompt, sanitizedMessages);
            } else {
              throw new Error("GEMINI_API_KEY is missing for fallback");
            }
          } else {
            response = await adapter.chat(systemPrompt, sanitizedMessages);
          }
          break; // Success!
        } catch (err: any) {
          console.error(`[Agent2 Retry] Attempt ${attempt} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (!response) {
        console.error(`[Agent2] All LLM chat attempts failed.`);
        await logAndEmit({
          type: "error",
          text: `All formulation chat attempts failed: ${lastError?.message || lastError}`
        });
        if (io) {
          io.to(sessionId).emit("agent2:error", {
            message: lastError?.message || "Failed to contact AI model after retries.",
            retryable: true
          });
        }
        break; // Stop formulation run
      }

      capacityRetryCount = 0; // reset capacity retry count on successful response
      const text = response.text();
      const calls = response.functionCalls();

      // Log thinking if present
      if (text) {
        console.log(`[Agent2 Debugger] LLM Text/Thinking response:\n${text}`);
        await logAndEmit({
          type: "thinking",
          text
        });
      }

      /* old code
      if (calls.length === 0) {
        // No tools called, agent is done
        console.log("[Agent2 Debugger] Formulation complete. No further tools called.");
        await logAndEmit({
          type: "decision",
          text: "Agent has finalized the project formulation."
        });
        break;
      }
      */

      // ??$$$ newer code — enforce complete formulation pipeline before exiting loop
      if (calls.length === 0) {
        // Reload session from DB to get latest state in case it updated in background/saveSessionProgress
        const updatedSession = await NewFlowSession.findById(sessionId);
        if (updatedSession) {
          session.bom = updatedSession.bom;
          session.wiring = updatedSession.wiring;
          session.milestones = updatedSession.milestones;
          session.diagram = updatedSession.diagram;
        }

        const hasBOM = session.bom && session.bom.length > 0;
        const hasWiring = session.wiring && session.wiring.length > 0;
        const hasMilestones = session.milestones && session.milestones.length > 0;
        const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;

        if (hasBOM && hasWiring && hasMilestones && hasDiagram) {
          console.log("[Agent2 Debugger] Formulation complete. No further tools called.");
          await logAndEmit({
            type: "decision",
            text: "Agent has finalized the project formulation."
          });
          formulationSuccessful = true; // ??$$$ newer code
          break;
        } else {
          console.log("[Agent2 Debugger] LLM returned no tool calls, but formulation is incomplete. Prompting to continue...");
          const missingSteps: string[] = [];
          if (!hasBOM) missingSteps.push("save the BOM using save_progress(type=\"bom\")");
          if (!hasWiring) missingSteps.push("generate and save the wiring using generate_wiring and save_progress(type=\"wiring\")");
          if (!hasMilestones) missingSteps.push("generate and save the milestones using generate_milestone and save_progress(type=\"milestone\")");
          if (!hasDiagram) missingSteps.push("generate and save the simulation diagram.json using generate_diagram_json and save_progress(type=\"diagram\")");

          // ??$$$ newer code: push placeholder assistant message to prevent consecutive user messages
          messages.push({
            role: "assistant",
            content: "Continuing with project formulation..."
          });

          messages.push({
            role: "user",
            content: `Formulation is NOT complete yet. You must still: ${missingSteps.join(", ")}. Please proceed to the next step.`
          });
          continue;
        }
      }

      console.log(`[Agent2 Debugger] LLM requested ${calls.length} tool calls.`);

      // We have tool calls
      const assistantMessage: any = {
        role: "assistant",
        content: text,
        functionCalls: calls.map(c => ({
          name: c.name,
          args: c.args,
          id: (c as any).id
        }))
      };
      messages.push(assistantMessage);

      // Execute each tool call
      for (const call of calls) {
        console.log(`[Agent2 Debugger] Executing tool "${call.name}" with args:`, JSON.stringify(call.args, null, 2));
        await logAndEmit({
          type: "tool_call",
          name: call.name,
          status: "running",
          input: call.args
        });

        let result: any;
        try {
          if (call.name === "save_progress") {
            result = await saveSessionProgress(sessionId, call.args.type, call.args.data);
          } else {
            result = await executeTool(call.name, call.args, sessionId);
          }

          console.log(`[Agent2 Debugger] Tool "${call.name}" executed successfully. Output snippet:`, JSON.stringify(result).substring(0, 200));

          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "done",
            output: result
          });
        } catch (toolErr: any) {
          console.error(`[Agent2 Debugger] Tool "${call.name}" execution failed:`, toolErr);
          result = { error: toolErr.message || "Execution error" };
          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "failed",
            output: result
          });
        }

        messages.push({
          role: "function",
          name: call.name,
          tool_call_id: (call as any).id,
          content: result
        });
      }
    } catch (err: any) {
      console.error("[Agent2 Debugger] Loop error occurred:", err);

      // ??$$$ newer code - check both rate limit (429) and over capacity (503) errors
      const isRateLimit = err.status === 429 ||
        err.message?.toLowerCase().includes("rate limit") ||
        err.error?.error?.message?.toLowerCase().includes("rate limit") ||
        err.error?.error?.code === "rate_limit_exceeded";

      const isCapacityLimit = err.status === 503 ||
        err.message?.toLowerCase().includes("over capacity") ||
        err.message?.toLowerCase().includes("capacity") ||
        err.error?.error?.message?.toLowerCase().includes("over capacity") ||
        err.error?.error?.message?.toLowerCase().includes("capacity");

      if (isRateLimit || isCapacityLimit) {
        let delaySeconds = 5;
        if (isRateLimit) {
          delaySeconds = getRateLimitDelay(err);
        } else {
          capacityRetryCount++;
          // Exponential backoff: 4s, 8s, 16s, 32s, 60s
          delaySeconds = Math.min(Math.pow(2, capacityRetryCount) * 2, 60);
        }

        console.warn(`[Agent2 Debugger] LLM service unavailable (${isRateLimit ? "Rate Limit" : "Capacity Limit"})! Rotating API key and waiting ${delaySeconds} seconds before retry...`);

        // 1. Rotate the key
        try {
          await rotationService.handleRateLimit();
        } catch (rotErr) {
          console.error("[Agent2 Debugger] Failed to rotate key:", rotErr);
        }

        // 2. Log and emit to frontend
        const errorTypeStr = isCapacityLimit ? "Capacity Limit" : "Rate Limit";
        await logAndEmit({
          type: "rate_limit" as any,
          text: `Groq ${errorTypeStr} Exceeded. Pausing formulation pipeline. Resuming automatically in ${Math.ceil(delaySeconds)} seconds (Attempt ${capacityRetryCount})...`,
          input: { delaySeconds }
        });

        // 3. Sleep
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

        // 4. Decrement turns and retry the current turn
        turns--;
        continue;
      }

      // If we reach here, it's a non-retryable error
      await logAndEmit({
        type: "error",
        text: `Error during agent loop: ${err.message || err}`
      });
      break;
    }
  }

  // ??$$$ newer code — if formulation was not successful, return early instead of creating incomplete projects
  if (!formulationSuccessful) {
    console.log(`[Agent2 Debugger] Formulation loop exited without completion. Session ${sessionId} remains in progress.`);
    return;
  }

  // Create real Project document on completion
  let projectId: any = null;
  try {
    console.log("[Agent2 Debugger] Formulating Project document creation...");
    const newProject = new Project({
      owner: session.owner,
      description: session.idea,
      isAgentic: true,
      stageStatus: {
        ideation: "done",
        components: "done",
        build: "ready",
        simulation: "locked",
        assembly: "locked",
        shopping: "locked"
      },
      ideation: {
        messages: session.qaHistory.map(q => ([
          { role: "model" as const, content: q.question, timestamp: q.timestamp },
          { role: "user" as const, content: q.answer, timestamp: q.timestamp }
        ])).flat(),
        brief: session.context.corePurpose,
        objective: session.context.corePurpose,
        compute: session.context.mcu,
        phases: {},
        constraints: session.context.constraints.join("\n"),
        open: session.context.openQuestions.join("\n"),
        readyForComponents: true,
        readyAt: new Date(),
        validatorApproved: true,
        validatorFeedback: "Approved by Agent 2 formulation.",
        validationAttempts: 1
      },
      // ??$$$ NEW FLOW — populate glbUrl from curated Part documents
      bom: await Promise.all(session.bom.map(async b => {
        // Look up Part to get glbUrl if isCurated
        let glbUrl = "";
        try {
          const partDoc = await Part.findOne({ mpn: b.mpn }).lean() as any;
          if (partDoc?.isCurated && partDoc?.glbUrl) {
            glbUrl = partDoc.glbUrl;
          }
        } catch (e) { /* non-blocking */ }

        return {
          key: b.key,
          wokwiPartType: b.partId,
          displayName: b.displayName,
          qty: b.qty,
          purpose: b.purpose,
          price: b.price || 0,
          storeUrl: "",
          mpn: b.mpn || "",
          partId: b.partId || "",
          pinConnections: b.pinConnections || [],
          glbUrl,
          pins: []
        };
      })),
      milestones: session.milestones.map((m, idx) => ({
        id: m.id,
        order: m.order || (idx + 1),
        title: m.title,
        objective: m.objective,
        componentsInvolved: m.partsInvolved,
        wiringInstructions: m.wiringInstructions,
        code: m.code,
        explanation: m.explanation,
        test: {
          expectedSerialOutput: m.expectedOutput,
          passCondition: m.passCondition,
          commonProblems: m.commonProblems
        },
        status: idx === 0 ? ("ready" as const) : ("locked" as const),
        userConfirmed: false,
        userNotes: "",
        compiledHex: "",
        compilationErrors: [],
        serialOutput: "",
        completedAt: null,
        simulatable: m.simulatable,
        dependsOn: idx === 0 ? [] : [session.milestones[idx - 1].id],
        debugMessages: [],
        requiredLibraries: m.requiredLibraries || []
      })),
      milestonesGenerated: true,
      activeMilestoneId: session.milestones[0]?.id || "",
      // ??$$$ newer code — map session.diagram (Wokwi format) to Project diagram field
      diagram: session.diagram || session.wiring
    });

    await newProject.save();
    projectId = newProject._id;
    console.log(`[Agent2 Debugger] Created project document successfully: ${projectId}`);
  } catch (err: any) {
    console.error("[Agent2 Debugger] Failed to create project document from session:", err);
  }

  /* old code
  session.projectId = projectId;
  session.phase2Complete = true;
  await session.save();
  */
  // ??$$$ newer code - load fresh session document to save completion status and avoid VersionError
  const freshSession = await NewFlowSession.findById(sessionId);
  if (freshSession) {
    freshSession.projectId = projectId;
    freshSession.phase2Complete = true;
    await freshSession.save();

    // ??$$$ newer code — Automatically save/export formulation files on completion so virtual playground can load them
    try {
      const exportDir = path.join("E:", "wireup_formulation_exports", `session_${sessionId}`);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");

      // ??$$$ old code
      /*
      const byOrder = [...(session.milestones || [])].sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0));
      const firstCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
      const sketchCode = firstCodeMilestone?.code
        || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
      */
      // ??$$$ newer code
      const byOrder = [...(session.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0));
      const latestCodeMilestone = byOrder.find((m: any) => String(m?.code || "").trim().length > 0);
      const sketchCode = latestCodeMilestone?.code
        || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
      fs.writeFileSync(path.join(exportDir, "sketch.ino"), sketchCode, "utf8");

      // Also write a sketch.json wrapper containing code, as expected by the compilation service
      fs.writeFileSync(path.join(exportDir, "sketch.json"), JSON.stringify({
        code: sketchCode,
        filename: "sketch.ino"
      }, null, 2), "utf8");
      
      console.log(`[Agent2 Debugger] Automatically exported formulation files to ${exportDir}`);
    } catch (err: any) {
      console.error("[Agent2 Debugger] Automatic file export failed:", err);
    }
  }

  if (io) {
    io.to(sessionId).emit("agent2:complete", { success: true, projectId });
  }
  console.log(`[Agent2 Debugger] Loop execution finished for session: ${sessionId}`);

  // ??$$$ NEW FLOW — resolve SnapEDA pin metadata in background (non-blocking)
  // Runs after agent2:complete is already emitted — frontend updates live via pins:ready events
  if (projectId && session.bom && session.bom.length > 0) {
    const bomForPins = session.bom
      .filter((b: any) => b.mpn)
      .map((b: any) => ({ mpn: b.mpn, key: b.key }));
    const ioRef = (global as any).io;
    resolveAllPins(bomForPins, String(projectId), ioRef).catch((err: any) => {
      console.error("[Agent2] resolveAllPins background error:", err.message);
    });
  }
}
