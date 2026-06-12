// ??$$$
import * as fs from "fs";
import * as path from "path";
import NewFlowSession from "../../models/newFlowSession.model";
import Project from "../../models/project.model";
import Part from "../../models/part.model";
import { executeTool } from "./tools/index";
/* old code
import { saveSessionProgress } from "./formulation.persistence";
*/
// ??$$$ newer code
import { saveSessionProgress, determineActivePhase } from "./formulation.persistence";
import { SYSTEM_PROMPT, buildInitialPrompt } from "./formulation.prompts";
import { resolveAllPins } from "../../services/pinResolver.service";
// ??$$$ newer code
import { runArchitect } from "../architect";
import rotationService from "../../services/keyRotation.service";
// ??$$$ newer code
import { providerCooldowns } from "./tools/utils";
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


// ??$$$ newer code - Highly optimized context & token manager for local Ollama and Cloud LLMs to prevent rate limits, loops, and context overflows

// ??$$$ newer code - Highly optimized context & token manager that deletes redundant intermediate messages of completed phases
function sanitizeMessageHistory(messages: any[], session?: any): any[] {
  const isBomSaved = session?.bom && session.bom.length > 0;
  const isWiringSaved = session?.wiring && session.wiring.length > 0;
  const isMilestonesDone = session?.milestones && session.milestones.length > 0 && session.milestones.every((m: any) => m.code && m.code.trim().length > 0);
  const isDiagramSaved = session?.diagram && Object.keys(session.diagram).length > 0;

  const toolsToPrune = new Set<string>();
  if (isBomSaved) {
    ["search_library", "search_datasheet", "get_part_details", "select_compute", "check_compatibility"].forEach(t => toolsToPrune.add(t));
  }
  if (isWiringSaved) {
    ["generate_wiring", "validate_pin_assignment", "estimate_power_budget"].forEach(t => toolsToPrune.add(t));
  }
  if (isMilestonesDone) {
    ["generate_milestone"].forEach(t => toolsToPrune.add(t));
  }
  if (isDiagramSaved) {
    ["generate_diagram_json", "get_wokwi_part_type", "check_simulation_support"].forEach(t => toolsToPrune.add(t));
  }

  // Find the index of the latest save_progress of each type
  const latestSaveIdx: Record<string, number> = {};
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if ((msg.role === "assistant" || msg.role === "model") && msg.functionCalls) {
      for (const fc of msg.functionCalls) {
        if (fc.name === "save_progress" && fc.args?.type) {
          if (latestSaveIdx[fc.args.type] === undefined) {
            latestSaveIdx[fc.args.type] = i;
          }
        }
      }
    }
  }

  const pruned: any[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip intermediate functions belonging to completed phases
    if (msg.role === "function" && msg.name && toolsToPrune.has(msg.name)) {
      continue;
    }

    if (msg.role === "assistant" || msg.role === "model") {
      const newFc = (msg.functionCalls || []).filter((fc: any) => {
        if (toolsToPrune.has(fc.name)) return false;
        if (fc.name === "save_progress" && fc.args?.type) {
          if (latestSaveIdx[fc.args.type] !== undefined && latestSaveIdx[fc.args.type] > i) {
            return false;
          }
        }
        return true;
      });

      if ((msg.content && msg.content.trim().length > 0) || newFc.length > 0) {
        pruned.push({
          ...msg,
          functionCalls: newFc.length > 0 ? newFc : undefined
        });
      }
      continue;
    }

    pruned.push(msg);
  }

  // Alternating role sanitization (merging consecutive roles)
  const finalMessages: any[] = [];
  for (const msg of pruned) {
    // ??$$$ newer code - Compact initial prompt if we are past turn 1
    let currentMsg = msg;
    if (finalMessages.length === 0 && msg.role === "user" && messages.length > 1 && session) {
      currentMsg = {
        ...msg,
        content: buildInitialPrompt(session, false, true)
      };
    }

    if (finalMessages.length > 0) {
      const lastMsg = finalMessages[finalMessages.length - 1];
      const lastRole = (lastMsg.role === "assistant" || lastMsg.role === "model") ? "model" : lastMsg.role;
      const currentRole = (currentMsg.role === "assistant" || currentMsg.role === "model") ? "model" : currentMsg.role;

      if (lastRole === currentRole) {
        // ??$$$ newer code - Merge instead of injecting synthetic messages
        lastMsg.content = `${lastMsg.content || ""}\n${currentMsg.content || ""}`.trim();
        if (currentMsg.functionCalls && currentMsg.functionCalls.length > 0) {
          lastMsg.functionCalls = [
            ...(lastMsg.functionCalls || []),
            ...currentMsg.functionCalls
          ];
        }
        continue;
      }
    }
    finalMessages.push(currentMsg);
  }

  // Restore/reassign tool call IDs
  const nameCounters: Record<string, number> = {};
  let pendingToolCalls: { name: string; assignedId: string }[] = [];

  for (let i = 0; i < finalMessages.length; i++) {
    const msg = finalMessages[i];
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
      if (msg.tool_call_id) {
        const matchIndex = pendingToolCalls.findIndex(tc => tc.assignedId === msg.tool_call_id);
        if (matchIndex > -1) {
          pendingToolCalls.splice(matchIndex, 1);
        }
      } else {
        const matchIndex = pendingToolCalls.findIndex(tc => tc.name === msg.name);
        if (matchIndex > -1) {
          msg.tool_call_id = pendingToolCalls[matchIndex].assignedId;
          pendingToolCalls.splice(matchIndex, 1);
        } else {
          if (!nameCounters[msg.name]) {
            nameCounters[msg.name] = 0;
          }
          msg.tool_call_id = `call_${msg.name}_${nameCounters[msg.name]++}`;
        }
      }
    }
  }

  return finalMessages;
}

