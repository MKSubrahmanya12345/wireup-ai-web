const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI not defined!");
  process.exit(1);
}

const BomItemSchema = new mongoose.Schema({}, { strict: false });
const NewFlowSessionSchema = new mongoose.Schema({
  bom: [BomItemSchema]
}, { strict: false });

const NewFlowSession = mongoose.model("NewFlowSession", NewFlowSessionSchema, "newflowsessions");

async function main() {
  await mongoose.connect(mongoUri);
  console.log("Connected to DB");
  const session = await NewFlowSession.findById("6a2395b5ae9ded7b0f5a83dc");
  if (!session) {
    console.log("Session not found!");
  } else {
    console.log("Session Idea:", session.idea);
    console.log("BOM Items:");
    console.log(JSON.stringify(session.bom, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
