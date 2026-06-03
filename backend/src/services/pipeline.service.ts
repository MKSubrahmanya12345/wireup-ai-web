// ??$$$ group 8 - Core Platform & Shared Infrastructure
// @ts-nocheck
// ??$$$ FORGE: pipeline.service.js — Stage orchestrator for the 6-stage FORGE pipeline
// All stage transitions go through here. Never mutate stageStatus directly in controllers.

import Project from '../models/project.model';

// Stage order — the canonical progression
const STAGES = ['ideation', 'components', 'build', 'simulation', 'assembly', 'shopping'];

// Estimated time per stage (shown in StageNav)
export const STAGE_TIME_ESTIMATES = {
  ideation:   '3–5 min',
  components: '1–2 min',
  build:      '2–3 min',
  simulation: '~1 min',
  assembly:   '~1 min',
  shopping:   '~30 sec',
};

/**
 * getStageStatus(projectId)
 * Returns the full stageStatus map for a project.
 * @returns {{ ideation, components, build, simulation, assembly, shopping }}
 */
export const getStageStatus = async (projectId) => {
  const project = await Project.findById(projectId).select('stageStatus').lean();
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.stageStatus || {};
};

/**
 * advanceStage(projectId, fromStage)
 * Marks fromStage as 'done' and unlocks the next stage as 'ready'.
 * Idempotent — safe to call multiple times.
 */
export const advanceStage = async (projectId, fromStage) => {
  const fromIndex = STAGES.indexOf(fromStage);
  if (fromIndex === -1) throw new Error(`Unknown stage: ${fromStage}`);

  const update = {
    [`stageStatus.${fromStage}`]: 'done',
  };

  const nextStage = STAGES[fromIndex + 1];
  if (nextStage) {
    update[`stageStatus.${nextStage}`] = 'ready';
  }

  await Project.findByIdAndUpdate(projectId, { $set: update });
  return { advanced: fromStage, unlocked: nextStage || null };
};

/**
 * setStageGenerating(projectId, stage)
 * Marks a stage as 'generating' while AI/backend work is in progress.
 */
export const setStageGenerating = async (projectId, stage) => {
  await Project.findByIdAndUpdate(projectId, {
    $set: { [`stageStatus.${stage}`]: 'generating' }
  });
};

/**
 * setStageError(projectId, stage)
 * Marks a stage as 'error' when generation/compilation fails.
 */
export const setStageError = async (projectId, stage) => {
  await Project.findByIdAndUpdate(projectId, {
    $set: { [`stageStatus.${stage}`]: 'error' }
  });
};

/**
 * rollbackStage(projectId, toStage)
 * Marks all stages AFTER toStage as 'stale' so the student knows to regenerate.
 * Preserves user edits in the target stage.
 */
export const rollbackStage = async (projectId, toStage) => {
  const toIndex = STAGES.indexOf(toStage);
  if (toIndex === -1) throw new Error(`Unknown stage: ${toStage}`);

  const update = {};
  for (let i = toIndex + 1; i < STAGES.length; i++) {
    update[`stageStatus.${STAGES[i]}`] = 'stale';
  }

  if (Object.keys(update).length > 0) {
    await Project.findByIdAndUpdate(projectId, { $set: update });
  }

  return { rolledBackTo: toStage, staleStages: STAGES.slice(toIndex + 1) };
};

/**
 * invalidateDownstream(projectId, fromStage)
 * Called when the user edits something in fromStage (e.g. swaps a BOM component).
 * Marks everything AFTER fromStage as 'stale'.
 * Does NOT change fromStage itself.
 */
export const invalidateDownstream = async (projectId, fromStage) => {
  const fromIndex = STAGES.indexOf(fromStage);
  if (fromIndex === -1) throw new Error(`Unknown stage: ${fromStage}`);

  const update = {};
  for (let i = fromIndex + 1; i < STAGES.length; i++) {
    update[`stageStatus.${STAGES[i]}`] = 'stale';
  }

  // ??$$$
  if (fromIndex <= 1) {
    update.milestonesGenerated = false;
    update.milestones = [];
    update.activeMilestoneId = null;
  }

  if (Object.keys(update).length > 0) {
    await Project.findByIdAndUpdate(projectId, { $set: update });
  }

  return { invalidatedFrom: fromStage, staleStages: STAGES.slice(fromIndex + 1) };
};

/**
 * isStageUnlocked(stageStatus, stage)
 * Helper — pure function, no DB call. Used in controllers to check access.
 * A stage is unlocked if its status is not 'locked'.
 */
export const isStageUnlocked = (stageStatus, stage) => {
  return stageStatus?.[stage] !== 'locked';
};

export default {
  STAGES,
  STAGE_TIME_ESTIMATES,
  getStageStatus,
  advanceStage,
  setStageGenerating,
  setStageError,
  rollbackStage,
  invalidateDownstream,
  isStageUnlocked,
};
