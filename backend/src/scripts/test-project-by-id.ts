// ??$$$ non-important
import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import { connectDB } from "../lib/db";
import { callGeminiIdeation, IDEATION_SYSTEM_PROMPT } from "../services/gemini.service";
import { parseAgent1Response } from "../controllers/ideation.controller";

async function main() {
  await connectDB();
  const id = "6a13705c5fd52688b16a260c";
  const project = await Project.findById(id);
  if (!project) {
    console.error("Project not found!");
    process.exit(1);
  }
  console.log("Project description:", project.description);
  console.log("Project stageStatus:", project.stageStatus);
  console.log("Project meta:", project.meta);
  console.log("Project ideation:", {
    readyForComponents: project.ideation?.readyForComponents,
    messagesCount: project.ideation?.messages?.length
  });

  // Let's run the exact chat logic to see what fails
  console.log("Simulating chat...");
  const messages = project.ideation?.messages || [];
  const chatHistory = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  if (chatHistory.length === 0) {
    chatHistory.push({ role: "user", content: project.description || "Start my project" });
  }

  try {
    const rawReply = await callGeminiIdeation(IDEATION_SYSTEM_PROMPT, chatHistory);
    console.log("Raw LLM reply length:", rawReply.length);
    const parsed = parseAgent1Response(rawReply);
    console.log("Parsed readyForComponents:", parsed.readyForComponents);
  } catch (err: any) {
    console.error("LLM CALL FAILED:", err);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
