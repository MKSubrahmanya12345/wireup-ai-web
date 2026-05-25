// @ts-nocheck
import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { getVoiceHealth, synthesizeAudio, transcribeAudio } from "../controllers/voice.controller";

const router = express.Router();

router.get("/voice/health", protectRoute, getVoiceHealth);
router.post("/voice/stt", protectRoute, transcribeAudio);
router.post("/voice/tts", protectRoute, synthesizeAudio);

export default router;
