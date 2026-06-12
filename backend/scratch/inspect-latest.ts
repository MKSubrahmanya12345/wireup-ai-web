// ??$$$ non-important
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup";

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db!;
  
  const latestSession = await db.collection("newflowsessions").findOne({}, { sort: { createdAt: -1 } });
  if (latestSession) {
    console.log("=== LATEST SESSION ===");
    console.log("ID:", latestSession._id);
    console.log("Idea:", latestSession.idea);
    console.log("Phase 1 Complete:", latestSession.phase1Complete);
    console.log("Phase 2 Complete:", latestSession.phase2Complete);
    console.log("BOM count:", latestSession.bom?.length);
    console.log("BOM:", JSON.stringify(latestSession.bom, null, 2));
    console.log("Wiring count:", latestSession.wiring?.length);
    console.log("Wiring:", JSON.stringify(latestSession.wiring, null, 2));
    console.log("Diagram keys:", latestSession.diagram ? Object.keys(latestSession.diagram) : "null");
    console.log("Diagram parts:", latestSession.diagram?.parts);
    console.log("Diagram connections:", latestSession.diagram?.connections);
    console.log("AgentLog count:", latestSession.agentLog?.length);
    console.log("Last 20 AgentLog items:", JSON.stringify(latestSession.agentLog?.slice(-20), null, 2));
  } else {
    console.log("No session found in db");
  }

  const latestProject = await db.collection("projects").findOne({}, { sort: { createdAt: -1 } });
  if (latestProject) {
    console.log("\n=== LATEST PROJECT ===");
    console.log("ID:", latestProject._id);
    console.log("Description:", latestProject.description);
    console.log("BOM count:", latestProject.bom?.length);
    console.log("BOM:", JSON.stringify(latestProject.bom, null, 2));
    console.log("Wiring:", JSON.stringify(latestProject.wiring, null, 2));
    console.log("Diagram keys:", latestProject.diagram ? Object.keys(latestProject.diagram) : "null");
  } else {
    console.log("No project found in db");
  }

  await mongoose.disconnect();
}

run().catch(console.error);
