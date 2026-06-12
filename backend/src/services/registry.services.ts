import { readFileSync } from "node:fs";
import path from "node:path";
import Part from "../models/part.model"; // ??$$$ newer code
// ... existing imports ...
type Registry = Record<string, any>;
type AIContextItem = {
  name: string;
  type: string;
  category: string;
  pins: string[];
  capabilities: Record<string, string[]>;
};

let REGISTRY_CACHE: Registry | null = null;
let AI_CONTEXT_CACHE: AIContextItem[] | null = null;

const getRegistryPath = (): string => {
  const here = __dirname;
  return path.resolve(here, "../../data/componentRegistry.json");
};

export function getRegistry(): Registry {
  if (REGISTRY_CACHE) return REGISTRY_CACHE;

  const raw = readFileSync(getRegistryPath(), "utf8");
  REGISTRY_CACHE = JSON.parse(raw) as Registry;

  return REGISTRY_CACHE;
}

// ??$$$ Optimized for token efficiency
export function buildAIContext(registry: Registry): AIContextItem[] {
  if (!registry || typeof registry !== "object") return [];

  return Object.entries(registry).map(([name, comp]: [string, any]) => {
    // Only include pins that have actual signals or are critical
    const filteredPins = (comp?.pins || [])
      .filter((p: any) => Array.isArray(p?.signals) && p.signals.length > 0)
      .map((p: any) => p.name);

    const capabilities = Object.fromEntries(
      (Array.isArray(comp?.pins) ? comp.pins : [])
        .filter((p: any) => Array.isArray(p?.signals) && p.signals.length > 0)
        .map((p: any) => [
          p.name,
          p.signals
            .map((s: any) => {
              const t = String(s?.type || "").trim();
              if (!t) return "";
              const role = s?.role ? `-${String(s.role).toLowerCase()}` : "";
              return `${t}${role}`;
            })
            .filter(Boolean)
        ])
    );

    return {
      name,
      type: comp?.wokwiType || "",
      category: comp?.category || "",
      pins: filteredPins,
      capabilities
    };
  });
}

export function getAIContext(): AIContextItem[] {
  if (AI_CONTEXT_CACHE) return AI_CONTEXT_CACHE;
  AI_CONTEXT_CACHE = buildAIContext(getRegistry());
  return AI_CONTEXT_CACHE;
}

export function validateComponentType(componentType: string): boolean {
  const registry = getRegistry();
  return Boolean(
    registry &&
    Object.prototype.hasOwnProperty.call(registry, componentType)
  );
}

export function assertValidComponentType(componentType: string): void {
  if (!validateComponentType(componentType)) {
    throw new Error(
      `Invalid component type: ${String(componentType || "").trim() || "(empty)"}`
    );
  }
}

// ??$$$ newer code - resolvePartByDesiredPart searches MongoDB Part and maps/fallbacks to componentRegistry
export async function resolvePartByDesiredPart(desiredPart: string): Promise<any> {
  const cleanTerm = String(desiredPart || "").trim();
  if (!cleanTerm) return null;

  // 1. Try exact MPN match
  let part = await Part.findOne({ mpn: cleanTerm }).lean();
  if (!part) {
    // 2. Try regex match on MPN or name
    part = await Part.findOne({
      $or: [
        { mpn: new RegExp(cleanTerm, "i") },
        { name: new RegExp(cleanTerm, "i") }
      ]
    }).lean();
  }

  // 3. Fallback to registry keys
  const registry = getRegistry();
  const matchedKey = Object.keys(registry).find(key => 
    key.toLowerCase() === cleanTerm.toLowerCase() ||
    (registry[key].wokwiType && registry[key].wokwiType.toLowerCase().includes(cleanTerm.toLowerCase()))
  );

  const regItem = matchedKey ? registry[matchedKey] : null;

  if (part) {
    // Merge registry pins & wokwiType if missing in MongoDB part doc
    return {
      _id: String(part._id),
      mpn: part.mpn,
      name: part.name,
      manufacturer: part.manufacturer || "Generic",
      description: part.description || "",
      wokwiPartType: part.wokwiPartType || regItem?.wokwiType || "",
      category: part.category || regItem?.category || "",
      pins: (part.pins && part.pins.length > 0) ? part.pins.map((p: any) => ({
        id: p.id || p.name,
        name: p.name || p.id,
        type: p.type || "digital",
        signals: p.signals || []
      })) : (regItem?.pins?.map((p: any) => ({
        id: p.name,
        name: p.name,
        type: p.signals?.[0]?.type || "digital",
        signals: p.signals || []
      })) || [])
    };
  }

  if (regItem) {
    return {
      _id: matchedKey,
      mpn: matchedKey,
      name: matchedKey,
      manufacturer: "Generic",
      description: regItem.description || "",
      wokwiPartType: regItem.wokwiType,
      category: regItem.category || "",
      pins: regItem.pins?.map((p: any) => ({
        id: p.name,
        name: p.name,
        type: p.signals?.[0]?.type || "digital",
        signals: p.signals || []
      })) || []
    };
  }

  // Fallback default mock part if none found
  return {
    _id: cleanTerm,
    mpn: cleanTerm,
    name: cleanTerm,
    manufacturer: "Generic",
    description: "",
    wokwiPartType: "",
    category: "",
    pins: []
  };
}

