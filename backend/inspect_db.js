// ??$$$ temporary script
const mongoose = require("mongoose");
require("dotenv/config");

const MONGO_URI = process.env.MONGO_URI;
const projectId = "6a239745ae9ded7b0f5a83dc";

const bomItemSchema = new mongoose.Schema({
  key: String,
  displayName: String,
  type: String,
  mpn: String,
  partId: String,
  qty: Number,
  wokwiPartType: String,
  glbUrl: String,
  pins: Array,
  pinConnections: Array
}, { strict: false });

const projectSchema = new mongoose.Schema({
  name: String,
  bom: [bomItemSchema]
}, { strict: false });

const Project = mongoose.model("Project", projectSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");
  const project = await Project.findById(projectId).lean();
  if (!project) {
    console.log("Project not found!");
  } else {
    console.log("PROJECT NAME:", project.name);
    console.log("PROJECT BOM:");
    console.dir(project.bom, { depth: null });
  }
  await mongoose.disconnect();
}

run().catch(console.error);
