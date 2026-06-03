// ??$$$ non-important
import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import { connectDB } from "../lib/db";
import process from "process";

async function main() {
  await connectDB();
  const id = "6a1837aef27ac2c020b2f7d5";
  const project = await Project.findById(id);
  if (!project) {
    console.error("Project not found!");
    process.exit(1);
  }
  
  console.log("=========================================");
  console.log("Project ID:", project._id);
  console.log("BOM Length:", project.bom?.length);
  console.log("BOM Items:", JSON.stringify(project.bom, null, 2));
  console.log("Wiring Length:", project.wiring?.length);
  console.log("Wiring Matrix:", JSON.stringify(project.wiring, null, 2));
  console.log("Diagram:", JSON.stringify(project.diagram, null, 2));
  console.log("=========================================");

  await mongoose.disconnect();
}

main().catch(console.error);
