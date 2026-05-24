import express, { Router, Request, Response, NextFunction } from "express";

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
router.post("/project", protectRoute, createProject);

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