// ??$$$ newer code - per-session execution lock
const activeSessions = new Set<string>();

export async function runAgent2(sessionId: string, modelName: string, isResume = false, isRescue = false) {
  // ??$$$ newer code - prevent concurrent overlapping loops for the same sessionId
  if (activeSessions.has(sessionId)) {
    console.warn(`[Agent2] Session ${sessionId} already has an active agent execution loop. Ignoring duplicate run request.`);
    return;
  }
  activeSessions.add(sessionId);

  try {
    let session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const io = (global as any).io;
  const callHistory: { name: string; argsStr: string }[] = [];

  const logAndEmit = async (logObj: {
    type: "thinking" | "tool_call" | "decision" | "error" | "context_received" | "rate_limit";
    name?: string;
    status?: "running" | "done" | "failed";
    input?: any;
    output?: any;
    text?: string;
    usage?: any; // ??$$$ newer code
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
      requirementsDoc: session.requirementsDoc || session.idea
    }
  });

  // Architect step: generate blueprint once, before formulation begins.
  // ??$$$ newer code
  if (!session.blueprint || Object.keys(session.blueprint || {}).length === 0) {
    try {
      const docForArchitect = session.requirementsDoc && session.requirementsDoc.trim().length > 0
        ? session.requirementsDoc
        : (session.idea || "");
      const blueprint = await runArchitect(docForArchitect);
      // ??$$$ newer code
      await NewFlowSession.updateOne({ _id: sessionId }, { $set: { blueprint } });
      session.blueprint = blueprint;
      await logAndEmit({
        type: "context_received",
        text: "Architect produced the system blueprint.",
        output: blueprint
      });
      if (io) {
        io.to(sessionId).emit("agent2:blueprint", { blueprint });
      }
    } catch (err: any) {
      await logAndEmit({
        type: "error",
        text: `Architect step failed: ${err.message || err}`
      });
    }
  }

  const systemPrompt = SYSTEM_PROMPT;
  // ??$$$ newer code
  const PHASE_TOOLS: Record<string, string[]> = {
    bom: ["select_compute", "search_library", "get_part_details", "check_compatibility", "search_datasheet", "save_progress"],
    wiring: ["generate_wiring", "validate_pin_assignment", "save_progress"],
    milestone: ["generate_milestone", "save_progress"],
    diagram: ["get_wokwi_part_type", "check_simulation_support", "generate_diagram_json", "save_progress"],
    firmware: ["generate_final_sketch"]
  };
  const initialPrompt = buildInitialPrompt(session, isResume);

  // ??$$$ newer code
  let messages: any[] = [];
  if (isResume && session.chatHistory && session.chatHistory.length > 0) {
    messages = [...session.chatHistory];
    if (messages[0] && messages[0].role === "user") {
      messages[0].content = initialPrompt;
    }
    console.log(`[Agent2] Rehydrated ${messages.length} messages and refreshed initial prompt.`);
  } else {
    messages = [
      { role: "user", content: initialPrompt }
    ];
  }

  let adapter: LLMAdapter;
  const isHybridMode = modelName.startsWith("hybrid:");
  const isPureOllama = !isRescue && modelName.toLowerCase().startsWith("ollama");
  const hybridPrimaryModel = isHybridMode ? modelName.substring("hybrid:".length) : "";

  if (isRescue) {
    const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_FALLBACK;
    if (groqKey) {
      adapter = new GroqAdapter("qwen/qwen3-32b", groqKey);
      console.log(`[Agent2] Mode: API Rescue. Primary: Groq (qwen/qwen3-32b).`);
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
    const primaryGroqModel = hybridPrimaryModel.includes("qwen") ? "qwen/qwen3-32b" : "qwen/qwen3-32b";
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
    // ??$$$ newer code - support Groq Llama 4 Scout and other models
    let actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
    } else if (modelName.toLowerCase().includes("llama-4-scout") || modelName.toLowerCase().includes("llama")) {
      actualModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    } else {
      actualModel = modelName;
    }
    adapter = new GroqAdapter(actualModel);
  }

  let turns = 0;
  const maxTurns = 30;
  let capacityRetryCount = 0;
  let formulationSuccessful = false;

  while (turns < maxTurns) {
    turns++;
    // ??$$$ newer code - pace turns faster (1s instead of 3s)
    await new Promise(resolve => setTimeout(resolve, 1000));
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
      // ??$$$ newer code - pass the session object to sanitizeMessageHistory for aggressive phase-based pruning
      const sanitizedMessages = sanitizeMessageHistory(messages, session);

      let fallbackAdapters: LLMAdapter[];

      if (isRescue) {
        const groqKey = process.env.GROQ_API_KEY;
        const groqFallback = process.env.GROQ_API_FALLBACK;
        const groqKey3 = process.env.GROQ_API_KEY_3;
        const cerebrasKey = process.env.CEREBRAS_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        fallbackAdapters = [];
        if (groqKey) {
          fallbackAdapters.push(new GroqAdapter("qwen/qwen3-32b", groqKey));
        }
        if (groqFallback && groqFallback !== groqKey) {
          fallbackAdapters.push(new GroqAdapter("qwen/qwen3-32b", groqFallback));
        }
        if (groqKey3 && groqKey3 !== groqFallback && groqKey3 !== groqKey) {
          fallbackAdapters.push(new GroqAdapter("qwen/qwen3-32b", groqKey3));
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
        const primaryGroqModel = hybridPrimaryModel.includes("qwen") ? "qwen/qwen3-32b" : "qwen/qwen3-32b";

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
          // ??$$$ newer code
          fallbackAdapters.push(new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct"));
        }
        if (process.env.CEREBRAS_API_KEY && !fallbackAdapters.some(a => a.constructor.name === "CerebrasAdapter")) {
          fallbackAdapters.push(new CerebrasAdapter(process.env.CEREBRAS_API_KEY, "gpt-oss-120b"));
        }
        // ??$$$ newer code - always fallback to local Ollama at the end of the chain
        try {
          const localModel = (await getOllamaModel()) || "qwen2.5:3b";
          fallbackAdapters.push(new OllamaAdapter(localModel));
        } catch (e) {
          fallbackAdapters.push(new OllamaAdapter("qwen2.5:3b"));
        }
      }

      for (let i = 0; i < fallbackAdapters.length; i++) {
        const currentTryAdapter = fallbackAdapters[i];
        const providerName = currentTryAdapter.constructor.name;

        // ??$$$ newer code - skip cooling providers
        let providerType = "ollama";
        if (providerName === "GroqAdapter") providerType = "groq";
        else if (providerName === "GeminiAdapter") providerType = "gemini";
        else if (providerName === "CerebrasAdapter") providerType = "cerebras";

        const cooldownUntil = providerCooldowns.get(providerType) || 0;
        if (cooldownUntil > Date.now()) {
          console.log(`[Agent2 Failover] Skipping fallback provider ${providerName} due to active cooldown (remains: ${Math.round((cooldownUntil - Date.now()) / 1000)}s)`);
          continue;
        }

        try {
          console.log(`[Agent2 Failover] Turn ${turns}: Attempting with ${providerName}...`);
          if (i > 0) {
            await logAndEmit({
              type: "rate_limit",
              text: `Active provider rate-limited or failed. Rotating to fallback provider: ${providerName}.`
            });
          }

          // ??$$$ newer code
          const activePhase = determineActivePhase(session);
          const activeToolNames = PHASE_TOOLS[activePhase] || [];
          response = await currentTryAdapter.chat(systemPrompt, sanitizedMessages, activeToolNames);

          if (currentTryAdapter !== adapter) {
            console.log(`[Agent2 Failover] Successfully failed over. Promoting ${providerName} to primary.`);
            adapter = currentTryAdapter;

            let newModelValue: string;
            if (providerName === "CerebrasAdapter") {
              newModelValue = (currentTryAdapter as any).model || "gpt-oss-120b";
            } else if (providerName === "GroqAdapter") {
              newModelValue = (currentTryAdapter as any).model || "qwen/qwen3-32b";
            } else if (providerName === "GeminiAdapter") {
              newModelValue = "gemini-2.5-flash";
            } else if (providerName === "OllamaAdapter") {
              newModelValue = (currentTryAdapter as any).model || "ollama/local";
            } else {
              newModelValue = providerName;
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
        if (response.usage) {
          console.log(`[Agent2 Debugger] Token Usage: Prompt ${response.usage.promptTokens} | Completion ${response.usage.completionTokens} | Total ${response.usage.totalTokens}`);
        }
        await logAndEmit({
          type: "thinking",
          text,
          usage: response.usage
        });
      } else if (response.usage) {
        console.log(`[Agent2 Debugger] Token Usage (tool calls): Prompt ${response.usage.promptTokens} | Completion ${response.usage.completionTokens} | Total ${response.usage.totalTokens}`);
        await logAndEmit({
          type: "thinking",
          text: `[Processing next step...]`,
          usage: response.usage
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

      /* old code
      for (const call of calls) {
        console.log(`[Agent2 Debugger] Executing tool "${call.name}" with args:`, JSON.stringify(call.args, null, 2));
        await logAndEmit({
          type: "tool_call",
          name: call.name,
          status: "running",
          input: call.args
        });

        let result: any;
        const argsStr = JSON.stringify(call.args || {});
        const duplicateCount = callHistory.filter(h => h.name === call.name && h.argsStr === argsStr).length;
        callHistory.push({ name: call.name, argsStr });

        if (call.name === "select_compute" && duplicateCount >= 1) {
          result = {
            error: "Duplicate Tool Call: You have already called select_compute with these parameters. Please check the previous tool output for the recommended MCU (e.g., ESP32 DevKit v1 / Raspberry Pi Pico) and proceed to search and add other components in your BOM, then call save_progress(type=\"bom\"). Do not call select_compute again."
          };
          console.warn(`[Agent2 Debugger] Intercepted duplicate select_compute call to prevent infinite loop.`);
        } else if (call.name === "search_library" && duplicateCount >= 3) {
          result = {
            error: "Duplicate Search: You have executed this library search query 3 times. Please proceed to fetch part details or save progress."
          };
          console.warn(`[Agent2 Debugger] Intercepted duplicate search_library call to prevent infinite loop.`);
        }

        if (result !== undefined) {
          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "done",
            output: result
          });
        } else {
          try {
            if (call.name === "save_progress") {
              result = await saveSessionProgress(sessionId, call.args.type, call.args.data, call.args);
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
        }

        messages.push({
          role: "function",
          name: call.name,
          tool_call_id: (call as any).id,
          content: result
        });
      }
      */
      // ??$$$ newer code - Run tool calls in parallel to reduce formulation round-trip latency
      const toolResults = await Promise.all(
        calls.map(async (call) => {
          console.log(`[Agent2 Debugger] Executing tool "${call.name}" in parallel with args:`, JSON.stringify(call.args, null, 2));
          await logAndEmit({
            type: "tool_call",
            name: call.name,
            status: "running",
            input: call.args
          });

          let result: any;
          const argsStr = JSON.stringify(call.args || {});
          const duplicateCount = callHistory.filter(h => h.name === call.name && h.argsStr === argsStr).length;
          callHistory.push({ name: call.name, argsStr });

          if (call.name === "select_compute" && duplicateCount >= 1) {
            result = {
              error: "Duplicate Tool Call: You have already called select_compute with these parameters. Please check the previous tool output for the recommended MCU (e.g., ESP32 DevKit v1 / Raspberry Pi Pico) and proceed to search and add other components in your BOM, then call save_progress(type=\"bom\"). Do not call select_compute again."
            };
            console.warn(`[Agent2 Debugger] Intercepted duplicate select_compute call to prevent infinite loop.`);
          } else if (call.name === "search_library" && duplicateCount >= 3) {
            result = {
              error: "Duplicate Search: You have executed this library search query 3 times. Please proceed to fetch part details or save progress."
            };
            console.warn(`[Agent2 Debugger] Intercepted duplicate search_library call to prevent infinite loop.`);
          }

          if (result === undefined) {
            try {
              if (call.name === "save_progress") {
                result = await saveSessionProgress(sessionId, call.args.type, call.args.data, call.args);
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
          } else {
            await logAndEmit({
              type: "tool_call",
              name: call.name,
              status: "done",
              output: result
            });
          }

          return { call, result };
        })
      );

      for (const { call, result } of toolResults) {
        messages.push({
          role: "function",
          name: call.name,
          tool_call_id: (call as any).id,
          content: result
        });
      }

      // ??$$$ newer code - save sanitized and length-limited chatHistory to database and prune in-memory messages array to prevent memory leaks and token bloat
      if (sessionId) {
        try {
          // ??$$$ newer code - pass the session object to sanitizeMessageHistory for aggressive phase-based pruning
          messages = sanitizeMessageHistory(messages, session);
          if (messages.length > 30) {
            // Find a safe start index (around the target length) that starts with an "assistant" message
            let sliceStart = messages.length - 28;
            while (sliceStart < messages.length && messages[sliceStart].role !== "assistant" && messages[sliceStart].role !== "model") {
              sliceStart++;
            }
            if (sliceStart >= messages.length) {
              sliceStart = messages.length - 2;
            }
            messages = [messages[0], ...messages.slice(sliceStart)];
          }
          await NewFlowSession.updateOne({ _id: sessionId }, { $set: { chatHistory: messages } });
        } catch (e) {
          console.error("[Agent2] Failed to save and prune chatHistory at turn end:", e);
        }
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

        // ??$$$ newer code - failover without pausing if cooldown is high
        let activeProviderType = "ollama";
        const activeAdapterName = adapter.constructor.name;
        if (activeAdapterName === "GroqAdapter") activeProviderType = "groq";
        else if (activeAdapterName === "GeminiAdapter") activeProviderType = "gemini";
        else if (activeAdapterName === "CerebrasAdapter") activeProviderType = "cerebras";

        if (delaySeconds > 15) {
          console.warn(`[Agent2 Debugger] Delay of ${delaySeconds}s is high. Putting ${activeAdapterName} on cooldown and failing over immediately.`);
          providerCooldowns.set(activeProviderType, Date.now() + (delaySeconds * 1000));
          try {
            await rotationService.handleRateLimit();
          } catch {}
          turns--;
          continue;
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

    // ??$$$ newer code — Check if project already exists, and update it. Else create new one.
    let projectDoc = null;
    if (session!.projectId) {
      projectDoc = await Project.findById(session!.projectId);
    }

    if (projectDoc) {
      console.log(`[Agent2 Debugger] Found existing project document: ${session!.projectId}. Updating instead of creating.`);
      
      projectDoc.description = session!.idea;
      projectDoc.stageStatus = {
        ideation: "done",
        components: "done",
        build: "ready",
        simulation: "ready",
        assembly: "locked",
        shopping: "locked"
      };

      projectDoc.ideation = {
        messages: session!.qaHistory.map(q => ([
          { role: "model" as const, content: q.question, timestamp: q.timestamp },
          { role: "user" as const, content: q.answer, timestamp: q.timestamp }
        ])).flat(),
        brief: session!.requirementsDoc || session!.idea,
        objective: session!.requirementsDoc || session!.idea,
        compute: session!.context?.mcu || "",
        phases: {},
        constraints: Array.isArray(session!.context?.constraints) ? session!.context.constraints.join("\n") : "",
        open: Array.isArray(session!.context?.openQuestions) ? session!.context.openQuestions.join("\n") : "",
        thinking: "",
        toolTrace: "",
        readinessReason: "",
        readyForComponents: true,
        readyAt: new Date(),
        validatorApproved: true,
        validatorFeedback: "Approved by Agent 2 formulation.",
        validationAttempts: 1
      };

      projectDoc.bom = await Promise.all(session!.bom.map(async b => {
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
      }));

      projectDoc.milestones = session!.milestones.map((m, idx) => ({
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
        requiredLibraries: m.requiredLibraries
          ? m.requiredLibraries.map((lib: any) => ({
              name: lib.name || "",
              version: lib.version || undefined,
              type: lib.type || "library_manager",
              installCommand: lib.installCommand || undefined
            }))
          : []
      }));

      projectDoc.milestonesGenerated = true;
      projectDoc.activeMilestoneId = session!.milestones[0]?.id || "";
      projectDoc.diagram = session!.diagram || session!.wiring;
      projectDoc.wiring = session!.wiring || [];
      projectDoc.sketch = session!.finalSketch || "";
      projectDoc.derivedDependencies = session!.derivedDependencies || [];

      // Ensure versioning states are synchronized
      projectDoc.bomMeta = session!.bomMeta;
      projectDoc.wiringMeta = session!.wiringMeta;
      projectDoc.sketchMeta = session!.sketchMeta;
      projectDoc.meta = {
        stage: "build",
        isAgentic: true,
        board: session!.context?.mcu || null,
        componentCount: session!.bom ? session!.bom.length : 0,
        detectedAt: new Date()
      };

      await projectDoc.save();
      projectId = projectDoc._id;
      console.log(`[Agent2 Debugger] Updated existing project document successfully: ${projectId}`);
    } else {
      console.log("[Agent2 Debugger] Creating new Project document...");
      const newProject = new Project({
        owner: session!.owner,
        description: session!.idea,
        stageStatus: {
          ideation: "done",
          components: "done",
          build: "ready",
          simulation: "ready",
          assembly: "locked",
          shopping: "locked"
        },
        ideation: {
          messages: session!.qaHistory.map(q => ([
            { role: "model" as const, content: q.question, timestamp: q.timestamp },
            { role: "user" as const, content: q.answer, timestamp: q.timestamp }
          ])).flat(),
          brief: session!.requirementsDoc || session!.idea,
          objective: session!.requirementsDoc || session!.idea,
          compute: session!.context?.mcu || "",
          phases: {},
          constraints: Array.isArray(session!.context?.constraints) ? session!.context.constraints.join("\n") : "",
          open: Array.isArray(session!.context?.openQuestions) ? session!.context.openQuestions.join("\n") : "",
          thinking: "",
          toolTrace: "",
          readinessReason: "",
          readyForComponents: true,
          readyAt: new Date(),
          validatorApproved: true,
          validatorFeedback: "Approved by Agent 2 formulation.",
          validationAttempts: 1
        },
        bom: await Promise.all(session!.bom.map(async b => {
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
        milestones: session!.milestones.map((m, idx) => ({
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
          requiredLibraries: m.requiredLibraries
            ? m.requiredLibraries.map((lib: any) => ({
                name: lib.name || "",
                version: lib.version || undefined,
                type: lib.type || "library_manager",
                installCommand: lib.installCommand || undefined
              }))
            : []
        })),

        milestonesGenerated: true,
        activeMilestoneId: session!.milestones[0]?.id || "",
        diagram: session!.diagram || session!.wiring,
        wiring: session!.wiring || [],
        sketch: session!.finalSketch || "",
        derivedDependencies: session!.derivedDependencies || [],
        meta: {
          stage: "build",
          isAgentic: true,
          board: session!.context?.mcu || null,
          componentCount: session!.bom ? session!.bom.length : 0,
          detectedAt: new Date()
        }
      });

      await newProject.save();
      projectId = newProject._id;
      console.log(`[Agent2 Debugger] Created project document successfully: ${projectId}`);
    }
  } catch (err: any) {
    console.error("[Agent2 Debugger] Failed to create or update project document from session:", err);
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
      fs.writeFileSync(path.join(exportDir, "requirements.md"), session!.requirementsDoc || "", "utf8");

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
  } finally {
    // ??$$$ newer code - release lock
    activeSessions.delete(sessionId);
  }
}
