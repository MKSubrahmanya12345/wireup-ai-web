// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code — Coordinate Space Alignment & Pin Service
import crypto from "crypto";

export interface PcbPosition {
  x_mm: number;
  y_mm: number;
}

export interface ModelPosition {
  x: number;
  y: number;
  z: number;
}

export interface IngestedPin {
  id: string;
  name: string;
  type: string;
  compatibleWith: string[];
  pcbPosition: PcbPosition;
  modelPosition: ModelPosition;
  worldPosition: ModelPosition;
  rotation: ModelPosition;
  normal: ModelPosition;
  snapRadius: number;
}

/**
 * Aligns PCB space, local model space, and world coordinates.
 * Priorities:
 * 1. Blender helper nodes (PIN_*) if available.
 * 2. Fallback to auto-centering PCB footprint pads relative to their bounding box center.
 */
export function alignPinSpaces(
  rawPins: Array<{ name: string; type?: string; pcbPosition: PcbPosition }>,
  blenderEmpties: Array<{ name: string; position: ModelPosition; rotation: ModelPosition }>,
  mounting: "smd" | "tht" | string
): IngestedPin[] {
  console.log(`[Pin Service] Aligning spaces for ${rawPins.length} pins. Empties detected: ${blenderEmpties.length}`);

  // Find bounding box center of PCB footprint pads
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  rawPins.forEach(p => {
    const x = p.pcbPosition.x_mm;
    const y = p.pcbPosition.y_mm;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const pcbCenterX = (minX === Infinity) ? 0 : (minX + maxX) / 2;
  const pcbCenterY = (minY === Infinity) ? 0 : (minY + maxY) / 2;

  return rawPins.map(p => {
    const pinName = p.name;
    const pinType = p.type || (pinName.toUpperCase().includes("GND") ? "gnd" : 
                    (pinName.toUpperCase().includes("VCC") || pinName.toUpperCase().includes("VDD") ? "power" : "digital"));

    // Check if Blender empty exists for this pin
    // Match case-insensitively and support prefixes/suffixes
    const matchingEmpty = blenderEmpties.find(e => 
      e.name.toLowerCase() === pinName.toLowerCase() ||
      e.name.toLowerCase() === `pin_${pinName.toLowerCase()}`
    );

    let modelPosition: ModelPosition;
    let rotation = { x: 0, y: 0, z: 0 };
    let normal = { x: 0, y: 1, z: 0 }; // Default facing up from board plane

    if (matchingEmpty) {
      // Use exact 3D coordinates from Blender Empty node
      modelPosition = { ...matchingEmpty.position };
      rotation = { ...matchingEmpty.rotation };
      
      // Compute normal based on rotation
      // Standard local normal vectors rotated by Euler angles
      const cy = Math.cos(rotation.y);
      const sy = Math.sin(rotation.y);
      const cx = Math.cos(rotation.x);
      const sx = Math.sin(rotation.x);
      
      normal = {
        x: sy,
        y: cx * cy,
        z: sx
      };
    } else {
      // Auto-centered fallback offset mapping
      const localX = p.pcbPosition.x_mm - pcbCenterX;
      const localZ = p.pcbPosition.y_mm - pcbCenterY; // Map PCB Y to 3D Z
      const localY = mounting === "smd" ? 0.4 : -0.8; // pad height/depth offset

      modelPosition = { x: localX, y: localY, z: localZ };
      normal = mounting === "smd" ? { x: 0, y: 1, z: 0 } : { x: 0, y: -1, z: 0 };
    }

    const pinUuid = crypto.randomUUID();

    // Assign compatibility rules based on pin type
    const compatibleWith = [];
    if (pinType === "gnd") {
      compatibleWith.push("gnd");
    } else if (pinType === "power") {
      compatibleWith.push("power");
    } else {
      compatibleWith.push("digital", "analog");
    }

    return {
      id: pinUuid,
      name: pinName,
      type: pinType,
      compatibleWith,
      pcbPosition: { ...p.pcbPosition },
      modelPosition,
      worldPosition: { x: 0, y: 0, z: 0 }, // determined dynamically in the 3D scene placement
      rotation,
      normal,
      snapRadius: mounting === "smd" ? 1.5 : 2.5
    };
  });
}
