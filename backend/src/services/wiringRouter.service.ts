// ??$$$ newer code - Shared 3-Phase Graph-Based Wiring Routing Service
import mongoose from "mongoose";
import Part from "../models/part.model";
import { getRegistry, detectCapabilities } from "./registry.services"; // ??$$$ newer code

export interface IPartInfo {
  key: string;
  partId: string;
  name: string;
  role: string;
}

export interface IWiringConnection {
  id: string;
  from: string;
  to: string;
  net: string;
  color: string;
  description: string;
}

// Helper to check if a pin is power/ground
function isPowerOrGndPin(pinName: string): boolean {
  const norm = pinName.toUpperCase();
  return ["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+", "GND", "VSS", "VEE"].some(p => norm === p || norm.startsWith(p + ".") || norm.includes("_GND") || norm.includes("_VCC"));
}

// Find a component pin by name patterns with exact match prioritization
function findPinByName(pins: any[], patterns: string[], defaultVal: string): string {
  if (!Array.isArray(pins)) return defaultVal;
  
  // 1. Try exact match first to prevent false substring matches (e.g. LOUT matching OUT)
  const exactFound = pins.find(p =>
    patterns.some(pat => p.name?.toUpperCase() === pat.toUpperCase() || p.id?.toUpperCase() === pat.toUpperCase())
  );
  if (exactFound) return exactFound.name || exactFound.id;

  // 2. Fallback to substring match
  const found = pins.find(p =>
    patterns.some(pat => p.name?.toUpperCase().includes(pat.toUpperCase()) || p.id?.toUpperCase().includes(pat.toUpperCase()))
  );
  return found ? (found.name || found.id) : defaultVal;
}

// Find an MCU pin by signal type and role from registry
function findPinBySignal(pins: any[], type: string, role?: string): string | null {
  if (!Array.isArray(pins)) return null;
  const found = pins.find(p =>
    p.signals?.some((s: any) =>
      String(s.type).toLowerCase() === type.toLowerCase() &&
      (!role || String(s.role).toLowerCase() === role.toLowerCase())
    )
  );
  return found ? found.name : null;
}

// Resolve MCU standard fallback pins if registry does not specify them
function resolveMcuFallbackPin(mcuName: string, interfaceType: string, role: string): string {
  const normMcu = mcuName.toLowerCase();
  const isEsp32 = normMcu.includes("esp32");
  const isPico = normMcu.includes("pico");
  const isMega = normMcu.includes("mega");

  if (interfaceType.toUpperCase() === "I2S") {
    if (role.toUpperCase() === "DIN" || role.toUpperCase() === "DOUT") {
      return isEsp32 ? "GPIO22" : (isPico ? "GP22" : "D2");
    }
    if (role.toUpperCase() === "LRC" || role.toUpperCase() === "LRCK" || role.toUpperCase() === "WS") {
      return isEsp32 ? "GPIO25" : (isPico ? "GP19" : "D3");
    }
    if (role.toUpperCase() === "BCLK" || role.toUpperCase() === "BCK") {
      return isEsp32 ? "GPIO26" : (isPico ? "GP18" : "D4");
    }
  }

  if (interfaceType.toUpperCase() === "I2C") {
    if (role.toUpperCase() === "SDA") {
      return isEsp32 ? "GPIO21" : (isPico ? "GP4" : (isMega ? "20" : "A4"));
    }
    if (role.toUpperCase() === "SCL") {
      return isEsp32 ? "GPIO22" : (isPico ? "GP5" : (isMega ? "21" : "A5"));
    }
  }

  if (interfaceType.toUpperCase() === "SPI") {
    if (role.toUpperCase() === "MOSI") {
      return isEsp32 ? "GPIO23" : (isPico ? "GP19" : (isMega ? "51" : "D11"));
    }
    if (role.toUpperCase() === "MISO") {
      return isEsp32 ? "GPIO19" : (isPico ? "GP16" : (isMega ? "50" : "D12"));
    }
    if (role.toUpperCase() === "SCK") {
      return isEsp32 ? "GPIO18" : (isPico ? "GP18" : (isMega ? "52" : "D13"));
    }
  }

  if (interfaceType.toUpperCase() === "UART") {
    if (role.toUpperCase() === "TX") {
      return isEsp32 ? "GPIO17" : (isPico ? "GP0" : (isMega ? "1" : "D1"));
    }
    if (role.toUpperCase() === "RX") {
      return isEsp32 ? "GPIO16" : (isPico ? "GP1" : (isMega ? "0" : "D0"));
    }
  }

  return "GPIO4";
}

