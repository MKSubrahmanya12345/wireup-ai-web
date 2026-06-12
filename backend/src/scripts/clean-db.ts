import "dotenv/config";
import mongoose from "mongoose";
import Part from "../models/part.model";

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup";
  await mongoose.connect(mongoUri);
  console.log("Connected to DB.");

  // We find any parts that have a 4-pin list containing "IO1" or "IO2"
  const allParts = await Part.find({}).lean();
  let cleanedCount = 0;
  for (const part of allParts) {
    const pins = part.pins || [];
    const hasIO = pins.some((p: any) => (p.id === "IO1" || p.name === "IO1" || p.id === "IO2" || p.name === "IO2"));
    if (hasIO && pins.length === 4) {
      console.log(`Cleaning polluted part: ${part.mpn}`);
      await Part.updateOne(
        { _id: part._id },
        { $set: { pins: [], pinsCachedAt: null } }
      );
      cleanedCount++;
    }
  }
  console.log(`Cleaned ${cleanedCount} parts in total.`);
  await mongoose.disconnect();
}

main().catch(err => console.error(err));
