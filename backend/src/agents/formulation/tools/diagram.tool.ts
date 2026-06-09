import mongoose from "mongoose";
import Part from "../../../models/part.model";
import { parseIfString } from "./utils";
import { getRegistry } from "../../../services/registry.services";

export async function executeGetWokwiPartType(args: any) {
  const { partId, partName } = args;
  const registry = getRegistry();

  try {
    const normalizedPartName = String(partName || partId || "").toUpperCase().replace(/\s+/g, "_");
    if (registry[normalizedPartName]) {
      return {
        partId,
        partName: normalizedPartName,
        wokwiPartType: registry[normalizedPartName].wokwiType,
        simulatable: true,
        notes: null
      };
    }

    for (const [key, def] of Object.entries(registry)) {
      if (normalizedPartName.includes(key)) {
        return {
          partId,
          partName: key,
          wokwiPartType: def.wokwiType,
          simulatable: true,
          notes: null
        };
      }
    }

    let partDoc: any = null;
    if (mongoose.Types.ObjectId.isValid(partId)) {
      partDoc = await Part.findById(partId).lean();
    }
    if (!partDoc) {
      partDoc = await Part.findOne({ mpn: partId }).lean();
    }

    if (partDoc?.wokwiPartType) {
      return {
        partId,
        partName: partDoc.name,
        wokwiPartType: partDoc.wokwiPartType,
        simulatable: true,
        notes: null
      };
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
          reason: isPhysicalKeyword ? \`\${item.name} requires physical installation\` : "No simulation model available"
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
      type: p.wokwiPartType || "wokwi-arduino-uno",
      id: p.id || p.key || \`part_\${idx}\`,
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
        return \`\${targetId}:\${normalizedPin}\`;
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
