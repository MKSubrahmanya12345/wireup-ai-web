// ??$$$ newer code - SSE generate pipeline routing
import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
// ??$$$ newer code
import { generatePipeline, chatEndpoint } from "../controllers/generate.controller";

const router = express.Router();

// SSE streaming generation pipeline
router.post("/generate", protectRoute, generatePipeline);

// ??$$$ newer code - Project assistant streaming chat
router.post("/chat", protectRoute, chatEndpoint);

export default router;
