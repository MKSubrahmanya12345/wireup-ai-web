// ??$$$ group 8 - Core Platform & Shared Infrastructure
import express, { Router } from "express";

import {
  createProject,
  getProjectById,
  getUserProjects,
  getIdeationHistory,
  getComponentsHistory,
  updateProject,
  deleteProject,
} from "../controllers/project.controller";

import { protectRoute } from "../middleware/auth.middleware";

const router: Router = express.Router();

// project management routes
// ??$$$ newer code - support both singular /project and plural /projects POST for frontend compatibility
router.post("/project", protectRoute, createProject);
router.post("/projects", protectRoute, createProject);

router.get("/projects", protectRoute, getUserProjects);

router.get("/project/:id", protectRoute, getProjectById);

router.get(
  "/project/:id/history/ideation",
  protectRoute,
  getIdeationHistory
);

router.get(
  "/project/:id/history/components",
  protectRoute,
  getComponentsHistory
);

router.put("/project/:id", protectRoute, updateProject);

router.delete("/project/:id", protectRoute, deleteProject);

export default router;