// ??$$$ newer code — Standalone CLI Component Ingestion & Conversion script
import "dotenv/config";
import { connectDB } from "../lib/db";
import { ingestComponent } from "../services/model.service";
import mongoose from "mongoose";
import process from "process";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("=================================================================");
    console.log("NovaCore 3D Component Pipeline Ingestion Batch Script");
    console.log("=================================================================");
    console.log("Usage:");
    console.log("  npx ts-node src/scripts/convert-model.ts <MPN_1> <MPN_2> ...");
    console.log("\nExample:");
    console.log("  npx ts-node src/scripts/convert-model.ts LM393 IRF540 NE555");
    console.log("=================================================================");
    process.exit(0);
  }

  console.log(`[Batch Pipeline] Initializing database connection...`);
  try {
    await connectDB();
  } catch (err: any) {
    console.error("[Batch Pipeline] Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }

  console.log(`[Batch Pipeline] Starting batch conversion for ${args.length} MPNs...`);

  for (let i = 0; i < args.length; i++) {
    const mpn = args[i];
    console.log(`\n[${i + 1}/${args.length}] Processing MPN: "${mpn}"`);
    try {
      const part = await ingestComponent(mpn, undefined, true); // forceRefresh = true for batch run
      console.log(`[Success] MPN: "${mpn}"`);
      console.log(`  - Format Version: ${part.componentFormatVersion}`);
      console.log(`  - Source: ${part.source} (${part.sourceId})`);
      console.log(`  - Pins aligned: ${part.pins?.length || 0}`);
      console.log(`  - Model GLB: ${part.glbUrl}`);
      console.log(`  - Mesh Info: vertices: ${part.mesh?.vertices}, materials: ${part.mesh?.materials}`);
    } catch (e: any) {
      console.error(`[Error] Failed to process MPN "${mpn}":`, e.message);
    }
  }

  console.log(`\n[Batch Pipeline] Finished batch processing. Closing database connection...`);
  await mongoose.disconnect();
  console.log(`[Batch Pipeline] Database connection closed.`);
}

main().catch(err => {
  console.error("[Batch Pipeline] Critical error in runner:", err);
  process.exit(1);
});
