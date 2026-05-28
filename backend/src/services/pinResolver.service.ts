// ??$$$ NEW FLOW — Pin Resolver Service
// Resolves SnapEDA pin metadata for BOM items after Agent 2 completes
// Runs in background — never blocks BOM response to frontend
import Part from "../models/part.model";
import { searchSnapEDA, getPinMetadata, SnapEdaPin } from "./snapeda.service";

const PIN_CACHE_TTL_DAYS = 30;

// ??$$$ Check if cached pins are still fresh (within TTL)
function isPinCacheValid(pinsCachedAt: Date | null | undefined): boolean {
  if (!pinsCachedAt) return false;
  const ageMs = Date.now() - new Date(pinsCachedAt).getTime();
  return ageMs < PIN_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
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

    // Step 3: Search SnapEDA for snapedaId
    const snapResult = await searchSnapEDA(mpn);
    if (!snapResult?.snapedaId) {
      console.warn(`[PinResolver] No SnapEDA match for MPN: "${mpn}"`);
      return [];
    }

    // Step 4: Fetch pin metadata
    const pins = await getPinMetadata(snapResult.snapedaId);
    if (!pins.length) {
      console.warn(`[PinResolver] No pins returned from SnapEDA for snapedaId: ${snapResult.snapedaId}`);
      return [];
    }

    // Step 5: Save to MongoDB Part document
    await Part.findOneAndUpdate(
      { mpn },
      {
        $set: {
          snapedaId: snapResult.snapedaId,
          pins,
          pinsCachedAt: new Date()
        }
      },
      { upsert: false } // only update existing parts, never create phantom parts
    );

    console.log(`[PinResolver] Resolved ${pins.length} pins for "${mpn}" via SnapEDA`);

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
