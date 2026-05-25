// ??$$$ newer code
import mongoose from "mongoose";
import "dotenv/config";
import process from "process";
import { connectDB } from "../lib/db";
import { searchLibrary } from "../services/library.service";

async function runTest() {
  console.log("🚀 Starting Library Search Verification Tests...\n");
  await connectDB();

  // Test 1: Local only search for seeded component
  console.log("-----------------------------------------");
  console.log("Test 1: Local Only Search ('ESP32')");
  console.log("-----------------------------------------");
  const localRes = await searchLibrary({
    query: "ESP32",
    limit: 3,
    strategy: "local_only"
  });
  console.log(`Returned ${localRes.length} results:`);
  localRes.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.name} (MPN: ${r.mpn}) - Curated: ${r.isCurated}`);
  });

  // Test 2: Local only search for passive resistor
  console.log("\n-----------------------------------------");
  console.log("Test 2: Local Only Search ('resistor')");
  console.log("-----------------------------------------");
  const passiveRes = await searchLibrary({
    query: "resistor",
    limit: 3,
    strategy: "local_only"
  });
  console.log(`Returned ${passiveRes.length} results:`);
  passiveRes.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.name} (MPN: ${r.mpn}) - Curated: ${r.isCurated} - Price: ₹${r.price}`);
  });

  // Test 3: Remote search/Fallback (LM358 isn't seeded locally, should check Octopart)
  console.log("\n-----------------------------------------");
  console.log("Test 3: Hybrid Search Auto Fallback ('LM358')");
  console.log("-----------------------------------------");
  const hybridRes = await searchLibrary({
    query: "LM358",
    limit: 3,
    strategy: "auto"
  });
  console.log(`Returned ${hybridRes.length} results:`);
  hybridRes.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.name} (MPN: ${r.mpn}) - Curated: ${r.isCurated} - Manufacturer: ${r.manufacturer}`);
    console.log(`      Datasheet: ${r.datasheetUrl || "None"}`);
    console.log(`      Image: ${r.imageUrl || "None"}`);
    console.log(`      Price: $${r.price || 0} - Available: ${r.available}`);
  });

  console.log("\n🎉 All library search tests completed.");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
