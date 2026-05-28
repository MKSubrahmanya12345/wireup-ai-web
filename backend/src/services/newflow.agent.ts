// ??$$$ NEW FLOW
import mongoose from "mongoose";
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

// Intercept and implement save_progress for NewFlowSession
async function saveSessionProgress(sessionId: string, type: string, data: any) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error("NewFlowSession not found");
  }

  let parsedData = data;
  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      console.error("[Agent2] Failed to parse stringified progress data:", e);
    }
  }

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
    let actualModel = "qwen/qwen3-32b";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
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

// ??$$$ NEW FLOW
export async function runAgent2(sessionId: string, modelName: string) {
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
    session.agentLog.push(logItem);
    await session.save();

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
    text: "AI Received Project Formulation Context.",
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
    let actualModel = "qwen/qwen3-32b";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
    }
    adapter = new GroqAdapter(actualModel);
  }

  let turns = 0;
  const maxTurns = 20;

  while (turns < maxTurns) {
    turns++;
    console.log(`[Agent2 Debugger] Starting turn ${turns}...`);
    console.log(`[Agent2 Debugger] Current message history length: ${messages.length}`);

    try {
      const response = await adapter.chat(systemPrompt, messages);
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

      if (calls.length === 0) {
        // No tools called, agent is done
        console.log("[Agent2 Debugger] Formulation complete. No further tools called.");
        await logAndEmit({
          type: "decision",
          text: "Agent has finalized the project formulation."
        });
        break;
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

      // ??$$$ newer code
      const isRateLimit = err.status === 429 ||
        err.message?.toLowerCase().includes("rate limit") ||
        err.error?.error?.message?.toLowerCase().includes("rate limit") ||
        err.error?.error?.code === "rate_limit_exceeded";

      if (isRateLimit) {
        const delaySeconds = getRateLimitDelay(err);
        console.warn(`[Agent2 Debugger] Rate limit hit! Rotating API key and waiting ${delaySeconds} seconds before retry...`);

        // 1. Rotate the key
        await rotationService.handleRateLimit();

        // 2. Log and emit "rate_limit" event to frontend
        await logAndEmit({
          type: "rate_limit" as any,
          text: `Groq Rate Limit Exceeded. Pausing formulation pipeline. Resuming automatically in ${Math.ceil(delaySeconds)} seconds...`,
          input: { delaySeconds }
        });

        // 3. Sleep
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

        // 4. Decrement turns and retry the current turn
        turns--;
        continue;
      }

      /* old code
      await logAndEmit({
        type: "error",
        text: `Error during agent loop: ${err.message || err}`
      });
      break;
      */

      // ??$$$ newer code
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

  session.projectId = projectId;
  session.phase2Complete = true;
  await session.save();

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
