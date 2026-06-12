// ??$$$ group 8 - Core Platform & Shared Infrastructure
import jwt from "jsonwebtoken";
import type { Response } from "express";

interface JwtPayload {
  userId: string;
}

export const generateToken = (userId: string, res: Response): string => {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const token = jwt.sign({ userId } as JwtPayload, secret, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });

  return token;
};