// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// ??$$$ newer code — Component Ingestion & Model Pipeline Orchestrator
import fs from "fs";
import path from "path";
import os from "os";
import Part from "../models/part.model";
import { fetchEasyEdaComponent, EasyEdaComponentData } from "./easyeda.service";
import { getKiCadStaticFallback, resolveKiCadComponent } from "./kicad.service";
import { convertCadModelToGlb } from "./blender.service";
import { alignPinSpaces } from "./pin.service";

const CURRENT_PIPELINE_VERSION = "1.0.0";
const CURRENT_ASSET_VERSION = 1;

/**
 * Ingests a component by MPN and LCSC ID.
 * Coordinates EasyEDA/KiCad querying, 3D file download, Blender conversion,
 * coordinate transformations, and database updates.
 */
export async function ingestComponent(mpn: string, lcscId?: string, forceRefresh = false): Promise<any> {
  console.log(`[Model Orchestrator] Starting ingestion for MPN: "${mpn}"`);

  // Check cache and validate pipeline versions
  if (!forceRefresh) {
    const cachedPart = await Part.findOne({ mpn });
    if (
      cachedPart &&
      cachedPart.pipelineVersion === CURRENT_PIPELINE_VERSION &&
      cachedPart.assetVersion === CURRENT_ASSET_VERSION
    ) {
      console.log(`[Model Orchestrator] Cache HIT for MPN: "${mpn}". Returning cached document.`);
      return cachedPart;
    }
  }

  // 1. Fetch raw data from EasyEDA, fallback to KiCad footprint library
  let rawData = await fetchEasyEdaComponent(mpn, lcscId);
  let source: "easyeda" | "kicad_static" | "kicad_s_expr" = "easyeda";

  if (!rawData) {
    console.log(`[Model Orchestrator] EasyEDA search failed or returned no results. Falling back to dynamic KiCad S-Expression resolver.`);
    rawData = await resolveKiCadComponent(mpn);
    if (rawData) {
      source = rawData.footprint?.type === "kicad_s_expr" ? "kicad_s_expr" : "kicad_static";
    }
  }

  if (!rawData) {
    throw new Error(`Failed to resolve component detail or static fallback for MPN: "${mpn}"`);
  }

  // 2. Download raw CAD models (STEP/WRL) if links exist
  let blenderPins: any[] = [];
  let meshInfo = { vertices: 24, materials: 1, optimized: false };
  let localGlbUrl = "";

  const stepUrl = rawData.model3d?.stepUrl;
  const wrlUrl = rawData.model3d?.wrlUrl;
  // Prefer wrlUrl first since we have synced and installed the official Web3D VRML importer in Blender
  const downloadUrl = wrlUrl || stepUrl;

  if (downloadUrl) {
    console.log(`[Model Orchestrator] Downloading CAD model from URL: "${downloadUrl}"`);
    try {
      const ext = downloadUrl.endsWith("/step") || downloadUrl.toLowerCase().includes("step") ? ".step" : ".wrl";
      const tempCadPath = path.join(os.tmpdir(), `cad_temp_${Date.now()}${ext}`);
      
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(tempCadPath, Buffer.from(buffer));

        // 3. Trigger Blender headless conversions
        console.log(`[Model Orchestrator] Triggering Blender pipeline conversion...`);
        const blenderResult = await convertCadModelToGlb(tempCadPath, mpn);
        
        blenderPins = blenderResult.pins || [];
        meshInfo = {
          vertices: blenderResult.vertices,
          materials: blenderResult.materials,
          optimized: blenderResult.vertices > 1000 ? true : false
        };

        // Servable GLB static server URL
        localGlbUrl = `http://localhost:5000/models/${path.basename(blenderResult.glbPath)}`;

        // Cleanup downloaded CAD file
        try {
          fs.unlinkSync(tempCadPath);
        } catch (_) {}
      } else {
        console.warn(`[Model Orchestrator] Failed to download CAD asset, HTTP status: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`[Model Orchestrator] Blender CAD conversion pipeline error:`, err.message);
    }
  }

  // 4. Align coordinate spaces (PCB -> Model space transforms)
  const resolvedPins = alignPinSpaces(rawData.pins, blenderPins, rawData.package?.mounting || "smd");

  // 5. Store / update document in MongoDB
  const updatePayload = {
    mpn: rawData.mpn,
    name: rawData.mpn,
    manufacturer: rawData.manufacturer,
    description: rawData.description,
    categories: rawData.categories,
    datasheetUrl: rawData.datasheetUrl,
    imageUrl: rawData.imageUrl,
    
    // Canonical metadata details
    componentFormatVersion: "1.0",
    source,
    sourceId: rawData.easyedaId || "",
    assetVersion: CURRENT_ASSET_VERSION,
    pipelineVersion: CURRENT_PIPELINE_VERSION,

    // Package metadata
    package: rawData.package,

    // Mesh metadata & transforms
    mesh: meshInfo,
    transform: {
      position: {
        x: (rawData as any).offset?.x ?? 0,
        y: (rawData as any).offset?.y ?? 0,
        z: (rawData as any).offset?.z ?? 0
      },
      rotation: {
        x: (rawData as any).rotate?.x ?? 0,
        y: (rawData as any).rotate?.y ?? 0,
        z: (rawData as any).rotate?.z ?? 0
      },
      scale: {
        x: (rawData as any).scale?.x ?? 1,
        y: (rawData as any).scale?.y ?? 1,
        z: (rawData as any).scale?.z ?? 1
      }
    },

    model3d: {
      stepUrl: rawData.model3d?.stepUrl || "",
      wrlUrl: rawData.model3d?.wrlUrl || "",
      glbUrl: localGlbUrl,
      localPath: localGlbUrl ? path.join("e:\\wireup.ai - new\\backend\\storage\\models", `${mpn.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.glb`) : ""
    },

    // Backwards compatibility field glbUrl
    glbUrl: localGlbUrl,

    pins: resolvedPins,
    pinsCachedAt: new Date(),
    footprint: rawData.footprint,
    symbol: rawData.symbol
  };

  console.log(`[Model Orchestrator] Upserting document for MPN: "${mpn}" to MongoDB`);
  const finalDoc = await Part.findOneAndUpdate(
    { mpn: rawData.mpn },
    { $set: updatePayload },
    { upsert: true, new: true }
  );

  return finalDoc;
}