// Get dynamic MCU interface pin
// ??$$$ newer code - Get dynamic MCU interface pin restricting to registry if available
function getMcuInterfacePin(mcuDef: any, mcuName: string, interfaceType: string, role: string): string {
  if (mcuDef && Array.isArray(mcuDef.pins)) {
    // 1. Try exact signal type & role match
    const matched = findPinBySignal(mcuDef.pins, interfaceType, role);
    if (matched) return matched;

    // 2. Try matching pin name from fallback in the MCU's own pin list
    const fallbackPinName = resolveMcuFallbackPin(mcuName, interfaceType, role);
    const exists = mcuDef.pins.some((p: any) => p.name?.toUpperCase() === fallbackPinName.toUpperCase());
    if (exists) return fallbackPinName;

    // 3. Find any pin in MCU's pins that matches naming patterns for this role
    const patterns: Record<string, string[]> = {
      DIN: ["gpio22", "gp22", "d2", "din"],
      LRC: ["gpio25", "gp19", "d3", "lrc", "lrck", "ws"],
      BCLK: ["gpio26", "gp18", "d4", "bclk", "bck"],
      SDA: ["sda", "gpio21", "gp4", "20", "a4"],
      SCL: ["scl", "gpio22", "gp5", "21", "a5"],
      MOSI: ["mosi", "gpio23", "gp19", "51", "d11"],
      MISO: ["miso", "gpio19", "gp16", "50", "d12"],
      SCK: ["sck", "sclk", "gpio18", "gp18", "52", "d13"],
      TX: ["tx", "gpio17", "gp0", "1", "d1"],
      RX: ["rx", "gpio16", "gp1", "0", "d0"]
    };

    const rolePats = patterns[role.toUpperCase()] || [];
    for (const pat of rolePats) {
      const pin = mcuDef.pins.find((p: any) => p.name?.toLowerCase() === pat.toLowerCase());
      if (pin) return pin.name;
    }

    // 4. Return the first pin in MCU definition that is free (not VCC/GND)
    const fallbackPin = mcuDef.pins.find((p: any) =>
      !p.name.includes("GND") && !p.name.includes("VCC") && !p.name.includes("3V3") && !p.name.includes("5V")
    );
    if (fallbackPin) return fallbackPin.name;
  }
  return resolveMcuFallbackPin(mcuName, interfaceType, role);
}

// ??$$$ newer code - Find a pin by signal metadata with exact, name-match, and substring-match fallbacks
function findPinBySignalMetadata(nodePins: any[], signalRole: string): string | null {
  if (!Array.isArray(nodePins)) return null;

  const patterns: Record<string, string[]> = {
    i2s_clock: ["bclk", "bck", "i2s_bclk", "i2s_bck", "i2s_clk", "sclk", "clk"],
    i2s_word_select: ["lrc", "lrck", "ws", "wsk", "i2s_lrc", "i2s_lrck", "i2s_ws", "word_select"],
    i2s_data_in: ["din", "data", "sd", "isdin", "i2s_din", "i2s_sd", "dac_din", "sdata", "di"],
    spi_mosi: ["mosi", "si", "di", "din", "mosi/txd", "spi_mosi", "sda"],
    spi_miso: ["miso", "so", "do", "dout", "miso/rxd", "spi_miso"],
    spi_sck: ["sck", "sclk", "clk", "sck/clk", "spi_sck"],
    spi_cs: ["cs", "ss", "chip_select", "spi_cs", "/ss"],
    audio_in: ["lin", "rin", "in_l", "in_r", "l_in", "r_in", "in+", "in-", "in1", "in2", "audio_in", "in"],
    audio_out: ["lout", "rout", "l+", "r+", "l_out", "r_out", "out_l", "out_r", "spk_l", "spk_r", "spk+", "spk-", "out", "l", "r"],
    i2c_sda: ["sda", "sad", "i2c_sda"],
    i2c_scl: ["scl", "sclk", "clk", "i2c_scl"],
    uart_tx: ["tx", "txd", "utx", "uart_tx"],
    uart_rx: ["rx", "rxd", "urx", "uart_rx"]
  };

  const rolePatterns = patterns[signalRole] || [];

  for (const pin of nodePins) {
    if (Array.isArray(pin.signals)) {
      for (const sig of pin.signals) {
        const sType = String(sig.type).toLowerCase();
        const sRole = String(sig.role || "").toLowerCase();
        
        if (sType === signalRole) return pin.name || pin.id;
        
        if (signalRole === "i2s_clock" && sType === "i2s" && sRole === "bclk") return pin.name || pin.id;
        if (signalRole === "i2s_word_select" && sType === "i2s" && sRole === "lrc") return pin.name || pin.id;
        if (signalRole === "i2s_data_in" && sType === "i2s" && sRole === "din") return pin.name || pin.id;
        
        if (signalRole === "spi_mosi" && sType === "spi" && sRole === "mosi") return pin.name || pin.id;
        if (signalRole === "spi_miso" && sType === "spi" && sRole === "miso") return pin.name || pin.id;
        if (signalRole === "spi_sck" && sType === "spi" && sRole === "sck") return pin.name || pin.id;
        if (signalRole === "spi_cs" && sType === "spi" && sRole === "cs") return pin.name || pin.id;

        if (signalRole === "i2c_sda" && sType === "i2c" && sRole === "sda") return pin.name || pin.id;
        if (signalRole === "i2c_scl" && sType === "i2c" && sRole === "scl") return pin.name || pin.id;

        if (signalRole === "uart_tx" && sType === "uart" && sRole === "tx") return pin.name || pin.id;
        if (signalRole === "uart_rx" && sType === "uart" && sRole === "rx") return pin.name || pin.id;
      }
    }
  }

  for (const pin of nodePins) {
    const pName = String(pin.name || pin.id || "").toLowerCase();
    if (rolePatterns.includes(pName)) {
      return pin.name || pin.id;
    }
  }

  for (const pin of nodePins) {
    const pName = String(pin.name || pin.id || "").toLowerCase();
    for (const pat of rolePatterns) {
      if (pName.includes(pat)) {
        return pin.name || pin.id;
      }
    }
  }

  return null;
}

