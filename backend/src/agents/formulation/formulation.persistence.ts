// ??$$$
// ??$$$ newer code
import NewFlowSession from "../../models/newFlowSession.model";
import Project from "../../models/project.model";
import { parseJsonRecursively } from "../shared/jsonRepair";
// ??$$$ newer code - pass-by-reference milestone cache (token optimization)
import { getCachedMilestone } from "./tools/utils";
// ??$$$ newer code
import fs from "fs";
import path from "path";
import Part from "../../models/part.model";

// ??$$$ newer code - Determine active phase of formulation
export function determineActivePhase(session: any): "bom" | "wiring" | "milestone" | "diagram" | "firmware" {
  const hasBOM = Array.isArray(session.bom) && session.bom.length > 0;
  const hasWiring = Array.isArray(session.wiring) && session.wiring.length > 0;
  const hasMilestones = Array.isArray(session.milestones) && session.milestones.length > 0 && !session.milestones.some((m: any) => !m.code || m.code.trim().length === 0);
  const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;

  if (!hasBOM) return "bom";
  if (!hasWiring) return "wiring";
  if (!hasMilestones) return "milestone";
  if (!hasDiagram) return "diagram";
  return "firmware";
}

// ??$$$ newer code - robust argument mapping and fallback handling for saveSessionProgress
export async function saveSessionProgress(sessionId: string, type: string, data: any, fullArgs?: any) {
  const session = await NewFlowSession.findById(sessionId);
  if (!session) {
    throw new Error("NewFlowSession not found");
  }

  // ??$$$ newer code - state machine sequence enforcement check
  const hasBOM = Array.isArray(session.bom) && session.bom.length > 0;
  const hasWiring = Array.isArray(session.wiring) && session.wiring.length > 0;

  if (type === "wiring" && !hasBOM) {
    return {
      saved: false,
      error: "State Machine Guard Violation: You cannot save wiring until the Bill of Materials (BOM) has been generated and saved."
    };
  }
  if (type === "milestone" && (!hasBOM || !hasWiring)) {
    return {
      saved: false,
      error: "State Machine Guard Violation: You cannot save milestones until the BOM and wiring connections have been generated and saved."
    };
  }
  if (type === "diagram" && (!hasBOM || !hasWiring)) {
    return {
      saved: false,
      error: "State Machine Guard Violation: You cannot save the diagram until the BOM and wiring connections have been generated and saved."
    };
  }

  let parsedData = parseJsonRecursively(data);
  if (!parsedData && fullArgs) {
    if (type === "bom") {
      parsedData = fullArgs.bom || fullArgs.components || fullArgs.parts || fullArgs.data;
    } else if (type === "wiring") {
      parsedData = fullArgs.connections || fullArgs.wiring || fullArgs.wires || fullArgs.data;
    } else if (type === "milestone") {
      parsedData = fullArgs.milestones || fullArgs.milestone || fullArgs.steps || fullArgs.data;
    } else if (type === "diagram") {
      parsedData = fullArgs.diagram || fullArgs.diagramJson || fullArgs.parts || fullArgs.data;
    }
  }
  parsedData = parseJsonRecursively(parsedData) || {};

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

    // ??$$$ newer code - validate and default missing properties for BOM items (rejecting empty keys/partIds/mpns)
    const rawItems = Array.isArray(bomList) ? bomList : [bomList];
    const validRawItems = rawItems.filter((item: any) => {
      if (!item || typeof item !== "object") return false;
      const key = String(item.key || item.id || "").trim();
      const partId = String(item.partId || item.id || "").trim();
      const mpn = String(item.mpn || item.partId || "").trim();
      return key.length > 0 && partId.length > 0 && mpn.length > 0;
    });

    if (validRawItems.length === 0) {
      throw new Error("BOM list is empty or invalid. Please ensure the components/BOM array is provided in your tool arguments with valid key, partId, and mpn fields.");
    }

    // ??$$$ newer code - resolve componentType from DB async
    const normalizedBOM = await Promise.all(validRawItems.map(async (item: any) => {
      let key = item.key || item.id || "unknown_key";
      if (key.toLowerCase() === "brain" || key.toLowerCase() === "mcu") {
        key = "mcu";
      }

      let partId = item.partId || item.id || "unknown_part";
      let mpn = item.mpn || item.partId || "unknown_mpn";

      const displayName = item.displayName || item.name || mpn || "Unknown Component";
      const purpose = item.purpose || item.description || "Auxiliary component";
      const subsystem = item.subsystem || "Main";
      const qty = typeof item.qty === "number" ? item.qty : 1;
      const price = typeof item.price === "number" ? item.price : 0;
      const interfaces = Array.isArray(item.interfaces) ? item.interfaces : [];
      const pinConnections = Array.isArray(item.pinConnections)
        ? item.pinConnections
          .map((pc: any) => {
            // ??$$$ Defensive coercion: LLM sometimes emits strings instead of {pin, connectsTo}
            if (typeof pc === "string") {
              const parts = pc.split(/->|→|:|=>/).map((s: string) => s.trim());
              return { pin: parts[0] || pc.trim(), connectsTo: parts[1] || "" };
            }
            if (pc && typeof pc === "object") {
              return { pin: pc.pin || "", connectsTo: pc.connectsTo || "" };
            }
            return { pin: "", connectsTo: "" };
          })
          .filter((pc: any) => pc.pin && pc.connectsTo)
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
    // ??$$$ newer code - validate wiring connection lists defensively
    let rawWiring = Array.isArray(parsedData.connections) ? parsedData.connections : parsedData;
    if (!Array.isArray(rawWiring)) rawWiring = [];

    const validConnections = rawWiring.filter((c: any) => {
      if (!c || typeof c !== "object") return false;
      const from = String(c.from || "").trim();
      const to = String(c.to || "").trim();
      return from.length > 0 && to.length > 0 && from.includes(".") && to.includes(".");
    });

    if (rawWiring.length > 0 && validConnections.length === 0) {
      throw new Error("Invalid wiring format. Connections must specify component pin mappings (e.g., 'mcu.GPIO25' or 'dht.SIG').");
    }

    if (validConnections.length === 0) {
      throw new Error("Wiring connection list is empty or invalid. Please ensure the connections array is provided in your tool arguments.");
    }

    const normalizedWiring = validConnections.map((c: any) => {
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

    // ??$$$ newer code - resolve pass-by-reference milestoneId from the server-side cache (token optimization)
    const milestoneRefId = fullArgs?.milestoneId || fullArgs?.milestone_id ||
      (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)
        ? (parsedData.milestoneId || parsedData.milestone_id)
        : undefined);
    if (milestoneRefId) {
      const cached = getCachedMilestone(sessionId, String(milestoneRefId));
      if (cached) {
        milestoneList = [cached];
      } else if (!milestoneList || (typeof milestoneList === "object" && !Array.isArray(milestoneList) && !milestoneList.code)) {
        return {
          saved: false,
          error: `Milestone reference "${milestoneRefId}" was not found in the server cache. Re-run generate_milestone for this milestone, then call save_progress again with the returned milestoneId.`
        };
      }
    }

    // ??$$$ newer code - validate rawList containing milestones, returning error on empty/invalid
    const rawList = Array.isArray(milestoneList) ? milestoneList : [milestoneList];
    const validRawList = rawList.filter((m: any) => {
      if (!m || typeof m !== "object") return false;
      return m.title || m.objective || m.code || m.order;
    });

    if (validRawList.length === 0) {
      throw new Error("Milestone list is empty or invalid. Please ensure the milestones array is provided in your tool arguments.");
    }

    // ??$$$ newer code
    const normalizedMilestones = validRawList
      .filter((m: any) => m && typeof m === "object")
      .map((m: any, idx: number) => {
        let code = m.code || "";
        const PLACEHOLDER_PATTERNS = [
          /milestone\s+\d+\s+code\s+from\s+generate/i,
          /code\s+from\s+generate/i,
          /placeholder/i,
          /\[code here\]/i,
          /insert code/i,
        ];
        const isPlaceholder = code.trim().length < 50 || PLACEHOLDER_PATTERNS.some(p => p.test(code));
        if (isPlaceholder) {
          const existing = session.milestones.find((em: any) =>
            em.id === m.id ||
            em.order === m.order ||
            (m.title && em.title.toLowerCase().trim() === m.title.toLowerCase().trim())
          );
          if (existing && existing.code && existing.code.trim().length >= 50) {
            code = existing.code;
            console.warn(`[Persistence] Rejected placeholder code for milestone "${m.title || m.order}", keeping existing code.`);
          } else {
            code = "";
          }
        }

        return {
          id: m.id || `milestone_${m.order || idx + 1 || Date.now()}`,
          order: typeof m.order === "number" ? m.order : (idx + 1),
          title: m.title || "Untitled Milestone",
          objective: m.objective || "",
          subsystem: m.subsystem || "General",
          partsInvolved: Array.isArray(m.partsInvolved) ? m.partsInvolved : (Array.isArray(m.componentsInvolved) ? m.componentsInvolved : []),
          wiringInstructions: m.wiringInstructions || "",
          code,
          explanation: m.explanation || "",
          expectedOutput: m.expectedOutput || m.expectedSerialOutput || "",
          passCondition: m.passCondition || "",
          commonProblems: Array.isArray(m.commonProblems) ? m.commonProblems : [],
          simulatable: typeof m.simulatable === "boolean" ? m.simulatable : true,
          // Normalize requiredLibraries: LLM sometimes sends plain strings like "SPI.h"
          // but the Mongoose schema expects {name, type, version, installCommand} objects.
          requiredLibraries: (Array.isArray(m.requiredLibraries) ? m.requiredLibraries : [])
            .map((lib: any) => {
              if (typeof lib === "string") {
                return { name: lib, type: "library_manager", version: null, installCommand: null };
              }
              return {
                name: lib.name || lib.libraryName || lib.library || String(lib),
                type: lib.type || "library_manager",
                version: lib.version ?? null,
                installCommand: lib.installCommand ?? null
              };
            })
            .filter((lib: any) => lib.name)
        };
      });

    normalizedMilestones.forEach(m => {
      const existingIdx = session.milestones.findIndex(em =>
        em.id === m.id ||
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
      // ??$$$ newer code - sequentially re-order to guarantee collision-free sequence
      session.milestones.forEach((m, idx) => {
        m.order = idx + 1;
      });
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
    // ??$$$ newer code - validate diagram data structure
    let diagramData = parsedData.diagramJson || parsedData;
    if (!diagramData || typeof diagramData !== "object" || Array.isArray(diagramData) || (!Array.isArray(diagramData.parts) && !Array.isArray(diagramData.connections))) {
      throw new Error("Diagram data is empty or invalid. Please ensure the parts and connections are provided in your tool arguments.");
    }
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

  // ??$$$ newer code — sync progress to Project document if linked
  if (session.projectId) {
    await syncSessionToProject(session);
  }

  // ??$$$ newer code - sync session data to disk formulation exports directory
  await syncSessionToDisk(sessionId);

  return {
    saved: true,
    type,
    sessionId,
    timestamp: new Date().toISOString()
  };
}

// ??$$$ newer code — Sync session to Project document
async function syncSessionToProject(session: any) {
  if (!session.projectId) return;
  try {
    const project = await Project.findById(session.projectId);
    if (!project) return;

    // Map BOM
    project.bom = await Promise.all((session.bom || []).map(async (b: any) => {
      let glbUrl = "";
      let componentType = b.type || "module";
      try {
        const partDoc = await Part.findOne({ mpn: b.mpn }).lean() as any;
        if (partDoc) {
          if (partDoc.isCurated && partDoc.glbUrl) {
            glbUrl = partDoc.glbUrl;
          }
          if (partDoc.componentType) {
            componentType = partDoc.componentType;
          }
        }
      } catch (e) { /* non-blocking */ }

      return {
        key: b.key,
        wokwiPartType: b.partId,
        displayName: b.displayName,
        qty: b.qty,
        purpose: b.purpose,
        price: b.price || 0,
        storeUrl: "",
        mpn: b.mpn || "",
        partId: b.partId || "",
        pinConnections: b.pinConnections || [],
        glbUrl,
        pins: [],
        type: componentType
      };
    }));

    // Map wiring
    project.wiring = session.wiring || [];

    // Map milestones
    project.milestones = (session.milestones || []).map((m: any, idx: number) => ({
      id: m.id,
      order: m.order || (idx + 1),
      title: m.title,
      objective: m.objective,
      componentsInvolved: m.partsInvolved,
      wiringInstructions: m.wiringInstructions,
      code: m.code,
      explanation: m.explanation,
      test: {
        expectedSerialOutput: m.expectedOutput,
        passCondition: m.passCondition,
        commonProblems: m.commonProblems
      },
      status: idx === 0 ? ("ready" as const) : ("locked" as const),
      userConfirmed: false,
      userNotes: "",
      compiledHex: "",
      compilationErrors: [],
      serialOutput: "",
      completedAt: null,
      simulatable: m.simulatable,
      dependsOn: idx === 0 ? [] : [session.milestones[idx - 1].id],
      debugMessages: [],
      requiredLibraries: (m.requiredLibraries || []).map((lib: any) => {
        if (typeof lib === "string") {
          return { name: lib, type: "library_manager", version: null, installCommand: null };
        }
        return lib;
      }).filter((lib: any) => lib.name)
    }));

    if (project.milestones.length > 0) {
      project.milestonesGenerated = true;
      project.activeMilestoneId = project.milestones[0].id;
    }

    // Map diagram
    project.diagram = session.diagram || session.wiring;

    // Map other state
    project.derivedDependencies = session.derivedDependencies || {};
    project.bomMeta = session.bomMeta;
    project.wiringMeta = session.wiringMeta;
    project.sketchMeta = session.sketchMeta;

    if (session.context?.mcu) {
      project.meta.board = session.context.mcu;
    }

    // ??$$$ newer code - sync project.files with the latest auto-generated files from formulation session, preserving manual user files
    const existingFiles = project.files || [];
    const generatedNames = new Set([
      "bom.json",
      "wiring.json",
      "milestones.json",
      "diagram.json",
      "sketch.ino"
    ]);
    if (session.milestones) {
      session.milestones.forEach((m: any) => {
        generatedNames.add(`milestone_${m.order}.ino`);
      });
    }

    const userFiles = existingFiles.filter((f: any) => !generatedNames.has(f.name));

    const generatedFiles: any[] = [];
    if (session.bom && session.bom.length > 0) {
      generatedFiles.push({
        name: "bom.json",
        language: "json",
        content: JSON.stringify(session.bom, null, 2)
      });
    }
    if (session.wiring && session.wiring.length > 0) {
      generatedFiles.push({
        name: "wiring.json",
        language: "json",
        content: JSON.stringify(session.wiring, null, 2)
      });
    }
    if (session.milestones && session.milestones.length > 0) {
      generatedFiles.push({
        name: "milestones.json",
        language: "json",
        content: JSON.stringify(session.milestones, null, 2)
      });
      session.milestones.forEach((m: any) => {
        if (m.code && m.code.trim()) {
          generatedFiles.push({
            name: `milestone_${m.order}.ino`,
            language: "arduino",
            content: m.code
          });
        }
      });
    }
    if (session.diagram) {
      generatedFiles.push({
        name: "diagram.json",
        language: "json",
        content: JSON.stringify(session.diagram, null, 2)
      });
    }
    if (session.finalSketch && session.finalSketch.trim()) {
      generatedFiles.push({
        name: "sketch.ino",
        language: "arduino",
        content: session.finalSketch
      });
    }

    project.files = [...userFiles, ...generatedFiles];
    project.markModified("files");

    await project.save();
    console.log(`[Persistence] Successfully synchronized session progress to project: ${project._id}`);
  } catch (err) {
    console.error(`[Persistence] Failed to sync session to project:`, err);
  }
}

// ??$$$ newer code - sync session data to disk formulation exports directory
export async function syncSessionToDisk(sessionId: string) {
  try {
    const session = await NewFlowSession.findById(sessionId);
    if (!session) return;

    const exportsBaseDir = process.env.FORMULATION_EXPORTS_DIR || "E:\\wireup_formulation_exports";
    const exportDir = path.join(exportsBaseDir, `session_${sessionId}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    fs.writeFileSync(path.join(exportDir, "bom.json"), JSON.stringify(session.bom || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "wiring.json"), JSON.stringify(session.wiring || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "milestones.json"), JSON.stringify(session.milestones || [], null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "diagram.json"), JSON.stringify(session.diagram || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "context.json"), JSON.stringify(session.context || {}, null, 2), "utf8");
    fs.writeFileSync(path.join(exportDir, "requirements.md"), session.requirementsDoc || "", "utf8");

    const sketchCode = session.finalSketch || (
      [...(session.milestones || [])].sort((a: any, b: any) => Number(b?.order || 0) - Number(a?.order || 0))
        .find((m: any) => String(m?.code || "").trim().length > 0)?.code
    ) || "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  delay(1000);\n}\n";

    fs.writeFileSync(path.join(exportDir, "sketch.ino"), sketchCode, "utf8");
    fs.writeFileSync(path.join(exportDir, "sketch.json"), JSON.stringify({
      code: sketchCode,
      filename: "sketch.ino"
    }, null, 2), "utf8");

    console.log(`[Persistence] Synced session data to disk exports: ${exportDir}`);
  } catch (err: any) {
    console.error(`[Persistence] Failed to sync session data to disk:`, err);
  }
}
