// ??$$$ NEW FLOW
import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware";
import {
  startSession,
  answerQuestion,
  proceedSession,
  getSession,
  formulateSession,
  // ??$$$ NEW FLOW
  restartSession,
  getSessionByProject
} from "../controllers/newflow.controller";

const router = Router();

router.post("/new-flow/start", protectRoute, startSession);
router.post("/new-flow/answer", protectRoute, answerQuestion);
router.post("/new-flow/proceed", protectRoute, proceedSession);
router.post("/new-flow/formulate", protectRoute, formulateSession);
router.post("/new-flow/restart", protectRoute, restartSession);
router.get("/new-flow/session/:sessionId", protectRoute, getSession);
router.get("/new-flow/project-session/:projectId", protectRoute, getSessionByProject);

export default router;
