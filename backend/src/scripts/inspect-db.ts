import "dotenv/config";
import mongoose from "mongoose";
import Part from "../models/part.model";

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup";
  await mongoose.connect(mongoUri);
  console.log("Connected to DB.");

  const parts = await Part.find({}).lean();
  console.log(`Found ${parts.length} parts in database:`);
  for (const part of parts) {
    console.log(`- MPN: ${part.mpn}`);
    console.log(`  Name: ${part.name}`);
    console.log(`  Pins: ${JSON.stringify(part.pins?.map((p: any) => p.name || p.id))}`);
  }

  await mongoose.disconnect();
}

main().catch(err => console.error(err));
