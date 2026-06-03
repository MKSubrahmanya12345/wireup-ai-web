// ??$$$ group 2 - Ideation Stage (Phase 1)
// @ts-nocheck
import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { chatIdeationProject, createIdeationProject, finalizeIdeation, assumeDefaults, getProjectThinking } from "../controllers/ideation.controller";

const router = express.Router();

router.post("/project", protectRoute, createIdeationProject);
router.post("/project/chat", protectRoute, chatIdeationProject);
router.get("/project/:projectId/thinking", protectRoute, getProjectThinking);


export default router;