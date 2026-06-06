// ??$$$
import NewFlowSession from "../../models/newFlowSession.model";
import { parseJsonRecursively } from "../shared/jsonRepair";
// ??$$$ newer code
import Part from "../../models/part.model";

export async function saveSessionProgress(sessionId: string, type: string, data: any) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error("NewFlowSession not found");
  }

  let parsedData = parseJsonRecursively(data);

  const io = (global as any).io;

  if (type === "bom") {
    if (session.bomMeta?.locked) {
      return { saved: false, error: "BOM is locked against AI overwrites" };
    }
    let bomList = parsedData;
    if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
      if (Array.isArray(parsedData.components)) {
        bomList = parsedData.components;
      } else if (Array.isArray(parsedData.bom)) {
        bomList = parsedData.bom;
      } else if (Array.isArray(parsedData.parts)) {
        bomList = parsedData.parts;
      }
    }

    const rawItems = Array.isArray(bomList) ? bomList : [bomList];
    // ??$$$ newer code - resolve componentType from DB async
    const normalizedBOM = await Promise.all(rawItems.filter(Boolean).map(async (item: any) => {
      let key = item.key || item.id || "";
      if (key.toLowerCase() === "brain" || key.toLowerCase() === "mcu") {
        key = "mcu";
      }

      let partId = item.partId || item.id || "";
      let mpn = item.mpn || item.partId || "";

      const displayName = item.displayName || item.name || mpn || "Unknown Component";
      const purpose = item.purpose || item.description || "Auxiliary component";
      const subsystem = item.subsystem || "Main";
      const qty = typeof item.qty === "number" ? item.qty : 1;
      const price = typeof item.price === "number" ? item.price : 0;
      const interfaces = Array.isArray(item.interfaces) ? item.interfaces : [];
      const pinConnections = Array.isArray(item.pinConnections)
        ? item.pinConnections.map((pc: any) => ({
          pin: pc.pin || "",
          connectsTo: pc.connectsTo || ""
        }))
        : [];

      let componentType = "module";
      try {
        const partDoc = await Part.findOne({ mpn }).lean();
        if (partDoc && (partDoc as any).componentType) {
          componentType = (partDoc as any).componentType;
        }
      } catch (err) {
        console.error(`Error fetching componentType for MPN ${mpn}:`, err);
      }

      return {
        key,
        partId,
        mpn,
        displayName,
        purpose,
        qty,
        price,
        subsystem,
        interfaces,
        pinConnections,
        glbUrl: item.glbUrl || "",
        pins: Array.isArray(item.pins) ? item.pins : [],
        type: componentType
      };
    }));

    session.bom = normalizedBOM;
    session.markModified("bom");

    // ??$$$ newer code - V1 State Propagation
    if (!session.bomMeta) session.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.wiringMeta) session.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.sketchMeta) session.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    session.bomMeta.version += 1;
    session.bomMeta.lastModifiedBy = "ai";
    session.wiringMeta.staleReason = "BOM component was modified by AI";
    session.sketchMeta.staleReason = "BOM component was modified by AI";
    session.markModified('bomMeta');
    session.markModified('wiringMeta');
    session.markModified('sketchMeta');

    await session.save();
    if (io) {
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "wiring") {
    if (session.wiringMeta?.locked) {
      return { saved: false, error: "Wiring is locked against AI overwrites" };
    }
    let rawWiring = Array.isArray(parsedData.connections) ? parsedData.connections : parsedData;
    if (!Array.isArray(rawWiring)) rawWiring = [];

    const normalizedWiring = rawWiring.map((c: any) => {
      let from = c.from || "";
      let to = c.to || "";

      if (from.startsWith("brain.")) {
        from = "mcu." + from.substring(6);
      }
      if (to.startsWith("brain.")) {
        to = "mcu." + to.substring(6);
      }

      return {
        from,
        to,
        net: c.net || `${from}-${to}`,
        color: c.color || "#000000"
      };
    });

    session.wiring = normalizedWiring;

    session.bom.forEach((bomItem) => {
      const matchingConns = (session.wiring || []).filter((c: any) => c.to.startsWith(bomItem.key));
      bomItem.pinConnections = matchingConns.map((c: any) => ({
        pin: c.to.split(".")[1] || "",
        connectsTo: c.from
      }));
    });

    session.markModified("wiring");
    session.markModified("bom");

    // ??$$$ newer code - V1 State Propagation
    if (!session.bomMeta) session.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.wiringMeta) session.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.sketchMeta) session.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    session.wiringMeta.version += 1;
    session.wiringMeta.bomVersionUsed = session.bomMeta.version;
    session.wiringMeta.lastModifiedBy = "ai";
    session.sketchMeta.staleReason = "Wiring connections changed by AI";
    session.markModified('wiringMeta');
    session.markModified('sketchMeta');

    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:wiring_update", { wiring: session.wiring });
      io.to(sessionId).emit("agent2:bom_update", { bom: session.bom });
    }
  } else if (type === "milestone") {
    if (session.sketchMeta?.locked) {
      return { saved: false, error: "Sketch/Milestones are locked against AI overwrites" };
    }
    let milestoneList = parsedData;
    if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
      if (Array.isArray(parsedData.milestones)) {
        milestoneList = parsedData.milestones;
      } else if (Array.isArray(parsedData.milestone)) {
        milestoneList = parsedData.milestone;
      } else if (Array.isArray(parsedData.steps)) {
        milestoneList = parsedData.steps;
      } else if (parsedData.milestone && typeof parsedData.milestone === "object") {
        milestoneList = [parsedData.milestone];
      }
    }

    const rawList = Array.isArray(milestoneList) ? milestoneList : [milestoneList];
    const normalizedMilestones = rawList
      .filter((m: any) => m && typeof m === "object")
      .map((m: any, idx: number) => {
        return {
          id: m.id || `milestone_${m.order || idx + 1 || Date.now()}`,
          order: typeof m.order === "number" ? m.order : (idx + 1),
          title: m.title || "Untitled Milestone",
          objective: m.objective || "",
          subsystem: m.subsystem || "General",
          partsInvolved: Array.isArray(m.partsInvolved) ? m.partsInvolved : (Array.isArray(m.componentsInvolved) ? m.componentsInvolved : []),
          wiringInstructions: m.wiringInstructions || "",
          code: m.code || "",
          explanation: m.explanation || "",
          expectedOutput: m.expectedOutput || m.expectedSerialOutput || "",
          passCondition: m.passCondition || "",
          commonProblems: Array.isArray(m.commonProblems) ? m.commonProblems : [],
          simulatable: typeof m.simulatable === "boolean" ? m.simulatable : true,
          requiredLibraries: Array.isArray(m.requiredLibraries) ? m.requiredLibraries : []
        };
      });

    normalizedMilestones.forEach(m => {
      const existingIdx = session.milestones.findIndex(em =>
        em.id === m.id ||
        em.order === m.order ||
        em.title.toLowerCase().trim() === m.title.toLowerCase().trim()
      );
      if (existingIdx > -1) {
        (session.milestones[existingIdx] as any).set(m);
      } else {
        session.milestones.push(m);
      }
    });

    if (session.milestones.length > 0) {
      session.milestones.sort((a, b) => a.order - b.order);
    }
    session.markModified("milestones");

    // ??$$$ newer code - V1 State Propagation
    if (!session.bomMeta) session.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.wiringMeta) session.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.sketchMeta) session.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    session.sketchMeta.version += 1;
    session.sketchMeta.wiringVersionUsed = session.wiringMeta.version;
    session.sketchMeta.lastModifiedBy = "ai";
    session.sketchMeta.staleReason = "";
    session.markModified('sketchMeta');

    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:milestone_update", { milestones: session.milestones });
    }
  } else if (type === "diagram") {
    if (session.wiringMeta?.locked) {
      return { saved: false, error: "Diagram (Wiring) is locked against AI overwrites" };
    }
    let diagramData = parsedData.diagramJson || parsedData;
    if (diagramData && typeof diagramData === "object") {
      if (Array.isArray(diagramData.parts)) {
        diagramData.parts = diagramData.parts.map((p: any) => {
          if (p && (p.id === "brain" || p.id === "mcu")) {
            return { ...p, id: "mcu" };
          }
          return p;
        });
      }
      if (Array.isArray(diagramData.connections)) {
        diagramData.connections = diagramData.connections.map((c: any) => {
          if (Array.isArray(c)) {
            return c.map((val: any) => {
              if (typeof val === "string" && val.startsWith("brain:")) {
                return "mcu:" + val.substring(6);
              }
              return val;
            });
          }
          return c;
        });
      }
    }

    session.diagram = diagramData;
    session.markModified("diagram");

    // ??$$$ newer code - V1 State Propagation
    if (!session.bomMeta) session.bomMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.wiringMeta) session.wiringMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };
    if (!session.sketchMeta) session.sketchMeta = { version: 1, lastModifiedBy: "ai", locked: false, staleReason: "" };

    session.wiringMeta.version += 1;
    session.wiringMeta.bomVersionUsed = session.bomMeta.version;
    session.wiringMeta.lastModifiedBy = "ai";
    session.sketchMeta.staleReason = "Diagram layout changed by AI";
    session.markModified('wiringMeta');
    session.markModified('sketchMeta');

    await session.save();

    if (io) {
      io.to(sessionId).emit("agent2:diagram_update", { diagram: session.diagram });
    }
  }

  return {
    saved: true,
    type,
    sessionId,
    timestamp: new Date().toISOString()
  };
}