// ??$$$ newer code - Get fallback pins for common subsystems when they are not in the registry/DB
function getFallbackComponentPins(pName: string, caps: any): any[] {
  const name = pName.toLowerCase();
  if (caps.role === "I2S DAC") {
    return [
      { name: "DIN", type: "digital", signals: [{ type: "i2s", role: "DIN" }] },
      { name: "LRC", type: "digital", signals: [{ type: "i2s", role: "LRC" }] },
      { name: "BCLK", type: "digital", signals: [{ type: "i2s", role: "BCLK" }] },
      { name: "LOUT", type: "analog", signals: [{ type: "analog", role: "LOUT" }] },
      { name: "ROUT", type: "analog", signals: [{ type: "analog", role: "ROUT" }] },
      { name: "VCC", type: "power" },
      { name: "GND", type: "power" }
    ];
  }
  if (caps.role === "Audio Amplifier") {
    return [
      { name: "LIN", type: "analog" },
      { name: "RIN", type: "analog" },
      { name: "L+", type: "analog" },
      { name: "R+", type: "analog" },
      { name: "VCC", type: "power" },
      { name: "GND", type: "power" }
    ];
  }
  if (caps.role === "Audio Sink") {
    return [
      { name: "L", type: "analog" },
      { name: "R", type: "analog" },
      { name: "GND", type: "power" }
    ];
  }
  if (caps.role === "Motor Driver") {
    return [
      { name: "IN1", type: "digital" },
      { name: "IN2", type: "digital" },
      { name: "OUT1", type: "power" },
      { name: "OUT2", type: "power" },
      { name: "VCC", type: "power" },
      { name: "GND", type: "power" }
    ];
  }
  if (caps.role === "Motor") {
    return [
      { name: "A+", type: "power" },
      { name: "A-", type: "power" },
      { name: "B+", type: "power" },
      { name: "B-", type: "power" }
    ];
  }
  return [];
}

interface IClassifiedRole {
  role: string;
  confidence: number;
}

// ??$$$ newer code - Classify component role using deterministic detectCapabilities registry service
function classifyComponentRole(item: IPartInfo, partDoc: any, regEntry: any, nodePins: any[]): IClassifiedRole {
  // Construct a unified part object to match detectCapabilities expected shape
  const part = {
    name: partDoc?.name || regEntry?.name || item.name || "",
    mpn: partDoc?.mpn || regEntry?.mpn || item.partId || "",
    description: partDoc?.description || regEntry?.description || "",
    category: partDoc?.category || regEntry?.category || "",
    wokwiPartType: partDoc?.wokwiPartType || regEntry?.wokwiType || "",
    pins: nodePins || []
  };

  const caps = detectCapabilities(part);

  // Map cap strings to router expected role classes
  let mappedRole = "Generic";
  if (caps.includes("mcu")) mappedRole = "MCU";
  else if (caps.includes("i2s_dac")) mappedRole = "I2S DAC";
  else if (caps.includes("audio_amp")) mappedRole = "Audio Amplifier";
  else if (caps.includes("audio_sink")) mappedRole = "Audio Sink";
  else if (caps.includes("motor_driver")) mappedRole = "Motor Driver";
  else if (caps.includes("motor")) mappedRole = "Motor";
  else if (caps.includes("spi_peripheral")) mappedRole = "SPI Peripheral";
  else if (caps.includes("i2c_peripheral")) mappedRole = "I2C Peripheral";
  else if (caps.includes("uart_peripheral")) mappedRole = "UART Peripheral";

  return {
    role: mappedRole,
    confidence: mappedRole === "Generic" ? 0.2 : 1.0
  };
}

interface IGraphNode {
  item: IPartInfo;
  partDoc: any;
  regEntry: any;
  role: string;
  confidence: number;
  pins: any[];
}

