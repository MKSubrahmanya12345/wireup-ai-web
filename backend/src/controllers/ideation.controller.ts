// ??$$$ group 2 - Ideation Stage (Phase 1)
// @ts-nocheck

import mongoose from "mongoose";
import Project from "../models/project.model";
// ??$$$ Import IDEATION_SYSTEM_PROMPT from gemini.service
import { callGeminiIdeation, callGeminiValidator, IDEATION_SYSTEM_PROMPT } from "../services/gemini.service";
import { advanceStage } from "../services/pipeline.service";

// ??$$$ parseAgent1Response per Section 4 instructions
export function parseAgent1Response(raw: string) {
  // Extract OBJECTIVE block (no %%% delimiters)
  const objectiveMatch = raw.match(/OBJECTIVE\n([\s\S]*?)\nEND/);
  const objective = objectiveMatch ? objectiveMatch[1].trim() : "";

  // Extract COMPUTE block (no %%% delimiters)
  const computeMatch = raw.match(/COMPUTE\n([\s\S]*?)\nEND/);
  const compute = computeMatch ? computeMatch[1].trim() : "";

  // Extract all %%%PHASE%%% blocks
  const phases: Record<string, string> = {};
  const phaseRegex = /%%%([A-Z_]+)%%%\n([\s\S]*?)%%%END%%%/g;
  let phaseMatch;
  while ((phaseMatch = phaseRegex.exec(raw)) !== null) {
    phases[phaseMatch[1].trim()] = phaseMatch[2].trim();
  }

  // Extract CONSTRAINTS line
  const constraintsMatch = raw.match(/CONSTRAINTS:\s*(.+)/);
  const constraints = constraintsMatch ? constraintsMatch[1].trim() : "";

  // Extract OPEN line
  const openMatch = raw.match(/OPEN:\s*(.+)/);
  const open = openMatch ? openMatch[1].trim() : "";

  // Build full brief from structured parts
  const hasBrief = objective.length > 0 && compute.length > 0;
  const brief = hasBrief ? raw.match(/(OBJECTIVE[\s\S]*?OPEN:.*)/)?.[1]?.trim() || "" : "";

  // Strip brief block from reply
  const reply = raw.replace(/OBJECTIVE[\s\S]*?OPEN:.*/, "").trim()
    || raw.trim();

  return {
    reply,
    brief,
    objective,
    compute,
    phases,
    constraints,
    open,
    readyForComponents: hasBrief,
    readinessReason: hasBrief ? "Brief generated — architecture clear enough for component sourcing" : "Still gathering requirements"
  };
}

