// ??$$$ NEW FLOW
import { Request, Response } from "express";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
// ??$$$ newer code
import fs from "fs";
import path from "path";
import rotationService from "../services/keyRotation.service";
import NewFlowSession from "../models/newFlowSession.model";
import { runAgent2 } from "../services/newflow.agent";

export const AGENT1_SYSTEM_PROMPT = `You are a hardware engineering discovery agent.
Your job is to ask the user clarifying questions about their project idea so that we can formulate it.
Ask ONE clear question at a time. Provide 2 to 4 simple option chips as quick responses, but also allow custom text answers.

Analyze the user's idea and the previous QA history.
If you have enough information to build the project (MCU chosen, subsystems identified, power and connectivity requirements known), set "done" to true.
If NOT done, return the next clarifying "question" and "options".

You must respond ONLY with a JSON object, without markdown, without backticks:
{
  "question": "The next question to ask the user, or empty if done",
  "options": ["Option A", "Option B", "Option C"],
  "done": false,
  "context": {
    "corePurpose": "Summary of the project purpose",
    "mcu": "Suggested microcontroller (e.g. ESP32, Arduino Nano, Raspberry Pi Pico)",
    "subsystems": ["Subsystem1", "Subsystem2"],
    "constraints": ["Constraint1", "Constraint2"],
    "powerSource": "Suggested power source (e.g. USB 5V, Battery)",
    "connectivity": "Suggested connectivity (e.g. WiFi, BLE, None)",
    "openQuestions": ["Remaining unclear items"]
  }
}`;

// Helper to call LLM for Discovery Agent
async function callDiscovery(modelName: string, promptText: string): Promise<any> {
  const isGemini = modelName.toLowerCase().includes("gemini");

  if (isGemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing in env");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: AGENT1_SYSTEM_PROMPT
    });

    const result = await model.generateContent(promptText);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } else {
    // Map Llama and Qwen models
    let actualModel = "qwen/qwen3-32b";
    if (modelName.toLowerCase().includes("qwen")) {
      actualModel = "qwen/qwen3-32b";
    }

    const client = await rotationService.getClient();
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

    // Create session
    const session = new NewFlowSession({
      owner: userId,
      selectedModel: model,
      idea,
      qaHistory: [],
      phase1Complete: false,
      phase2Complete: false
    });

    await session.save();

    // Call Discovery Agent for first question
    const promptText = `Original Project Idea: ${idea}\nNo previous Q&A history. Get the first question.`;
    const response = await callDiscovery(model, promptText);

    // Save initial context and first question/options to state
    session.context = response.context || {};
    session.phase1Complete = !!response.done;
    await session.save();

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: !!response.done,
      context: session.context
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

    // Save previous Q&A to history
    session.qaHistory.push({
      question: currentQuestion || "Clarification",
      options: currentOptions,
      answer,
      timestamp: new Date()
    });

    await session.save();

    // Reconstruct entire prompt context with Q&A history
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nGenerate the next question based on history, or finalize if done.`;

    const response = await callDiscovery(session.selectedModel, promptText);

    // Update session state
    session.context = response.context || session.context;
    session.phase1Complete = !!response.done;
    await session.save();

    return res.json({
      sessionId: session._id,
      question: response.question,
      options: response.options || [],
      done: session.phase1Complete,
      context: session.context
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

    // ??$$$ old code
    /*
    session.phase1Complete = true;
    await session.save();

    return res.json({
      success: true,
      context: session.context
    });
    */

    // ??$$$ newer code — compile final context from Q&A history on proceed/skip
    let promptText = `Original Project Idea: ${session.idea}\n\nQ&A History:\n`;
    session.qaHistory.forEach((item, index) => {
      promptText += `${index + 1}. Q: ${item.question}\n   A: ${item.answer}\n`;
    });
    promptText += `\nThe user has decided to skip further questions. Please extract and populate the final context object as best as possible from the idea and the Q&A history answered so far. Set "done" to true.`;

    try {
      const response = await callDiscovery(session.selectedModel, promptText);
      if (response && response.context) {
        session.context = response.context;
      }
    } catch (e) {
      console.error("[proceedSession] Failed to run final discovery extraction:", e);
    }

    session.phase1Complete = true;
    await session.save();

    return res.json({
      success: true,
      context: session.context
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

    // Run Agent 2 formulation loop in the background
    runAgent2(sessionId, session.selectedModel).catch(err => {
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
    const { sessionId, context } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required." });
    }

    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Save context to database if provided
    if (context) {
      session.context = {
        corePurpose: context.corePurpose || "",
        mcu: context.mcu || "",
        subsystems: Array.isArray(context.subsystems) ? context.subsystems : [],
        constraints: Array.isArray(context.constraints) ? context.constraints : [],
        powerSource: context.powerSource || "",
        connectivity: context.connectivity || "",
        openQuestions: Array.isArray(context.openQuestions) ? context.openQuestions : []
      };
    }

    // Reset formulation progress fields
    session.agentLog = [];
    session.bom = [];
    session.wiring = [];
    session.milestones = [];
    session.phase2Complete = false;
    session.projectId = null;

    await session.save();

    // Trigger fresh Agent 2 loop
    runAgent2(sessionId, session.selectedModel).catch(err => {
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
        qaHistory: [],
        phase1Complete: true,
        phase2Complete: false,
        projectId: project._id
      });

      // Populate context from project details
      if ((project as any).ideation) {
        session.context = {
          corePurpose: (project as any).ideation.objective || project.description || "",
          mcu: (project as any).ideation.compute || "",
          subsystems: (project as any).ideation.phases ? Object.keys((project as any).ideation.phases) : [],
          constraints: (project as any).ideation.constraints ? [(project as any).ideation.constraints] : [],
          powerSource: "",
          connectivity: "",
          openQuestions: (project as any).ideation.open ? [(project as any).ideation.open] : []
        };
      }

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

    // Define export path on E: drive
    const exportDir = `E:\\wireup_formulation_exports\\session_${sessionId}`;

    // Ensure directory exists
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Write individual JSON files
    fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");

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
