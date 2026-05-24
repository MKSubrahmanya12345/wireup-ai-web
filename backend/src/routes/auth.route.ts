import express from "express";

import {
  checkAuth,
  login,
  logout,
  signup,
  updateUser,
} from "../controllers/auth.controller";

import { protectRoute } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);
router.put("/update", protectRoute, updateUser);

export default router;