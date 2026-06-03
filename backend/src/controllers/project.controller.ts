// ??$$$ group 8 - Core Platform & Shared Infrastructure
import mongoose, { Types } from "mongoose";
import Project from "../models/project.model";
import Part from "../models/part.model";
import {
  buildGenerationProfileFromMeta,
  processInput,
} from "../services/ai.services";

import type { Request, Response } from "express";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  user?: {
    _id: Types.ObjectId | string;
  };
}

interface ChatBody {
  projectId: string;
  message: string;
}

interface CreateProjectBody {
  description: string;
  // ??$$$ Added isAgentic flag to request interface
  isAgentic?: boolean;
}

interface UpdateProjectBody {
  description?: string;
  wokwiUrl?: string;
  wokwiProjectPath?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// Old code:
// const isIdeaFinalized = (project: any): boolean => {
//   return (
//     Boolean(project?.ideaState?.summary?.trim()) &&
//     (project?.ideaState?.unknowns?.length ?? 0) === 0
//   );
// };
// ??$$$ newer code
const isIdeaFinalized = (project: any): boolean => {
  return project?.ideation?.finalized === true;
};

// ─── CREATE PROJECT ─────────────────────────────────────────────────────────

export const createProject = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // ??$$$ Read isAgentic from req.body
    const { description, isAgentic } = req.body as CreateProjectBody;

