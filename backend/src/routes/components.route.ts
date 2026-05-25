// @ts-nocheck
import express from "express";
import {
  chatComponents,
  generateWokwiFilesFromAI,
  initComponents,
  updateComponent // ??$$$
} from "../controllers/components.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = express.Router();

// optional init (first time load)
router.post("/components/init", protectRoute, initComponents);

// main chat
router.post("/components/chat", protectRoute, chatComponents);
router.post("/components/generate-files", protectRoute, generateWokwiFilesFromAI);

// ??$$$ BOM update endpoint — called by useProjectStore.updateBOM()
router.put("/components/update", protectRoute, updateComponent);

export default router;