// ??$$$ newer code - detectCapabilities maps component properties to deterministic hardware capabilities
export function detectCapabilities(part: any): string[] {
  if (!part) return [];
  const caps: string[] = [];
  const name = String(part.name || part.mpn || "").toLowerCase();
  const desc = String(part.description || "").toLowerCase();
  const category = String(part.category || "").toLowerCase();
  const wokwiType = String(part.wokwiPartType || "").toLowerCase();

  // 1. MCU
  if (category === "controller" || name.includes("arduino") || name.includes("esp32") || name.includes("pico") || name.includes("rp2040") || name.includes("atmega") || wokwiType.includes("devkit") || wokwiType.includes("arduino") || wokwiType.includes("pico")) {
    caps.push("mcu");
    return caps; // MCU is just MCU
  }

  // 2. I2S DAC
  if (name.includes("max98357") || name.includes("pcm5102") || name.includes("dac") || category === "dac" || desc.includes("i2s dac") || desc.includes("digital-to-analog")) {
    caps.push("i2s_dac");
  }

  // 3. Audio Amplifier
  if (name.includes("pam8403") || name.includes("lm386") || name.includes("max98306") || name.includes("amplifier") || category.includes("amplifier") || category.includes("amp") || desc.includes("amplifier") || desc.includes("audio amp")) {
    if (!caps.includes("i2s_dac")) {
      caps.push("audio_amp");
    }
  }

  // 4. Audio Sink
  if (name.includes("speaker") || name.includes("headphone") || name.includes("jack") || name.includes("pj-320") || name.includes("pj320") || name.includes("buzzer") || category.includes("speaker") || category.includes("audio_sink") || desc.includes("speaker") || desc.includes("headphone") || desc.includes("audio sink")) {
    caps.push("audio_sink");
  }

  // 5. Motor Driver
  if (name.includes("driver") || name.includes("esc") || name.includes("h-bridge") || name.includes("l298") || name.includes("l9110") || name.includes("l293") || name.includes("a4988") || category.includes("driver") || desc.includes("motor driver") || desc.includes("speed controller")) {
    caps.push("motor_driver");
  }

  // 6. Motor
  if (name.includes("motor") || name.includes("servo") || name.includes("sg90") || name.includes("stepper") || category.includes("motor") || category.includes("actuator") || desc.includes("motor") || desc.includes("servo")) {
    if (!caps.includes("motor_driver")) {
      caps.push("motor");
    }
  }

  // 7. SPI Peripheral
  if (name.includes("spi") || name.includes("sdcard") || name.includes("sd card") || name.includes("microsd") || name.includes("nrf24") || category.includes("spi")) {
    caps.push("spi_peripheral");
  } else if (part.pins && Array.isArray(part.pins)) {
    const hasSPI = part.pins.some((p: any) => p.signals?.some((s: any) => String(s.type).toLowerCase() === "spi") || p.name?.toLowerCase().includes("mosi") || p.name?.toLowerCase().includes("miso"));
    if (hasSPI) caps.push("spi_peripheral");
  }

  // 8. I2C Peripheral
  if (name.includes("i2c") || name.includes("mpu6050") || name.includes("gyro") || name.includes("ssd1306") || name.includes("lcd1602") || category.includes("display") || category.includes("i2c")) {
    if (!caps.includes("spi_peripheral") && !caps.includes("mcu")) {
      caps.push("i2c_peripheral");
    }
  } else if (part.pins && Array.isArray(part.pins)) {
    const hasI2C = part.pins.some((p: any) => p.signals?.some((s: any) => String(s.type).toLowerCase() === "i2c") || p.name?.toLowerCase() === "sda" || p.name?.toLowerCase() === "scl");
    if (hasI2C && !caps.includes("mcu")) caps.push("i2c_peripheral");
  }

  // 9. UART Peripheral
  if (name.includes("uart") || name.includes("gps") || name.includes("gsm") || name.includes("bluetooth") || name.includes("hc05") || name.includes("hc-05")) {
    caps.push("uart_peripheral");
  }

  // 10. ADC Sensor
  if (name.includes("potentiometer") || name.includes("pot") || name.includes("ldr") || name.includes("photoresistor") || name.includes("sensor") || category.includes("sensor") || category.includes("input")) {
    if (!caps.includes("i2c_peripheral") && !caps.includes("spi_peripheral") && !caps.includes("audio_sink") && !caps.includes("motor")) {
      caps.push("adc_sensor");
    }
  }

  // 11. PWM Device
  if (name.includes("led") || name.includes("rgb") || name.includes("neopixel")) {
    if (!caps.includes("mcu")) {
      caps.push("pwm_device");
    }
  }

  return caps;
}