    if (!req.user?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Old code:
    // const project = await Project.create({
    //   description,
    //   owner: req.user._id,
    //   messages: [{ role: "user", content: description }],
    //   ideaState: {
    //     summary: "",
    //     requirements: [],
    //     unknowns: [],
    //   },
    //   meta: { stage: "ideation" },
    // });
    // ??$$$ newer code
    // ??$$$ Initialize project.ideation with empty messages array so first boot triggers the agent call
    const project = await Project.create({
      description,
      owner: req.user._id,
      ideation: {
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
      },
      meta: { 
        stage: "ideation",
        isAgentic: isAgentic || false
      },
    });

    // Old code:
    // const ai = await processInput(project, description);
    // if (ai.extractedContext) {
    //   project.extractedContext = ai.extractedContext;
    // }
    // project.ideaState = {
    //   summary: ai.summary,
    //   requirements: ai.requirements,
    //   unknowns: ai.unknowns,
    // };
    // project.architectureState = ai.architectureState;
    // project.meta.stage = isIdeaFinalized(project) ? "components" : "ideation";
    // project.generationProfile = buildGenerationProfileFromMeta(
    //   project.meta || {}
    // );
    // project.messages.push({
    //   role: "ai",
    //   content: aiReplyCreate,
    // });
    // await project.save();
    // ??$$$ newer code
    project.generationProfile = buildGenerationProfileFromMeta(
      project.meta || {}
    );
    await project.save();

    return res.json({
      projectId: project._id,
      reply: "",
      ideation: project.ideation,
      architectureState: project.architectureState,
      generationProfile: project.generationProfile,
    });
  } catch (err: any) {
    console.error("CREATE PROJECT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET USER PROJECTS
// ─────────────────────────────────────────────────────────────

export const getUserProjects = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const projects = await Project.find({
      owner: req.user?._id,
    }).sort({ createdAt: -1 });

    return res.json(projects);
  } catch (err: any) {
    console.error("GET PROJECTS ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET PROJECT BY ID
// ─────────────────────────────────────────────────────────────

export const getProjectById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(id).lean() as any;

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ??$$$ newer code — Merge pins and glbUrl from Part documents into BOM items
    if (project.bom && Array.isArray(project.bom)) {
      project.bom = await Promise.all(project.bom.map(async (item: any) => {
        try {
          const partDoc = await Part.findOne({ mpn: item.mpn }).lean() as any;
          if (partDoc) {
            return {
              ...item,
              pins: partDoc.pins || [],
              glbUrl: partDoc.glbUrl || item.glbUrl || ""
            };
          }
        } catch (e) {}
        return item;
      }));
    }

    return res.json(project);
  } catch (err: any) {
    console.error("GET PROJECT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// IDEATION HISTORY
// ─────────────────────────────────────────────────────────────

export const getIdeationHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    // ??$$$ Select ideation instead of messages
    const project = await Project.findById(id).select("owner ideation");

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ??$$$ Return ideation messages
    return res.json({ messages: project.ideation?.messages || [] });
  } catch (err: any) {
    console.error("GET IDEATION HISTORY ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// COMPONENTS HISTORY
// ─────────────────────────────────────────────────────────────

export const getComponentsHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(id).select(
      "owner componentsMessages"
    );

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({ messages: project.componentsMessages || [] });
  } catch (err: any) {
    console.error("GET COMPONENTS HISTORY ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE PROJECT
// ─────────────────────────────────────────────────────────────

export const updateProject = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const { description, wokwiUrl, wokwiProjectPath } =
      req.body as UpdateProjectBody;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hasDescription = typeof description === "string";
    const hasWokwiUrl = typeof wokwiUrl === "string";
    const hasWokwiProjectPath = typeof wokwiProjectPath === "string";

    if (!hasDescription && !hasWokwiUrl && !hasWokwiProjectPath) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    if (hasDescription) {
      const next = description!.trim();
      if (!next) {
        return res
          .status(400)
          .json({ error: "Description cannot be empty" });
      }
      project.description = next;
    }

    if (hasWokwiUrl) {
      const next = wokwiUrl!.trim();
      if (next && !/^https:\/\/wokwi\.com\/projects\/\d+/i.test(next)) {
        return res
          .status(400)
          .json({ error: "Invalid Wokwi project URL" });
      }
      project.wokwiUrl = next;
    }

    if (hasWokwiProjectPath) {
      project.wokwiProjectPath = wokwiProjectPath!.trim();
    }

    await project.save();

    return res.json(project);
  } catch (err: any) {
    console.error("UPDATE PROJECT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE PROJECT
// ─────────────────────────────────────────────────────────────

export const deleteProject = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await project.deleteOne();

    return res.json({ message: "Project deleted" });
  } catch (err: any) {
    console.error("DELETE PROJECT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CHAT LOOP
// ─────────────────────────────────────────────────────────────

// Old code:
// export const chatProject = async (
//   req: AuthRequest,
//   res: Response
// ) => {
//   try {
//     const { projectId, message } = req.body as ChatBody;
// 
//     if (!mongoose.Types.ObjectId.isValid(projectId)) {
//       return res.status(400).json({ error: "Invalid projectId" });
//     }
// 
//     const project = await Project.findById(projectId);
// 
//     if (!project) {
//       return res.status(404).json({ error: "Project not found" });
//     }
// 
//     if (project.owner.toString() !== req.user?._id?.toString()) {
//       return res.status(403).json({ error: "Forbidden" });
//     }
// 
//     project.messages.push({
//       role: "user",
//       content: message,
//     });
// 
//     const ai = await processInput(project, message);
// 
//     project.ideaState = {
//       summary: ai.summary,
//       requirements: ai.requirements,
//       unknowns: ai.unknowns,
//     };
// 
//     project.architectureState = ai.architectureState;
// 
//     project.meta.stage = isIdeaFinalized(project) ? "components" : "ideation";
// 
//     project.generationProfile = buildGenerationProfileFromMeta(
//       project.meta || {}
//     );
// 
//     const aiReply =
//       ai.question ||
//       ai.summary ||
//       "I've updated the project context. What's next?";
// 
//     project.messages.push({
//       role: "ai",
//       content: aiReply,
//     });
// 
//     await project.save();
// 
//     return res.json({
//       reply: ai.question,
//       ideaState: project.ideaState,
//       architectureState: project.architectureState,
//       generationProfile: project.generationProfile,
//     });
//   } catch (err: any) {
//     console.error("CHAT PROJECT ERROR:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };