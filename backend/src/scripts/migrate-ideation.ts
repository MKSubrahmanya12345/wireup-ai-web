// ??$$$ non-important
// ??$$$ newer code
import mongoose from "mongoose";
import "dotenv/config";
import { connectDB } from "../lib/db";
import Project from "../models/project.model";

async function runMigration() {
  console.log("🚀 Starting Ideation Schema Migration...");
  await connectDB();

  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects to process.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const doc of projects) {
    const raw = doc.toObject() as any;

    // Check if ideation already exists (has messages). If so, skip (idempotent).
    if (raw.ideation && Array.isArray(raw.ideation.messages) && raw.ideation.messages.length > 0) {
      console.log(`Skipping project ${doc._id} - already migrated.`);
      skippedCount++;
      continue;
    }

    const messages = Array.isArray(raw.messages)
      ? raw.messages.map((m: any) => ({
          role: m.role === "ai" ? "model" : m.role,
          content: m.content || "",
          timestamp: m.timestamp || new Date()
        }))
      : [];

    const snapshot = {
      corePurpose: raw.ideaState?.summary || raw.description || "",
      computeCore: raw.extractedContext?.board || raw.meta?.board || "",
      inputs: Array.isArray(raw.extractedContext?.sensors) ? raw.extractedContext.sensors : [],
      outputs: Array.isArray(raw.extractedContext?.outputs) ? raw.extractedContext.outputs : [],
      communication: raw.extractedContext?.connectivity ? [raw.extractedContext.connectivity] : [],
      power: raw.extractedContext?.power || raw.meta?.powerSource || "",
      constraints: Array.isArray(raw.ideaState?.requirements) ? raw.ideaState.requirements : [],
      openQuestions: Array.isArray(raw.ideaState?.unknowns) ? raw.ideaState.unknowns : []
    };

    const confidence = raw.extractedContext?.confidence?.projectSummary || 0;
    const finalized = raw.meta?.stage !== "ideation";
    const finalizedAt = finalized ? (raw.updatedAt || new Date()) : null;
    const finalizationReason = finalized ? "Migrated from legacy ideation stage" : "";

    const ideation = {
      messages,
      snapshot,
      thinking: "",
      confidence,
      finalized,
      finalizedAt,
      finalizationReason
    };

    console.log(`Migrating project ${doc._id}...`);
    // Run atomic update and unset
    await Project.updateOne(
      { _id: doc._id },
      {
        $set: { ideation },
        $unset: { ideaState: "", extractedContext: "" }
      }
    );
    migratedCount++;
  }

  console.log(`Migration complete! Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
