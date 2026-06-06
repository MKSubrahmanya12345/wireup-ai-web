// ??$$$
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "../../../services/keyRotation.service";
import Project from "../../../models/project.model";
import NewFlowSession from "../../../models/newFlowSession.model";
import { parseIfString, retryWithBackoff } from "./utils";
// ??$$$ newer code
import { deriveDependencies, validateBOM, validateWiring, logPipelineStage } from "../../../services/validation.service";

export async function executeSaveProgress(args: any, sessionId: string) {
  const type = args.type;
  const data = parseIfString(args.data);
  const targetId = args.sessionId || sessionId;

  try {
    const project = await Project.findById(targetId);
    if (!project) {
      return { saved: false, error: "Project not found" };
    }

    if (type === "bom") {
      if (project.bomMeta?.locked) {
        return { saved: false, error: "BOM is locked against AI overwrites" };
      }
      project.bom = Array.isArray(data) ? data : [...(project.bom || []), data];

      // ??$$$ newer code - V1 State Propagation
      if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

      project.bomMeta.version += 1;
      project.bomMeta.lastModifiedBy = "ai";
      project.wiringMeta.staleReason = "BOM component was modified by AI";
      project.sketchMeta.staleReason = "BOM component was modified by AI";
      project.markModified('bomMeta');
      project.markModified('wiringMeta');
      project.markModified('sketchMeta');

      await project.save();

      // ??$$$ newer code
      const valResult = validateBOM(project.bom);
      await logPipelineStage(targetId, "bom", valResult.valid ? "done" : "failed", {
        inputs: { purpose: project.description, board: project.meta?.board },
        process: ["Component search", "Compatibility checks", "Interface determination", "Power budget estimation"],
        outputs: project.bom,
        consumers: ["Wiring Engine", "Diagram Generator", "Firmware Generator"],
        validationStatus: { valid: valResult.valid, errors: valResult.errors, warnings: valResult.warnings }
      });

      const globalIo = (global as any).io;
      if (globalIo) {
        globalIo.to(targetId).emit("agent2:bom_update", { bom: project.bom });
      }
    } else if (type === "wiring") {
      if (project.wiringMeta?.locked) {
        return { saved: false, error: "Wiring is locked against AI overwrites" };
      }
      project.bom.forEach((bomItem) => {
        const matchingConns = (data.connections || []).filter((c: any) => c.to.startsWith(bomItem.key));
        bomItem.pinConnections = matchingConns.map((c: any) => ({
          pin: c.to.split(".")[1] || "",
          connectsTo: c.from
        }));
      });

      // ??$$$ newer code - V1 State Propagation
      if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

      project.wiringMeta.version += 1;
      project.wiringMeta.bomVersionUsed = project.bomMeta.version;
      project.wiringMeta.lastModifiedBy = "ai";
      project.sketchMeta.staleReason = "Wiring connections changed by AI";
      project.markModified('wiringMeta');
      project.markModified('sketchMeta');

      await project.save();

      // ??$$$ newer code
      const valResult = validateWiring(data.connections || [], project.bom, project.meta?.board || "esp32");
      await logPipelineStage(targetId, "wiring", valResult.valid ? "done" : "failed", {
        inputs: { bom: project.bom.map(b => ({ key: b.key, mpn: b.mpn })) },
        process: ["Interface classification", "Pin allocation", "Conflict checks", "Resource allocation", "Power/Ground routing"],
        outputs: data.connections || [],
        consumers: ["Diagram Generator", "Firmware Generator", "Simulation"],
        validationStatus: { valid: valResult.valid, errors: valResult.errors, warnings: valResult.warnings }
      });

      const globalIo = (global as any).io;
      if (globalIo) {
        globalIo.to(targetId).emit("agent2:wiring_update", { wiring: data.connections || [] });
      }
    } else if (type === "milestone") {
      if (project.sketchMeta?.locked) {
        return { saved: false, error: "Sketch/Milestones are locked against AI overwrites" };
      }
      project.milestones = Array.isArray(data) ? data : [...(project.milestones || []), data];

      // ??$$$ newer code - V1 State Propagation
      if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

      project.sketchMeta.version += 1;
      project.sketchMeta.wiringVersionUsed = project.wiringMeta.version;
      project.sketchMeta.lastModifiedBy = "ai";
      project.sketchMeta.staleReason = "";
      project.markModified('sketchMeta');

      await project.save();

      // ??$$$ newer code
      await logPipelineStage(targetId, "milestones", "done", {
        inputs: { bom: project.bom?.map((b: any) => b.key) || [], wiring: project.wiring || [] },
        process: ["Test code generation", "Verification assertions", "Library determination"],
        outputs: project.milestones,
        consumers: ["Compiler", "Firmware Generator"],
        validationStatus: { valid: true, errors: [], warnings: [] }
      });

      const globalIo = (global as any).io;
      if (globalIo) {
        globalIo.to(targetId).emit("agent2:milestone_update", { milestone: data });
      }
    } else if (type === "diagram") {
      if (project.wiringMeta?.locked) {
        return { saved: false, error: "Diagram (Wiring) is locked against AI overwrites" };
      }
      project.diagram = data.diagramJson || data;

      // ??$$$ newer code - V1 State Propagation
      if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
      if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

      project.wiringMeta.version += 1;
      project.wiringMeta.bomVersionUsed = project.bomMeta.version;
      project.wiringMeta.lastModifiedBy = "ai";
      project.sketchMeta.staleReason = "Diagram layout changed by AI";
      project.markModified('wiringMeta');
      project.markModified('sketchMeta');

      await project.save();

      // ??$$$ newer code
      await logPipelineStage(targetId, "diagram", "done", {
        inputs: { bom: project.bom?.map((b: any) => b.key) || [], wiring: project.wiring || [] },
        process: ["Wokwi part mapping", "Coordinate layout placement"],
        outputs: project.diagram,
        consumers: ["Wokwi Simulator", "Build Page"],
        validationStatus: { valid: true, errors: [], warnings: [] }
      });

      const globalIo = (global as any).io;
      if (globalIo) {
        globalIo.to(targetId).emit("agent2:diagram_update", { diagram: project.diagram });
      }
    }

    return {
      saved: true,
      type,
      sessionId: targetId,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    console.error("executeSaveProgress failed:", err);
    return { saved: false, error: err.message };
  }
}

export async function executeGenerateFinalSketch(args: any, sessionId?: string) {
  const objective = args.objective;
  const mcu = args.mcu;
  const allMilestones = parseIfString(args.allMilestones);
  const bom = parseIfString(args.bom);
  const wiring = parseIfString(args.wiring);

  if (sessionId) {
    try {
      const session = await NewFlowSession.findById(sessionId);
      if (session?.finalSketch && session.finalSketch.trim().length > 0) {
        console.log("[Agent2] Final sketch already generated. Returning cached.");
        return { success: true, code: session.finalSketch };
      }
    } catch (e) {
      console.error("[Agent2] Failed to check for existing final sketch:", e);
    }
  }

  try {
    let modelName = "llama-3.3-70b-versatile";
    if (sessionId) {
      try {
        const session = await NewFlowSession.findById(sessionId);
        if (session && session.selectedModel) {
          modelName = session.selectedModel;
        }
      } catch (e) {
        console.error("[Agent2] Failed to read session model for final sketch:", e);
      }
    }

    const systemPrompt = "Return ONLY valid Arduino .ino code. No markdown, no prose, no <think>. Only code.";
    const userPrompt = `You are an embedded systems expert. Given the following project objective, components, wiring, and milestone codes, generate a single final complete Arduino sketch that integrates all functionality.
    
    Objective: ${objective}
    MCU: ${mcu}
    BOM: ${JSON.stringify(bom)}
    Wiring: ${JSON.stringify(wiring)}
    Milestones with code:
    ${JSON.stringify(allMilestones?.map((m: any) => ({ order: m.order, title: m.title, code: m.code })))}
    
    ## Specialized Drone and Sensor Rules:
    - If this project involves a drone, quadcopter, or flight controller:
      * Integrate quadcopter X-frame motor mixing equations mapping Throttle, Pitch, Roll, Yaw inputs to four ESC outputs.
      * Include MPU6050/9250 IMU sensor reading and pitch/roll/yaw angle estimation using a complementary filter or library.
      * Set up PWM outputs suitable for standard ESCs (using Servo.h or analogWrite).
      * Implement real-time telemetry output (serial or WebSocket if WiFi/Ethernet is present) showing orientation and throttle.
    - Declare all pin constants precisely matching the Wiring netlist (e.g. if motor pin connects to GPIO4, use GPIO4 in the code).
    
    Return ONLY valid Arduino .ino code. No markdown, no explanation. Just the code.`;

    let raw = "";
    const useGemini = modelName.toLowerCase().includes("gemini");
    const useDeepSeek = modelName.toLowerCase().includes("deepseek");
    const useOllama = modelName.toLowerCase().includes("ollama");
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (useGemini && geminiApiKey) {
      console.log("[Agent2Tools] Generating final sketch using Gemini directly...");
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
        generationConfig: { temperature: 0.2 }
      });
      const result = await retryWithBackoff(() => geminiModel.generateContent(userPrompt));
      raw = result.response.text().trim();
    } else if (useDeepSeek) {
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) throw new Error("DEEPSEEK_API_KEY is missing in env");
      console.log("[Agent2Tools] Generating final sketch using DeepSeek directly...");
      const data: any = await retryWithBackoff(async () => {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${deepseekApiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API call failed: ${response.statusText} - ${errText}`);
        }
        return response.json();
      });
      raw = data.choices[0]?.message?.content?.trim() || "";
    } else if (useOllama) {
      const modelTag = modelName.split("/")[1] || "qwen2.5:3b";
      console.log(`[Agent2Tools] Generating final sketch locally using Ollama (${modelTag})...`);
      const data: any = await retryWithBackoff(async () => {
        const response = await fetch("http://localhost:11434/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: modelTag,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2,
            options: {
              num_ctx: 8192
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama API call failed: ${response.statusText} - ${errText}`);
        }
        return response.json();
      });
      raw = data.choices[0]?.message?.content?.trim() || "";
    } else {
      try {
        console.log(`[Agent2Tools] Generating final sketch using Groq (${modelName})...`);
        const groq = await rotationService.getClient();
        const completion = await retryWithBackoff(() => groq.chat.completions.create({
          model: modelName.toLowerCase().includes("qwen") ? "qwen/qwen3-32b" : "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        }));
        raw = completion.choices[0]?.message?.content?.trim() || "";
      } catch (err: any) {
        console.warn("[Agent2Tools] Groq final sketch generation failed. Trying Gemini fallback...", err.message || err);
        if (geminiApiKey) {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.2 }
          });
          const result = await retryWithBackoff(() => geminiModel.generateContent(userPrompt));
          raw = result.response.text().trim();
        } else {
          throw err;
        }
      }
    }

    let generatedCode = raw;
    if (generatedCode.includes("```")) {
      generatedCode = generatedCode.replace(/```(cpp|ino|arduino|c)?/gi, "").replace(/```/g, "").trim();
    }

    if (sessionId) {
      const session = await NewFlowSession.findById(sessionId);
      if (session) {
        session.finalSketch = generatedCode;
        // ??$$$ newer code
        session.derivedDependencies = deriveDependencies(session.bom, generatedCode, session.context?.mcu || mcu);
        await session.save();

        if (session.projectId) {
          const project = await Project.findById(session.projectId);
          if (project) {
            project.sketch = generatedCode;
            project.derivedDependencies = session.derivedDependencies;
            await project.save();
          }
        }

        // ??$$$ newer code
        await logPipelineStage(sessionId, "firmware", "done", {
          inputs: { bom: session.bom?.map((b: any) => b.key) || [], wiring: session.wiring || [] },
          process: ["Arduino sketch compilation generation", "API integration", "Pin constant mapping", "Specialized drone logic injection"],
          outputs: { code: generatedCode, derivedDependencies: session.derivedDependencies },
          consumers: ["Compiler", "Simulator", "Build Page"],
          validationStatus: { valid: true, errors: [], warnings: [] }
        });
        if (session.projectId) {
          await logPipelineStage(String(session.projectId), "firmware", "done", {
            inputs: { bom: session.bom?.map((b: any) => b.key) || [], wiring: session.wiring || [] },
            process: ["Arduino sketch compilation generation", "API integration", "Pin constant mapping", "Specialized drone logic injection"],
            outputs: { code: generatedCode, derivedDependencies: session.derivedDependencies },
            consumers: ["Compiler", "Simulator", "Build Page"],
            validationStatus: { valid: true, errors: [], warnings: [] }
          });
        }

        const io = (global as any).io;
        if (io) {
          io.to(sessionId).emit("agent2:final_sketch_update", { 
            finalSketch: generatedCode,
            derivedDependencies: session.derivedDependencies
          });
        }
      }
    }

    return { success: true, code: generatedCode };
  } catch (err: any) {
    console.error("executeGenerateFinalSketch failed:", err);
    return { success: false, error: err.message };
  }
}
