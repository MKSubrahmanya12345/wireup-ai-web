const mongoose = require("mongoose");
require("dotenv").config({ path: "e:\\wireup.ai - new\\backend\\.env" });

const mongoUri = process.env.MONGO_URI;
const Schema = mongoose.Schema;
const Project = mongoose.model("Project", new Schema({}, { strict: false }), "projects");

async function main() {
  await mongoose.connect(mongoUri);
  console.log("Connected to DB");
  
  const id = "6a239745ae9ded7b0f5a83dc";
  const project = await Project.findById(id);
  if (project) {
    console.log("Project BOM:");
    console.log(JSON.stringify(project.bom, null, 2));
  } else {
    console.log("Project not found.");
  }

  process.exit(0);
}

main().catch(console.error);
