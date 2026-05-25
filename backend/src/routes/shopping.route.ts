// @ts-nocheck
// ??$$$ FORGE: shopping.route.js — Stage 5
import express from 'express';
import { getShoppingList } from '../controllers/shopping.controller';
import { protectRoute } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/shopping/:projectId', protectRoute, getShoppingList);

export default router;
