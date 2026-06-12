// ??$$$ group 8 - Core Platform & Shared Infrastructure
// @ts-nocheck
// ??$$$ FORGE: pipeline.controller.js — Stage transition logic for the NovaAI pipeline
import { advanceStage, getStageStatus } from '../services/pipeline.service';

/**
 * POST /api/pipeline/advance
 * Manually advances a project to the next stage.
 */
export const advanceProjectStage = async (req, res) => {
  const { projectId, fromStage } = req.body;

  if (!projectId || !fromStage) {
    return res.status(400).json({ error: 'projectId and fromStage are required' });
  }

  try {
    const result = await advanceStage(projectId, fromStage);
    const stageStatus = await getStageStatus(projectId);

    res.json({
      success: true,
      ...result,
      stageStatuses: stageStatus
    });
  } catch (err) {
    console.error('[pipeline.controller] advanceProjectStage error:', err);
    res.status(500).json({ error: err.message });
  }
};
