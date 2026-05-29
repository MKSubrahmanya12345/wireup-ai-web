// ??$$$ NEW FLOW — Pin Resolver Service
// Resolves SnapEDA pin metadata for BOM items after Agent 2 completes
// Runs in background — never blocks BOM response to frontend
// ??$$$ old code
// import Part from "../models/part.model";
// import { searchSnapEDA, getPinMetadata, SnapEdaPin } from "./snapeda.service";
// import { cacheModelLocally } from "./modelConversion.service";
// ??$$$ newer code
import mongoose from "mongoose";
import Part from "../models/part.model";
import { searchSnapEDA, getPinMetadata, SnapEdaPin } from "./snapeda.service";
import { cacheModelLocally } from "./modelConversion.service";

const PIN_CACHE_TTL_DAYS = 30;

// ??$$$ Check if cached pins are still fresh (within TTL)
function isPinCacheValid(pinsCachedAt: Date | null | undefined): boolean {
  if (!pinsCachedAt) return false;
  const ageMs = Date.now() - new Date(pinsCachedAt).getTime();
  return ageMs < PIN_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

// ??$$$ newer code — get fallback standard pins for popular components
function getFallbackPins(mpn: string): any[] {
  const norm = mpn.toUpperCase();
  
  if (norm.includes("ESP8266") || norm.includes("NODEMCU")) {
    const pinNames = [
      "A0", "GND", "VU", "S3", "S2", "S1", "SC", "SO", "SK", "GND", "3V3", "EN", "RST", "GND", "VIN",
      "D0", "D1", "D2", "D3", "D4", "3V3", "GND", "D5", "D6", "D7", "D8", "RX", "TX", "GND", "3V3"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name.includes("3V") || name.includes("V") ? "power" : "digital")
    }));
  }
  
  if (norm.includes("LCD") || norm.includes("1602") || norm.includes("16X2")) {
    const pinNames = ["GND", "VCC", "SDA", "SCL"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : (name === "VCC" ? "power" : "digital")
    }));
  }
  
  if (norm.includes("TMP36") || norm.includes("TEMPERATURE") || norm.includes("TMP35") || norm.includes("TMP37") || norm.includes("LM35")) {
    const pinNames = ["VCC", "SIG", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : (name === "VCC" ? "power" : "analog")
    }));
  }
  
  if (norm.includes("LED")) {
    return [
      { id: "A", name: "A", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "C", name: "C", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }
  
  if (norm.includes("RESISTOR") || norm.includes("RES")) {
    return [
      { id: "1", name: "1", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "2", name: "2", x_mm: 10, y_mm: 0, z_mm: 0, type: "digital" }
    ];
  }
  
  // Generic fallback: a simple chip with 8 pins
  return [
    { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
    { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
    { id: "IO1", name: "IO1", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
    { id: "IO2", name: "IO2", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" }
  ];
}

// ??$$$ Resolve pins for a single BOM item
// 1. Check MongoDB cache → 2. SnapEDA search → 3. fetch pins → 4. save + emit
export async function resolvePins(
  mpn: string,
  bomKey: string,
  projectId: string,
  io?: any
): Promise<SnapEdaPin[]> {
  try {
    // Step 1: Find Part in MongoDB
    let part = await Part.findOne({ mpn }).lean() as any;

    // ??$$$ old code
    /*
    // Step 2: Return cached if fresh
    if (part && part.pins && part.pins.length > 0 && isPinCacheValid(part.pinsCachedAt)) {
      console.log(`[PinResolver] Cache hit for "${mpn}" (${part.pins.length} pins)`);

      if (io) {
        io.to(projectId).emit("pins:ready", {
          projectId,
          bomKey,
          pins: part.pins
        });
      }
      return part.pins;
    }
    */
    // ??$$$ newer code
    // Step 2: Return cached if fresh, and sync models
    if (part && part.pins && part.pins.length > 0 && isPinCacheValid(part.pinsCachedAt)) {
      console.log(`[PinResolver] Cache hit for "${mpn}" (${part.pins.length} pins)`);

      if (projectId) {
        try {
          const Project = mongoose.model("Project");
          const mappedPins = part.pins.map((p: any) => ({
            id: p.id || p.name,
            name: p.name || p.id,
            x_mm: p.x_mm || 0,
            y_mm: p.y_mm || 0,
            z_mm: p.z_mm || 0,
            type: p.type || "digital"
          }));
          
          await Project.updateOne(
            { _id: projectId, "bom.key": bomKey },
            {
              $set: {
                "bom.$.pins": mappedPins,
                "bom.$.glbUrl": part.glbUrl || ""
              }
            }
          );
          
          const NewFlowSession = mongoose.model("NewFlowSession");
          await NewFlowSession.updateOne(
            { projectId: projectId, "bom.key": bomKey },
            {
              $set: {
                "bom.$.pins": mappedPins,
                "bom.$.glbUrl": part.glbUrl || ""
              }
            }
          );
          console.log(`[PinResolver] Synced cached pins/glbUrl to Project and NewFlowSession for "${bomKey}"`);
        } catch (err: any) {
          console.error(`[PinResolver] Failed to sync cached pins/glbUrl:`, err.message);
        }
      }

      if (io) {
        io.to(projectId).emit("pins:ready", {
          projectId,
          bomKey,
          pins: part.pins
        });
      }
      return part.pins;
    }

    // Step 3: Search SnapEDA for snapedaId
    const snapResult = await searchSnapEDA(mpn);
    let pins: any[] = [];
    let snapedaId = "";
    if (snapResult && snapResult.snapedaId) {
      snapedaId = snapResult.snapedaId;
      // Step 4: Fetch pin metadata
      pins = await getPinMetadata(snapedaId);
    }

    if (!pins.length) {
      console.warn(`[PinResolver] No pins returned from SnapEDA for ${mpn}. Using fallback standard pins.`);
      pins = getFallbackPins(mpn);
    }

    // ??$$$ old code
    /*
    // Also download & cache GLB model locally if not already cached
    let glbUrl = part?.glbUrl || "";
    if (!glbUrl) {
      const lowercaseMpn = mpn.toLowerCase();
      let sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/uno.glb";
      if (lowercaseMpn.includes("arduino-uno") || lowercaseMpn.includes("uno")) {
        sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/uno.glb";
      } else if (lowercaseMpn.includes("esp8266") || lowercaseMpn.includes("nodemcu")) {
        sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/uno.glb";
      } else if (lowercaseMpn.includes("led")) {
        sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/led.glb";
      } else if (lowercaseMpn.includes("resistor")) {
        sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/resistor.glb";
      } else if (lowercaseMpn.includes("lcd")) {
        sourceUrl = "https://raw.githubusercontent.com/Wokwi/wokwi-features/master/3d/uno.glb";
      }
      try {
        glbUrl = await cacheModelLocally(mpn, sourceUrl);
      } catch (err) {
        glbUrl = sourceUrl;
      }
    }
    */
    // ??$$$ newer code — map directly to local/standard models to bypass 404 remote fetch failures
    let glbUrl = part?.glbUrl || "";
    if (!glbUrl) {
      const lowercaseMpn = mpn.toLowerCase();
      if (lowercaseMpn.includes("arduino-uno") || lowercaseMpn.includes("uno")) {
        glbUrl = "/models/arduino.glb";
      } else if (lowercaseMpn.includes("led")) {
        glbUrl = "/models/led.glb";
      } else if (lowercaseMpn.includes("resistor")) {
        glbUrl = "/models/resistor.glb";
      } else if (lowercaseMpn.includes("button") || lowercaseMpn.includes("switch") || lowercaseMpn.includes("tactile")) {
        glbUrl = "/models/button.glb";
      } else {
        glbUrl = "/models/generic.glb";
      }
    }

    // ??$$$ old code
    /*
    // Step 5: Save to MongoDB Part document
    await Part.findOneAndUpdate(
      { mpn },
      {
        $set: {
          snapedaId,
          pins,
          glbUrl,
          pinsCachedAt: new Date()
        }
      },
      { upsert: false } // only update existing parts, never create phantom parts
    );
    */
    // ??$$$ newer code — update Part document, and also Project and Session models
    await Part.findOneAndUpdate(
      { mpn },
      {
        $set: {
          snapedaId,
          pins,
          glbUrl,
          pinsCachedAt: new Date()
        }
      },
      { upsert: false }
    );

    if (projectId) {
      try {
        const Project = mongoose.model("Project");
        const mappedPins = pins.map((p: any) => ({
          id: p.id || p.name,
          name: p.name || p.id,
          x_mm: p.x_mm || 0,
          y_mm: p.y_mm || 0,
          z_mm: p.z_mm || 0,
          type: p.type || "digital"
        }));
        
        await Project.updateOne(
          { _id: projectId, "bom.key": bomKey },
          {
            $set: {
              "bom.$.pins": mappedPins,
              "bom.$.glbUrl": glbUrl
            }
          }
        );
        console.log(`[PinResolver] Updated Project ${projectId} BOM item "${bomKey}" with ${pins.length} pins.`);

        const NewFlowSession = mongoose.model("NewFlowSession");
        await NewFlowSession.updateOne(
          { projectId: projectId, "bom.key": bomKey },
          {
            $set: {
              "bom.$.pins": mappedPins,
              "bom.$.glbUrl": glbUrl
            }
          }
        );
        console.log(`[PinResolver] Updated NewFlowSession matching project ${projectId} BOM item "${bomKey}" with ${pins.length} pins.`);
      } catch (err: any) {
        console.error(`[PinResolver] Failed to update Project/Session pins:`, err.message);
      }
    }

    console.log(`[PinResolver] Resolved ${pins.length} pins for "${mpn}" via SnapEDA/Fallback`);

    // Step 6: Emit WebSocket event
    if (io) {
      io.to(projectId).emit("pins:ready", {
        projectId,
        bomKey,
        pins
      });
    }

    return pins;
  } catch (err: any) {
    console.error(`[PinResolver] resolvePins failed for "${mpn}":`, err.message);
    return [];
  }
}

// ??$$$ Resolve all BOM items in parallel — run after Agent 2 finalizes BOM
// projectId here is the NEW Project document's _id (not sessionId)
export async function resolveAllPins(
  bom: { mpn: string; key: string }[],
  projectId: string,
  io?: any
): Promise<void> {
  if (!bom || !bom.length) return;

  console.log(`[PinResolver] Resolving pins for ${bom.length} BOM items (projectId: ${projectId})`);

  try {
    await Promise.all(
      bom.map(item =>
        resolvePins(item.mpn, item.key, projectId, io).catch(err => {
          console.error(`[PinResolver] Failed for ${item.mpn}:`, err);
          return [];
        })
      )
    );

    // Emit completion event
    if (io) {
      io.to(projectId).emit("session:pins:complete", { projectId });
    }

    console.log(`[PinResolver] All pins resolved for projectId: ${projectId}`);
  } catch (err: any) {
    console.error("[PinResolver] resolveAllPins error:", err.message);
  }
}
