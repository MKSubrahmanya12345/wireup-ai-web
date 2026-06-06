const mongoose = require("mongoose");
require("dotenv").config();

const mongoUri = process.env.MONGO_URI;

const Schema = mongoose.Schema;
const Part = mongoose.model("Part", new Schema({}, { strict: false }), "parts");

async function main() {
  await mongoose.connect(mongoUri);
  console.log("Connected to DB");
  
  const id = "6a13ec800c47f410601cfeb2";
  const part = await Part.findById(id);
  if (part) {
    console.log("Part details:");
    console.log(JSON.stringify(part, null, 2));
  } else {
    console.log("Part not found.");
  }

  process.exit(0);
}

main().catch(console.error);