// ??$$$ newer code - Graph-First Routing Engine
export async function routeGraphWiring(parts: IPartInfo[], mcuName: string): Promise<IWiringConnection[]> {
  const connections: IWiringConnection[] = [];
  let connCounter = 1;

  const assignPin = (fromComp: string, fromPin: string, toComp: string, toPin: string, net: string, color: string, desc: string, routeReason: string) => {
    connections.push({
      id: `conn_${connCounter++}`,
      from: `${fromComp}.${fromPin}`,
      to: `${toComp}.${toPin}`,
      net,
      color,
      description: desc,
      routeReason
    } as any);
  };

  const registry = getRegistry();
  const normMcu = String(mcuName || "esp32-devkit-v1").toUpperCase();
  let mcuDef = registry[normMcu] || Object.entries(registry).find(([k]) => k.includes(normMcu) || normMcu.includes(k))?.[1];
  if (!mcuDef) {
    mcuDef = registry["ESP32-DEVKIT-V1"] || registry["ARDUINO_UNO"];
  }

  const isEsp32 = mcuName.toLowerCase().includes("esp32");
  const isPico = mcuName.toLowerCase().includes("pico");
  const mcuVcc = isEsp32 || isPico ? "3V3" : "5V";

  const nodes: IGraphNode[] = [];

  // ========================================================
  // PHASE 0: Build Graph & Registry Integrity Audits
  // ========================================================
  for (const item of parts) {
    if (!item) continue;
    let partDoc: any = null;
    if (item.partId) {
      if (mongoose.Types.ObjectId.isValid(item.partId)) {
        partDoc = await Part.findById(item.partId).lean();
      }
      if (!partDoc) {
        partDoc = await Part.findOne({ mpn: item.partId }).lean();
      }
      if (!partDoc) {
        // Try substring/case-insensitive regex match on mpn
        partDoc = await Part.findOne({
          $or: [
            { mpn: new RegExp(item.partId, "i") },
            { name: new RegExp(item.partId, "i") }
          ]
        }).lean();
      }
    }

    const mpnKey = String(item.partId || item.key || "").toUpperCase();
    const regEntry = registry[mpnKey] || Object.entries(registry).find(([k]) => k.includes(mpnKey) || mpnKey.includes(k))?.[1];

    const pName = String(partDoc?.name || partDoc?.mpn || item.name || item.partId || item.key || "").toLowerCase();
    
    let pins = partDoc?.pins || [];
    if (pins.length === 0 && regEntry?.pins) {
      pins = regEntry.pins;
    }

    // Role confidence classification
    const classResult = classifyComponentRole(item, partDoc, regEntry, pins);

    // If pins are empty, get fallback pins based on the classified role!
    if (pins.length === 0) {
      pins = getFallbackComponentPins(pName, classResult);
    }

    // If it is MCU and pins are empty, fall back to mcuDef.pins!
    if (classResult.role === "MCU" && pins.length === 0 && mcuDef && Array.isArray(mcuDef.pins)) {
      pins = mcuDef.pins;
    }

    nodes.push({
      item,
      partDoc,
      regEntry,
      role: classResult.role,
      confidence: classResult.confidence,
      pins
    });
  }

  // Warning logs for low confidence
  for (const node of nodes) {
    if (node.confidence < 0.70 && node.role !== "Generic" && node.role !== "MCU") {
      console.warn(`warning: Unable to confidently classify component '${node.item.key}' (role: ${node.role}, confidence: ${node.confidence.toFixed(2)})`);
    }
  }

  // Multiple MCUs validation
  const mcus = nodes.filter(n => n.role === "MCU");
  if (mcus.length > 1) {
    throw new Error(`Registry integrity validation failed: Multiple MCUs detected: [${mcus.map(m => m.item.key).join(", ")}]. Only one microcontroller is supported.`);
  }

  const mcuNode = nodes.find(n => n.role === "MCU");
  const mcuKey = mcuNode?.item.key || "mcu";

  // Registry integrity validation checks using signal metadata
  for (const node of nodes) {
    if (node.role === "I2S DAC") {
      const bclk = findPinBySignalMetadata(node.pins, "i2s_clock");
      const lrc = findPinBySignalMetadata(node.pins, "i2s_word_select");
      const din = findPinBySignalMetadata(node.pins, "i2s_data_in");
      if (!bclk || !lrc || !din) {
        throw new Error(`Registry integrity validation failed: Component '${node.item.key}' classified as I2S DAC but is missing required I2S signal pins (i2s_clock, i2s_word_select, i2s_data_in) in registry metadata.`);
      }
    }

    if (node.role === "Audio Amplifier") {
      const audioIn = findPinBySignalMetadata(node.pins, "audio_in");
      const audioOut = findPinBySignalMetadata(node.pins, "audio_out");
      if (!audioIn || !audioOut) {
        throw new Error(`Registry integrity validation failed: Component '${node.item.key}' classified as Audio Amplifier but is missing required audio input or output pins in registry metadata.`);
      }
    }

    if (node.role === "SPI Peripheral") {
      const mosi = findPinBySignalMetadata(node.pins, "spi_mosi");
      const miso = findPinBySignalMetadata(node.pins, "spi_miso");
      const sck = findPinBySignalMetadata(node.pins, "spi_sck");
      const cs = findPinBySignalMetadata(node.pins, "spi_cs");
      if (!mosi || !miso || !sck || !cs) {
        throw new Error(`Registry integrity validation failed: Component '${node.item.key}' classified as SPI Peripheral but is missing required SPI signal pins (spi_mosi, spi_miso, spi_sck, spi_cs) in registry metadata.`);
      }
    }
  }

  // Wires trace set
  const connectedPins = new Set<string>();
  const markWired = (compKey: string, pinName: string) => {
    connectedPins.add(`${compKey}.${pinName}`);
  };
  const isWired = (compKey: string, pinName: string): boolean => {
    return connectedPins.has(`${compKey}.${pinName}`);
  };

  // ========================================================
  // PHASE 1: Build Logical Signal Graph (Inter-Component)
  // ========================================================

  const dacNode = nodes.find(n => n.role === "I2S DAC");
  const ampNode = nodes.find(n => n.role === "Audio Amplifier");
  const sinkNode = nodes.find(n => n.role === "Audio Sink");

  if (dacNode && ampNode && sinkNode) {
    const dacL = findPinByName(dacNode.pins, ["LOUT", "LO", "L_OUT", "OUT_L", "OUT"], "LOUT");
    const dacR = findPinByName(dacNode.pins, ["ROUT", "RO", "R_OUT", "OUT_R", "OUT"], "ROUT");
    const ampL = findPinByName(ampNode.pins, ["LIN", "IN_L", "L_IN", "IN+", "IN1"], "LIN");
    const ampR = findPinByName(ampNode.pins, ["RIN", "IN_R", "R_IN", "IN-", "IN2"], "RIN");

    assignPin(dacNode.item.key, dacL, ampNode.item.key, ampL, "AUDIO_SIG_L", "#ff66aa", "Left channel audio signal",
      `Connected DAC output to Amplifier input because: DAC exposes audio_out (${dacL}) and Amplifier exposes audio_in (${ampL})`
    );
    assignPin(dacNode.item.key, dacR, ampNode.item.key, ampR, "AUDIO_SIG_R", "#ff66cc", "Right channel audio signal",
      `Connected DAC output to Amplifier input because: DAC exposes audio_out (${dacR}) and Amplifier exposes audio_in (${ampR})`
    );

    markWired(dacNode.item.key, dacL);
    markWired(dacNode.item.key, dacR);
    markWired(ampNode.item.key, ampL);
    markWired(ampNode.item.key, ampR);

    const ampOutL = findPinByName(ampNode.pins, ["L+", "L_OUT+", "LOUT", "OUT_L", "SPK_L", "L"], "L+");
    const ampOutR = findPinByName(ampNode.pins, ["R+", "R_OUT+", "ROUT", "OUT_R", "SPK_R", "R"], "R+");
    const sinkL = findPinByName(sinkNode.pins, ["L", "TIP", "IN_L", "SIG", "A"], "L");
    const sinkR = findPinByName(sinkNode.pins, ["R", "RING", "IN_R", "C"], "R");

    assignPin(ampNode.item.key, ampOutL, sinkNode.item.key, sinkL, "AUDIO_OUT_L", "#33ccff", "Left channel output to audio sink",
      `Connected Amplifier output to Audio Sink input because: Amplifier exposes audio_out (${ampOutL}) and Audio Sink exposes audio_in (${sinkL})`
    );
    assignPin(ampNode.item.key, ampOutR, sinkNode.item.key, sinkR, "AUDIO_OUT_R", "#33cccc", "Right channel output to audio sink",
      `Connected Amplifier output to Audio Sink input because: Amplifier exposes audio_out (${ampOutR}) and Audio Sink exposes audio_in (${sinkR})`
    );

    markWired(ampNode.item.key, ampOutL);
    markWired(ampNode.item.key, ampOutR);
    markWired(sinkNode.item.key, sinkL);
    markWired(sinkNode.item.key, sinkR);

  } else if (dacNode && sinkNode) {
    const dacOutL = findPinByName(dacNode.pins, ["OUT", "LOUT", "L+", "L_OUT", "L"], "OUT");
    const dacOutR = findPinByName(dacNode.pins, ["OUT", "ROUT", "R+", "R_OUT", "R"], "OUT");
    const sinkL = findPinByName(sinkNode.pins, ["L", "TIP", "IN_L", "SIG", "A"], "L");
    const sinkR = findPinByName(sinkNode.pins, ["R", "RING", "IN_R", "C"], "R");

    assignPin(dacNode.item.key, dacOutL, sinkNode.item.key, sinkL, "AUDIO_OUT_L", "#33ccff", "Left channel output to audio sink",
      `Connected DAC output to Audio Sink input because: DAC exposes audio_out (${dacOutL}) and Audio Sink exposes audio_in (${sinkL})`
    );
    if (dacOutL !== dacOutR && sinkL !== sinkR) {
      assignPin(dacNode.item.key, dacOutR, sinkNode.item.key, sinkR, "AUDIO_OUT_R", "#33cccc", "Right channel output to audio sink",
        `Connected DAC output to Audio Sink input because: DAC exposes audio_out (${dacOutR}) and Audio Sink exposes audio_in (${sinkR})`
      );
      markWired(dacNode.item.key, dacOutR);
      markWired(sinkNode.item.key, sinkR);
    }

    markWired(dacNode.item.key, dacOutL);
    markWired(sinkNode.item.key, sinkL);

  } else if (ampNode && sinkNode) {
    const ampOutL = findPinByName(ampNode.pins, ["L+", "L_OUT+", "LOUT", "OUT_L", "SPK_L", "L"], "L+");
    const ampOutR = findPinByName(ampNode.pins, ["R+", "R_OUT+", "ROUT", "OUT_R", "SPK_R", "R"], "R+");
    const sinkL = findPinByName(sinkNode.pins, ["L", "TIP", "IN_L", "SIG", "A"], "L");
    const sinkR = findPinByName(sinkNode.pins, ["R", "RING", "IN_R", "C"], "R");

    assignPin(ampNode.item.key, ampOutL, sinkNode.item.key, sinkL, "AUDIO_OUT_L", "#33ccff", "Left channel output to audio sink",
      `Connected Amplifier output to Audio Sink input because: Amplifier exposes audio_out (${ampOutL}) and Audio Sink exposes audio_in (${sinkL})`
    );
    assignPin(ampNode.item.key, ampOutR, sinkNode.item.key, sinkR, "AUDIO_OUT_R", "#33cccc", "Right channel output to audio sink",
      `Connected Amplifier output to Audio Sink input because: Amplifier exposes audio_out (${ampOutR}) and Audio Sink exposes audio_in (${sinkR})`
    );

    markWired(ampNode.item.key, ampOutL);
    markWired(ampNode.item.key, ampOutR);
    markWired(sinkNode.item.key, sinkL);
    markWired(sinkNode.item.key, sinkR);
  }

  // Motor Driver to Motor
  const driverNode = nodes.find(n => n.role === "Motor Driver");
  const motorNode = nodes.find(n => n.role === "Motor");

  if (driverNode && motorNode) {
    const drv1 = findPinByName(driverNode.pins, ["OUT1", "OUTA", "A", "U", "OUT"], "OUT1");
    const drv2 = findPinByName(driverNode.pins, ["OUT2", "OUTB", "B", "V", "OUT"], "OUT2");
    const mot1 = findPinByName(motorNode.pins, ["A+", "1", "A", "U", "PWM", "SIG", "IN"], "A+");
    const mot2 = findPinByName(motorNode.pins, ["B-", "2", "B", "V", "GND"], "B-");

    assignPin(driverNode.item.key, drv1, motorNode.item.key, mot1, "MOTOR_COIL_A", "#ff6600", "Motor driver coil output A",
      `Connected Motor Driver output to Motor input because: Motor Driver exposes motor_driver_out (${drv1}) and Motor exposes motor_in (${mot1})`
    );
    assignPin(driverNode.item.key, drv2, motorNode.item.key, mot2, "MOTOR_COIL_B", "#ffaa00", "Motor driver coil output B",
      `Connected Motor Driver output to Motor input because: Motor Driver exposes motor_driver_out (${drv2}) and Motor exposes motor_in (${mot2})`
    );

    markWired(driverNode.item.key, drv1);
    markWired(driverNode.item.key, drv2);
    markWired(motorNode.item.key, mot1);
    markWired(motorNode.item.key, mot2);
  }

  // Power and Ground connections
  for (const node of nodes) {
    if (node.role === "MCU") continue;

    const vccPin = findPinByName(node.pins, ["VCC", "VDD", "VIN", "5V", "3V3", "3.3V", "V+"], "");
    const gndPin = findPinByName(node.pins, ["GND", "VSS", "VEE"], "");

    if (vccPin && node.role !== "Audio Sink") {
      assignPin(mcuKey, mcuVcc, node.item.key, vccPin, "POWER_VCC", "#ff0000", `${node.item.key} VCC power connection`,
        `Connected Component Power because: component exposes VCC pin (${vccPin})`
      );
      markWired(node.item.key, vccPin);
    }
    if (gndPin) {
      assignPin(mcuKey, "GND", node.item.key, gndPin, "POWER_GND", "#000000", `${node.item.key} Ground connection`,
        `Connected Component Ground because: component exposes GND pin (${gndPin})`
      );
      markWired(node.item.key, gndPin);
    }
  }

  // ========================================================
  // PHASE 2: Dynamic Bus & Signal Assignment (to MCU)
  // ========================================================
  const allocatedDigital = new Set<string>();

  const getFreeMcuGpio = (type: "digital" | "analog" | "pwm" | "usart" | "spi" = "digital"): string => {
    if (!mcuDef) return isEsp32 ? "GPIO4" : "D4";

    const candidates = mcuDef.pins.filter((p: any) => {
      if (p.name.includes("GND") || p.name.includes("VCC") || p.name.includes("3V3") || p.name.includes("5V")) return false;
      if (type === "digital") return true;
      return p.signals?.some((s: any) => String(s.type).toLowerCase() === type.toLowerCase());
    });

    const freePin = candidates.find((p: any) => !allocatedDigital.has(p.name));
    if (freePin) {
      allocatedDigital.add(freePin.name);
      return freePin.name;
    }

    const fallbackPin = mcuDef.pins.find((p: any) =>
      !p.name.includes("GND") && !p.name.includes("VCC") && !p.name.includes("3V3") && !p.name.includes("5V") && !allocatedDigital.has(p.name)
    );
    if (fallbackPin) {
      allocatedDigital.add(fallbackPin.name);
      return fallbackPin.name;
    }

    return isEsp32 ? "GPIO4" : "D4";
  };

  // Route I2S
  if (dacNode) {
    const dacDin = findPinBySignalMetadata(dacNode.pins, "i2s_data_in") || "DIN";
    const dacLrc = findPinBySignalMetadata(dacNode.pins, "i2s_word_select") || "LRC";
    const dacBclk = findPinBySignalMetadata(dacNode.pins, "i2s_clock") || "BCLK";

    const mcuDin = getMcuInterfacePin(mcuDef, mcuName, "I2S", "DIN");
    const mcuLrc = getMcuInterfacePin(mcuDef, mcuName, "I2S", "LRC");
    const mcuBclk = getMcuInterfacePin(mcuDef, mcuName, "I2S", "BCLK");

    allocatedDigital.add(mcuDin);
    allocatedDigital.add(mcuLrc);
    allocatedDigital.add(mcuBclk);

    assignPin(mcuKey, mcuDin, dacNode.item.key, dacDin, "I2S_DIN", "#9333ea", "I2S Audio Data",
      `Connected MCU I2S to DAC because: MCU exposes I2S signals (${mcuDin}) and DAC exposes I2S data input (${dacDin})`
    );
    assignPin(mcuKey, mcuLrc, dacNode.item.key, dacLrc, "I2S_LRC", "#a855f7", "I2S Word Select / Left-Right Clock",
      `Connected MCU I2S to DAC because: MCU exposes I2S signals (${mcuLrc}) and DAC exposes LRC/WS input (${dacLrc})`
    );
    assignPin(mcuKey, mcuBclk, dacNode.item.key, dacBclk, "I2S_BCLK", "#c084fc", "I2S Bit Clock",
      `Connected MCU I2S to DAC because: MCU exposes I2S signals (${mcuBclk}) and DAC exposes BCLK input (${dacBclk})`
    );

    markWired(dacNode.item.key, dacDin);
    markWired(dacNode.item.key, dacLrc);
    markWired(dacNode.item.key, dacBclk);
  }

  // SPI, I2C, UART
  for (const node of nodes) {
    if (node.role === "MCU") continue;

    if (node.role === "SPI Peripheral") {
      const miso = findPinBySignalMetadata(node.pins, "spi_miso") || "MISO";
      const mosi = findPinBySignalMetadata(node.pins, "spi_mosi") || "MOSI";
      const sck = findPinBySignalMetadata(node.pins, "spi_sck") || "SCK";
      const cs = findPinBySignalMetadata(node.pins, "spi_cs") || "CS";

      const mcuMiso = getMcuInterfacePin(mcuDef, mcuName, "SPI", "MISO");
      const mcuMosi = getMcuInterfacePin(mcuDef, mcuName, "SPI", "MOSI");
      const mcuSck = getMcuInterfacePin(mcuDef, mcuName, "SPI", "SCK");
      const freeCs = getFreeMcuGpio("digital");

      allocatedDigital.add(mcuMiso);
      allocatedDigital.add(mcuMosi);
      allocatedDigital.add(mcuSck);

      assignPin(mcuKey, mcuMiso, node.item.key, miso, "SPI_MISO", "#a855f7", "SPI MISO",
        `Connected MCU SPI to SPI Device because: MCU MISO (${mcuMiso}) connects to Device MISO (${miso})`
      );
      assignPin(mcuKey, mcuMosi, node.item.key, mosi, "SPI_MOSI", "#d946ef", "SPI MOSI",
        `Connected MCU SPI to SPI Device because: MCU MOSI (${mcuMosi}) connects to Device MOSI (${mosi})`
      );
      assignPin(mcuKey, mcuSck, node.item.key, sck, "SPI_SCK", "#8b5cf6", "SPI SCK",
        `Connected MCU SPI to SPI Device because: MCU SCK (${mcuSck}) connects to Device SCK (${sck})`
      );
      assignPin(mcuKey, freeCs, node.item.key, cs, "SPI_CS", "#6366f1", "SPI Chip Select",
        `Connected MCU SPI to SPI Device because: MCU CS GPIO (${freeCs}) connects to Device Chip Select (${cs})`
      );

      markWired(node.item.key, miso);
      markWired(node.item.key, mosi);
      markWired(node.item.key, sck);
      markWired(node.item.key, cs);

    } else if (node.role === "I2C Peripheral") {
      const sda = findPinBySignalMetadata(node.pins, "i2c_sda") || "SDA";
      const scl = findPinBySignalMetadata(node.pins, "i2c_scl") || "SCL";

      const mcuSda = getMcuInterfacePin(mcuDef, mcuName, "I2C", "SDA");
      const mcuScl = getMcuInterfacePin(mcuDef, mcuName, "I2C", "SCL");

      allocatedDigital.add(mcuSda);
      allocatedDigital.add(mcuScl);

      assignPin(mcuKey, mcuSda, node.item.key, sda, "I2C_SDA", "#0066ff", "I2C data line",
        `Connected MCU I2C to I2C Device because: MCU SDA (${mcuSda}) connects to Device SDA (${sda})`
      );
      assignPin(mcuKey, mcuScl, node.item.key, scl, "I2C_SCL", "#ffcc00", "I2C clock line",
        `Connected MCU I2C to I2C Device because: MCU SCL (${mcuScl}) connects to Device SCL (${scl})`
      );

      markWired(node.item.key, sda);
      markWired(node.item.key, scl);

    } else if (node.role === "UART Peripheral") {
      const rx = findPinBySignalMetadata(node.pins, "uart_rx") || "RX";
      const tx = findPinBySignalMetadata(node.pins, "uart_tx") || "TX";

      const mcuTx = getMcuInterfacePin(mcuDef, mcuName, "UART", "TX");
      const mcuRx = getMcuInterfacePin(mcuDef, mcuName, "UART", "RX");

      allocatedDigital.add(mcuTx);
      allocatedDigital.add(mcuRx);

      assignPin(mcuKey, mcuTx, node.item.key, rx, "UART_TX", "#f43f5e", "UART Transmitter to Receiver",
        `Connected MCU UART to UART Device because: MCU TX (${mcuTx}) connects to Device RX (${rx})`
      );
      assignPin(mcuKey, mcuRx, node.item.key, tx, "UART_RX", "#ec4899", "UART Receiver to Transmitter",
        `Connected MCU UART to UART Device because: MCU RX (${mcuRx}) connects to Device TX (${tx})`
      );

      markWired(node.item.key, rx);
      markWired(node.item.key, tx);
    }
  }

  // ========================================================
  // PHASE 3: Route Remaining Independent Signals
  // ========================================================
  for (const node of nodes) {
    if (node.role === "MCU") continue;
    if (node.role === "Motor" || node.role === "Audio Sink") continue;

    for (const p of node.pins) {
      const pinName = p.name || p.id;
      if (isPowerOrGndPin(pinName) || isWired(node.item.key, pinName)) continue;

      const pType = String(p.type || "digital").toLowerCase();
      const pNameLower = pinName.toLowerCase();

      let freePin = "";
      if (pType === "analog" || pNameLower.includes("sig") || pNameLower.includes("adc")) {
        freePin = getFreeMcuGpio("analog");
      } else if (pType === "pwm" || pNameLower.includes("pwm") || pNameLower.includes("in1") || pNameLower.includes("in2") || pNameLower.includes("sig")) {
        freePin = getFreeMcuGpio("pwm");
      } else {
        freePin = getFreeMcuGpio("digital");
      }

      assignPin(mcuKey, freePin, node.item.key, pinName, `${node.item.key.toUpperCase()}_${pinName.toUpperCase()}`, "#00ccff", `${node.item.key} signal line`,
        `Connected free GPIO pin because: pin was unconnected on component (${pinName})`
      );
      markWired(node.item.key, pinName);
    }
  }

  // ========================================================
  // PHASE 4: Netlist Sanity Validation
  // ========================================================

  // 1. Self-Connections
  for (const conn of connections) {
    const fromComp = conn.from.split(".")[0];
    const toComp = conn.to.split(".")[0];
    if (fromComp === toComp) {
      throw new Error(`Netlist Sanity Validation failed: Self-connection detected for component '${fromComp}' (${conn.from} -> ${conn.to}).`);
    }
  }

  // 2. Incorrect Power
  for (const conn of connections) {
    const toComp = conn.to.split(".")[0];
    const toNode = nodes.find(n => n.item.key === toComp);
    if (toNode && toNode.role === "Audio Sink") {
      if (conn.net.toUpperCase().includes("VCC") || conn.from.includes("3V3") || conn.from.includes("5V")) {
        throw new Error(`Netlist Sanity Validation failed: Component '${toComp}' classified as Audio Sink cannot have VCC connected.`);
      }
    }
  }

  // 3. Incorrect Bridging
  const hasDac = nodes.some(n => n.role === "I2S DAC");
  const hasAmp = nodes.some(n => n.role === "Audio Amplifier");
  const hasDriver = nodes.some(n => n.role === "Motor Driver");

  for (const conn of connections) {
    const fromComp = conn.from.split(".")[0];
    const toComp = conn.to.split(".")[0];

    if (fromComp === mcuKey) {
      const toNode = nodes.find(n => n.item.key === toComp);
      if (toNode && toNode.role === "Audio Sink" && (hasDac || hasAmp)) {
        if (!conn.net.toUpperCase().includes("GND")) {
          throw new Error(`Netlist Sanity Validation failed: Audio Sink '${toComp}' cannot connect directly to MCU signal pin '${conn.from}' when a DAC or Amplifier exists.`);
        }
      }

      if (toNode && toNode.role === "Motor" && hasDriver) {
        if (!conn.net.toUpperCase().includes("GND") && !conn.net.toUpperCase().includes("POWER")) {
          throw new Error(`Netlist Sanity Validation failed: Motor '${toComp}' cannot connect directly to MCU signal pin '${conn.from}' when a Motor Driver exists.`);
        }
      }
    }
  }

  // 4. Nonexistent Pins
  for (const conn of connections) {
    const fromParts = conn.from.split(".");
    const toParts = conn.to.split(".");
    const fromKey = fromParts[0];
    const fromPin = fromParts.slice(1).join(".");
    const toKey = toParts[0];
    const toPin = toParts.slice(1).join(".");

    const fromNode = nodes.find(n => n.item.key === fromKey);
    const toNode = nodes.find(n => n.item.key === toKey);

    if (fromNode) {
      const exists = fromNode.pins.some(p => p.name?.toLowerCase() === fromPin.toLowerCase() || p.id?.toLowerCase() === fromPin.toLowerCase());
      if (!exists) {
        throw new Error(`Netlist Sanity Validation failed: Pin '${fromPin}' does not exist on component '${fromKey}' in its registry/database definition.`);
      }
    }

    if (toNode) {
      const exists = toNode.pins.some(p => p.name?.toLowerCase() === toPin.toLowerCase() || p.id?.toLowerCase() === toPin.toLowerCase());
      if (!exists) {
        throw new Error(`Netlist Sanity Validation failed: Pin '${toPin}' does not exist on component '${toKey}' in its registry/database definition.`);
      }
    }
  }

  // 5. Signal Cycles
  const adj: Record<string, string[]> = {};
  for (const conn of connections) {
    if (conn.net.toUpperCase().includes("POWER") || conn.net.toUpperCase().includes("GND")) continue;
    if (!adj[conn.from]) adj[conn.from] = [];
    adj[conn.from].push(conn.to);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adj[nodeId] || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const pin of Object.keys(adj)) {
    if (hasCycle(pin)) {
      throw new Error(`Netlist Sanity Validation failed: Directed signal path contains a cycle starting at pin '${pin}'.`);
    }
  }

  // 6. Orphans & Reachability
  const isIgnored = (node: any): boolean => {
    const n = String(node.item.name || node.item.partId || node.item.key || "").toLowerCase();
    const role = String(node.item.role || "").toLowerCase();
    const cat = String(node.partDoc?.category || node.regEntry?.category || "").toLowerCase();
    return (
      role.includes("button") || role.includes("switch") || role.includes("passive") ||
      cat.includes("button") || cat.includes("switch") || cat.includes("passive") ||
      n.includes("button") || n.includes("switch") || n.includes("resistor") || n.includes("capacitor") || n.includes("jumper") || n.includes("rail") || n.includes("battery") || n.includes("power") || n.includes("gnd") || n.includes("vcc")
    );
  };

  const compAdj: Record<string, Set<string>> = {};
  for (const node of nodes) {
    compAdj[node.item.key] = new Set<string>();
  }

  for (const conn of connections) {
    if (conn.net.toUpperCase().includes("POWER") || conn.net.toUpperCase().includes("GND")) continue;
    const c1 = conn.from.split(".")[0];
    const c2 = conn.to.split(".")[0];
    if (compAdj[c1]) compAdj[c1].add(c2);
    if (compAdj[c2]) compAdj[c2].add(c1);
  }

  const reachable = new Set<string>();
  const queue: string[] = [mcuKey];
  reachable.add(mcuKey);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = compAdj[curr] || new Set();
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  for (const node of nodes) {
    if (node.role === "MCU" || isIgnored(node)) continue;

    const nodeConns = connections.filter(c => c.from.startsWith(node.item.key + ".") || c.to.startsWith(node.item.key + "."));
    const hasPower = nodeConns.some(c => c.net.toUpperCase().includes("POWER") || c.net.toUpperCase().includes("GND"));
    const hasSignal = nodeConns.some(c => !c.net.toUpperCase().includes("POWER") && !c.net.toUpperCase().includes("GND"));

    if (hasPower && !hasSignal) {
      throw new Error(`Netlist Sanity Validation failed: Component '${node.item.key}' has power connections but no signal path.`);
    }

    if (!reachable.has(node.item.key)) {
      throw new Error(`Netlist Sanity Validation failed: Component '${node.item.key}' is not reachable from MCU through any valid graph route.`);
    }
  }

  return connections;
}