export const createIdeationProject = async (req, res) => {
  try {
    const { description } = req.body;
    const normalizedDescription = description?.trim();

    if (!normalizedDescription) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (!req.user?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recentSameProject = await Project.findOne({
      owner: req.user._id,
      description: normalizedDescription,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (recentSameProject) {
      const latestReply = [...(recentSameProject.ideation?.messages || [])]
        .reverse()
        .find(msg => msg.role === "model")?.content || "Project already exists.";

      return res.json({
        projectId: recentSameProject._id,
        reply: latestReply,
        readyForComponents: recentSameProject.ideation?.readyForComponents || false,
        readinessReason: recentSameProject.ideation?.readinessReason || "",
        brief: recentSameProject.ideation?.brief || "",
        phases: recentSameProject.ideation?.phases || {},
        objective: recentSameProject.ideation?.objective || "",
        compute: recentSameProject.ideation?.compute || "",
        constraints: recentSameProject.ideation?.constraints || "",
        open: recentSameProject.ideation?.open || "",
        deduped: true
      });
    }

    const project = await Project.create({
      description: normalizedDescription,
      owner: req.user._id,
      ideation: {
        messages: [{ role: "user", content: normalizedDescription, timestamp: new Date() }],
        brief: "",
        objective: "",
        compute: "",
        phases: {},
        constraints: "",
        open: "",
        thinking: "",
        toolTrace: "",
        readyForComponents: false,
        readyAt: null,
        readinessReason: "",
        validatorApproved: false,
        validatorFeedback: "",
        validationAttempts: 0
      },
      meta: { stage: "ideation" }
    });

    // Ensure validator isn't holding the project lock
    const projLock = (project.meta && project.meta.agentLock) || null;
    if (projLock === "validator") {
      return res.status(409).json({ error: "Validation in progress; try again shortly" });
    }

    // Acquire ideation lock, call agent, then release
    await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "ideation" } });
    let aiResponseText;
    try {
      // ??$$$ Removed projectId per Section 6 instructions
      aiResponseText = await callGeminiIdeation(
        IDEATION_SYSTEM_PROMPT,
        project.ideation.messages
      );
    } finally {
      await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
    }

    const parsed = parseAgent1Response(aiResponseText);

    // ??$$$ Removed toolCallsJson logic per Section 6 instructions
    project.ideation.messages.push({
      role: "model",
      content: parsed.reply || "Project initialized and specifications extracted.",
      timestamp: new Date()
    });

    project.ideation.brief = parsed.brief;
    project.ideation.phases = parsed.phases;
    project.ideation.objective = parsed.objective;
    project.ideation.compute = parsed.compute;
    project.ideation.constraints = parsed.constraints;
    project.ideation.open = parsed.open;

    if (parsed.readyForComponents === true) {
      
      // Acquire validator lock and run validation
      await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "validator" } });
      let validation;
      try {
        // ??$$$ callGeminiValidator with parsed.brief per Section 6 instructions
        validation = await callGeminiValidator(parsed.brief);
      } finally {
        await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
      }
      project.ideation.validationAttempts = (project.ideation.validationAttempts || 0) + 1;

      if (validation.approved) {
        // Agent 2 happy → advance for real
        project.ideation.readyForComponents = true;
        project.ideation.readyAt = new Date();
        project.ideation.readinessReason = parsed.readinessReason || "";
        project.ideation.validatorApproved = true;
        project.ideation.validatorFeedback = "";
        project.meta.stage = "components";
        if (!project.stageStatus) project.stageStatus = {};
        project.stageStatus.ideation = "done";
        project.stageStatus.components = "ready";
        await project.save();
        await advanceStage(project._id, "ideation");

      } else {
        // Agent 2 rejected → store feedback, inject into next Agent 1 call
        project.ideation.validatorFeedback = validation.problems;
        project.ideation.validatorApproved = false;
        
        // Inject Agent 2's problem as a system note into the conversation
        project.ideation.messages.push({
          role: "user",
          content: `[SYSTEM NOTE — not from user]: Architecture validator flagged this issue: "${validation.problems}". Suggested resolution: "${validation.suggestion}". Address this naturally in your next response to the user without revealing there is a validation system.`,
          timestamp: new Date()
        });

        // Call Agent 1 again with the injected feedback (acquire ideation lock)
        await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "ideation" } });
        let correctionResponse;
        try {
          // ??$$$ Removed projectId per Section 6 instructions
          correctionResponse = await callGeminiIdeation(
            IDEATION_SYSTEM_PROMPT,
            project.ideation.messages
          );
        } finally {
          await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
        }
        const correctionParsed = parseAgent1Response(correctionResponse);

        // Replace the system note with the AI's natural response
        project.ideation.messages.pop();
        project.ideation.messages.push({
          role: "model",
          content: correctionParsed.reply,
          timestamp: new Date()
        });

        // ??$$$ Updated snapshot/confidence assignments to use brief fields per Section 6 instructions
        project.ideation.brief = correctionParsed.brief;
        project.ideation.phases = correctionParsed.phases;
        project.ideation.objective = correctionParsed.objective;
        project.ideation.compute = correctionParsed.compute;
        project.ideation.constraints = correctionParsed.constraints;
        project.ideation.open = correctionParsed.open;

        // Override parsed.reply so the response to frontend uses correction
        parsed.reply = correctionParsed.reply;
        parsed.brief = correctionParsed.brief;
        parsed.phases = correctionParsed.phases;
        parsed.objective = correctionParsed.objective;
        parsed.compute = correctionParsed.compute;
        parsed.constraints = correctionParsed.constraints;
        parsed.open = correctionParsed.open;
        parsed.readinessReason = correctionParsed.readinessReason;

        await project.save();
      }
    } else {
      await project.save();
    }

    // ??$$$ Return new fields, without thinking or toolCalls, per Section 6 instructions
    res.json({
      projectId: project._id,
      reply: parsed.reply,
      readyForComponents: project.ideation.readyForComponents,
      readinessReason: parsed.readinessReason,
      brief: parsed.brief,
      phases: parsed.phases,
      objective: parsed.objective,
      compute: parsed.compute,
      constraints: parsed.constraints,
      open: parsed.open,
    });

  } catch (err) {
    console.error("CREATE IDEATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const chatIdeationProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ??$$$ Initializing ideation state with brief fields instead of snapshot per Section 6
    if (!project.ideation) {
      project.ideation = {
        messages: [],
        brief: "",
        objective: "",
        compute: "",
        phases: {},
        constraints: "",
        open: "",
        thinking: "",
        toolTrace: "",
        readyForComponents: false,
        readyAt: null,
        readinessReason: "",
        validatorApproved: false,
        validatorFeedback: "",
        validationAttempts: 0
      };
    }

    // If validator currently holds the lock, block ideation interaction
    if (project.meta && project.meta.agentLock === "validator") {
      return res.status(409).json({ error: "Validation in progress; try again shortly" });
    }

    project.ideation.messages.push({
      role: "user",
      content: message.trim(),
      timestamp: new Date()
    });

    // Acquire ideation lock, call agent, then release
    await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "ideation" } });
    let aiResponseText;
    try {
      // ??$$$ Removed projectId per Section 6 instructions
      aiResponseText = await callGeminiIdeation(
        IDEATION_SYSTEM_PROMPT,
        project.ideation.messages
      );
    } finally {
      await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
    }

    const parsed = parseAgent1Response(aiResponseText);

    // ??$$$ Removed toolCallsJson logic per Section 6 instructions
    project.ideation.messages.push({
      role: "model",
      content: parsed.reply || "Specifications and architecture details updated.",
      timestamp: new Date()
    });

    project.ideation.brief = parsed.brief;
    project.ideation.phases = parsed.phases;
    project.ideation.objective = parsed.objective;
    project.ideation.compute = parsed.compute;
    project.ideation.constraints = parsed.constraints;
    project.ideation.open = parsed.open;

    if (parsed.readyForComponents === true && !project.ideation.readyForComponents) {
      
      // Acquire validator lock and run validation
      await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "validator" } });
      let validation;
      try {
        // ??$$$ call validator with parsed.brief per Section 6
        validation = await callGeminiValidator(parsed.brief);
      } finally {
        await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
      }
      project.ideation.validationAttempts = (project.ideation.validationAttempts || 0) + 1;

      if (validation.approved) {
        // Agent 2 happy → advance for real
        project.ideation.validatorFeedback = "";
        project.ideation.readyForComponents = true;
        project.ideation.readyAt = new Date();
        project.ideation.readinessReason = parsed.readinessReason || "";
        project.ideation.validatorApproved = true;
        project.meta.stage = "components";
        if (!project.stageStatus) project.stageStatus = {};
        project.stageStatus.ideation = "done";
        project.stageStatus.components = "ready";
        await project.save();
        await advanceStage(project._id, "ideation");

      } else {
        // Agent 2 rejected → store feedback, inject into next Agent 1 call
        project.ideation.validatorFeedback = validation.problems;
        project.ideation.validatorApproved = false;
        
        // Inject Agent 2's problem as a system note into the conversation
        project.ideation.messages.push({
          role: "user",
          content: `[SYSTEM NOTE — not from user]: Architecture validator flagged this issue: "${validation.problems}". Suggested resolution: "${validation.suggestion}". Address this naturally in your next response to the user without revealing there is a validation system.`,
          timestamp: new Date()
        });

        // Call Agent 1 again with the injected feedback
        await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": "ideation" } });
        let correctionResponse;
        try {
          // ??$$$ Removed projectId per Section 6 instructions
          correctionResponse = await callGeminiIdeation(
            IDEATION_SYSTEM_PROMPT,
            project.ideation.messages
          );
        } finally {
          await Project.findByIdAndUpdate(project._id, { $set: { "meta.agentLock": null } });
        }
        const correctionParsed = parseAgent1Response(correctionResponse);

        // Replace the system note with the AI's natural response
        project.ideation.messages.pop();
        project.ideation.messages.push({
          role: "model",
          content: correctionParsed.reply,
          timestamp: new Date()
        });

        // ??$$$ Updated snapshot/confidence assignments to use brief fields per Section 6 instructions
        project.ideation.brief = correctionParsed.brief;
        project.ideation.phases = correctionParsed.phases;
        project.ideation.objective = correctionParsed.objective;
        project.ideation.compute = correctionParsed.compute;
        project.ideation.constraints = correctionParsed.constraints;
        project.ideation.open = correctionParsed.open;

        // Override parsed.reply so the response to frontend uses correction
        parsed.reply = correctionParsed.reply;
        parsed.brief = correctionParsed.brief;
        parsed.phases = correctionParsed.phases;
        parsed.objective = correctionParsed.objective;
        parsed.compute = correctionParsed.compute;
        parsed.constraints = correctionParsed.constraints;
        parsed.open = correctionParsed.open;
        parsed.readinessReason = correctionParsed.readinessReason;
        
        await project.save();
      }
    } else {
      await project.save();
    }

    // ??$$$ Return updated fields, without thinking or toolCalls, per Section 6
    res.json({
      reply: parsed.reply,
      readyForComponents: project.ideation.readyForComponents,
      readinessReason: parsed.readinessReason,
      brief: parsed.brief,
      phases: parsed.phases,
      objective: parsed.objective,
      compute: parsed.compute,
      constraints: parsed.constraints,
      open: parsed.open,
    });

  } catch (err) {
    console.error("CHAT IDEATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// Deprecated stubs to satisfy TS import constraints from legacy routes
export const finalizeIdeation = async (req, res) => {
  res.json({ success: true, message: "Deprecated" });
};

export const assumeDefaults = async (req, res) => {
  res.json({ success: true, message: "Deprecated" });
};

// ??$$$ simplified getProjectThinking per Section 8 instructions
export const getProjectThinking = async (req: any, res: any) => {
  try {
    res.json({ thinking: "" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
