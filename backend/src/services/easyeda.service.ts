// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code — EasyEDA Component Ingestion Service
import crypto from "crypto";

export interface EasyEdaComponentData {
  mpn: string;
  manufacturer: string;
  lcscId: string;
  easyedaId: string;
  description: string;
  categories: string[];
  datasheetUrl: string;
  imageUrl: string;
  package: {
    type: string;
    pitch_mm: number;
    mounting: "smd" | "tht" | "other";
  };
  model3d: {
    stepUrl: string;
    wrlUrl: string;
    glbUrl: string;
    localPath: string;
  };
  pins: any[];
  footprint: any;
  symbol: any;
  offset?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  rotate?: { x: number; y: number; z: number };
}

/**
 * Searches EasyEDA API for a component by MPN or LCSC ID and downloads metadata.
 */
export async function fetchEasyEdaComponent(mpn: string, lcscId?: string): Promise<EasyEdaComponentData | null> {
  const query = lcscId || mpn;
  console.log(`[EasyEDA Service] Fetching data for query: "${query}"`);

  try {
    // 1. Query EasyEDA Component Search API
    const searchUrl = `https://easyeda.com/api/components?keyword=${encodeURIComponent(query)}&page=1&pageSize=3`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`EasyEDA Search API returned HTTP ${searchRes.status}`);
    }

    const searchData = (await searchRes.json()) as any;
    const componentSummary = searchData?.result?.lists?.[0];

    if (!componentSummary) {
      console.warn(`[EasyEDA Service] No search results for: "${query}"`);
      return null;
    }

    const uuid = componentSummary.uuid;
    console.log(`[EasyEDA Service] Found component UUID: "${uuid}"`);

    // 2. Fetch component detail (symbol & footprint)
    const detailUrl = `https://easyeda.com/api/components/${uuid}`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) {
      throw new Error(`EasyEDA Details API returned HTTP ${detailRes.status}`);
    }

    const detailData = (await detailRes.json()) as any;
    const result = detailData?.result;

    if (!result) {
      console.warn(`[EasyEDA Service] Empty detail response for UUID: "${uuid}"`);
      return null;
    }

    // Extract basic fields
    const parsedMpn = result.mpn || componentSummary.mpn || mpn;
    const manufacturer = result.manufacturer || componentSummary.manufacturer || "Generic";
    const parsedLcscId = result.lcsc || componentSummary.lcsc || "";
    const description = result.description || componentSummary.description || "";
    
    // Parse package mounting and pitch
    const packageType = result.package || "SOIC-8";
    const mounting = packageType.toLowerCase().includes("smd") || packageType.toLowerCase().includes("soic") || packageType.toLowerCase().includes("qfn") ? "smd" : "tht";
    
    // Infer pitch based on package type
    let pitch = 2.54;
    if (packageType.toLowerCase().includes("soic")) pitch = 1.27;
    else if (packageType.toLowerCase().includes("ssop")) pitch = 0.65;
    else if (packageType.toLowerCase().includes("qfn")) pitch = 0.5;

    // Parse symbol & footprint objects
    const symbolJson = result.symbol || {};
    const footprintJson = result.footprint || {};

    // 3. Extract pin info from footprint pad positions
    const pins: any[] = [];
    const pads = footprintJson.pads || [];
    
    pads.forEach((pad: any) => {
      const pinName = pad.name || pad.number || `PIN_${pins.length + 1}`;
      const pinType = pinName.toUpperCase().includes("GND") ? "gnd" : 
                      (pinName.toUpperCase().includes("VCC") || pinName.toUpperCase().includes("VDD") || pinName.toUpperCase().includes("5V") || pinName.toUpperCase().includes("3V") ? "power" : "digital");
      
      const pinUuid = crypto.randomUUID();
      
      // Pad coordinates are typically in mils (1 mil = 0.0254 mm) or mm directly. EasyEDA uses 10th of a mil or mils.
      // Normalize coordinate translation:
      const x_mm = typeof pad.x === "number" ? pad.x * 0.0254 : 0;
      const y_mm = typeof pad.y === "number" ? pad.y * 0.0254 : 0;

      pins.push({
        id: pinUuid,
        name: pinName,
        type: pinType,
        compatibleWith: pinType === "power" ? ["power"] : (pinType === "gnd" ? ["gnd"] : ["digital", "analog"]),
        pcbPosition: { x_mm, y_mm },
        modelPosition: { x: x_mm, y: 0.8, z: y_mm }, // initial heuristic mapping
        worldPosition: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 1, z: 0 }, // pointing upwards from PCB plane
        snapRadius: 2.0
      });
    });

    // 4. Resolve 3D model references
    let stepUrl = "";
    let wrlUrl = "";
    const raw3DModel = result["3dmodel"] || result.model3d || {};
    const modelUuid = raw3DModel.uuid || raw3DModel.id || "";
    
    if (modelUuid) {
      // EasyEDA public endpoint templates for 3D model files
      stepUrl = `https://easyeda.com/api/3dmodels/${modelUuid}/step`;
      wrlUrl = `https://easyeda.com/api/3dmodels/${modelUuid}/wrl`;
    }

    const canonicalData: EasyEdaComponentData = {
      mpn: parsedMpn,
      manufacturer,
      lcscId: parsedLcscId,
      easyedaId: uuid,
      description,
      categories: result.categories || [componentSummary.category].filter(Boolean),
      datasheetUrl: result.datasheet || componentSummary.datasheet || "",
      imageUrl: result.image || componentSummary.image || "",
      package: {
        type: packageType,
        pitch_mm: pitch,
        mounting
      },
      model3d: {
        stepUrl,
        wrlUrl,
        glbUrl: "",
        localPath: ""
      },
      pins,
      footprint: footprintJson,
      symbol: symbolJson
    };

    return canonicalData;
  } catch (err: any) {
    console.error(`[EasyEDA Service] Failed to ingest component ${mpn}:`, err.message);
    return null;
  }
}
