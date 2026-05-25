// @ts-nocheck
// ??$$$ FORGE: pipeline.route.js — Routes for stage progression
import express from 'express';
import { protectRoute } from '../middleware/auth.middleware';
import { advanceProjectStage } from '../controllers/pipeline.controller';

const router = express.Router();

router.post('/advance', protectRoute, advanceProjectStage);

export default router;
