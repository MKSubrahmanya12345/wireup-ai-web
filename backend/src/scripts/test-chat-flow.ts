// ??$$$ non-important
import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import User from "../models/user.model";
import { connectDB } from "../lib/db";

async function main() {
  console.log("Connecting to MongoDB...");
  await connectDB();
  
  const user = await User.findOne({ email: "mksubbu007@gmail.com" });
  if (!user) {
    console.error("User not found!");
    process.exit(1);
  }
  console.log("User found:", user.email, user._id);
  
  const project = await Project.findOne({ owner: user._id });
  if (!project) {
    console.log("No projects found for user. Creating a new one...");
    const newProj = await Project.create({
      description: "Quadcopter drone with ESP32",
      owner: user._id,
      stageStatus: {
        ideation: "ready",
        components: "locked",
        build: "locked",
        design: "locked"
      }
    });
    console.log("Created project:", newProj._id);
  } else {
    console.log("Found project:", project.description, project._id);
    console.log("Project stageStatus:", project.stageStatus);
    console.log("Project ideation:", {
      readyForComponents: project.ideation?.readyForComponents,
      messagesCount: project.ideation?.messages?.length,
      brief: project.ideation?.brief
    });
  }
  
  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch(console.error);
