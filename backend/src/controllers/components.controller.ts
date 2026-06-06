// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// @ts-nocheck
import Project from "../models/project.model";
import { processComponents } from "../services/ai.services";
import { generateArtifactsFromRegistry } from "../services/registry-codegen.service";
import { deriveBOMKey } from "../utils/bom.utils";
import { invalidateDownstream } from "../services/pipeline.service"; // ???
// ??$$$ newer code
import { getRegistry } from "../services/registry.services";

// Old code:
// const isIdeaFinalized = (project) => {
//   return Boolean(project?.ideaState?.summary?.trim()) && (project?.ideaState?.unknowns?.length ?? 0) === 0;
// };
// ??$$$ newer code
const isIdeaFinalized = (project) => {
  return project?.ideation?.finalized === true;
};

const canStartComponents = (project) => {
  return isIdeaFinalized(project) || project?.meta?.stage === "components";
};

/*
INITIALIZE COMPONENTS
*/
export const initComponents = async (req, res) => {
  try {
    const { projectId } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!canStartComponents(project)) {
      return res.status(400).json({
        error: "Finalize Ideation AI before starting Components AI"
      });
    }

    // Call AI to get structured BOM
    const ai = await processComponents(project, "Start components design");

    // Fallback: If AI returns empty BOM, use the one pre-populated during finalization or derive from meta
    if (!ai.bom || ai.bom.length === 0) {
      if (!project.bom || project.bom.length === 0) {
        // Old code:
        // const sensors = Array.isArray(project.extractedContext?.sensors) ? project.extractedContext.sensors : [];
        // const outputs = Array.isArray(project.extractedContext?.outputs) ? project.extractedContext.outputs : [];
        // const board = project.extractedContext?.board ? [project.extractedContext.board] : [];
        // ??$$$ newer code
        const sensors = Array.isArray(project.ideation?.snapshot?.inputs) ? project.ideation.snapshot.inputs : [];
        const outputs = Array.isArray(project.ideation?.snapshot?.outputs) ? project.ideation.snapshot.outputs : [];
        const board = project.ideation?.snapshot?.computeCore ? [project.ideation.snapshot.computeCore] : [];
        const initialComponents = [...board, ...sensors, ...outputs];
        
        project.bom = initialComponents.map(name => ({
          key: deriveBOMKey(name),
          wokwiPartType: '',
          displayName: name,
          qty: 1,
          purpose: 'Fallback component from ideation',
          pinConnections: [],
          price: 0,
          storeUrl: ''
        }));
      }
    } else {
      project.bom = ai.bom;
    }

    // ??$$$ newer code
    project.bom = distributeComponentsAcrossPhases(project.bom.map(b => b.toObject ? b.toObject() : b), project.ideation?.phases || {});

    project.pinAssignments = ai.pinAssignments || project.pinAssignments || {};

    project.componentsState = {
      components: (project.bom || []).map(b => b.displayName || b.key),
      bom: project.bom
    };

    if (!project.componentsMessages) project.componentsMessages = [];
    /* old code
    project.componentsMessages.push({
      role: "ai",
      content: ai.assistantReply || "I've structured your components list based on our ideation."
    });
    */
    // ??$$$
    project.componentsMessages.push({
      role: "model",
      content: ai.assistantReply || "I've structured your components list based on our ideation."
    });

    project.stageStatus.components = "done";
    project.stageStatus.build = "ready";

    await project.save();

    res.json({
      reply: ai.assistantReply || "I've structured your components list.",
      bom: project.bom,
      pinAssignments: project.pinAssignments
    });

  } catch (err) {
    console.error("PROJECT ERROR:", err);
    import('fs').then(fs => fs.appendFileSync('components_error.log', `\n[${new Date().toISOString()}] ${err.stack || err.message}`));
    res.status(500).json({ 
      error: err.message, 
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      context: "Components Init Failure"
    });
  }
};


