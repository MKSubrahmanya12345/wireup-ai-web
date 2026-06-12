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
  // ??$$$ newer code
  bomMeta?: any;
  wiringMeta?: any;
  sketchMeta?: any;
  files?: any[];
  activeFile?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

    // ??$$$ newer code
    // ??$$$ Initialize project.ideation with empty messages array so first boot triggers the agent call
    const project = await Project.create({
      description,
      owner: req.user._id,
      // ??$$$ newer code
      files: [
        {
          name: "README.md",
          language: "markdown",
          content: `# ${description.trim()}\n\nProject created with WireUp.\n`,
        },
      ],
      activeFile: "README.md",
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

    // ??$$$ newer code
    project.generationProfile = buildGenerationProfileFromMeta(
      project.meta || {}
    );
    await project.save();

    // ??$$$ newer code - return _id along with projectId to support frontend navigation contract
    return res.json({
      _id: project._id,
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

    // ??$$$ newer code — Merge pins, glbUrl and componentType from Part documents into BOM items dynamically
    if (project.bom && Array.isArray(project.bom)) {
      project.bom = await Promise.all(project.bom.map(async (item: any) => {
        const queryMpn = item.partId || item.mpn || item.key;
        let partDoc: any = null;
        try {
          partDoc = await Part.findOne({ mpn: queryMpn }).lean();
        } catch (e) {}

        const displayName = partDoc?.name || item.displayName || item.key || "Unknown Component";
        const componentType = partDoc?.componentType || item.type || item.role || "module";
        const pins = partDoc?.pins || [];
        const glbUrl = partDoc?.glbUrl || item.glbUrl || "";
        const mpn = partDoc?.mpn || item.partId || item.mpn || "";

        return {
          ...item,
          mpn,
          displayName,
          pins,
          glbUrl,
          type: componentType,
          wokwiPartType: partDoc?.wokwiPartType || item.wokwiPartType || ""
        };
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

    // ??$$$ newer code
    const hasDescription = typeof description === "string";
    const hasWokwiUrl = typeof wokwiUrl === "string";
    const hasWokwiProjectPath = typeof wokwiProjectPath === "string";
    const hasBomMeta = req.body.bomMeta !== undefined;
    const hasWiringMeta = req.body.wiringMeta !== undefined;
    const hasSketchMeta = req.body.sketchMeta !== undefined;
    const hasFiles = req.body.files !== undefined;
    const hasActiveFile = req.body.activeFile !== undefined;

    if (!hasDescription && !hasWokwiUrl && !hasWokwiProjectPath && !hasBomMeta && !hasWiringMeta && !hasSketchMeta && !hasFiles && !hasActiveFile) {
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

    // ??$$$ newer code
    if (hasBomMeta) {
      project.bomMeta = { ...((project.bomMeta as any)?.toObject?.() || project.bomMeta), ...req.body.bomMeta };
      project.markModified("bomMeta");
    }
    if (hasWiringMeta) {
      project.wiringMeta = { ...((project.wiringMeta as any)?.toObject?.() || project.wiringMeta), ...req.body.wiringMeta };
      project.markModified("wiringMeta");
    }
    if (hasSketchMeta) {
      project.sketchMeta = { ...((project.sketchMeta as any)?.toObject?.() || project.sketchMeta), ...req.body.sketchMeta };
      project.markModified("sketchMeta");
    }
    // ??$$$ newer code - sync project files update back to NewFlowSession and the local disk mirror
    if (hasFiles) {
      project.files = req.body.files;
      project.markModified("files");

      try {
        const NewFlowSession = require("../models/newFlowSession.model").default;
        const { syncSessionToDisk } = require("../agents/formulation/formulation.persistence");
        const session = await NewFlowSession.findOne({ projectId: project._id });
        if (session) {
          const files = req.body.files || [];
          const sketchFile = files.find((f: any) => f.name === "sketch.ino");
          if (sketchFile) {
            session.finalSketch = sketchFile.content;
            session.markModified("finalSketch");
          }
          
          const wiringFile = files.find((f: any) => f.name === "wiring.json");
          if (wiringFile) {
            try {
              session.wiring = JSON.parse(wiringFile.content);
              session.markModified("wiring");
            } catch (e) {
              console.error("Failed to parse wiring.json for session update:", e);
            }
          }
          
          const milestonesFile = files.find((f: any) => f.name === "milestones.json");
          if (milestonesFile) {
            try {
              session.milestones = JSON.parse(milestonesFile.content);
              session.markModified("milestones");
            } catch (e) {
              console.error("Failed to parse milestones.json for session update:", e);
            }
          }

          const diagramFile = files.find((f: any) => f.name === "diagram.json");
          if (diagramFile) {
            try {
              session.diagram = JSON.parse(diagramFile.content);
              session.markModified("diagram");
            } catch (e) {
              console.error("Failed to parse diagram.json for session update:", e);
            }
          }

          await session.save();
          await syncSessionToDisk(session._id.toString());
        }
      } catch (err) {
        console.error("Error syncing project files update to session/disk:", err);
      }
    }

    if (hasActiveFile) {
      project.activeFile = req.body.activeFile;
      project.markModified("activeFile");
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
