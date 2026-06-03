// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code
import express from "express";
import { searchLibraryController } from "../controllers/library.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = express.Router();

// Support both GET and POST for convenience
router.get("/library/search", protectRoute, searchLibraryController);
router.post("/library/search", protectRoute, searchLibraryController);

export default router;
