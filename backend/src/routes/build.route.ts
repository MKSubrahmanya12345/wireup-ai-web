// @ts-nocheck
// ??$$$ FORGE: build.route.js — Build stage routes (all protected)
import express from 'express';
/* old code
import { generateBuild, syncBuild, getBuild, generateSketch, generateDiagram } from '../controllers/build.controller';
*/
import {
  generateBuild,
  syncBuild,
  getBuild,
  generateSketch,
  generateDiagram,
  compileBuild,
  // ??$$$
  generateMilestones,
  getMilestones,
  updateMilestone,
  compileMilestone,
  confirmMilestone,
  failMilestone,
  chatDebugCoach,
  skipMilestone,
  regenerateMilestoneCode,
  reportComponentIssue,
  validateSerialOutput
} from '../controllers/build.controller';
import { protectRoute } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/build/generate', protectRoute, generateBuild);
router.post('/build/generate-sketch', protectRoute, generateSketch);
router.post('/build/generate-diagram', protectRoute, generateDiagram);
router.post('/build/sync',     protectRoute, syncBuild);
router.get('/build/:projectId', protectRoute, getBuild);
// ??$$$
router.post('/build/compile', protectRoute, compileBuild);

// ??$$$ Milestones endpoints
router.post('/build/:id/milestones/generate', protectRoute, generateMilestones);
router.get('/build/:id/milestones', protectRoute, getMilestones);
router.put('/build/:id/milestones/:milestoneId', protectRoute, updateMilestone);
router.post('/build/:id/milestones/:milestoneId/compile', protectRoute, compileMilestone);
router.post('/build/:id/milestones/:milestoneId/confirm', protectRoute, confirmMilestone);
router.post('/build/:id/milestones/:milestoneId/fail', protectRoute, failMilestone);
router.post('/build/:id/milestones/:milestoneId/skip', protectRoute, skipMilestone);
router.post('/build/:id/milestones/:milestoneId/regenerate', protectRoute, regenerateMilestoneCode);
router.post('/build/:id/milestones/:milestoneId/debug/chat', protectRoute, chatDebugCoach);
router.post('/build/:id/milestones/:milestoneId/component-issue', protectRoute, reportComponentIssue);
router.post('/build/:id/milestones/:milestoneId/validate-serial', protectRoute, validateSerialOutput);

export default router;
