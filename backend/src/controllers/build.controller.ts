// ??$$$ group 4 - Build & Firmware Compilation (Phase 3)
// @ts-nocheck
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
// ??$$$
import {
  callGeminiMilestoneGenerator,
  callGeminiDebugCoachIterative,
  callGeminiRegenerateMilestoneCode,
  callGeminiComponentIssue,
  callGeminiValidateSerial
} from '../services/gemini.service';
// ??$$$ newer code
import { exec as cbExec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(cbExec);
import SystemConfig from '../models/systemConfig.model';

// ??$$$ newer code - resolve arduino-cli path based on environments
function resolveArduinoCliPath() {
  if (process.env.ARDUINO_CLI_PATH?.trim()) {
    return process.env.ARDUINO_CLI_PATH.trim();
  }
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const windowsLocal = path.join(home, ".arduino-cli", "bin", "arduino-cli.exe");
  const unixLocal = path.join(home, ".arduino-cli", "bin", "arduino-cli");

  if (existsSync(windowsLocal)) return windowsLocal;
  if (existsSync(unixLocal)) return unixLocal;

  return "arduino-cli";
}

// ??$$$ newer code - ensureLibrariesInstalled utility function with TTL and conflict checking
async function ensureLibrariesInstalled(libraries: any[]) {
  if (!libraries || libraries.length === 0) return;

  const arduinoCliPath = resolveArduinoCliPath();

  // Quick pre-check
  try {
    await exec(`"${arduinoCliPath}" version`);
  } catch (err) {
    console.warn(`[ensureLibrariesInstalled] 'arduino-cli' is not installed or not found in system PATH or default home directory. Automatic library installer skipped.`);
    return;
  }

  // Check TTL (24 hours = 86400000 ms)
  const config = await SystemConfig.findOne({ key: "installed_arduino_libraries" });
  let cacheValid = false;
  let cachedLibs: any[] = [];

  if (config && config.value && config.value.cachedAt) {
    const cachedAt = new Date(config.value.cachedAt).getTime();
    const now = Date.now();
    if (now - cachedAt < 24 * 60 * 60 * 1000) {
      cacheValid = true;
      cachedLibs = config.value.libs || [];
    }
  }

  for (const lib of libraries) {
    if (lib.type === "core") continue; // built-in core libraries, no install
    if (lib.type === "manual") {
      console.warn(`[ensureLibrariesInstalled] Manual library required: ${lib.name} — ${lib.installCommand || ""}`);
      continue;
    }

    if (lib.type === "library_manager") {
      // Check cache first if valid
      let alreadyInstalled = false;
      if (cacheValid) {
        const cached = cachedLibs.find(c => c.name === lib.name);
        if (cached) {
          if (!lib.version || cached.version === lib.version) {
            alreadyInstalled = true;
          }
        }
      }

      // If not in cache or version mismatch, check with arduino-cli list
      if (!alreadyInstalled) {
        try {
          const { stdout } = await exec(`"${arduinoCliPath}" lib list --format json`);
          let libsList: any[] = [];
          try {
            const parsed = JSON.parse(stdout);
            libsList = Array.isArray(parsed) ? parsed : (parsed.libraries || []);
          } catch (pe) {
            console.error("Failed to parse arduino-cli JSON output:", pe);
          }

          // In arduino-cli, library details are often inside found.library.name or found.name
          const found = libsList.find(item => {
            const l = item.library || item;
            return l.name === lib.name;
          });

          if (found) {
            const foundLib = found.library || found;
            const currentVersion = foundLib.version;
            if (lib.version && currentVersion !== lib.version) {
              console.log(`[ensureLibrariesInstalled] Library version conflict for ${lib.name}. Expected ${lib.version}, found ${currentVersion}. Upgrading/installing...`);
              await installLibrary(lib.name, lib.version);
            } else {
              console.log(`[ensureLibrariesInstalled] Library ${lib.name} is already installed with version ${currentVersion}`);
            }
          } else {
            console.log(`[ensureLibrariesInstalled] Library ${lib.name} not found. Installing...`);
            await installLibrary(lib.name, lib.version);
          }
        } catch (err) {
          console.error(`[ensureLibrariesInstalled] CLI check failed for ${lib.name}, trying direct install:`, err);
          await installLibrary(lib.name, lib.version);
        }
      }
    }
  }

  // After all libraries are installed/verified, update the cache
  try {
    const { stdout } = await exec(`"${arduinoCliPath}" lib list --format json`);
    let libsList: any[] = [];
    try {
      const parsed = JSON.parse(stdout);
      libsList = Array.isArray(parsed) ? parsed : (parsed.libraries || []);
    } catch (pe) {}

    const libsToCache = libsList.map(item => {
      const l = item.library || item;
      return { name: l.name, version: l.version };
    });

    await SystemConfig.findOneAndUpdate(
      { key: "installed_arduino_libraries" },
      {
        value: {
          libs: libsToCache,
          cachedAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (cacheErr) {
    console.error("Failed to update installed libraries cache:", cacheErr);
  }
}

async function installLibrary(name: string, version?: string) {
  const arduinoCliPath = resolveArduinoCliPath();
  const cmd = version
    ? `"${arduinoCliPath}" lib install "${name}@${version}"`
    : `"${arduinoCliPath}" lib install "${name}"`;
  console.log(`[ensureLibrariesInstalled] Running: ${cmd}`);
  try {
    await exec(cmd);
  } catch (err) {
    console.error(`[ensureLibrariesInstalled] Failed to run command "${cmd}":`, err);
    throw err;
  }
}


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
    
    // ??$$$ Advance stage whenever sketch is generated — don't gate on diagram existence
    await advanceStage(projectId, 'build');

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
    await setStageError(projectId, 'build'); // ??$$$ fixed: removed wrong 3rd arg
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
    const { repairedDiagram } = repairBoard(diagram, project.generationProfile?.board); // ??$$$ fixed: pass board string not whole profile
    project.diagram = repairedDiagram;

    const warnings = validatePinSync(project.sketch, project.diagram);
    
    // ??$$$ Advance stage whenever diagram is generated — don't gate on sketch
    await advanceStage(projectId, 'build');

    await project.save();

    res.json({ success: true, diagram, warnings, stageStatus: project.stageStatus?.build });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const generateMilestones = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.milestonesGenerated && project.milestones && project.milestones.length > 0) {
      return res.json({ milestones: project.milestones, activeMilestoneId: project.activeMilestoneId });
    }

    if (!project.bom || project.bom.length === 0) {
      return res.status(400).json({ error: 'BOM not ready. Complete components stage first.' });
    }

    if (!project.ideation?.readyForComponents) {
      return res.status(400).json({ error: 'Ideation not complete.' });
    }

    await setStageGenerating(project._id, 'build');

    const skillLevel = req.user?.skillLevel || "beginner";
    const generated = await callGeminiMilestoneGenerator(
      project.ideation.brief || "",
      project.ideation.objective || "",
      project.ideation.compute || "",
      project.ideation.phases || {},
      project.bom || [],
      project.ideation.constraints || "",
      skillLevel
    );

    if (!generated || generated.length === 0) {
      await setStageError(project._id, 'build');
      return res.status(500).json({ error: 'AI failed to generate build milestones. Please try again.' });
    }

    project.milestones = generated;
    project.milestonesGenerated = true;
    project.activeMilestoneId = generated[0]?.id || null;

    await project.save();
    res.json({ milestones: project.milestones, activeMilestoneId: project.activeMilestoneId });

  } catch (err) {
    console.error('[build.controller] generateMilestones error:', err);
    await setStageError(req.params.id, 'build');
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const getMilestones = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ milestones: project.milestones || [], activeMilestoneId: project.activeMilestoneId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const updateMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { title, objective, wiringInstructions, code, test, status, userConfirmed, userNotes, serialOutput } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    if (title !== undefined) milestone.title = title;
    if (objective !== undefined) milestone.objective = objective;
    if (wiringInstructions !== undefined) milestone.wiringInstructions = wiringInstructions;
    if (code !== undefined) {
      if (milestone.code !== code) {
        milestone.compiledHex = "";
        milestone.compilationErrors = [];
      }
      milestone.code = code;
    }
    if (test !== undefined) milestone.test = test;
    if (status !== undefined) milestone.status = status;
    if (userConfirmed !== undefined) milestone.userConfirmed = userConfirmed;
    if (userNotes !== undefined) milestone.userNotes = userNotes;
    if (serialOutput !== undefined) milestone.serialOutput = serialOutput;
    // ??$$$ newer code
    if (req.body.manualLibsAcknowledged !== undefined) milestone.manualLibsAcknowledged = req.body.manualLibsAcknowledged;

    await project.save();
    res.json(milestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* old code
export const compileMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  let tempDir = null;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const unsatisfied = milestone.dependsOn.filter(depId => {
      const dep = project.milestones.find(dm => dm.id === depId);
      return !dep || dep.status !== "passed";
    });
    if (unsatisfied.length > 0) {
      return res.status(400).json({ error: `Dependencies not satisfied: ${unsatisfied.join(', ')}` });
    }

    if (milestone.simulatable === false) {
      milestone.status = "in_progress";
      await project.save();
      return res.json({ success: true, hex: "", errors: [], message: "Physical-only milestone. Skipping Wokwi compilation." });
    }

    milestone.status = "in_progress";
    await project.save();

    tempDir = await mkdtemp(path.join(os.tmpdir(), "wireup-compile-milestone-"));
    const sketchPath = path.join(tempDir, "sketch.ino");
    await mkdir(tempDir, { recursive: true });
    await writeFile(sketchPath, milestone.code || "", "utf8");

    let fqbn = "arduino:avr:uno";
    const board = project.generationProfile?.board || "";
    if (board.includes("mega")) {
      fqbn = "arduino:avr:mega";
    } else if (board.includes("nano")) {
      fqbn = "arduino:avr:nano";
    } else if (board.includes("esp32")) {
      fqbn = "esp32:esp32:esp32";
    }

    console.log(`[build.controller] Compiling milestone sketch: ${sketchPath} for ${fqbn}`);
    const compileResult = await compileWokwiSketch({
      projectPath: tempDir,
      sketchFile: "sketch.ino",
      fqbn
    });

    const isSuccess = !!compileResult.ok;
    const errors = isSuccess ? [] : [compileResult.stderrTail || compileResult.stdoutTail || "Compile failed"];

    milestone.compiledHex = isSuccess ? (compileResult.metadata?.firmwarePath || "hex") : "";
    milestone.compilationErrors = errors;

    await project.save();
    res.json({
      success: isSuccess,
      hex: milestone.compiledHex,
      errors
    });

  } catch (err) {
    console.error('[build.controller] compileMilestone error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};
*/
// ??$$$ newer code - compileMilestone with library verification & exact FQBN mapping
export const compileMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  let tempDir = null;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const unsatisfied = milestone.dependsOn.filter(depId => {
      const dep = project.milestones.find(dm => dm.id === depId);
      return !dep || dep.status !== "passed";
    });
    if (unsatisfied.length > 0) {
      return res.status(400).json({ error: `Dependencies not satisfied: ${unsatisfied.join(', ')}` });
    }

    // Manual libraries compile gate
    const manualLibs = milestone.requiredLibraries?.filter(l => l.type === "manual") || [];
    if (manualLibs.length > 0) {
      if (!milestone.manualLibsAcknowledged) {
        return res.status(400).json({
          error: "manual_libs_required",
          libraries: manualLibs,
          message: "This milestone requires libraries that must be installed manually. Please acknowledge that you have installed them before compiling."
        });
      }
    }

    if (milestone.simulatable === false) {
      milestone.status = "in_progress";
      await project.save();
      return res.json({ success: true, hex: "", errors: [], message: "Physical-only milestone. Skipping Wokwi compilation." });
    }

    milestone.status = "in_progress";
    await project.save();

    // Ensure all required libraries are installed prior to compiling
    if (milestone.requiredLibraries && milestone.requiredLibraries.length > 0) {
      console.log(`[compileMilestone] Ensuring libraries are installed: ${JSON.stringify(milestone.requiredLibraries)}`);
      await ensureLibrariesInstalled(milestone.requiredLibraries);
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), "wireup-compile-milestone-"));
    const sketchPath = path.join(tempDir, "sketch.ino");
    await mkdir(tempDir, { recursive: true });
    await writeFile(sketchPath, milestone.code || "", "utf8");

    // Board FQBN Map matching
    const COMPUTE_TO_FQBN: Record<string, string> = {
      "esp32":      "esp32:esp32:esp32",
      "esp8266":    "esp8266:esp8266:generic",
      "arduino uno": "arduino:avr:uno",
      "arduino nano": "arduino:avr:nano",
      "teensy":     "teensy:avr:teensy40",
      "pico":       "rp2040:rp2040:rpipico",
      "attiny":     "ATTinyCore:avr:attinyx5",
    };

    let fqbn = "arduino:avr:uno";
    const board = (project.generationProfile?.board || "").toLowerCase();
    const compute = (project.ideation?.compute || "").toLowerCase();
    
    let matchedFqbn = "";
    for (const [key, val] of Object.entries(COMPUTE_TO_FQBN)) {
      if (board.includes(key) || compute.includes(key)) {
        matchedFqbn = val;
        break;
      }
    }
    if (matchedFqbn) {
      fqbn = matchedFqbn;
    } else {
      console.warn(`[compileMilestone] No FQBN matched for board: "${board}" or compute: "${compute}". Defaulting to: ${fqbn}`);
    }

    console.log(`[build.controller] Compiling milestone sketch: ${sketchPath} for ${fqbn}`);
    const compileResult = await compileWokwiSketch({
      projectPath: tempDir,
      sketchFile: "sketch.ino",
      fqbn
    });

    const isSuccess = !!compileResult.ok;
    const errors = isSuccess ? [] : [compileResult.stderrTail || compileResult.stdoutTail || "Compile failed"];

    milestone.compiledHex = isSuccess ? (compileResult.metadata?.firmwarePath || "hex") : "";
    milestone.compilationErrors = errors;

    await project.save();
    res.json({
      success: isSuccess,
      hex: milestone.compiledHex,
      errors
    });

  } catch (err) {
    console.error('[build.controller] compileMilestone error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};

// ??$$$
export const confirmMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { serialOutput, notes } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const unsatisfied = milestone.dependsOn.filter(depId => {
      const dep = project.milestones.find(dm => dm.id === depId);
      return !dep || dep.status !== "passed";
    });
    if (unsatisfied.length > 0) {
      return res.status(400).json({ error: `Dependencies not satisfied: ${unsatisfied.join(', ')}` });
    }

    milestone.status = "passed";
    milestone.userConfirmed = true;
    milestone.completedAt = new Date();
    if (serialOutput !== undefined) milestone.serialOutput = serialOutput;
    if (notes !== undefined) milestone.userNotes = notes;

    // Unlock next milestones
    project.milestones.forEach(m => {
      if (m.status === "locked") {
        const unsat = m.dependsOn.filter(depId => {
          const dep = project.milestones.find(dm => dm.id === depId);
          return !dep || dep.status !== "passed";
        });
        if (unsat.length === 0) {
          m.status = "ready";
        }
      }
    });

    // Update active milestone ID
    const unfinished = project.milestones
      .filter(m => m.status !== "passed")
      .sort((a, b) => a.order - b.order);
    if (unfinished.length > 0) {
      project.activeMilestoneId = unfinished[0].id;
    }

    const allComplete = project.milestones.every(m => m.status === "passed");
    
    await project.save();

    if (allComplete) {
      await advanceStage(project._id, 'build');
    }

    res.json({ nextMilestoneId: project.activeMilestoneId, allComplete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const failMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { serialOutput, problem } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    milestone.status = "failed";
    if (serialOutput !== undefined) milestone.serialOutput = serialOutput;

    // Append to conversation
    milestone.debugMessages.push({
      role: "user",
      content: problem || "Test failed. Having trouble with output.",
      timestamp: new Date()
    });

    const advice = await callGeminiDebugCoachIterative(milestone, milestone.debugMessages);
    milestone.debugMessages.push({
      role: "model",
      content: advice,
      timestamp: new Date()
    });

    await project.save();
    res.json({ debugAdvice: advice, debugMessages: milestone.debugMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const chatDebugCoach = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { message } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    milestone.debugMessages.push({
      role: "user",
      content: message,
      timestamp: new Date()
    });

    const advice = await callGeminiDebugCoachIterative(milestone, milestone.debugMessages);
    milestone.debugMessages.push({
      role: "model",
      content: advice,
      timestamp: new Date()
    });

    await project.save();
    res.json({ debugAdvice: advice, debugMessages: milestone.debugMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const skipMilestone = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { notes } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const unsatisfied = milestone.dependsOn.filter(depId => {
      const dep = project.milestones.find(dm => dm.id === depId);
      return !dep || dep.status !== "passed";
    });
    if (unsatisfied.length > 0) {
      return res.status(400).json({ error: `Dependencies not satisfied: ${unsatisfied.join(', ')}` });
    }

    milestone.status = "passed";
    milestone.userConfirmed = true;
    milestone.completedAt = new Date();
    milestone.userNotes = `(Skipped by user) ${notes || ""}`;

    // Unlock next milestones
    project.milestones.forEach(m => {
      if (m.status === "locked") {
        const unsat = m.dependsOn.filter(depId => {
          const dep = project.milestones.find(dm => dm.id === depId);
          return !dep || dep.status !== "passed";
        });
        if (unsat.length === 0) {
          m.status = "ready";
        }
      }
    });

    // Update active milestone ID
    const unfinished = project.milestones
      .filter(m => m.status !== "passed")
      .sort((a, b) => a.order - b.order);
    if (unfinished.length > 0) {
      project.activeMilestoneId = unfinished[0].id;
    }

    const allComplete = project.milestones.every(m => m.status === "passed");

    await project.save();

    if (allComplete) {
      await advanceStage(project._id, 'build');
    }

    res.json({ nextMilestoneId: project.activeMilestoneId, allComplete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const regenerateMilestoneCode = async (req, res) => {
  const { id, milestoneId } = req.params;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const code = await callGeminiRegenerateMilestoneCode(milestone, project);
    milestone.code = code;
    milestone.compiledHex = "";
    milestone.compilationErrors = [];
    milestone.status = "ready";

    await project.save();
    res.json(milestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const reportComponentIssue = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { componentKey, problem } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const advice = await callGeminiComponentIssue(milestone, componentKey, problem);
    res.json(advice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ??$$$
export const validateSerialOutput = async (req, res) => {
  const { id, milestoneId } = req.params;
  const { actualOutput } = req.body;
  try {
    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const result = await callGeminiValidateSerial(milestone, actualOutput);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

