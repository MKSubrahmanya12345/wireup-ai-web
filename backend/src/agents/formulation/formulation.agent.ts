// ??$$$
import * as fs from "fs";
import * as path from "path";
import NewFlowSession from "../../models/newFlowSession.model";
import Project from "../../models/project.model";
import Part from "../../models/part.model";
import { executeTool } from "./tools/index";
import { saveSessionProgress } from "./formulation.persistence";
import { SYSTEM_PROMPT, buildInitialPrompt } from "./formulation.prompts";
import { resolveAllPins } from "../../services/pinResolver.service";
import rotationService from "../../services/keyRotation.service";
import {
  LLMAdapter,
  LLMResponse,
  GeminiAdapter,
  GroqAdapter,
  CerebrasAdapter,
  OllamaAdapter,
  getOllamaModel
} from "../shared/adapters";

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

  return 60;
}

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

  const processed = JSON.parse(JSON.stringify(sanitized));
  const nameCounters: Record<string, number> = {};
  let pendingToolCalls: { name: string; assignedId: string }[] = [];

  for (let i = 0; i < processed.length; i++) {
    const msg = processed[i];

    if (msg.role === "assistant" || msg.role === "model") {
      if (msg.functionCalls && msg.functionCalls.length > 0) {
        pendingToolCalls = [];
        msg.functionCalls.forEach((fc: any) => {
          if (!nameCounters[fc.name]) {
            nameCounters[fc.name] = 0;
          }
          if (!fc.id) {
            fc.id = `call_${fc.name}_${nameCounters[fc.name]++}`;
          }
          pendingToolCalls.push({ name: fc.name, assignedId: fc.id });
        });
      }
    } else if (msg.role === "function") {
      const matchIndex = pendingToolCalls.findIndex(tc => tc.name === msg.name);
      if (matchIndex > -1) {
        msg.tool_call_id = pendingToolCalls[matchIndex].assignedId;
        pendingToolCalls.splice(matchIndex, 1);
      } else {
        if (!nameCounters[msg.name]) {
          nameCounters[msg.name] = 0;
        }
        if (!msg.tool_call_id) {
          msg.tool_call_id = `call_${msg.name}_${nameCounters[msg.name]++}`;
        }
      }
    }
  }

  return processed;
}

