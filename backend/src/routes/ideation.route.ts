// ??$$$ group 2 - Ideation Stage (Phase 1)
// @ts-nocheck
import express from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { startSession, chatSession } from "../controllers/newflow.controller";
import NewFlowSession from "../models/newFlowSession.model";

const router = express.Router();

/* old code
import { chatIdeationProject, createIdeationProject, finalizeIdeation, assumeDefaults, getProjectThinking } from "../controllers/ideation.controller";
router.post("/project", protectRoute, createIdeationProject);
router.post("/project/chat", protectRoute, chatIdeationProject);
router.get("/project/:projectId/thinking", protectRoute, getProjectThinking);
*/

// ??$$$ newer code - Redirect legacy project creation to startSession
router.post("/project", protectRoute, (req, res) => {
  console.log("[Deprecation Warning] Redirecting /api/ideation/project to /api/new-flow/start");
  if (req.body.description && !req.body.idea) {
    req.body.idea = req.body.description;
  }
  return startSession(req, res);
});

// ??$$$ newer code - Redirect legacy chat to new flow chat
router.post("/project/chat", protectRoute, async (req, res) => {
  console.log("[Deprecation Warning] Redirecting /api/ideation/project/chat to new flow chat");
  const { projectId, message } = req.body;
  if (projectId) {
    const session = await NewFlowSession.findOne({ projectId });
    if (session) {
      req.body.sessionId = session._id;
      req.body.message = message || req.body.text;
      return chatSession(req, res);
    }
  }
  return res.status(400).json({ error: "Legacy chat session not found on new flow." });
});

// ??$$$ newer code - Stub out thinking
router.get("/project/:projectId/thinking", protectRoute, (req, res) => {
  return res.json({ thinking: "Legacy thinking deprecated. Using agentic pipeline." });
});

export default router;