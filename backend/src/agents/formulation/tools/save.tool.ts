// ??$$$
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "../../../services/keyRotation.service";
import Project from "../../../models/project.model";
import NewFlowSession from "../../../models/newFlowSession.model";
import { parseIfString, retryWithBackoff, unifiedLlmCall } from "./utils";
// ??$$$ newer code
import { deriveDependencies, validateBOM, validateWiring, logPipelineStage } from "../../../services/validation.service";

import { saveSessionProgress, syncSessionToDisk } from "../formulation.persistence";

export async function executeSaveProgress(args: any, sessionId: string) {
  const type = args.type;
  const data = parseIfString(args.data);
  const targetId = args.sessionId || sessionId;


  // ??$$$ newer code - invoke saveSessionProgress and log pipeline stages
  // ??$$$ newer code - pass args to saveSessionProgress for robust fallback argument resolution
  const result = await saveSessionProgress(targetId, type, data, args);
  if (!result.saved) {
    return result;
  }

  try {
    let project = await Project.findById(targetId);
    if (!project) {
      const session = await NewFlowSession.findById(targetId);
      if (session && session.projectId) {
        project = await Project.findById(session.projectId);
      }
    }
    if (project) {
      if (type === "bom") {
        const valResult = validateBOM(project.bom);
        await logPipelineStage(targetId, "bom", valResult.valid ? "done" : "failed", {
          inputs: { purpose: project.description, board: project.meta?.board },
          process: ["Component search", "Compatibility checks", "Interface determination", "Power budget estimation"],
          outputs: project.bom,
          consumers: ["Wiring Engine", "Diagram Generator", "Firmware Generator"],
          validationStatus: { valid: valResult.valid, errors: valResult.errors, warnings: valResult.warnings }
        });
      } else if (type === "wiring") {
        const valResult = validateWiring(project.wiring || [], project.bom, project.meta?.board || "esp32");
        await logPipelineStage(targetId, "wiring", valResult.valid ? "done" : "failed", {
          inputs: { bom: project.bom.map(b => ({ key: b.key, mpn: b.mpn })) },
          process: ["Interface classification", "Pin allocation", "Conflict checks", "Resource allocation", "Power/Ground routing"],
          outputs: project.wiring || [],
          consumers: ["Diagram Generator", "Firmware Generator", "Simulation"],
          validationStatus: { valid: valResult.valid, errors: valResult.errors, warnings: valResult.warnings }
        });
      } else if (type === "milestone") {
        await logPipelineStage(targetId, "milestones", "done", {
          inputs: { bom: project.bom?.map((b: any) => b.key) || [], wiring: project.wiring || [] },
          process: ["Test code generation", "Verification assertions", "Library determination"],
          outputs: project.milestones,
          consumers: ["Compiler", "Firmware Generator"],
          validationStatus: { valid: true, errors: [], warnings: [] }
        });
      } else if (type === "diagram") {
        await logPipelineStage(targetId, "diagram", "done", {
          inputs: { bom: project.bom?.map((b: any) => b.key) || [], wiring: project.wiring || [] },
          process: ["Wokwi part mapping", "Coordinate layout placement"],
          outputs: project.diagram,
          consumers: ["Wokwi Simulator", "Build Page"],
          validationStatus: { valid: true, errors: [], warnings: [] }
        });
      }
    }
  } catch (err) {
    console.error("Pipeline logging failed in executeSaveProgress:", err);
  }

  return result;
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

    const raw = await unifiedLlmCall(systemPrompt, userPrompt);

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

        // ??$$$ newer code - sync session data to disk formulation exports directory
        await syncSessionToDisk(sessionId);

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
