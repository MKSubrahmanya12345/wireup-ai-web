import mongoose from "mongoose";
import NewFlowSession from "../models/newFlowSession.model";

async function run() {
  const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wireup-ai";
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const session = await NewFlowSession.findOne().sort({ createdAt: -1 }).lean();
  if (!session) {
    console.log("No session found.");
    process.exit(0);
  }

  console.log("Session ID:", session._id);
  console.log("Project ID:", session.projectId);
  console.log("Selected Model:", session.selectedModel);
  console.log("Phase 1 Complete:", session.phase1Complete);
  console.log("Phase 2 Complete:", session.phase2Complete);
  console.log("Idea:", session.idea);
  console.log("\n--- AGENT LOGS ---");
  session.agentLog?.forEach((log: any, idx: number) => {
    console.log(`[${idx}] [${log.timestamp.toISOString()}] [${log.type}] ${log.name || ""} - ${log.status || ""} - ${log.text || ""}`);
    if (log.input) console.log("  Input:", JSON.stringify(log.input));
    if (log.output) console.log("  Output snippet:", JSON.stringify(log.output).substring(0, 300));
  });

  process.exit(0);
}

run().catch(console.error);
