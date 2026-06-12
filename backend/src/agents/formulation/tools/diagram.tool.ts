// ??$$$
import mongoose from "mongoose";
import Part from "../../../models/part.model";
import { parseIfString } from "./utils";

export async function executeGetWokwiPartType(args: any) {
  const { partId, partName } = args;

  const LOOKUP_TABLE: Record<string, string> = {
    "ESP32": "wokwi-esp32-devkit-v1",
    "ESP8266": "wokwi-esp8266",
    "Arduino Uno": "wokwi-uno",
    "Arduino Nano": "wokwi-nano",
    "Arduino Mega": "wokwi-mega2560",
    "Raspberry Pi Pico": "wokwi-pi-pico",
    "MPU6050": "wokwi-mpu6050",
    "DHT22": "wokwi-dht22",
    "DHT11": "wokwi-dht22",
    "BMP280": "wokwi-bmp280",
    "SSD1306": "wokwi-ssd1306",
    "LCD1602": "wokwi-lcd1602",
    "SG90": "wokwi-servo",
    "servo": "wokwi-servo",
    "LED": "wokwi-led",
    "resistor": "wokwi-resistor",
    "button": "wokwi-pushbutton",
    "HC-SR04": "wokwi-hc-sr04",
    "NeoPixel": "wokwi-neopixel",
    "potentiometer": "wokwi-potentiometer"
  };

  try {
    let partDoc: any = null;
    if (mongoose.Types.ObjectId.isValid(partId)) {
      partDoc = await Part.findById(partId).lean();
    }
    if (!partDoc) {
      partDoc = await Part.findOne({ mpn: partId }).lean();
    }

    const finalName = (partDoc?.name || partName || partId || "").toUpperCase();

    if (partDoc?.wokwiPartType) {
      return {
        partId,
        partName: partDoc.name,
        wokwiPartType: partDoc.wokwiPartType,
        simulatable: true,
        notes: null
      };
    }

    for (const [key, value] of Object.entries(LOOKUP_TABLE)) {
      if (finalName.includes(key.toUpperCase())) {
        return {
          partId,
          partName: key,
          wokwiPartType: value,
          simulatable: true,
          notes: null
        };
      }
    }

    return {
      partId,
      partName: partName || partId,
      wokwiPartType: null,
      simulatable: false,
      notes: "This component is not supported in Wokwi simulator."
    };
  } catch (err: any) {
    console.error("executeGetWokwiPartType failed:", err);
    return { partId, wokwiPartType: null, simulatable: false, error: err.message };
  }
}

export async function executeCheckSimulationSupport(args: any) {
  const parts = parseIfString(args.parts);

  const PHYSICAL_ONLY_KEYWORDS = [
    "brushless", "esc", "receiver", "transmitter", "battery", "frame", "lora", "nrf24", "relay"
  ];

  try {
    const simulatable: any[] = [];
    const physicalOnly: any[] = [];

    for (const item of parts) {
      const typeRes = await executeGetWokwiPartType({ partId: item.partId, partName: item.name });
      const nameLower = item.name.toLowerCase();

      const isPhysicalKeyword = PHYSICAL_ONLY_KEYWORDS.some(kw => nameLower.includes(kw));

      if (typeRes.simulatable && !isPhysicalKeyword) {
        simulatable.push({
          key: item.key,
          name: item.name,
          wokwiType: typeRes.wokwiPartType
        });
      } else {
        physicalOnly.push({
          key: item.key,
          name: item.name,
          reason: isPhysicalKeyword ? `${item.name} requires physical installation` : "No simulation model available"
        });
      }
    }

    return {
      simulatable,
      physicalOnly,
      simulatableCount: simulatable.length,
      physicalCount: physicalOnly.length,
      recommendation: physicalOnly.length > 0 
        ? "Some components require physical setup; verify them individually."
        : "All components supported in Wokwi simulation."
    };
  } catch (err: any) {
    console.error("executeCheckSimulationSupport failed:", err);
    return { error: err.message };
  }
}

export async function executeGenerateDiagramJson(args: any) {
  const parts = parseIfString(args.parts);
  const connections = parseIfString(args.connections);

  try {
    const formattedParts = parts.map((p: any, idx: number) => ({
      type: p.wokwiPartType || "wokwi-esp32-devkit-v1",
      id: p.id || p.key || `part_${idx}`,
      top: idx * 250,
      left: 0,
      attrs: {}
    }));

    const colorMap: Record<string, string> = {
      "#ff0000": "red",
      "#000000": "black",
      "#0066ff": "blue",
      "#ffcc00": "yellow",
      "#ff6600": "orange",
      "#00cc66": "green"
    };

    const formattedConns = connections.map((c: any) => {
      const cleanPin = (pStr: string) => {
        const partsList = pStr.split(".");
        const partRef = partsList[0];
        const pinRef = partsList[1] || "";
        
        let targetId = partRef;
        const matchingPart = parts.find((p: any) => p.key === partRef || p.id === partRef);
        if (matchingPart) {
          targetId = matchingPart.id || matchingPart.key;
        }

        const normalizedPin = pinRef.replace("GPIO", "");
        return `${targetId}:${normalizedPin}`;
      };

      const color = colorMap[c.color] || "gray";
      return [cleanPin(c.from), cleanPin(c.to), color, []];
    });

    const diagramJson = {
      version: 1,
      author: "Wireup AI",
      editor: "wokwi",
      parts: formattedParts,
      connections: formattedConns,
      dependencies: {}
    };

    return {
      diagramJson,
      partCount: parts.length,
      connectionCount: connections.length,
      warnings: []
    };
  } catch (err: any) {
    console.error("executeGenerateDiagramJson failed:", err);
    return { diagramJson: {}, partCount: 0, connectionCount: 0, error: err.message };
  }
}
