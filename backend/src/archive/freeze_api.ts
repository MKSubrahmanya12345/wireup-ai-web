// ??$$$ API Schema Freezer
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/test";

async function main() {
  console.log("Connecting to database...");
  await mongoose.connect(mongoUri);
  console.log("Connected to database.");

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("No database instance found");
  }
  const collections = await db.listCollections().toArray();
  const report: Record<string, any> = {};

  for (const coll of collections) {
    const name = coll.name;
    const doc = await db.collection(name).findOne({});
    if (doc) {
      const cleaned = cleanDoc(doc);
      report[name] = cleaned;
      console.log(`Captured schema for collection: ${name}`);
    } else {
      report[name] = null;
      console.log(`Collection ${name} is empty.`);
    }
  }

  const archiveDir = __dirname;
  fs.writeFileSync(
    path.join(archiveDir, "api_freeze.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log(`API schema freeze completed and saved to ${path.join(archiveDir, "api_freeze.json")}`);
  await mongoose.disconnect();
}

function cleanDoc(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.slice(0, 1).map(cleanDoc);
  }
  if (val instanceof mongoose.Types.ObjectId || (val && val._bsontype === "ObjectID")) {
    return "ObjectId";
  }
  if (val instanceof Date) {
    return "Date";
  }
  if (typeof val === "object") {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      if (key === "password") {
        res[key] = "string (masked)";
      } else {
        res[key] = cleanDoc(val[key]);
      }
    }
    return res;
  }
  return typeof val;
}

main().catch(err => {
  console.error("Error during API freeze:", err);
  process.exit(1);
});
