// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ NEW FLOW — Pin Resolver Service
// Resolves SnapEDA pin metadata for BOM items after Agent 2 completes
// Runs in background — never blocks BOM response to frontend
// ??$$$ newer code
import mongoose from "mongoose";
import Part from "../models/part.model";
import { searchSnapEDA, getPinMetadata, SnapEdaPin } from "./snapeda.service";
import { cacheModelLocally } from "./modelConversion.service";
// ??$$$ newer code
import { getRegistry } from "./registry.services";

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
  
  if (norm.includes("ESP32") || norm.includes("ESP-32") || norm.includes("WROOM")) {
    const pinNames = [
      "3V3", "EN", "GPIO36", "GPIO39", "GPIO34", "GPIO35", "GPIO32", "GPIO33", "GPIO25", "GPIO26", "GPIO27", "GPIO14", "GPIO12", "GPIO13", "GND",
      "VIN", "GPIO23", "GPIO22", "GPIO1", "GPIO3", "GPIO21", "GPIO19", "GPIO18", "GPIO5", "GPIO17", "GPIO16", "GPIO4", "GPIO2", "GPIO15", "GND"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name === "3V3" || name === "VIN" || name === "5V" ? "power" : (["GPIO34", "GPIO35", "GPIO36", "GPIO39"].includes(name) ? "analog" : "digital"))
    }));
  }

  if (norm.includes("ARDUINO") || norm.includes("UNO") || norm.includes("ATMEGA328")) {
    const pinNames = [
      "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13",
      "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3V3", "GND", "RESET", "AREF"
    ];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name.includes("GND") ? "gnd" : (name.includes("5V") || name.includes("3V3") ? "power" : (name.startsWith("A") ? "analog" : "digital"))
    }));
  }

  if (norm.includes("MAX98357") || norm.includes("PCM5102") || norm.includes("DAC") || norm.includes("I2S-DAC")) {
    return [
      { id: "LRC", name: "LRC", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "BCLK", name: "BCLK", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "DIN", name: "DIN", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "GAIN", name: "GAIN", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SD", name: "SD", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 15.24, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "OUT+", name: "OUT+", x_mm: 17.78, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "OUT-", name: "OUT-", x_mm: 20.32, y_mm: 0, z_mm: 0, type: "analog" }
    ];
  }

  if (norm.includes("PAM8403") || norm.includes("LM386") || norm.includes("AMPLIFIER") || norm.includes("AMP")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "LIN", name: "LIN", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "RIN", name: "RIN", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "GND_AUD", name: "GND_AUD", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "L+", name: "L+", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "L-", name: "L-", x_mm: 15.24, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R+", name: "R+", x_mm: 17.78, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R-", name: "R-", x_mm: 20.32, y_mm: 0, z_mm: 0, type: "analog" }
    ];
  }

  if (norm.includes("PJ-32") || norm.includes("JACK") || norm.includes("HEADPHONE") || norm.includes("SPEAKER") || norm.includes("AUDIO_JACK")) {
    return [
      { id: "L", name: "L", x_mm: 0, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "R", name: "R", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "analog" },
      { id: "GND", name: "GND", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("MICROSD") || norm.includes("SD-CARD") || norm.includes("SDCARD") || norm.includes("STORAGE")) {
    return [
      { id: "CS", name: "CS", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SCK", name: "SCK", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "MOSI", name: "MOSI", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "MISO", name: "MISO", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("SSD1306") || norm.includes("OLED") || norm.includes("DISPLAY") || norm.includes("LCD") || norm.includes("1602") || norm.includes("16X2")) {
    return [
      { id: "SCL", name: "SCL", x_mm: 0, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "SDA", name: "SDA", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "VCC", name: "VCC", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("TP4056") || norm.includes("CHARGER")) {
    return [
      { id: "IN+", name: "IN+", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "IN-", name: "IN-", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "BAT+", name: "BAT+", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "power" },
      { id: "BAT-", name: "BAT-", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "OUT+", name: "OUT+", x_mm: 10.16, y_mm: 0, z_mm: 0, type: "power" },
      { id: "OUT-", name: "OUT-", x_mm: 12.7, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("LIPO") || norm.includes("BATTERY")) {
    return [
      { id: "BAT+", name: "BAT+", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "BAT-", name: "BAT-", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("DHT") || norm.includes("AM2302")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "GND", name: "GND", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "gnd" },
      { id: "SIG", name: "SIG", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" }
    ];
  }

  if (norm.includes("HC-SR04") || norm.includes("SR04") || norm.includes("ULTRASONIC")) {
    return [
      { id: "VCC", name: "VCC", x_mm: 0, y_mm: 0, z_mm: 0, type: "power" },
      { id: "TRIG", name: "TRIG", x_mm: 2.54, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "ECHO", name: "ECHO", x_mm: 5.08, y_mm: 0, z_mm: 0, type: "digital" },
      { id: "GND", name: "GND", x_mm: 7.62, y_mm: 0, z_mm: 0, type: "gnd" }
    ];
  }

  if (norm.includes("SERVO") || norm.includes("SG90") || norm.includes("MOTOR")) {
    const pinNames = ["PWM", "VCC", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : (name === "VCC" ? "power" : "digital")
    }));
  }

  if (norm.includes("BUTTON") || norm.includes("SWITCH") || norm.includes("TACTILE")) {
    const pinNames = ["SIG", "GND"];
    return pinNames.map((name, idx) => ({
      id: name,
      name: name,
      x_mm: idx * 2.54,
      y_mm: 0,
      z_mm: 0,
      type: name === "GND" ? "gnd" : "digital"
    }));
  }

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

async function resolvePins(
  mpn: string,
  bomKey: string,
  projectId: string,
  io?: any
): Promise<SnapEdaPin[]> {
  try {
    // Step 1: Find Part in MongoDB
    let part = await Part.findOne({ mpn }).lean() as any;

    // ??$$$ newer code
    // Step 2: Return cached if fresh, and sync models. Bypass if cached pins are the generic fallback.
    const isGenericFallback = part && part.pins && part.pins.length === 4 &&
      part.pins.some((p: any) => p.id === "IO1") &&
      part.pins.some((p: any) => p.id === "IO2");

    // ??$$$ newer code - check for validity and bypass generic fallback cache entries
    if (part && part.pins && part.pins.length > 0 && isPinCacheValid(part.pinsCachedAt) && !isGenericFallback) {
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

// ??$$$ newer code
export interface IWiringConnection {
  id: string;
  from: string;
  to: string;
  net: string;
  color: string;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  conflicts: any[];
  invalidPins: string[];
  missingConnections: string[];
  warnings: string[];
  summary: string;
}

export function getComponentPins(wokwiPartType: string): Record<string, string> {
  const norm = (wokwiPartType || "").toLowerCase();
  if (norm.includes("ssd1306") || norm.includes("lcd1602") || norm.includes("mpu6050")) {
    return { SDA: "SDA", SCL: "SCL", VCC: "VCC", GND: "GND" };
  }
  if (norm.includes("dht22") || norm.includes("dht11")) {
    return { SDA: "SDA", VCC: "VCC", GND: "GND" };
  }
  if (norm.includes("servo")) {
    return { PWM: "PWM", VCC: "VCC", GND: "GND" };
  }
  if (norm.includes("button") || norm.includes("pushbutton")) {
    return { SIG: "SIG", GND: "GND" };
  }
  if (norm.includes("led")) {
    return { A: "A", C: "C" };
  }
  if (norm.includes("resistor")) {
    return { "1": "1", "2": "2" };
  }
  return { SIG: "SIG", VCC: "VCC", GND: "GND" };
}

// ??$$$ newer code
export function resolveWiring(bom: any[], mcu: string): IWiringConnection[] {
  const connections: IWiringConnection[] = [];
  let connCounter = 1;

  const assignPin = (fromPin: string, toPin: string, net: string, color: string, desc: string) => {
    connections.push({
      id: `conn_${connCounter++}`,
      from: fromPin,
      to: toPin,
      net,
      color,
      description: desc
    });
  };

  const registry = getRegistry();
  const normMcu = String(mcu || "esp32-devkit-v1").toUpperCase();
  let mcuDef = registry[normMcu] || Object.entries(registry).find(([k]) => k.includes(normMcu) || normMcu.includes(k))?.[1];
  if (!mcuDef) {
    mcuDef = registry["ESP32-DEVKIT-V1"] || registry["ARDUINO_UNO"];
  }

  const isEsp32 = (mcu || "").toLowerCase().includes("esp32");
  const allocatedDigital = new Set<string>();

  // Helper to find a free digital/analog GPIO on MCU
  const getFreeMcuGpio = (type: "digital" | "analog" | "pwm" | "usart" | "spi" = "digital"): string => {
    if (!mcuDef) return isEsp32 ? "GPIO4" : "D4";

    // Filter pins by signal type
    const candidates = mcuDef.pins.filter((p: any) => {
      if (p.name.includes("GND") || p.name.includes("VCC") || p.name.includes("3V3") || p.name.includes("5V")) return false;
      if (type === "digital") return true; // generic gpio
      return p.signals?.some((s: any) => String(s.type).toLowerCase() === type.toLowerCase());
    });

    const freePin = candidates.find((p: any) => !allocatedDigital.has(p.name));
    if (freePin) {
      allocatedDigital.add(freePin.name);
      return freePin.name;
    }

    // fallback: find any free pin
    const fallbackPin = mcuDef.pins.find((p: any) => 
      !p.name.includes("GND") && !p.name.includes("VCC") && !p.name.includes("3V3") && !p.name.includes("5V") && !allocatedDigital.has(p.name)
    );
    if (fallbackPin) {
      allocatedDigital.add(fallbackPin.name);
      return fallbackPin.name;
    }

    return isEsp32 ? "GPIO4" : "D4";
  };

  // Pre-allocate SCL/SDA for I2C buses (to share them)
  const mcuSDA = isEsp32 ? "GPIO21" : "A4";
  const mcuSCL = isEsp32 ? "GPIO22" : "A5";

  bom.forEach((p: any) => {
    if (p.role === "controller") return;

    const pKey = p.key;
    const pName = (p.name || p.mpn || "").toLowerCase();
    const mpnKey = String(p.mpn || p.partId || "").toUpperCase();
    const regItem = registry[mpnKey];

    // Check if we can route using registry interface metadata
    if (regItem && Array.isArray(regItem.pins)) {
      let hasMappedInterfaces = false;

      // 1. Identify I2C pins
      const sdaPin = regItem.pins.find((pin: any) => pin.signals?.some((s: any) => s.type === "i2c" && s.role === "SDA"));
      const sclPin = regItem.pins.find((pin: any) => pin.signals?.some((s: any) => s.type === "i2c" && s.role === "SCL"));

      if (sdaPin && sclPin) {
        assignPin(`mcu.${mcuSDA}`, `${pKey}.${sdaPin.name}`, "I2C_SDA", "#0066ff", "I2C data line");
        assignPin(`mcu.${mcuSCL}`, `${pKey}.${sclPin.name}`, "I2C_SCL", "#ffcc00", "I2C clock line");
        hasMappedInterfaces = true;
      }

      // 2. Identify Power and Ground pins
      regItem.pins.forEach((pin: any) => {
        const isGnd = pin.name.toUpperCase().includes("GND") || pin.signals?.some((s: any) => s.type === "power" && s.role === "GND");
        const isVcc = pin.name.toUpperCase().includes("VCC") || pin.name.toUpperCase().includes("VDD") || pin.name.toUpperCase().includes("V+") || pin.signals?.some((s: any) => s.type === "power" && s.role === "VCC");

        if (isGnd) {
          assignPin("mcu.GND", `${pKey}.${pin.name}`, "POWER_GND", "#000000", "Ground");
        } else if (isVcc) {
          assignPin(`mcu.${isEsp32 ? "3V3" : "5V"}`, `${pKey}.${pin.name}`, "POWER_VCC", "#ff0000", "VCC power supply");
        }
      });

      // 3. Identify special/other signal pins (PWM, Analog, USART, SPI)
      regItem.pins.forEach((pin: any) => {
        // Skip I2C and Power pins we mapped
        if (pin === sdaPin || pin === sclPin) return;
        const isGnd = pin.name.toUpperCase().includes("GND") || pin.signals?.some((s: any) => s.type === "power" && s.role === "GND");
        const isVcc = pin.name.toUpperCase().includes("VCC") || pin.name.toUpperCase().includes("VDD") || pin.name.toUpperCase().includes("V+") || pin.signals?.some((s: any) => s.type === "power" && s.role === "VCC");
        if (isGnd || isVcc) return;

        const sig = pin.signals?.[0];
        if (sig) {
          const type = String(sig.type).toLowerCase();
          if (type === "pwm") {
            const mcuPin = getFreeMcuGpio("pwm");
            assignPin(`mcu.${mcuPin}`, `${pKey}.${pin.name}`, `${pKey.toUpperCase()}_PWM`, "#ff6600", "PWM control line");
            hasMappedInterfaces = true;
          } else if (type === "analog") {
            const mcuPin = getFreeMcuGpio("analog");
            assignPin(`mcu.${mcuPin}`, `${pKey}.${pin.name}`, `${pKey.toUpperCase()}_ANALOG`, "#00ccaa", "Analog signal");
            hasMappedInterfaces = true;
          } else if (type === "spi") {
            // SPI mapping
            const role = String(sig.role).toUpperCase();
            let mcuPin = "D13";
            if (role === "MISO") mcuPin = isEsp32 ? "GPIO19" : "D12";
            else if (role === "MOSI") mcuPin = isEsp32 ? "GPIO23" : "D11";
            else if (role === "SCK") mcuPin = isEsp32 ? "GPIO18" : "D13";
            else if (role === "CS" || role === "SS") mcuPin = getFreeMcuGpio("digital");
            assignPin(`mcu.${mcuPin}`, `${pKey}.${pin.name}`, `SPI_${role}`, "#a855f7", `SPI ${role}`);
            hasMappedInterfaces = true;
          } else if (type === "usart" || type === "uart") {
            // Serial cross connection (TX to RX, RX to TX)
            const role = String(sig.role).toUpperCase();
            let mcuPin = "D0";
            if (role === "TX") mcuPin = isEsp32 ? "GPIO16" : "D0"; // MCU RX
            else if (role === "RX") mcuPin = isEsp32 ? "GPIO17" : "D1"; // MCU TX
            assignPin(`mcu.${mcuPin}`, `${pKey}.${pin.name}`, `UART_${role}`, "#f43f5e", `UART ${role}`);
            hasMappedInterfaces = true;
          } else if (type === "digital") {
            const mcuPin = getFreeMcuGpio("digital");
            assignPin(`mcu.${mcuPin}`, `${pKey}.${pin.name}`, `${pKey.toUpperCase()}_SIG`, "#00cc66", "Digital signal line");
            hasMappedInterfaces = true;
          }
        }
      });

      if (hasMappedInterfaces) return;
    }

    // Fallback path: Legacy name-based regex wiring configuration
    if (pName.includes("mpu6050") || pName.includes("gyro") || pName.includes("i2c") || pName.includes("sensor")) {
      assignPin(`mcu.${mcuSDA}`, `${pKey}.SDA`, "I2C_SDA", "#0066ff", "I2C data line");
      assignPin(`mcu.${mcuSCL}`, `${pKey}.SCL`, "I2C_SCL", "#ffcc00", "I2C clock line");
      assignPin(`mcu.${isEsp32 ? "3V3" : "5V"}`, `${pKey}.VCC`, "POWER_VCC", "#ff0000", "VCC power supply");
      assignPin("mcu.GND", `${pKey}.GND`, "POWER_GND", "#000000", "Ground");
    } else if (pName.includes("led")) {
      const pin = getFreeMcuGpio("digital");
      assignPin(`mcu.${pin}`, `${pKey}.A`, "LED_ANODE", "#00ccff", "LED Anode Control");
      assignPin("mcu.GND", `${pKey}.C`, "POWER_GND", "#000000", "LED Cathode Ground");
    } else if (pName.includes("dht")) {
      const pin = getFreeMcuGpio("digital");
      assignPin(`mcu.${pin}`, `${pKey}.SDA`, "DHT_DATA", "#00ccff", "DHT data signal");
      assignPin(`mcu.${isEsp32 ? "3V3" : "5V"}`, `${pKey}.VCC`, "POWER_VCC", "#ff0000", "DHT VCC");
      assignPin("mcu.GND", `${pKey}.GND`, "POWER_GND", "#000000", "DHT Ground");
    } else if (pName.includes("button") || pName.includes("switch") || pName.includes("tact")) {
      const pin = getFreeMcuGpio("digital");
      assignPin(`mcu.${pin}`, `${pKey}.SIG`, "BUTTON_SIG", "#00cc66", "Button signal input");
      assignPin("mcu.GND", `${pKey}.GND`, "POWER_GND", "#000000", "Button Ground");
    } else if (pName.includes("servo") || pName.includes("motor")) {
      const pin = getFreeMcuGpio("pwm");
      assignPin(`mcu.${pin}`, `${pKey}.PWM`, "SERVO_PWM", "#ff6600", "Servo control line");
      assignPin(`mcu.${isEsp32 ? "3V3" : "5V"}`, `${pKey}.VCC`, "POWER_VCC", "#ff0000", "Servo VCC");
      assignPin("mcu.GND", `${pKey}.GND`, "POWER_GND", "#000000", "Servo Ground");
    } else {
      // Generic defaults
      const pin = getFreeMcuGpio("digital");
      assignPin(`mcu.${pin}`, `${pKey}.SIG`, "SIGNAL", "#00ccff", "Signal line");
      assignPin(`mcu.${isEsp32 ? "3V3" : "5V"}`, `${pKey}.VCC`, "POWER_VCC", "#ff0000", "Power VCC");
      assignPin("mcu.GND", `${pKey}.GND`, "POWER_GND", "#000000", "Ground");
    }
  });

  return connections;
}

export function validateWiring(connections: IWiringConnection[], mcu: string = "esp32"): ValidationResult {
  const conflicts: any[] = [];
  const invalidPins: string[] = [];
  const missingConnections: string[] = [];
  const warnings: string[] = [];

  const availablePins: string[] = mcu.toLowerCase().includes("esp32")
    ? ["GPIO21", "GPIO22", "GPIO23", "GPIO19", "GPIO18", "GPIO1", "GPIO3", "GPIO13", "GPIO15", "GPIO2", "GPIO4", "3V3", "5V", "GND"]
    : ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3V3", "GND"];

  // Duplicate usage check
  const pinMap: Record<string, string[]> = {};
  connections.forEach((as: any) => {
    const fromMatch = as.from.match(/mcu\.(.+)/);
    if (fromMatch) {
      const pin = fromMatch[1];
      if (!pinMap[pin]) pinMap[pin] = [];
      pinMap[pin].push(as.to);
    }
  });

  for (const [pin, users] of Object.entries(pinMap)) {
    if (users.length > 1) {
      const isI2C = users.every(u => u.toLowerCase().includes("sda") || u.toLowerCase().includes("scl") || u.toLowerCase().includes("i2c"));
      const isPower = pin.toLowerCase().includes("vcc") || pin.toLowerCase().includes("gnd") || pin.toLowerCase().includes("3v3") || pin.toLowerCase().includes("5v");
      
      if (isI2C) {
        warnings.push(`Pin ${pin} is shared by multiple I2C lines: ${users.join(", ")}. This is standard I2C bus sharing.`);
      } else if (isPower) {
        // Power lines can be shared infinitely
      } else {
        conflicts.push({
          pin,
          usedBy: users,
          fix: "Reassign one of the peripherals to another GPIO pin."
        });
      }
    }
  }

  // Invalid pins check
  connections.forEach((as: any) => {
    const fromMatch = as.from.match(/mcu\.(.+)/);
    if (fromMatch) {
      const pin = fromMatch[1];
      const found = availablePins.some(p => p.toLowerCase() === pin.toLowerCase());
      if (!found) {
        invalidPins.push(`${pin} does not exist on ${mcu}`);
      }
    }
  });

  // Check input only pins (e.g. GPIO34-39 on ESP32)
  connections.forEach((as: any) => {
    const fromMatch = as.from.match(/mcu\.(.+)/);
    if (fromMatch) {
      const pin = fromMatch[1];
      if (mcu.toLowerCase().includes("esp32") && ["gpio34", "gpio35", "gpio36", "gpio37", "gpio38", "gpio39"].includes(pin.toLowerCase())) {
        if (!as.to.toLowerCase().includes("input") && !as.to.toLowerCase().includes("sda") && !as.to.toLowerCase().includes("scl") && !as.to.toLowerCase().includes("rx")) {
          warnings.push(`${pin} is input-only on ESP32, cannot use for output signal: ${as.to}`);
        }
      }
    }
  });

  const valid = conflicts.length === 0 && invalidPins.length === 0;

  return {
    valid,
    conflicts,
    invalidPins,
    missingConnections,
    warnings,
    summary: valid 
      ? `All pin assignments valid for ${mcu}. No conflicts detected.` 
      : `${conflicts.length + invalidPins.length} issues found. See conflicts and invalidPins.`
  };
}