export async function runAgent2(sessionId: string, modelName: string, isResume = false, isRescue = false) {
  let session = await NewFlowSession.findById(sessionId);
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
    const freshSession = await NewFlowSession.findById(sessionId);
    if (freshSession) {
      freshSession.agentLog.push(logItem);
      await freshSession.save();
      session!.agentLog = freshSession.agentLog;
      session!.bom = freshSession.bom;
      session!.wiring = freshSession.wiring;
      session!.milestones = freshSession.milestones;
      session!.diagram = freshSession.diagram;
      (session as any).__v = freshSession.__v;
    }

    if (io) {
      io.to(sessionId).emit("agent2:log", logItem);
    }
  };

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

  const systemPrompt = SYSTEM_PROMPT;
  const initialPrompt = buildInitialPrompt(session, isResume);

  const messages: any[] = [
    { role: "user", content: initialPrompt }
  ];

  let adapter: LLMAdapter;
  const isHybridMode = modelName.startsWith("hybrid:");
  const isPureOllama = !isRescue && modelName.toLowerCase().startsWith("ollama");
  const hybridPrimaryModel = isHybridMode ? modelName.substring("hybrid:".length) : "";

  if (isRescue) {
    const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_FALLBACK;
    if (groqKey) {
      adapter = new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct", groqKey);
      console.log(`[Agent2] Mode: API Rescue. Primary: Groq (meta-llama/llama-4-scout-17b-16e-instruct).`);
    } else if (process.env.CEREBRAS_API_KEY) {
      adapter = new CerebrasAdapter(process.env.CEREBRAS_API_KEY, "gpt-oss-120b");
      console.log(`[Agent2] Mode: API Rescue. Primary: Cerebras (gpt-oss-120b).`);
    } else if (process.env.GEMINI_API_KEY) {
      adapter = new GeminiAdapter(process.env.GEMINI_API_KEY);
      console.log(`[Agent2] Mode: API Rescue. Primary: Gemini.`);
    } else {
      throw new Error("No API keys found for API Rescue.");
    }
  } else if (isPureOllama) {
    const localModel = modelName.includes("/") ? modelName.split("/")[1] : (modelName.substring(7) || "minimax-m3:cloud");
    adapter = new OllamaAdapter(localModel);
    console.log(`[Agent2] Mode: Pure Ollama (${localModel}). No cloud fallbacks.`);
  } else if (isHybridMode) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY is missing for hybrid mode");
    const primaryGroqModel = hybridPrimaryModel.includes("qwen") ? "qwen/qwen3-32b" : "meta-llama/llama-4-scout-17b-16e-instruct";
    adapter = new GroqAdapter(primaryGroqModel, groqKey);
    console.log(`[Agent2] Mode: Hybrid. Primary: Groq (${primaryGroqModel}). Chain: Groq KEY -> Groq FALLBACK -> Cerebras -> OllamaAdapter MiniMax-M3`);
  } else if (modelName.toLowerCase().includes("gemini")) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing");
    adapter = new GeminiAdapter(geminiKey);
  } else if (modelName.toLowerCase().includes("gpt-oss") || modelName.toLowerCase().includes("zai-glm") || modelName.toLowerCase().includes("cerebras")) {
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!cerebrasKey) throw new Error("CEREBRAS_API_KEY is missing in env");
    const actualModel = modelName.includes("zai-glm") ? "zai-glm-4.7" : "gpt-oss-120b";
    adapter = new CerebrasAdapter(cerebrasKey, actualModel);
  } else {
    let actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
    }
    adapter = new GroqAdapter(actualModel);
  }

  let turns = 0;
  const maxTurns = 30;
  let capacityRetryCount = 0;
  let formulationSuccessful = false;

  while (turns < maxTurns) {
    turns++;
    console.log(`[Agent2 Debugger] Starting turn ${turns}...`);
    console.log(`[Agent2 Debugger] Current message history length: ${messages.length}`);

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
      let response: LLMResponse | null = null;
      let lastError: any = null;
      const sanitizedMessages = sanitizeMessageHistory(messages);

      let fallbackAdapters: LLMAdapter[];

      if (isRescue) {
        const groqKey = process.env.GROQ_API_KEY;
        const groqFallback = process.env.GROQ_API_FALLBACK;
        const groqKey3 = process.env.GROQ_API_KEY_3;
        const cerebrasKey = process.env.CEREBRAS_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        fallbackAdapters = [];
        if (groqKey) {
          fallbackAdapters.push(new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct", groqKey));
        }
        if (groqFallback && groqFallback !== groqKey) {
          fallbackAdapters.push(new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct", groqFallback));
        }
        if (groqKey3 && groqKey3 !== groqFallback && groqKey3 !== groqKey) {
          fallbackAdapters.push(new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct", groqKey3));
        }
        if (cerebrasKey) {
          fallbackAdapters.push(new CerebrasAdapter(cerebrasKey, "gpt-oss-120b"));
        }
        if (geminiKey) {
          fallbackAdapters.push(new GeminiAdapter(geminiKey));
        }
        console.log(`[Agent2 Rescue] Active API Rescue chain: ${fallbackAdapters.map(a => a.constructor.name).join(" -> ")}`);
      } else if (isPureOllama) {
        fallbackAdapters = [adapter];
        console.log("[Agent2 Failover] Pure Ollama mode — no cloud fallbacks.");
      } else if (isHybridMode) {
        const groqKey = process.env.GROQ_API_KEY;
        const groqFallback = process.env.GROQ_API_FALLBACK;
        const cerebrasKey = process.env.CEREBRAS_API_KEY;
        const primaryGroqModel = hybridPrimaryModel.includes("qwen") ? "qwen/qwen3-32b" : "meta-llama/llama-4-scout-17b-16e-instruct";

        fallbackAdapters = [adapter];
        if (groqFallback && groqFallback !== groqKey) {
          fallbackAdapters.push(new GroqAdapter(primaryGroqModel, groqFallback));
        }
        if (cerebrasKey) {
          fallbackAdapters.push(new CerebrasAdapter(cerebrasKey, "gpt-oss-120b"));
        }
        fallbackAdapters.push(new OllamaAdapter("minimax-m3:cloud"));
        console.log(`[Agent2 Failover] Hybrid chain built: ${fallbackAdapters.map(a => a.constructor.name).join(" -> ")}`);
      } else {
        fallbackAdapters = [adapter];
        if (process.env.GEMINI_API_KEY && !fallbackAdapters.some(a => a.constructor.name === "GeminiAdapter")) {
          fallbackAdapters.push(new GeminiAdapter(process.env.GEMINI_API_KEY));
        }
        const hasGroqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3;
        if (hasGroqKey && !fallbackAdapters.some(a => a.constructor.name === "GroqAdapter")) {
          fallbackAdapters.push(new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct"));
        }
        if (process.env.CEREBRAS_API_KEY && !fallbackAdapters.some(a => a.constructor.name === "CerebrasAdapter")) {
          fallbackAdapters.push(new CerebrasAdapter(process.env.CEREBRAS_API_KEY, "gpt-oss-120b"));
        }
      }

      for (let i = 0; i < fallbackAdapters.length; i++) {
        const currentTryAdapter = fallbackAdapters[i];
        const providerName = currentTryAdapter.constructor.name;

        try {
          console.log(`[Agent2 Failover] Turn ${turns}: Attempting with ${providerName}...`);
          if (i > 0) {
            await logAndEmit({
              type: "rate_limit",
              text: `Active provider rate-limited or failed. Rotating to fallback provider: ${providerName}.`
            });
          }

          response = await currentTryAdapter.chat(systemPrompt, sanitizedMessages);

          if (currentTryAdapter !== adapter) {
            console.log(`[Agent2 Failover] Successfully failed over. Promoting ${providerName} to primary.`);
            adapter = currentTryAdapter;

            let newModelValue = "gemini-2.5-flash";
            if (providerName === "CerebrasAdapter") {
              newModelValue = (currentTryAdapter as any).model || "gpt-oss-120b";
            } else if (providerName === "GroqAdapter") {
              newModelValue = (currentTryAdapter as any).model || "meta-llama/llama-4-scout-17b-16e-instruct";
            }

            if (io) {
              console.log(`[Agent2 Failover] Emitting model changed event to frontend: ${newModelValue}`);
              io.to(sessionId).emit("agent2:model_changed", {
                model: newModelValue
              });
            }
          }
          break;
        } catch (err: any) {
          console.error(`[Agent2 Failover] ${providerName} attempt failed:`, err.message || err);
          lastError = err;
          await new Promise(resolve => setTimeout(resolve, 1500));
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
        break;
      }

      capacityRetryCount = 0;
      const text = response.text();
      const calls = response.functionCalls();

      if (text) {
        console.log(`[Agent2 Debugger] LLM Text/Thinking response:\n${text}`);
        await logAndEmit({
          type: "thinking",
          text
        });
      }

      if (calls.length === 0) {
        const updatedSession = await NewFlowSession.findById(sessionId);
        if (updatedSession) {
          session!.bom = updatedSession.bom;
          session!.wiring = updatedSession.wiring;
          session!.milestones = updatedSession.milestones;
          session!.diagram = updatedSession.diagram;
          session!.finalSketch = updatedSession.finalSketch;
        }

        const hasBOM = session!.bom && session!.bom.length > 0;
        const hasWiring = session!.wiring && session!.wiring.length > 0;
        const hasMilestones = session!.milestones && session!.milestones.length > 0;
        const hasDiagram = session!.diagram && Object.keys(session!.diagram).length > 0;

        if (hasBOM && hasWiring && hasMilestones && hasDiagram) {
          const milestonesWithoutCode = session!.milestones?.filter(
            (m: any) => !m.code || m.code.trim().length === 0
          );

          if (milestonesWithoutCode && milestonesWithoutCode.length > 0) {
            console.log(`[Agent2 Debugger] BOM, wiring, milestones, and diagram exist, but ${milestonesWithoutCode.length} milestones lack code. Prompting code generation...`);
            messages.push({ role: "assistant", content: text || "Continuing..." });
            messages.push({
              role: "user",
              content: `Code generation is incomplete. The following milestones still need code generated via generate_milestone:\n${milestonesWithoutCode.map((m: any) => `- Milestone ${m.order}: "${m.title}" (subsystem: ${m.subsystem})`).join("\n")
                }\nPlease call generate_milestone for each of these now, in order.`
            });
            continue;
          }

          const hasFinalSketch = session!.finalSketch && session!.finalSketch.trim().length > 0;
          if (!hasFinalSketch) {
            console.log("[Agent2 Debugger] All milestones have code, but final integrated sketch is missing. Generating final integrated sketch directly...");
            await logAndEmit({
              type: "thinking",
              text: "All milestones have code. Generating final integrated sketch directly to optimize token usage..."
            });
            const sketchResult = await executeTool("generate_final_sketch", {
              objective: session!.context?.corePurpose || session!.idea || "",
              mcu: session!.context?.mcu || "Arduino Uno",
              allMilestones: session!.milestones,
              bom: session!.bom,
              wiring: session!.wiring
            }, sessionId);

            if (sketchResult?.success) {
              console.log("[Agent2 Debugger] Direct final sketch generation succeeded.");
              formulationSuccessful = true;
              break;
            } else {
              console.error("[Agent2 Debugger] Direct final sketch generation failed:", sketchResult?.error);
              messages.push({ role: "assistant", content: text || "Continuing..." });
              messages.push({
                role: "user",
                content: `Direct final sketch generation failed: ${sketchResult?.error || "Unknown error"}. Please retry or fix.`
              });
              continue;
            }
          }

          console.log("[Agent2 Debugger] Formulation complete. No further tools called.");
          await logAndEmit({
            type: "decision",
            text: "Agent has finalized the project formulation."
          });
          formulationSuccessful = true;
          break;
        } else {
          console.log("[Agent2 Debugger] LLM returned no tool calls, but formulation is incomplete. Prompting to continue...");
          const missingSteps: string[] = [];
          if (!hasBOM) missingSteps.push("save the BOM using save_progress(type=\"bom\")");
          if (!hasWiring) missingSteps.push("generate and save the wiring using generate_wiring and save_progress(type=\"wiring\")");
          if (!hasMilestones) missingSteps.push("generate and save the milestones using generate_milestone and save_progress(type=\"milestone\")");
          if (!hasDiagram) missingSteps.push("generate and save the simulation diagram.json using generate_diagram_json and save_progress(type=\"diagram\")");

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
          delaySeconds = Math.min(Math.pow(2, capacityRetryCount) * 2, 60);
        }

        console.warn(`[Agent2 Debugger] LLM service unavailable (${isRateLimit ? "Rate Limit" : "Capacity Limit"})! Rotating API key and waiting ${delaySeconds} seconds before retry...`);

        try {
          await rotationService.handleRateLimit();
        } catch (rotErr) {
          console.error("[Agent2 Debugger] Failed to rotate key:", rotErr);
        }

        const errorTypeStr = isCapacityLimit ? "Capacity Limit" : "Rate Limit";
        await logAndEmit({
          type: "rate_limit" as any,
          text: `Groq ${errorTypeStr} Exceeded. Pausing formulation pipeline. Resuming automatically in ${Math.ceil(delaySeconds)} seconds (Attempt ${capacityRetryCount})...`,
          input: { delaySeconds }
        });

        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

        turns--;
        continue;
      }

      await logAndEmit({
        type: "error",
        text: `Error during agent loop: ${err.message || err}`
      });
      break;
    }
  }

  if (!formulationSuccessful) {
    console.log(`[Agent2 Debugger] Formulation loop exited without completion. Session ${sessionId} remains in progress.`);
    return;
  }

  let projectId: any = null;
  try {
    const freshSessionForProject = await NewFlowSession.findById(sessionId);
    if (freshSessionForProject) {
      session = freshSessionForProject;
    }

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
      bom: await Promise.all(session.bom.map(async b => {
        let glbUrl = "";
        let componentType = b.type || "module";
        try {
          const partDoc = await Part.findOne({ mpn: b.mpn }).lean() as any;
          if (partDoc) {
            if (partDoc.isCurated && partDoc.glbUrl) {
              glbUrl = partDoc.glbUrl;
            }
            if (partDoc.componentType) {
              componentType = partDoc.componentType;
            }
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
          pins: [],
          type: componentType
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
        dependsOn: idx === 0 ? [] : [session!.milestones[idx - 1].id],
        debugMessages: [],
        requiredLibraries: m.requiredLibraries || []
      })),

      milestonesGenerated: true,
      activeMilestoneId: session!.milestones[0]?.id || "",
      diagram: session!.diagram || session!.wiring,
      wiring: session!.wiring || [],
      sketch: session.finalSketch || "",
      derivedDependencies: session.derivedDependencies || []
    });

    await newProject.save();
    projectId = newProject._id;
    console.log(`[Agent2 Debugger] Created project document successfully: ${projectId}`);
  } catch (err: any) {
    console.error("[Agent2 Debugger] Failed to create project document from session:", err);
  }

  const freshSession = await NewFlowSession.findById(sessionId);
  if (freshSession) {
    freshSession.projectId = projectId;
    freshSession.phase2Complete = true;
    await freshSession.save();

    try {
      const exportDir = path.join("E:", "wireup_formulation_exports", `session_${sessionId}`);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session!.bom || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session!.wiring || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session!.milestones || [], null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session!.diagram || {}, null, 2), "utf8");
      fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session!.context || {}, null, 2), "utf8");

      const sketchCode = session!.finalSketch || (
        [...(session!.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0))
          .find((m: any) => String(m?.code || "").trim().length > 0)?.code
      ) || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";
      fs.writeFileSync(path.join(exportDir, "sketch.ino"), sketchCode, "utf8");

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
    io.to(sessionId).emit("agent2:complete", {
      success: true,
      projectId,
      finalSketch: session!.finalSketch
    });
  }
  console.log(`[Agent2 Debugger] Loop execution finished for session: ${sessionId}`);

  if (projectId && session!.bom && session!.bom.length > 0) {
    const bomForPins = session!.bom
      .filter((b: any) => b.mpn)
      .map((b: any) => ({ mpn: b.mpn, key: b.key }));
    const ioRef = (global as any).io;
    resolveAllPins(bomForPins, String(projectId), ioRef).catch((err: any) => {
      console.error("[Agent2] resolveAllPins background error:", err.message);
    });
  }
}
