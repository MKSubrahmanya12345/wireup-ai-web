// @ts-nocheck
// ??$$$ FORGE: build.controller.js — Generates and manages build artifacts (sketch + diagram)
// One-directional sync: sketch is source of truth, diagram derives from sketch.

import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import Project from '../models/project.model';
import { 
  generateWokwiAssetsFromState, 
  generateSketchOnly, 
  generateDiagramOnly, 
  validatePinSync 
} from '../services/ai.services';
import { validateSketch } from '../utils/validateSketch';
import { validateDiagram } from '../utils/validateDiagram';
import { repairBoard } from '../utils/boardLock';
import { setStageGenerating, setStageError, advanceStage, invalidateDownstream } from '../services/pipeline.service';
import { deriveBOMKey } from '../utils/bom.utils';
import { compileWokwiSketch } from '../services/wokwi-local.service';
import { triggerBOMModelFetchJob } from '../services/modelConversion.service';

/**
 * POST /api/build/generate
 * Generates sketch.ino + diagram.json from the project's generationProfile + BOM.
 * Runs validation and auto-repair. Saves to project.sketch + project.diagram.
 */
/* old code
export const generateBuild = async (req, res) => {
  const { projectId } = req.body;
  console.log(`[build.controller] generateBuild called for project: ${projectId}`);

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Guard: must have generationProfile.board
    if (!project.generationProfile?.board) {
      return res.status(400).json({
        error: 'Generation profile not set. Complete ideation first.',
        stage: 'ideation'
      });
    }

    // Guard: must have BOM (attempt auto-derivation if empty)
    if (!project.bom || project.bom.length === 0) {
      const components = project.componentsState?.components || [];
      const sensors = Array.isArray(project.ideation?.snapshot?.inputs) ? project.ideation.snapshot.inputs : [];
      const outputs = Array.isArray(project.ideation?.snapshot?.outputs) ? project.ideation.snapshot.outputs : [];
      const board = project.ideation?.snapshot?.computeCore ? [project.ideation.snapshot.computeCore] : [];
      
      const initialComponents = components.length > 0 ? components : [...board, ...sensors, ...outputs];
      
      if (initialComponents.length > 0) {
        project.bom = initialComponents.map((c, i) => {
          const name = typeof c === 'string' ? c.trim() : (c.name || `Component ${i + 1}`);
          return {
            key: deriveBOMKey(name),
            wokwiPartType: '',
            displayName: name,
            qty: 1,
            purpose: 'Auto-recovered component',
            pinConnections: [],
            price: 0,
            storeUrl: ''
          };
        });

        project.componentsState = {
          components: (project.bom || []).map(b => b.displayName || b.key),
          bom: project.bom
        };
        
        await project.save();
      } else {
        return res.status(400).json({
          error: 'BOM is empty and no components found in state. Complete components stage first.',
          stage: 'components'
        });
      }
    }

    await setStageGenerating(projectId, 'build');

    // ── Generate ──────────────────────────────────────────────────────────
    console.log(`[build.controller] Calling AI to generate assets...`);
    const result = await generateWokwiAssetsFromState({ project }); // ??$$$ fixed: wrap in object
    console.log(`[build.controller] AI generation complete. Received:`, { 
      hasSketch: !!result.sketchIno, 
      hasDiagram: !!result.diagramJson 
    });


    // ── Update project state ──────────────────────────────────────────
    const sketchValidation = validateSketch(result.sketchIno);
    if (!sketchValidation.valid) {
      throw new Error(`Sketch validation failed: ${sketchValidation.errors.join(', ')}`);
    }

    const diagramValidation = validateDiagram(result.diagramJson);
    if (!diagramValidation.valid) {
      throw new Error(`Diagram validation failed: ${diagramValidation.errors.join(', ')}`);
    }

    project.sketch = result.sketchIno;
    project.diagram = result.diagramJson;
    project.meta.buildCount = (project.meta.buildCount || 0) + 1;
    project.meta.lastBuiltAt = new Date();

    // Auto-repair board if needed
    const { repairedDiagram } = repairBoard(project.diagram, project.generationProfile.board);
    project.diagram = repairedDiagram;

    console.log(`[build.controller] Saving project with new build artifacts...`);
    await project.save();
    console.log(`[build.controller] Project saved. Advancing stage...`);
    await advanceStage(projectId, 'build');
    console.log(`[build.controller] Stage advanced. Returning success.`);

    res.json({
      success: true,
      sketch: project.sketch,
      diagram: project.diagram
    });

  } catch (err) {
    console.error('[build.controller] generateBuild error:', err);
    await setStageError(projectId, 'build', err.message);
    res.status(500).json({ error: err.message });
  }
};
*/

