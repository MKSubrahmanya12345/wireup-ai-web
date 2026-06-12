// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code — KiCad Static Fallback Service
import crypto from "crypto";
import { EasyEdaComponentData } from "./easyeda.service";

// Static footprints for common standard packages
const KICAD_STATIC_PACKAGES: Record<string, {
  type: string;
  pitch_mm: number;
  mounting: "smd" | "tht";
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  pins: Array<{ name: string; type: string; x_mm: number; y_mm: number }>;
}> = {
  "DIP-8": {
    type: "DIP-8",
    pitch_mm: 2.54,
    mounting: "tht",
    width_mm: 9.27,
    height_mm: 7.62,
    depth_mm: 3.3,
    pins: [
      { name: "1", type: "digital", x_mm: -3.81, y_mm: -3.81 },
      { name: "2", type: "digital", x_mm: -1.27, y_mm: -3.81 },
      { name: "3", type: "digital", x_mm: 1.27, y_mm: -3.81 },
      { name: "4", type: "gnd", x_mm: 3.81, y_mm: -3.81 },
      { name: "5", type: "digital", x_mm: 3.81, y_mm: 3.81 },
      { name: "6", type: "digital", x_mm: 1.27, y_mm: 3.81 },
      { name: "7", type: "digital", x_mm: -1.27, y_mm: 3.81 },
      { name: "8", type: "power", x_mm: -3.81, y_mm: 3.81 }
    ]
  },
  "DIP-16": {
    type: "DIP-16",
    pitch_mm: 2.54,
    mounting: "tht",
    width_mm: 19.05,
    height_mm: 7.62,
    depth_mm: 3.3,
    pins: [
      { name: "1", type: "digital", x_mm: -8.89, y_mm: -3.81 },
      { name: "2", type: "digital", x_mm: -6.35, y_mm: -3.81 },
      { name: "3", type: "digital", x_mm: -3.81, y_mm: -3.81 },
      { name: "4", type: "digital", x_mm: -1.27, y_mm: -3.81 },
      { name: "5", type: "digital", x_mm: 1.27, y_mm: -3.81 },
      { name: "6", type: "digital", x_mm: 3.81, y_mm: -3.81 },
      { name: "7", type: "digital", x_mm: 6.35, y_mm: -3.81 },
      { name: "8", type: "gnd", x_mm: 8.89, y_mm: -3.81 },
      { name: "9", type: "digital", x_mm: 8.89, y_mm: 3.81 },
      { name: "10", type: "digital", x_mm: 6.35, y_mm: 3.81 },
      { name: "11", type: "digital", x_mm: 3.81, y_mm: 3.81 },
      { name: "12", type: "digital", x_mm: 1.27, y_mm: 3.81 },
      { name: "13", type: "digital", x_mm: -1.27, y_mm: 3.81 },
      { name: "14", type: "digital", x_mm: -3.81, y_mm: 3.81 },
      { name: "15", type: "digital", x_mm: -6.35, y_mm: 3.81 },
      { name: "16", type: "power", x_mm: -8.89, y_mm: 3.81 }
    ]
  },
  "SOIC-8": {
    type: "SOIC-8",
    pitch_mm: 1.27,
    mounting: "smd",
    width_mm: 4.9,
    height_mm: 3.9,
    depth_mm: 1.25,
    pins: [
      { name: "1", type: "digital", x_mm: -1.905, y_mm: -2.5 },
      { name: "2", type: "digital", x_mm: -0.635, y_mm: -2.5 },
      { name: "3", type: "digital", x_mm: 0.635, y_mm: -2.5 },
      { name: "4", type: "gnd", x_mm: 1.905, y_mm: -2.5 },
      { name: "5", type: "digital", x_mm: 1.905, y_mm: 2.5 },
      { name: "6", type: "digital", x_mm: 0.635, y_mm: 2.5 },
      { name: "7", type: "digital", x_mm: -0.635, y_mm: 2.5 },
      { name: "8", type: "power", x_mm: -1.905, y_mm: 2.5 }
    ]
  },
  "TO-220": {
    type: "TO-220",
    pitch_mm: 2.54,
    mounting: "tht",
    width_mm: 10.16,
    height_mm: 4.7,
    depth_mm: 15.87,
    pins: [
      { name: "1", type: "digital", x_mm: -2.54, y_mm: 0 },
      { name: "2", type: "power", x_mm: 0, y_mm: 0 },
      { name: "3", type: "gnd", x_mm: 2.54, y_mm: 0 }
    ]
  }
};

/**
 * Returns KiCad static metadata fallback structure if EasyEDA lookup fails.
 */
