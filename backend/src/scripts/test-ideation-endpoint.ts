import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import User from "../models/user.model";
import { connectDB } from "../lib/db";
import { callGeminiIdeation, IDEATION_SYSTEM_PROMPT } from "../services/gemini.service";
import { parseAgent1Response } from "../controllers/ideation.controller";

async function main() {
  console.log("Connecting to MongoDB...");
  await connectDB();

  const user = await User.findOne({ email: "mksubbu007@gmail.com" });
  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }

  const project = await Project.findOne({ owner: user._id });
  if (!project) {
    console.error("Project not found!");
    process.exit(1);
  }

  console.log("Found project:", project.description, project._id);
  const userMessage = "Can you add an ultrasonic distance sensor to this RC car?";
  console.log(`Sending chat message: '${userMessage}'`);

  const messages = project.ideation?.messages || [];
  const chatHistory = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  chatHistory.push({ role: "user", content: userMessage });

  console.log("Calling Gemini/Groq service...");
  const rawReply = await callGeminiIdeation(IDEATION_SYSTEM_PROMPT, chatHistory);
  console.log("Raw LLM Reply length:", rawReply.length);

  const parsed = parseAgent1Response(rawReply);
  console.log("-----------------------------------------");
  console.log("PARSED AI REPLY:\n", parsed.reply);
  console.log("-----------------------------------------");
  console.log("PARSED READY FOR COMPONENTS:", parsed.readyForComponents);
  console.log("PARSED READINESS REASON:", parsed.readinessReason);
  console.log("-----------------------------------------");

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch(console.error);
