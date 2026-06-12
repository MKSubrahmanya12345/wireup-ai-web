// ??$$$
import NewFlowSession from "../../../models/newFlowSession.model";
// ??$$$ newer code - cacheMilestone enables pass-by-reference milestone saving
import { parseIfString, unifiedLlmCall, cacheMilestone } from "./utils";

export async function executeGenerateMilestone(args: any, sessionId?: string) {
  const title = args.title;
  const objective = args.objective;
  const subsystem = args.subsystem;
  const mcu = args.mcu;
  const isFirstMilestone = args.isFirstMilestone;
  const partsInvolved = parseIfString(args.partsInvolved);
  const wiringSubset = parseIfString(args.wiringSubset);
  const previousMilestones = parseIfString(args.previousMilestones);

  if (sessionId) {
    try {
      const session = await NewFlowSession.findById(sessionId);
      if (session && session.milestones) {
        const dbMilestonesCount = session.milestones.length || 0;
        const order = typeof args.order === "number" ? args.order : dbMilestonesCount + 1;
        const existing = session.milestones.find((m: any) => {
          if (m.title === title) return true;
          if (m.order === order) {
            if (order === 1) {
              return m.title.toLowerCase().trim() === title.toLowerCase().trim();
            }
            return true;
          }
          return false;
        });

        if (existing && existing.code && existing.code.trim().length > 0) {
          console.log(`[Agent2] Milestone '${title}' or order ${order} already exists with code. Returning cached milestone.`);
          return {
            id: existing.id || `milestone_${order}_${Date.now()}`,
            order,
            title,
            objective,
            subsystem,
            partsInvolved,
            wiringInstructions: existing.wiringInstructions || (wiringSubset && wiringSubset.length > 0 ? wiringSubset.map((w: any) => `${w.from} -> ${w.to} (${w.net})`).join(", ") : ""),
            code: existing.code,
            explanation: existing.explanation,
            expectedOutput: existing.expectedOutput,
            passCondition: existing.passCondition,
            commonProblems: existing.commonProblems || [],
            simulatable: existing.simulatable,
            requiredLibraries: existing.requiredLibraries || []
          };
        }
      }
    } catch (e) {
      console.error("[Agent2] Failed to check for existing milestone:", e);
    }
  }

  try {
    // Enforce data integrity: reject generation if wiringSubset is empty
    if (!Array.isArray(wiringSubset) || wiringSubset.length === 0) {
      throw new Error("wiringSubset cannot be empty. You must specify the relevant wiring connections for this milestone.");
    }

    const wiringText = JSON.stringify(wiringSubset, null, 2);
    const prevText = previousMilestones ? previousMilestones.join(", ") : "None";

    const systemPrompt = "Return ONLY valid JSON. No markdown. No prose. No <think>. Keep compile errors out.";
    const userPrompt = `You are writing firmware for a hardware project milestone.
  
  MCU: ${mcu}
  Milestone: ${title}
  Objective: ${objective}
  Parts involved: ${partsInvolved.join(", ")}
  Wiring for this milestone: ${wiringText}
  Previous milestones completed: ${prevText}
  Is first milestone: ${isFirstMilestone || false}
  
  Rules:
  - Write complete, compilable Arduino code
  - Include only what is needed for THIS milestone
  - If isFirstMilestone: focus on verifying basic MCU and serial communication functionality, utilizing an onboard LED or serial prints suitable for the parts involved, using no external libraries
  - Use exact pin numbers from the wiring subset provided
  - Use exact I2C addresses and register values (not guesses)
  - Add clear comments explaining each section
  - Code must work standalone without previous milestone code
  
  Return ONLY valid JSON, no markdown:
  {
    "code": "full .ino code here",
    "explanation": "why this step matters, what we learn from it",
    "expectedOutput": "exact serial monitor output on success",
    "passCondition": "plain english: what success looks like",
    "commonProblems": ["problem 1 and fix", "problem 2 and fix"],
    "simulatable": true,
    "requiredLibraries": [
      {
        "name": "Wire",
        "type": "core",
        "version": null,
        "installCommand": null
      }
    ]
  }`;

    const raw = await unifiedLlmCall(systemPrompt, userPrompt);

    const clean = raw
      .replace(/```json|```/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, (c) => {
        const escapes: Record<string, string> = {
          '\n': '\\n', '\r': '\\r', '\t': '\\t'
        };
        return escapes[c] ?? '';
      })
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.warn("[Agent2Tools] JSON.parse failed, attempting manual extraction/fallback", e);
      const codeMatch = raw.match(/"code"\s*:\s*"([\s\S]*?)(?<!\\)",/);
      if (codeMatch) {
        const fixedRaw = raw.replace(codeMatch[0], 
          `"code": ${JSON.stringify(codeMatch[1])},`
        );
        parsed = JSON.parse(fixedRaw.replace(/```json|```/g, '').trim());
      } else {
        throw e;
      }
    }

    // Enforce code placeholder validation
    const code = parsed.code || "";
    const PLACEHOLDER_PATTERNS = [
      /milestone\s+\d+\s+code\s+from\s+generate/i,
      /code\s+from\s+generate/i,
      /placeholder/i,
      /\[code here\]/i,
      /insert code/i,
      /TODO/i,
      /write your code/i
    ];
    const isPlaceholder = code.trim().length < 50 || PLACEHOLDER_PATTERNS.some(p => p.test(code));
    if (isPlaceholder) {
      throw new Error("Generated code is a placeholder or too short. A complete, functioning Arduino sketch is required.");
    }

    let dbMilestonesCount = 0;
    if (sessionId) {
      try {
        const session = await NewFlowSession.findById(sessionId);
        if (session) {
          dbMilestonesCount = session.milestones?.length || 0;
        }
      } catch {}
    }
    const order = typeof args.order === "number" ? args.order : dbMilestonesCount + 1;

    return {
      id: `milestone_${order}_${Date.now()}`,
      order,
      title,
      objective,
      subsystem,
      partsInvolved,
      wiringInstructions: wiringSubset.map((w: any) => `${w.from} -> ${w.to} (${w.net})`).join(", "),
      ...parsed
    };
  } catch (err: any) {
    console.error("executeGenerateMilestone failed:", err);
    let dbMilestonesCount = 0;
    if (sessionId) {
      try {
        const session = await NewFlowSession.findById(sessionId);
        if (session) {
          dbMilestonesCount = session.milestones?.length || 0;
        }
      } catch {}
    }
    const order = typeof args.order === "number" ? args.order : dbMilestonesCount + 1;
    return {
      id: `milestone_${order}_fallback`,
      order,
      title,
      objective,
      subsystem,
      partsInvolved,
      wiringInstructions: wiringSubset && wiringSubset.length > 0
        ? wiringSubset.map((w: any) => `${w.from} -> ${w.to} (${w.net})`).join(", ")
        : "mcu.GPIO13 -> led.A",
      code: "void setup() {\n  Serial.begin(115200);\n}\nvoid loop() {\n  delay(1000);\n}",
      explanation: "Fallback milestone created due to generation failure.",
      expectedOutput: "System initialized",
      passCondition: "Serial monitor shows output",
      commonProblems: [],
      simulatable: true,
      requiredLibraries: []
    };
  }
}