export function getKiCadStaticFallback(mpn: string, category?: string): EasyEdaComponentData | null {
  console.log(`[KiCad Service] Constructing static fallback for MPN: "${mpn}"`);

  // Detect appropriate package type based on MPN or category hints
  let targetPackage = "DIP-8";
  if (mpn.toUpperCase().includes("ESP") || mpn.toUpperCase().includes("MCU")) {
    targetPackage = "DIP-16";
  } else if (mpn.toUpperCase().includes("LM") || mpn.toUpperCase().includes("NE555")) {
    targetPackage = "SOIC-8";
  } else if (mpn.toUpperCase().includes("7805") || mpn.toUpperCase().includes("IRF")) {
    targetPackage = "TO-220";
  }

  const pkg = KICAD_STATIC_PACKAGES[targetPackage] || KICAD_STATIC_PACKAGES["DIP-8"];

  const pins = pkg.pins.map(p => ({
    id: crypto.randomUUID(),
    name: p.name,
    type: p.type,
    compatibleWith: p.type === "power" ? ["power"] : (p.type === "gnd" ? ["gnd"] : ["digital", "analog"]),
    pcbPosition: { x_mm: p.x_mm, y_mm: p.y_mm },
    modelPosition: { x: p.x_mm, y: 0.8, z: p.y_mm },
    worldPosition: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    snapRadius: 2.0
  }));

  // Generate generic placeholder URLs for step/wrl models
  const dummyUuid = crypto.createHash("md5").update(mpn).digest("hex");
  const stepUrl = `https://kicad-fallback-libs.org/models/${targetPackage.toLowerCase()}_${dummyUuid}.step`;
  const wrlUrl = `https://kicad-fallback-libs.org/models/${targetPackage.toLowerCase()}_${dummyUuid}.wrl`;

  return {
    mpn,
    manufacturer: "KiCad Fallback",
    lcscId: "",
    easyedaId: `kicad-${dummyUuid.slice(0, 8)}`,
    description: `Static KiCad fallback component for standard ${targetPackage} package.`,
    categories: category ? [category] : ["Standard Components"],
    datasheetUrl: "",
    imageUrl: "",
    package: {
      type: pkg.type,
      pitch_mm: pkg.pitch_mm,
      mounting: pkg.mounting
    },
    model3d: {
      stepUrl,
      wrlUrl,
      glbUrl: "",
      localPath: ""
    },
    pins,
    footprint: { type: "static_kicad", package: pkg.type },
    symbol: { type: "static_kicad", package: pkg.type }
  };
}