// ??$$$
export const generateBuild = async (req, res) => {
  const { projectId } = req.body;
  console.log(`[build.controller] generateBuild (sketch only) called for project: ${projectId}`);

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Guard: must have generationProfile.board
    if (!project.generationProfile?.board) {
      return res.status(400).json({
        error: 'Generation profile not set. Complete ideation first.',
        stage: 'ideation'
      });
    }

    await setStageGenerating(projectId, 'build');

    console.log(`[build.controller] Calling AI generateSketchOnly...`);
    const sketch = await generateSketchOnly(project);
    project.sketch = sketch;
    project.meta.buildCount = (project.meta.buildCount || 0) + 1;
    project.meta.lastBuiltAt = new Date();

    // Also verify and auto-derive BOM if empty for safety
    if (!project.bom || project.bom.length === 0) {
      const components = project.componentsState?.components || [];
      const sensors = Array.isArray(project.ideation?.snapshot?.inputs) ? project.ideation.snapshot.inputs : [];
      const outputs = Array.isArray(project.ideation?.snapshot?.outputs) ? project.ideation.snapshot.outputs : [];
      const board = project.ideation?.snapshot?.computeCore ? [project.ideation.snapshot.computeCore] : [];
      const initialComponents = components.length > 0 ? components : [...board, ...sensors, ...outputs];
      
      if (initialComponents.length > 0) {
        project.bom = initialComponents.map((c, i) => {
          const name = typeof c === 'string' ? c.trim() : (c.name || `Component ${i + 1}`);
          return {
            key: deriveBOMKey(name),
            wokwiPartType: '',
            displayName: name,
            qty: 1,
            purpose: 'Auto-recovered component',
            pinConnections: [],
            price: 0,
            storeUrl: ''
          };
        });
      }
    }

    console.log(`[build.controller] Saving project with generated sketch...`);
    await project.save();
    
    // Auto-advance if diagram exists
    if (project.sketch && project.diagram && Object.keys(project.diagram).length > 0) {
      await advanceStage(projectId, 'build');
    }

    const language = project.generationProfile?.language || (project.ideation?.compute?.toLowerCase().includes("esp32") ? "micropython" : "cpp");

    // Trigger background 3D model job
    if (project.bom && project.bom.length > 0) {
      triggerBOMModelFetchJob(projectId, project.bom);
    }

    res.json({
      sketch: project.sketch,
      language
    });

  } catch (err) {
    console.error('[build.controller] generateBuild error:', err);
    await setStageError(projectId, 'build', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/build/sync
 * Manually sync sketch change to diagram.
 */
export const syncBuild = async (req, res) => {
  const { projectId, sketch, diagram } = req.body; // ??$$$ added diagram

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (sketch !== undefined) {
      const validation = validateSketch(sketch);
      if (!validation.valid) {
        console.warn(`[build.controller] Sketch validation failed:`, validation.errors); // ??$$$ verbose
        return res.status(400).json({ error: `Sketch validation failed: ${validation.errors.join(', ')}` });
      }
      project.sketch = sketch;
    }

    if (diagram !== undefined) {
      const dValidation = validateDiagram(diagram); // ??$$$
      if (!dValidation.valid) {
        console.warn(`[build.controller] Diagram validation failed:`, dValidation.errors); // ??$$$ verbose
        return res.status(400).json({ error: `Diagram validation failed: ${dValidation.errors.join(', ')}` });
      }
      project.diagram = diagram;
    }

    
    // Invalidate downstream stages on any build change
    await invalidateDownstream(projectId, 'build'); // ??$$$
    
    // ??$$$ Auto-advance stage to 'done' if both artifacts are now present and valid
    if (project.sketch && project.diagram && Object.keys(project.diagram).length > 0) {
      await advanceStage(projectId, 'build');
    }

    await project.save();
    res.json({ 
      success: true, 
      sketch: project.sketch,
      diagram: project.diagram,
      stageStatus: project.stageStatus?.build || 'ready'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * GET /api/build/:projectId
 * Returns existing build artifacts.
 */
/* old code
export const getBuild = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({
      sketch: project.sketch,
      diagram: project.diagram
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
*/

// ??$$$
export const getBuild = async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Trigger background 3D model conversion job
    if (project.bom && project.bom.length > 0) {
      triggerBOMModelFetchJob(projectId, project.bom);
    }

    res.json({
      sketch: project.sketch,
      diagram: project.diagram,
      bom: project.bom,
      lastCompilation: project.lastCompilation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const compileBuild = async (req, res) => {
  const { projectId } = req.body;
  console.log(`[build.controller] compileBuild called for project: ${projectId}`);

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  let tempDir = null;
  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let projectPath = project.wokwiProjectPath;
    if (!projectPath || !existsSync(projectPath)) {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "wireup-compile-"));
      projectPath = tempDir;
    }

    // Write sketch to projectPath/sketch.ino
    const sketchPath = path.join(projectPath, "sketch.ino");
    await mkdir(projectPath, { recursive: true });
    await writeFile(sketchPath, project.sketch || "", "utf8");

    let fqbn = "arduino:avr:uno";
    const board = project.generationProfile?.board || "";
    if (board.includes("mega")) {
      fqbn = "arduino:avr:mega";
    } else if (board.includes("nano")) {
      fqbn = "arduino:avr:nano";
    } else if (board.includes("esp32")) {
      fqbn = "esp32:esp32:esp32";
    }

    console.log(`[build.controller] Compiling sketch at: ${sketchPath} with FQBN: ${fqbn}`);
    const compileResult = await compileWokwiSketch({
      projectPath,
      sketchFile: "sketch.ino",
      fqbn
    });

    const isSuccess = !!compileResult.ok;
    const errors = isSuccess ? [] : [compileResult.stderrTail || compileResult.stdoutTail || "Compile failed"];

    project.lastCompilation = {
      hex: isSuccess ? (compileResult.metadata?.firmwarePath || "hex") : "",
      compilationErrors: errors,
      warnings: [],
      compiledAt: new Date()
    };
    await project.save();

    res.json({
      success: isSuccess,
      errors,
      warnings: []
    });

  } catch (err) {
    console.error('[build.controller] compileBuild error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};

/**
 * POST /api/build/generate-sketch
 */
export const generateSketch = async (req, res) => {
  const { projectId } = req.body;
  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const sketch = await generateSketchOnly(project);
    project.sketch = sketch;
    
    const warnings = validatePinSync(project.sketch, project.diagram);
    
    // ??$$$ Auto-advance if both are ready
    if (project.sketch && project.diagram && Object.keys(project.diagram).length > 0) {
      await advanceStage(projectId, 'build');
    }

    await project.save();
    res.json({ success: true, sketch, warnings, stageStatus: project.stageStatus?.build });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/build/generate-diagram
 */
export const generateDiagram = async (req, res) => {
  const { projectId } = req.body;
  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const diagram = await generateDiagramOnly(project);
    
    // Auto-repair board if needed ??$$$
    const { repairedDiagram } = repairBoard(diagram, project.generationProfile);
    project.diagram = repairedDiagram;

    const warnings = validatePinSync(project.sketch, project.diagram);
    
    // ??$$$ Auto-advance if both are ready
    if (project.sketch && project.diagram && Object.keys(project.diagram).length > 0) {
      await advanceStage(projectId, 'build');
    }

    await project.save();

    res.json({ success: true, diagram, warnings, stageStatus: project.stageStatus?.build });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