/*
CHAT LOOP - COMPONENTS
*/
export const chatComponents = async (req, res) => {
  try {
    const { projectId, message } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!canStartComponents(project)) {
      return res.status(400).json({
        error: "Finalize Ideation AI before starting Components AI"
      });
    }

    if (!project.componentsMessages) project.componentsMessages = [];

    // store user msg
    project.componentsMessages.push({
      role: "user",
      content: message
    });

    const ai = await processComponents(project, message);

    project.bom = ai.bom || project.bom || [];
    // ??$$$ newer code
    project.bom = distributeComponentsAcrossPhases(project.bom.map(b => b.toObject ? b.toObject() : b), project.ideation?.phases || {});

    project.pinAssignments = ai.pinAssignments || project.pinAssignments || {};

    project.componentsState = {
      components: (project.bom || []).map(b => b.displayName || b.key),
      bom: project.bom
    };

    /* old code
    project.componentsMessages.push({
      role: "ai",
      content: ai.assistantReply
    });
    */
    // ??$$$
    project.componentsMessages.push({
      role: "model",
      content: ai.assistantReply
    });

    await project.save();

    res.json({
      reply: ai.assistantReply,
      bom: project.bom,
      pinAssignments: project.pinAssignments,
      componentsState: project.componentsState
    });

  } catch (err) {
    console.error("COMPONENTS CHAT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

/*
GENERATE WOKWI FILES
*/
export const generateWokwiFilesFromAI = async (req, res) => {
  try {
    const { projectId } = req.body;
    const project = await Project.findById(projectId);

    if (!project) return res.status(404).json({ error: "Project not found" });

    // Use shared registry service
    const artifacts = await generateArtifactsFromRegistry({ project });

    project.sketch = artifacts.sketchIno;
    project.diagram = artifacts.diagramJson;
    project.meta.stage = "build";

    await project.save();

    res.json({
      sketch: project.sketch,
      diagram: project.diagram
    });

  } catch (err) {
    console.error("GENERATE FILES ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

/*
UPDATE BOM COMPONENT — called by useProjectStore.updateBOM()
??$$$ PUT /api/components/update
*/
export const updateComponent = async (req, res) => {
  try {
    const { projectId, componentKey, replacement } = req.body;

    if (!projectId || !componentKey || !replacement) {
      return res.status(400).json({ error: 'projectId, componentKey, and replacement are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const bomIndex = (project.bom || []).findIndex(b => b.key === componentKey);
    if (bomIndex === -1) {
      return res.status(404).json({ error: `Component key '${componentKey}' not found in BOM` });
    }

    // Merge replacement fields over existing BOM item
    project.bom[bomIndex] = { ...project.bom[bomIndex].toObject(), ...replacement };
    project.markModified('bom');

    // ??$$$ newer code - V1 State Propagation
    if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    project.bomMeta.version += 1;
    project.bomMeta.lastModifiedBy = req.body.modifier || "user";
    if (req.body.locked !== undefined) {
      project.bomMeta.locked = req.body.locked;
    }
    project.wiringMeta.staleReason = "BOM component was modified";
    project.sketchMeta.staleReason = "BOM component was modified";
    project.markModified('bomMeta');
    project.markModified('wiringMeta');
    project.markModified('sketchMeta');

    project.componentsState = {
      components: project.bom.map(b => b.displayName || b.key),
      bom: project.bom
    };

    // Invalidate all downstream stages (build, simulation, assembly, shopping)
    await invalidateDownstream(projectId, 'components'); // ??$$$

    await project.save();

    res.json({ success: true, updatedBom: project.bom });
  } catch (err) {
    console.error('UPDATE COMPONENT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

// ??$$$ newer code
export function distributeComponentsAcrossPhases(bom: any[], phases: Record<string, string>) {
  if (!bom || bom.length === 0) return bom;
  
  // Sort phase keys chronologically (e.g., PHASE_1, PHASE_2, PHASE_3)
  const phaseKeys = Object.keys(phases || {}).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    return numA - numB;
  });

  if (phaseKeys.length === 0) {
    return bom.map(item => ({ ...item, phase: "PHASE_1" }));
  }

  return bom.map(item => {
    const displayName = String(item.displayName || "").toLowerCase();
    const purpose = String(item.purpose || "").toLowerCase();
    const key = String(item.key || "").toLowerCase();

    // 1. If it's a microcontroller/controller board, it must be in the very first phase (PHASE_1)
    const isMCU = displayName.includes("arduino") || 
                  displayName.includes("esp32") || 
                  displayName.includes("board") || 
                  displayName.includes("pico") || 
                  displayName.includes("uno") || 
                  displayName.includes("nano") ||
                  purpose.includes("controller") ||
                  purpose.includes("microcontroller") ||
                  key.includes("board");
                  
    if (isMCU) {
      return { ...item, phase: phaseKeys[0] };
    }

    // 2. Search phase descriptions for matching keywords
    for (const phaseKey of phaseKeys) {
      const desc = String(phases[phaseKey] || "").toLowerCase();
      const tokens = displayName.split(/[\s_\-]+/).filter(t => t.length > 2);
      const matchesToken = tokens.some(token => desc.includes(token));
      
      if (
        matchesToken ||
        (key && desc.includes(key)) ||
        (item.wokwiPartType && desc.includes(String(item.wokwiPartType).toLowerCase()))
      ) {
        return { ...item, phase: phaseKey };
      }
    }

    // 3. Fallback matching
    for (const phaseKey of phaseKeys) {
      const desc = String(phases[phaseKey] || "").toLowerCase();
      if (
        (displayName.includes("sensor") && (desc.includes("sensor") || desc.includes("read") || desc.includes("input"))) ||
        (displayName.includes("led") && (desc.includes("led") || desc.includes("light") || desc.includes("display") || desc.includes("output"))) ||
        (displayName.includes("motor") && (desc.includes("motor") || desc.includes("servo") || desc.includes("stepper") || desc.includes("move")))
      ) {
        return { ...item, phase: phaseKey };
      }
    }

    return { ...item, phase: phaseKeys[0] };
  });
}

// ??$$$ newer code
export const syncWiring = async (req, res) => {
  try {
    const { projectId, nodeCoordinates, bomPhases, connections } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 1. Update nodeCoordinates
    if (nodeCoordinates) {
      project.nodeCoordinates = nodeCoordinates;
      project.markModified("nodeCoordinates");
    }

    // 2. Update BOM phases
    if (bomPhases) {
      project.bom.forEach((item) => {
        if (bomPhases[item.key] !== undefined) {
          item.phase = bomPhases[item.key];
        }
      });
      project.markModified("bom");
    }

    // 3. Update diagram parts coordinates to match nodeCoordinates
    if (project.diagram && project.diagram.parts && nodeCoordinates) {
      project.diagram.parts = project.diagram.parts.map((part) => {
        const coords = nodeCoordinates[part.id];
        if (coords) {
          return {
            ...part,
            top: coords.y,
            left: coords.x,
            rotate: coords.rotate ?? part.rotate ?? 0
          };
        }
        return part;
      });
      project.markModified("diagram");
    }

    // 4. Update diagram connections and pinConnections in BOM
    if (connections) {
      // Clear old pinConnections on BOM items
      project.bom.forEach((item) => {
        item.pinConnections = [];
      });

      // Update diagram connections
      if (!project.diagram) project.diagram = {};
      project.diagram.connections = connections;
      project.markModified("diagram");

      // Rebuild pinConnections for each BOM item from connections
      connections.forEach(([fromStr, toStr]) => {
        if (typeof fromStr !== "string" || typeof toStr !== "string") return;
        const [fromId, fromPin] = fromStr.split(":");
        const [toId, toPin] = toStr.split(":");

        if (fromId && fromPin && toId && toPin) {
          const fromItem = project.bom.find((item) => item.key === fromId);
          if (fromItem) {
            fromItem.pinConnections.push({
              pin: fromPin,
              connectsTo: `${toId}:${toPin}`
            });
          }

          const toItem = project.bom.find((item) => item.key === toId);
          if (toItem) {
            toItem.pinConnections.push({
              pin: toPin,
              connectsTo: `${fromId}:${fromPin}`
            });
          }
        }
      });
      project.markModified("bom");
    }

    // ??$$$ newer code - V1 State Propagation
    if (!project.bomMeta) project.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!project.wiringMeta) project.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!project.sketchMeta) project.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    project.wiringMeta.version += 1;
    project.wiringMeta.bomVersionUsed = project.bomMeta.version;
    project.wiringMeta.lastModifiedBy = req.body.modifier || "user";
    if (req.body.locked !== undefined) {
      project.wiringMeta.locked = req.body.locked;
    }
    project.sketchMeta.staleReason = "Wiring connections changed";
    project.markModified('wiringMeta');
    project.markModified('sketchMeta');

    // Invalidate downstream stages (build, simulation, assembly, shopping)
    await invalidateDownstream(projectId, "components");

    await project.save();

    res.json({
      success: true,
      bom: project.bom,
      diagram: project.diagram,
      nodeCoordinates: project.nodeCoordinates
    });
  } catch (err) {
    console.error("SYNC WIRING ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ??$$$ newer code
export const getRegistryController = async (req, res) => {
  try {
    const registry = getRegistry();
    res.json(registry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
