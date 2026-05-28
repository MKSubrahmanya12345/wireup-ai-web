// ??$$$ NEW FLOW — SnapEDA Service: pin metadata only (no model downloads)
// GLB models come from MongoDB Part.glbUrl (isCurated parts only)
// Uses native fetch (Node 18+) — no axios dependency needed

const BASE_URL = process.env.SNAPEDA_BASE_URL || "https://marketplace.snapeda.com/api/v1";
const API_KEY = process.env.SNAPEDA_API_KEY || "";

export interface SnapEdaPin {
  id: string;        // e.g. "1", "A1"
  name: string;      // e.g. "VCC", "GPIO21", "SDA"
  x_mm: number;
  y_mm: number;
  z_mm: number;      // typically 0 for flat/PCB components
  type: "power" | "digital" | "analog" | "gnd" | "nc";
}

interface SnapEdaSearchResult {
  snapedaId: string;
  name: string;
  has_3d_model: boolean;
}

// ??$$$ Classify pin type from SnapEDA pin designator / name heuristics
function classifyPinType(pinName: string, designator?: string): SnapEdaPin["type"] {
  const n = (pinName || "").toUpperCase();
  const d = (designator || "").toUpperCase();
  if (n.includes("VCC") || n.includes("VDD") || n.includes("3V") || n.includes("5V") || d === "PWR") return "power";
  if (n.includes("GND") || n.includes("VSS") || d === "GND") return "gnd";
  if (n.includes("GPIO") || n.includes("DIO") || n.includes("CLK") || n.includes("SCK") ||
      n.includes("MOSI") || n.includes("MISO") || n.includes("SCL") || n.includes("SDA") ||
      n.includes("TX") || n.includes("RX") || d === "IN" || d === "OUT" || d === "IO") return "digital";
  if (n.includes("ADC") || n.includes("DAC") || n.includes("AIN") || n.includes("AOUT") || d === "AI" || d === "AO") return "analog";
  if (n.includes("NC") || n === "NC") return "nc";
  return "digital"; // safe default
}

// ??$$$ Search SnapEDA for a part by MPN — returns snapedaId for subsequent calls
export async function searchSnapEDA(mpn: string): Promise<SnapEdaSearchResult | null> {
  if (!API_KEY) {
    console.warn("[SnapEDA] No SNAPEDA_API_KEY configured — skipping search");
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BASE_URL}/parts/search/?mpn=${encodeURIComponent(mpn)}`, {
      headers: { Authorization: `Token ${API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const results = json?.results || json?.parts || [];
    if (!results.length) return null;
    const first = results[0];
    return {
      snapedaId: String(first.id || first.part_id || first.slug || ""),
      name: first.part_name || first.name || mpn,
      has_3d_model: !!(first.has_3d_model || first.model_3d)
    };
  } catch (err: any) {
    console.warn(`[SnapEDA] searchSnapEDA failed for MPN "${mpn}":`, err.message);
    return null;
  }
}

// ??$$$ Fetch pin metadata for a known SnapEDA part ID
export async function getPinMetadata(snapedaId: string): Promise<SnapEdaPin[]> {
  if (!API_KEY || !snapedaId) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BASE_URL}/parts/${snapedaId}/pins/`, {
      headers: { Authorization: `Token ${API_KEY}` },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    const rawPins: any[] = json?.results || json?.pins || [];
    return rawPins.map((p: any, idx: number) => ({
      id: String(p.pin_number || p.id || idx + 1),
      name: p.name || p.pin_name || `P${idx + 1}`,
      x_mm: parseFloat(p.x || p.x_mm || p.pos_x || 0),
      y_mm: parseFloat(p.y || p.y_mm || p.pos_y || 0),
      z_mm: parseFloat(p.z || p.z_mm || 0),
      type: classifyPinType(p.name || p.pin_name || "", p.electrical_type || p.designator || "")
    }));
  } catch (err: any) {
    console.warn(`[SnapEDA] getPinMetadata failed for snapedaId "${snapedaId}":`, err.message);
    return [];
  }
}
