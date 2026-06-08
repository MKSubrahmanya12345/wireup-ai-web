// ??$$$ group 6 - Physical Enclosure & 3D Modeling (Phase 5)
// @ts-nocheck
// ??$$$ Model Conversion Service for fetching and converting STEP to GLB models
import Part from "../models/part.model";
import Project from "../models/project.model";

import fs from "fs";
import path from "path";

// ??$$$ newer code — cache online models locally to E: and return backend serve path
export async function cacheModelLocally(mpn: string, url: string): Promise<string> {
  const modelsDir = process.env.MODELS_DIR || path.join(process.cwd(), "exports", "models");
  try {
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    const safeMpn = mpn.replace(/[^a-zA-Z0-9_-]/g, "_");
    const localPath = path.join(modelsDir, `${safeMpn}.glb`);

    console.log(`[modelConversion] Caching model from "${url}" to local disk: "${localPath}"`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    console.log(`[modelConversion] Successfully cached model locally for ${mpn}`);
    return `http://localhost:5000/models/${safeMpn}.glb`;
  } catch (err: any) {
    console.error(`[modelConversion] Failed to cache model locally for ${mpn}:`, err.message);
    return url; // fallback to online url
  }
}

/**
 * Trigger background job to fetch and convert 3D models for a project's BOM.
 * This runs in the background and does not block the UI.
 */
export const triggerBOMModelFetchJob = (projectId: string, bomItems: any[]) => {
  // Execute async immediately to avoid blocking
  console.log(`[modelConversion.service] Triggering background 3D model fetch job for project: ${projectId}`);
  
  Promise.resolve().then(async () => {
    try {
      const project = await Project.findById(projectId);
      if (!project) return;

      for (const item of bomItems) {
        // Find matching Part
        let part = null;
        if (item.partId) {
          part = await Part.findById(item.partId);
        }
        if (!part && item.mpn) {
          part = await Part.findOne({ mpn: item.mpn });
        }
        if (!part) {
          // Fallback search by displayName / key
          part = await Part.findOne({
            $or: [
              { name: item.displayName },
              { mpn: item.key.toUpperCase() }
            ]
          });
        }

        // If part still doesn't exist, create a new temporary Part document for tracking
        if (!part) {
          console.log(`[modelConversion.service] Part not found for BOM item: ${item.displayName || item.key}. Creating new Part doc.`);
          part = new Part({
            mpn: item.mpn || item.key.toUpperCase() || "GENERIC-PART",
            name: item.displayName || item.key,
            manufacturer: "Generic",
            description: item.purpose || "",
            glbUrl: ""
          });
          await part.save();
          
          // Link it back to the BOM item in project
          const pIndex = project.bom.findIndex(b => b.key === item.key);
          if (pIndex !== -1) {
            project.bom[pIndex].partId = part._id.toString();
            project.bom[pIndex].mpn = part.mpn;
          }
        }

        // Check if glbUrl exists
        if (part.glbUrl) {
          console.log(`[modelConversion.service] GLB model already exists for part: ${part.name} -> ${part.glbUrl}`);
          continue;
        }

        // Trigger conversion process
        console.log(`[modelConversion.service] Starting STEP to GLB conversion for: ${part.name} (MPN: ${part.mpn})`);
        
        // Asynchronously process this part
        processPartModelConversion(projectId, item.key, part._id.toString()).catch(err => {
          console.error(`[modelConversion.service] Error converting part model for ${item.key}:`, err);
        });
      }

      await project.save();
    } catch (error) {
      console.error("[modelConversion.service] Error in triggerBOMModelFetchJob:", error);
    }
  });
};

/**
 * Handle individual part search, download, convert, upload, and socket emission.
 */
async function processPartModelConversion(projectId: string, bomKey: string, partId: string) {
  const part = await Part.findById(partId);
  if (!part) return;

  const mpn = part.mpn;
  console.log(`[modelConversion.service] Converting Part ID: ${partId}, MPN: ${mpn}`);

  // Simulating/implementing the external APIs step by step
  let stepFileUrl = "";
  let glbUrl = "";

  try {
    // 1. Search SnapEDA API for STEP file
    // Real implementation or fallback simulation
    if (process.env.SNAPEDA_API_KEY) {
      console.log(`[modelConversion.service] Querying SnapEDA API for MPN: ${mpn}...`);
      const snapRes = await fetch(`https://www.snapeda.com/api/v1/parts/search?q=${encodeURIComponent(mpn)}&key=${process.env.SNAPEDA_API_KEY}`);
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        // Extract step file URL from response
        const firstResult = snapData.results?.[0];
        if (firstResult?.step_file) {
          stepFileUrl = firstResult.step_file;
          console.log(`[modelConversion.service] Found STEP file on SnapEDA: ${stepFileUrl}`);
        }
      }
    }

    // 2. Convert STEP → GLB using CAD Exchanger Cloud API
    const cadExchangerKey = process.env.CAD_EXCHANGER_KEY;
    if (stepFileUrl && cadExchangerKey) {
      console.log(`[modelConversion.service] Requesting CAD Exchanger conversion for: ${stepFileUrl}...`);
      // Start conversion job on CAD Exchanger Cloud API
      const convRes = await fetch("https://cloud.cadexchanger.com/api/v1/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cadExchangerKey}`
        },
        body: JSON.stringify({
          source: stepFileUrl,
          outputFormat: "glb"
        })
      });
      if (convRes.ok) {
        const jobData = await convRes.json();
        const jobId = jobData.id;
        
        // Poll for job completion
        let attempts = 0;
        let isDone = false;
        while (attempts < 20 && !isDone) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const jobCheck = await fetch(`https://cloud.cadexchanger.com/api/v1/jobs/${jobId}`, {
            headers: { "Authorization": `Bearer ${cadExchangerKey}` }
          });
          if (jobCheck.ok) {
            const statusData = await jobCheck.json();
            if (statusData.status === "completed") {
              glbUrl = statusData.outputUrl;
              isDone = true;
              console.log(`[modelConversion.service] CAD Exchanger conversion complete: ${glbUrl}`);
            } else if (statusData.status === "failed") {
              break;
            }
          }
          attempts++;
        }
      }
    }

    // 3. Fallback: If CAD Exchanger or SnapEDA failed / keys are missing, use a fallback beautiful mock model URL
    if (!glbUrl) {
      console.log(`[modelConversion.service] No keys or conversion failed for ${mpn}. Using beautifully structured mock model.`);
      
      // Let's map specific curated part types to high fidelity mockup model paths
      const lowercaseMpn = mpn.toLowerCase();
      if (lowercaseMpn.includes("arduino-uno") || lowercaseMpn.includes("uno")) {
        glbUrl = "/models/arduino_uno.glb";
      } else if (lowercaseMpn.includes("esp32")) {
        glbUrl = "/models/esp32.glb";
      } else if (lowercaseMpn.includes("servo") || lowercaseMpn.includes("sg90")) {
        glbUrl = "/models/servo.glb";
      } else if (lowercaseMpn.includes("dht22") || lowercaseMpn.includes("sensor")) {
        glbUrl = "/models/sensor.glb";
      } else {
        glbUrl = `/models/component_generic.glb`;
      }
    }

    // 4. Save glbUrl to Part in MongoDB
    part.glbUrl = glbUrl;
    await part.save();
    console.log(`[modelConversion.service] Saved GLB URL to Part: ${partId} -> ${glbUrl}`);

    // 5. Emit socket event "model:ready" with { partId, glbUrl, bomKey, projectId }
    const io = (global as any).io;
    if (io) {
      console.log(`[modelConversion.service] Emitting model:ready event for ${bomKey} in project ${projectId}`);
      io.emit("model:ready", {
        projectId,
        partId,
        bomKey,
        glbUrl
      });
    } else {
      console.warn("[modelConversion.service] Socket.IO instance (global.io) not found. Skipped emitting event.");
    }

  } catch (err) {
    console.error(`[modelConversion.service] Error converting part ${mpn}:`, err);
  }
}
