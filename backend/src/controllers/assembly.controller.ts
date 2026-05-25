// @ts-nocheck

import Project from '../models/project.model';
import { generateLayout } from '../services/assembly.service';
import { setStageGenerating, setStageError, advanceStage } from '../services/pipeline.service';

export const generateAssembly = async (req, res) => {
  const { projectId, sizePreference = 'pocket', overrides } = req.body;

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Ensure build is done before assembly
    if (!project.sketch || !project.diagram || Object.keys(project.diagram).length === 0) {
      return res.status(400).json({ error: 'Complete Build stage first (Sketch + Diagram required).', stage: 'build' });
    }

    // ??$$$ Self-healing: if build is not 'done' but we have the files, advance it now
    if (project.stageStatus?.build !== 'done') {
      console.log(`[assembly.controller] Auto-advancing build stage for project ${projectId}`);
      await advanceStage(projectId, 'build');
    }


    await setStageGenerating(projectId, 'assembly');

    // Generate Layout
    const layout = await generateLayout(project, sizePreference, overrides);

    // Save
    await Project.findByIdAndUpdate(projectId, {
      $set: { assemblyLayout: layout }
    });

    await advanceStage(projectId, 'assembly');

    return res.status(200).json({ assemblyLayout: layout });

  } catch (err) {
    console.error('[assembly.controller] generateAssembly error:', err);
    await setStageError(projectId, 'assembly').catch(() => {});
    return res.status(500).json({ error: err.message || 'Layout generation failed', stage: 'assembly' });
  }
};

export const getAssembly = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findOne({ _id: projectId, owner: req.user._id })
      .select('assemblyLayout stageStatus');

    if (!project) return res.status(404).json({ error: 'Project not found' });

    return res.status(200).json({
      assemblyLayout: project.assemblyLayout || null,
      stageStatus: project.stageStatus?.assembly || 'locked',
    });
  } catch (err) {
    console.error('[assembly.controller] getAssembly error:', err);
    return res.status(500).json({ error: 'Failed to load assembly' });
  }
};
