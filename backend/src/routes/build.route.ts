// @ts-nocheck
// ??$$$ FORGE: build.route.js — Build stage routes (all protected)
import express from 'express';
/* old code
import { generateBuild, syncBuild, getBuild, generateSketch, generateDiagram } from '../controllers/build.controller';
*/
// ??$$$
import { generateBuild, syncBuild, getBuild, generateSketch, generateDiagram, compileBuild } from '../controllers/build.controller';
import { protectRoute } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/build/generate', protectRoute, generateBuild);
router.post('/build/generate-sketch', protectRoute, generateSketch);
router.post('/build/generate-diagram', protectRoute, generateDiagram);
router.post('/build/sync',     protectRoute, syncBuild);
router.get('/build/:projectId', protectRoute, getBuild);
// ??$$$
router.post('/build/compile', protectRoute, compileBuild);


export default router;
