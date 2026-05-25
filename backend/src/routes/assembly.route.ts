// @ts-nocheck
// ??$$$ FORGE: assembly.route.js — Stage 4
import express from 'express';
import { generateAssembly, getAssembly } from '../controllers/assembly.controller';
import { protectRoute } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/assembly/generate', protectRoute, generateAssembly);
router.get('/assembly/:projectId', protectRoute, getAssembly);

export default router;