// ??$$$ newer code — Dynamic KiCad S-Expression resolver
export async function resolveKiCadComponent(mpn: string, category?: string): Promise<EasyEdaComponentData | null> {
  console.log(`[KiCad Service] Resolving dynamic KiCad component for MPN: "${mpn}"`);

  // Detect appropriate package type based on MPN
  let targetPackage = "DIP-8";
  if (mpn.toUpperCase().includes("TO92") || mpn.toUpperCase().includes("TMP36") || mpn.toUpperCase().includes("TO-92")) {
    targetPackage = "TO-92_Inline";
  } else if (mpn.toUpperCase().includes("ESP") || mpn.toUpperCase().includes("MCU")) {
    targetPackage = "DIP-16";
  } else if (mpn.toUpperCase().includes("LM") || mpn.toUpperCase().includes("NE555") || mpn.toUpperCase().includes("SOIC")) {
    targetPackage = "SOIC-8";
  } else if (mpn.toUpperCase().includes("7805") || mpn.toUpperCase().includes("IRF") || mpn.toUpperCase().includes("TO-220")) {
    targetPackage = "TO-220";
  }

  const KICAD_FOOTPRINT_MAPPING: Record<string, string> = {
    "TO-92_Inline": "Package_TO_SOT_THT.pretty/TO-92_Inline.kicad_mod",
    "DIP-8": "Package_DIP.pretty/DIP-8_W7.62mm.kicad_mod",
    "DIP-16": "Package_DIP.pretty/DIP-16_W7.62mm.kicad_mod",
    "SOIC-8": "Package_SO.pretty/SOIC-8_3.9x4.9mm_P1.27mm.kicad_mod",
    "TO-220": "Package_TO_SOT_THT.pretty/TO-220-3_Vertical.kicad_mod"
  };

  const mappingPath = KICAD_FOOTPRINT_MAPPING[targetPackage];
  if (!mappingPath) {
    return getKiCadStaticFallback(mpn, category);
  }

  const url = `https://raw.githubusercontent.com/KiCad/kicad-footprints/master/${mappingPath}`;
  console.log(`[KiCad Service] Fetching S-expression footprint from KiCad master: ${url}`);

  try {
    const res = await globalThis.fetch(url);
    if (!res.ok) {
      console.warn(`[KiCad Service] Footprint fetch failed with status ${res.status}. Falling back to static profile.`);
      return getKiCadStaticFallback(mpn, category);
    }
    const content = await res.text();

    // Parse model block (offset, scale, rotate)
    const modelRegex = /\(model\s+(?:"([^"]+)"|([^\s\)]+))\s*\(at\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\(scale\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\(rotate\s+\(xyz\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)\)\s*\)/i;
    const match = content.match(modelRegex);

    let offset = { x: 0, y: 0, z: 0 };
    let scale = { x: 1, y: 1, z: 1 };
    let rotate = { x: 0, y: 0, z: 0 };
    let stepUrl = "";
    let wrlUrl = "";

    if (match) {
      const rawPath = match[1] || match[2];
      offset = { x: parseFloat(match[3]), y: parseFloat(match[4]), z: parseFloat(match[5]) };
      scale = { x: parseFloat(match[6]), y: parseFloat(match[7]), z: parseFloat(match[8]) };
      rotate = { x: parseFloat(match[9]), y: parseFloat(match[10]), z: parseFloat(match[11]) };

      // Map to gitlab raw packages3d format
      // remove environmental prefix e.g. ${KISYS3DMOD}/ or ${KICAD6_3DMODEL_DIR}/
      const cleanPath = rawPath.replace(/^\$\{[A-Z0-9_]+\}\//i, "");
      
      // Swap WRL for STEP as instructed, keeping both links
      const cleanStepPath = cleanPath.replace(/\.wrl$/i, ".step");

      wrlUrl = `https://raw.githubusercontent.com/KiCad/kicad-packages3D/master/${cleanPath}`;
      stepUrl = `https://raw.githubusercontent.com/KiCad/kicad-packages3D/master/${cleanStepPath}`;
      
      console.log(`[KiCad Service] Successfully parsed S-expression model links:\n  - STEP: ${stepUrl}\n  - WRL: ${wrlUrl}`);
    }

    // Parse pads to resolve pin layout and position
    const padRegex = /pad\s+([A-Za-z0-9_]+)\s+\S+\s+\S+\s+\(at\s+([-\d.]+)\s+([-\d.]+)\)/g;
    const pins: any[] = [];
    let padMatch;
    
    // Reset regex index
    padRegex.lastIndex = 0;
    while ((padMatch = padRegex.exec(content)) !== null) {
      const pinName = padMatch[1];
      const pinX = parseFloat(padMatch[2]);
      const pinY = parseFloat(padMatch[3]);

      pins.push({
        id: crypto.randomUUID(),
        name: pinName,
        type: "digital",
        compatibleWith: ["digital", "analog", "gnd", "power"],
        pcbPosition: { x_mm: pinX, y_mm: pinY },
        modelPosition: { x: pinX, y: 0.8, z: pinY },
        worldPosition: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 1, z: 0 },
        snapRadius: 2.0
      });
    }

    // Fallback to static package pins if none were parsed
    const staticPkg = KICAD_STATIC_PACKAGES[targetPackage] || KICAD_STATIC_PACKAGES["DIP-8"];
    if (pins.length === 0) {
      staticPkg.pins.forEach(p => {
        pins.push({
          id: crypto.randomUUID(),
          name: p.name,
          type: p.type,
          compatibleWith: ["digital", "analog", "gnd", "power"],
          pcbPosition: { x_mm: p.x_mm, y_mm: p.y_mm },
          modelPosition: { x: p.x_mm, y: 0.8, z: p.y_mm },
          worldPosition: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          snapRadius: 2.0
        });
      });
    }

    const dummyUuid = crypto.createHash("md5").update(mpn).digest("hex");

    return {
      mpn,
      manufacturer: "KiCad Footprints",
      lcscId: "",
      easyedaId: `kicad-${dummyUuid.slice(0, 8)}`,
      description: `KiCad S-Expression resolved component for ${targetPackage} package.`,
      categories: category ? [category] : ["Standard Components"],
      datasheetUrl: "",
      imageUrl: "",
      package: {
        type: staticPkg.type,
        pitch_mm: staticPkg.pitch_mm,
        mounting: staticPkg.mounting
      },
      model3d: {
        stepUrl: stepUrl || `https://kicad-fallback-libs.org/models/${targetPackage.toLowerCase()}_${dummyUuid}.step`,
        wrlUrl: wrlUrl || `https://kicad-fallback-libs.org/models/${targetPackage.toLowerCase()}_${dummyUuid}.wrl`,
        glbUrl: "",
        localPath: ""
      },
      // Store parsed S-expression spatial offsets
      offset,
      scale,
      rotate,
      pins,
      footprint: { type: "kicad_s_expr", package: targetPackage },
      symbol: { type: "kicad_s_expr", package: targetPackage }
    };
  } catch (err: any) {
    console.error(`[KiCad Service] S-expression footprint parsing error:`, err.message);
    return getKiCadStaticFallback(mpn, category);
  }
}
