// @ts-nocheck
import Project from "../models/project.model";
import { processComponents } from "../services/ai.services";
import { generateArtifactsFromRegistry } from "../services/registry-codegen.service";
import { deriveBOMKey } from "../utils/bom.utils";
import { invalidateDownstream } from "../services/pipeline.service"; // ???

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
