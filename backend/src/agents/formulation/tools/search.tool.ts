// ??$$$
import mongoose from "mongoose";
import Part from "../../../models/part.model";
import { searchLibrary, octopartSearch } from "../../../services/library.service";

export async function executeSearchLibrary(args: any) {
  const query = args.query;
  const limit = args.limit || 5;
  const strategy = args.strategy || "auto";

  try {
    const results = await searchLibrary({ query, limit, strategy });
    const formatted = results.map((p: any) => ({
      partId: p.id || p.mpn || "",
      mpn: p.mpn || "",
      name: p.name || "",
      manufacturer: p.manufacturer || "Unknown",
      description: p.description || "",
      interfaces: p.interfaces || (p.specs?.Interface ? [p.specs.Interface] : []),
      specs: p.specs || {},
      price: p.price || 0,
      datasheetUrl: p.datasheetUrl || "",
      wokwiPartType: p.wokwiPartType || "",
      inLocalLibrary: !!p.isCurated
    }));

    return {
      results: formatted,
      total: formatted.length,
      source: strategy === "local_only" ? "local" : (strategy === "remote_only" ? "nexar" : "mixed")
    };
  } catch (err: any) {
    console.error("executeSearchLibrary failed:", err);
    return { results: [], total: 0, source: "error", error: err.message };
  }
}

export async function executeGetPartDetails(args: any) {
  const { partId } = args;
  if (!partId) {
    return { found: false, partId: "", suggestion: "partId is required" };
  }

  try {
    let partDoc: any = null;

    // 1. Try ObjectId first
    if (mongoose.Types.ObjectId.isValid(partId)) {
      partDoc = await Part.findById(partId).lean();
    }

    // 2. Fallback to MPN search in DB
    if (!partDoc) {
      partDoc = await Part.findOne({ mpn: partId }).lean();
    }

    // 3. Fallback to Nexar search if token exists
    if (!partDoc && process.env.access_token) {
      const remoteResults = await octopartSearch(partId, 1);
      if (remoteResults && remoteResults.length > 0) {
        partDoc = remoteResults[0];
      }
    }

    if (partDoc) {
      const specsObj = partDoc.specs || {};
      const interfaces = partDoc.interfaces || (specsObj.Interface ? [specsObj.Interface] : []);
      
      return {
        found: true,
        part: {
          partId: partDoc._id ? partDoc._id.toString() : (partDoc.mpn || partId),
          mpn: partDoc.mpn || "",
          name: partDoc.name || partDoc.mpn || "",
          manufacturer: partDoc.manufacturer || "Unknown",
          description: partDoc.description || "",
          specs: {
            voltage: specsObj.Voltage || specsObj["Supply Voltage"] || specsObj["Operating Voltage"] || "3.3V",
            current: specsObj.Current || specsObj["Supply Current"] || "80mA typical",
            dimensions: specsObj.Dimensions || specsObj.Size || "N/A",
            interfaces: interfaces,
            gpioCount: specsObj.GPIOs || specsObj["Number of I/Os"] || 0,
            flashSize: specsObj.Flash || specsObj["Program Memory Size"] || "N/A",
            ...specsObj
          },
          interfaces: interfaces,
          pinMap: partDoc.pinMap || specsObj.PinMap || {
            SDA: "GPIO21",
            SCL: "GPIO22",
            TX: "GPIO1",
            RX: "GPIO3",
            VCC: "3V3",
            GND: "GND"
          },
          datasheetUrl: partDoc.datasheetUrl || "",
          wokwiPartType: partDoc.wokwiPartType || "",
          price: partDoc.price || 0
        }
      };
    }

    return {
      found: false,
      partId,
      suggestion: "Try searching with search_library instead"
    };
  } catch (err: any) {
    console.error("executeGetPartDetails failed:", err);
    return { found: false, partId, error: err.message };
  }
}

export async function executeSearchDatasheet(args: any) {
  const { partId, query } = args;

  const LOOKUP_TABLE: Record<string, Record<string, string>> = {
    "MPU6050": {
      "I2C address": "0x68 (AD0 low) or 0x69 (AD0 high)",
      "register map": "PWR_MGMT_1: 0x6B, GYRO_CONFIG: 0x1B, ACCEL_CONFIG: 0x1C, ACCEL_XOUT_H: 0x3B",
      "voltage range": "2.375V to 3.46V, 5V tolerant on I2C"
    },
    "BMP280": {
      "I2C address": "0x76 (SDO low) or 0x77 (SDO high)",
      "register map": "chip_id: 0xD0, reset: 0xE0, ctrl_meas: 0xF4",
      "voltage range": "1.71V to 3.6V"
    },
    "DHT22": {
      "I2C address": "Not I2C — single wire protocol on any GPIO",
      "voltage range": "3.3V to 5.5V",
      "timing": "18ms low start signal, then read 40 bits"
    },
    "SG90": {
      "voltage range": "4.8V to 6V",
      "control": "PWM 50Hz, 1ms=0°, 1.5ms=90°, 2ms=180°"
    },
    "HC-SR04": {
      "voltage range": "5V",
      "timing": "10µs trigger pulse, measure echo pulse width"
    },
    "ESP32": {
      "voltage range": "3.0V to 3.6V, GPIO max 3.3V",
      "I2C pins": "SDA default GPIO21, SCL default GPIO22",
      "ADC pins": "GPIO32-39 (ADC1), GPIO0,2,4,12-15,25-27 (ADC2)"
    }
  };

  try {
    let partDoc: any = null;
    if (mongoose.Types.ObjectId.isValid(partId)) {
      partDoc = await Part.findById(partId).lean();
    }
    if (!partDoc) {
      partDoc = await Part.findOne({ mpn: partId }).lean();
    }

    const partName = partDoc ? partDoc.name : partId;
    let foundKey = "";
    
    for (const key of Object.keys(LOOKUP_TABLE)) {
      if (partName.toUpperCase().includes(key.toUpperCase())) {
        foundKey = key;
        break;
      }
    }

    if (foundKey && LOOKUP_TABLE[foundKey][query]) {
      return {
        partId,
        partName: foundKey,
        query,
        result: LOOKUP_TABLE[foundKey][query],
        source: "lookup_table",
        confidence: "high",
        additionalContext: `Standard configurations for component ${foundKey}.`
      };
    }

    return {
      partId,
      partName: partName || "Unknown",
      query,
      result: "Datasheet content search unavailable. Default values assumed.",
      source: "lookup_table",
      confidence: "medium",
      additionalContext: "Please check standard Arduino libraries for default parameters."
    };
  } catch (err: any) {
    console.error("executeSearchDatasheet failed:", err);
    return { partId, query, error: err.message };
  }
}
