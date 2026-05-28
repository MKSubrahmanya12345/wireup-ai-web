import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup";

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const project = await db.collection("projects").findOne({ _id: new mongoose.Types.ObjectId("6a1837aef27ac2c020b2f7d5") });
  if (!project) {
    const proj2 = await db.collection("projects").findOne({});
    console.log("Project 6a1837aef27ac2c020b2f7d5 not found. Found project:", proj2?._id);
    console.log(JSON.stringify(proj2, null, 2));
  } else {
    console.log("Project found! BOM items count:", project.bom?.length);
    console.log(JSON.stringify(project.bom, null, 2));
    console.log("Project wiring:", JSON.stringify(project.wiring, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
