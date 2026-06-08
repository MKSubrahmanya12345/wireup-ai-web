// ??$$$ non-important
// ??$$$ newer code — Seeding Active Project from formulation session data
import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import Part from "../models/part.model";
import { connectDB } from "../lib/db";
import { ingestComponent } from "../services/model.service";
import fs from "fs";
import path from "path";
import process from "process";

async function main() {
  await connectDB();
  console.log("[Seeder] Connected to MongoDB.");

  // 1. Ingest parts into the global catalog first
  const partsToIngest = ["ESP8266-NODEMCU", "TMP36", "LCD-16X2-I2C"];
  console.log("[Seeder] Ingesting parts into master registry...");
  for (const mpn of partsToIngest) {
    try {
      console.log(`[Seeder] Ingesting component: ${mpn}`);
      const part = await ingestComponent(mpn, undefined, true);
      console.log(`[Seeder] Ingested successfully: ${part.mpn}`);
    } catch (e: any) {
      console.error(`[Seeder] Failed to ingest component ${mpn}:`, e.message);
    }
  }

  // 2. Read session files from E:
  const sessionPath = process.env.SESSION_PATH || path.join(process.cwd(), "exports", "session_6a18365bf27ac2c020b2f7d4");
  console.log(`[Seeder] Loading session data from: ${sessionPath}`);

  const bom = JSON.parse(fs.readFileSync(path.join(sessionPath, "bom.json"), "utf-8"));
  const wiring = JSON.parse(fs.readFileSync(path.join(sessionPath, "wiring.json"), "utf-8"));
  const diagram = JSON.parse(fs.readFileSync(path.join(sessionPath, "diagram.json"), "utf-8"));
  const milestonesRaw = JSON.parse(fs.readFileSync(path.join(sessionPath, "milestones.json"), "utf-8"));

  // 3. Map milestones raw formats to Mongoose schema IMilestone
  const mappedMilestones = milestonesRaw.map((m: any, idx: number) => ({
    id: m.id || `milestone_${idx + 1}`,
    order: m.order || idx + 1,
    title: m.title || "Build Phase",
    objective: m.objective || "",
    componentsInvolved: m.partsInvolved || m.componentsInvolved || [],
    wiringInstructions: m.wiringInstructions || "",
    code: m.code || "",
    explanation: m.explanation || "",
    test: {
      expectedSerialOutput: m.expectedOutput || "",
      passCondition: m.passCondition || "",
      commonProblems: m.commonProblems || []
    },
    status: idx === 0 ? "ready" : "locked",
    userConfirmed: false,
    userNotes: "",
    compiledHex: "",
    compilationErrors: [],
    serialOutput: "",
    simulatable: typeof m.simulatable === "boolean" ? m.simulatable : true,
    dependsOn: m.dependsOn || []
  }));

  // 4. Update the active project
  const projectId = "6a1837aef27ac2c020b2f7d5";
  console.log(`[Seeder] Updating Project ${projectId}...`);

  const project = await Project.findById(projectId);
  if (!project) {
    console.error(`[Seeder] Error: Active Project "${projectId}" not found!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Update properties
  const enrichedBom = [];
  for (const item of bom) {
    const part = await Part.findOne({ mpn: item.mpn });
    if (part) {
      console.log(`[Seeder] Enriched BOM item ${item.key} with glbUrl: ${part.glbUrl} and ${part.pins?.length} pins`);
      enrichedBom.push({
        ...item,
        glbUrl: part.glbUrl,
        pins: part.pins
      });
    } else {
      console.warn(`[Seeder] Warning: Master Part not found for mpn: ${item.mpn}`);
      enrichedBom.push(item);
    }
  }

  project.bom = enrichedBom;
  project.wiring = wiring;
  project.diagram = diagram;
  project.milestones = mappedMilestones;
  project.milestonesGenerated = true;
  project.activeMilestoneId = mappedMilestones[0]?.id || null;

  // Let's unlock stages so the UI flows beautifully
  project.stageStatus = {
    ideation: "done",
    components: "done",
    build: "ready",
    simulation: "ready",
    assembly: "ready",
    shopping: "ready"
  };

  // Set active stage in meta to simulation or build
  if (project.meta) {
    project.meta.stage = "simulation";
    project.meta.board = null;
  }

  await project.save();
  console.log(`[Seeder] Project "${projectId}" seeded and updated successfully!`);

  await mongoose.disconnect();
}

main().catch(console.error);
