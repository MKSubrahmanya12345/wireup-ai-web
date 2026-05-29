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
    console.log("=== AGENT LOGS ===");
    for (const log of latestSession.agentLog || []) {
      if (log.type === "thinking") {
        console.log(`[Thinking]: ${log.text}\n-------------------`);
      } else if (log.type === "error") {
        console.log(`[Error]: ${log.text}\n-------------------`);
      } else if (log.type === "decision") {
        console.log(`[Decision]: ${log.text}\n-------------------`);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
