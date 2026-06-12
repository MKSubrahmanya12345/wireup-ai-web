
// ??$$$ newer code
/* old code
export const SYSTEM_PROMPT = `You are an autonomous hardware project formulation agent.

## Your Role
Your job is ONLY to orchestrate, plan, and call tools. You call tools to search parts, generate wiring, save progress, and plan milestones. You do NOT write code yourself.

## Tool Responsibilities
- search_library, get_part_details, check_compatibility, select_compute → find, validate, and match parts (e.g. MCUs)
- generate_wiring, validate_pin_assignment → plan connections
- save_progress → persist BOM, wiring, milestones, diagram
- get_wokwi_part_type, generate_diagram_json → simulation setup
- generate_milestone → delegates code generation to a separate capable model (NOT you)
- generate_final_sketch → delegates final code generation to a separate capable model (NOT you)

## Critical Rules
1. NEVER write Arduino/C++ code yourself in your responses.
2. ALWAYS use generate_milestone to produce milestone code — never inline it.
3. ALWAYS use generate_final_sketch for the final sketch — never inline it.
4. Keep your thinking responses short — you are an orchestrator, not a code writer.
5. Follow this exact order every time:
   - Always call select_compute first to find the recommended MCU before searching for or selecting the controller/MCU in the BOM.
   - Search + select parts → save BOM
   - Generate wiring → save wiring
   - Generate each milestone via generate_milestone, then IMMEDIATELY save it via save_progress(type='milestone') before generating the next one. Do NOT generate all milestones first and save them later.
   - Get Wokwi part types → generate diagram → save diagram
   - Generate final sketch via generate_final_sketch
6. Do NOT call generate_diagram_json until ALL milestones are saved.
7. Do NOT call generate_final_sketch more than once.
8. CRITICAL: When calling save_progress(type="bom"), the data must be a JSON array of components where each component is a flat object directly containing: key, partId (use the database _id string from get_part_details, NEVER the MPN string), mpn, displayName, purpose, subsystem, qty, price, interfaces, pinConnections. Do NOT wrap under a 'components' key. Each entry in pinConnections MUST be an object with exactly two string fields: {"pin": "<component pin name>", "connectsTo": "<mcu pin or net>"}. Never use plain strings. Example: "pinConnections": [{"pin": "SDA", "connectsTo": "mcu.GPIO21"}, {"pin": "VCC", "connectsTo": "mcu.3V3"}].
9. CRITICAL: After each generate_milestone call completes, you MUST immediately call save_progress(type='milestone') with the COMPLETE object returned by generate_milestone — including the full unmodified 'code' string. Never summarize, truncate, or replace the code field with a placeholder. Never batch multiple milestone saves together. The pattern is: generate_milestone -> immediately save_progress(milestone) -> generate_milestone -> immediately save_progress(milestone) -> repeat.
10. CRITICAL: The MCU must always use the key 'mcu' everywhere — in the BOM, in generate_wiring, and in generate_diagram_json. Never use 'brain' as a key. The id field in diagram.parts must match the BOM key (which is 'mcu').
11. CRITICAL: The partId field in save_progress for the BOM must be the exact database _id string returned by get_part_details (e.g. '6a13ec800c47f410601cfea7'), not the MPN string.

## You are running on a small local model. Stay focused, use tools, don't ramble.`;
*/
// ??$$$ newer code
export const SYSTEM_PROMPT = `You are a hardware formulation orchestrator. Follow these 5 imperative rules:
1. NEVER write code yourself; delegate code tasks to tools. Keep responses and thinking brief.
2. Follow strict sequential formulation phases: BOM Sourcing (save_progress type bom) -> Wiring Design (save_progress type wiring) -> Milestones (generate_milestone & save_progress milestone per step) -> Diagram Layout (save_progress type diagram) -> Final Integrated Sketch.
3. The microcontroller must always use the BOM key 'mcu' (never 'brain') across BOM, wiring, and diagram.
4. When calling save_progress(type="bom"), pass a flat JSON array of component objects where partId is the database _id returned by get_part_details.
5. Immediately after each generate_milestone call, save it with save_progress(type="milestone", milestoneId="<id from the generate_milestone result>"). The server resolves the full milestone (including its code) from milestoneId — NEVER re-send the code field. Do this before calling generate_milestone for the next milestone.`;

import { determineActivePhase } from "./formulation.persistence";

/* old code
export function buildInitialPrompt(session: any, isResume: boolean): string {
  let contextBlock = "";

  if (session.requirementsDoc && session.requirementsDoc.trim().length > 0) {
    contextBlock = session.requirementsDoc;
  } else if (session.context && Object.keys(session.context).length > 0) {
    const ctx = session.context;
    let subsystemsStr = "";
    if (ctx.subsystems && typeof ctx.subsystems === "object") {
      const s = ctx.subsystems;
      const parts = [];
      if (Array.isArray(s.inputs) && s.inputs.length > 0) parts.push(`Inputs: [${s.inputs.join(", ")}]`);
      if (Array.isArray(s.outputs) && s.outputs.length > 0) parts.push(`Outputs: [${s.outputs.join(", ")}]`);
      if (Array.isArray(s.communication) && s.communication.length > 0) parts.push(`Communication: [${s.communication.join(", ")}]`);
      if (Array.isArray(s.storage) && s.storage.length > 0) parts.push(`Storage: [${s.storage.join(", ")}]`);
      if (Array.isArray(s.power) && s.power.length > 0) parts.push(`Power: [${s.power.join(", ")}]`);
      subsystemsStr = parts.join(" | ");
    }
    const constraints = Array.isArray(ctx.constraints) ? ctx.constraints.join(", ") : "";
    const connectivityStr = Array.isArray(ctx.connectivity) ? ctx.connectivity.join(", ") : (ctx.connectivity || "");
    
    contextBlock = `Project Context:
Core Purpose: ${ctx.corePurpose || ""}
Compute Brain: ${ctx.mcu || ""}
Subsystems: ${subsystemsStr}
Constraints: ${constraints}
Power Source: ${ctx.powerSource || ""}
Connectivity: ${connectivityStr}
Physical Form Factor: ${ctx.formFactor || ""}
Estimated Budget: ${ctx.estimatedBudget || ""}
Open Questions: ${Array.isArray(ctx.openQuestions) ? ctx.openQuestions.join(", ") : ""}`;
  } else {
    contextBlock = `Project Idea: ${session.idea || "No idea provided"}\n\nNote: Full requirements document was not generated. Please formulate based on the idea above.`;
  }

  let blueprintBlock = "";
  if (session.blueprint && Object.keys(session.blueprint).length > 0) {
    blueprintBlock = `\n\n## SYSTEM BLUEPRINT (binding contract — you MUST satisfy this)\n${JSON.stringify(session.blueprint, null, 2)}\n\nRules: fill every "core" subsystem in the BOM. Choose an MCU that satisfies computeRequirements (pin count, peripherals, flash/RAM, voltage). Respect powerProfile. Use the simulation classes when generating the diagram.`;
  }

  // ??$$$ newer code - inject detailed state of saved artifacts to preserve context across pruning
  const hasBOM = session.bom && session.bom.length > 0;
  let bomDetails = "";
  if (hasBOM) {
    bomDetails = `\n\n### Saved Bill of Materials (BOM):\n${JSON.stringify(session.bom.map((b: any) => ({
      key: b.key,
      partId: b.partId,
      mpn: b.mpn,
      displayName: b.displayName,
      purpose: b.purpose,
      qty: b.qty
    })), null, 2)}`;
  }

  const hasWiring = session.wiring && session.wiring.length > 0;
  let wiringDetails = "";
  if (hasWiring) {
    wiringDetails = `\n\n### Saved Wiring Connections:\n${JSON.stringify(session.wiring.map((w: any) => ({
      from: w.from,
      to: w.to,
      net: w.net
    })), null, 2)}`;
  }

  const hasMilestones = session.milestones && session.milestones.length > 0;
  let milestoneDetails = "";
  if (hasMilestones) {
    milestoneDetails = `\n\n### Saved Milestones:\n${JSON.stringify(session.milestones.map((m: any) => ({
      id: m.id,
      order: m.order,
      title: m.title,
      objective: m.objective,
      partsInvolved: m.partsInvolved,
      hasCode: !!(m.code && m.code.trim().length > 0)
    })), null, 2)}`;
  }

  const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;
  let diagramDetails = "";
  if (hasDiagram) {
    diagramDetails = `\n\n### Saved Simulation Diagram:\n[Diagram layout JSON has been successfully saved]`;
  }
*/
// ??$$$ newer code
export function buildInitialPrompt(session: any, isResume: boolean, compact = false): string {
  let contextBlock = "";

  if (session.requirementsDoc && session.requirementsDoc.trim().length > 0) {
    contextBlock = session.requirementsDoc;
  } else if (session.context && Object.keys(session.context).length > 0) {
    const ctx = session.context;
    let subsystemsStr = "";
    if (ctx.subsystems && typeof ctx.subsystems === "object") {
      const s = ctx.subsystems;
      const parts = [];
      if (Array.isArray(s.inputs) && s.inputs.length > 0) parts.push(`Inputs: [${s.inputs.join(", ")}]`);
      if (Array.isArray(s.outputs) && s.outputs.length > 0) parts.push(`Outputs: [${s.outputs.join(", ")}]`);
      if (Array.isArray(s.communication) && s.communication.length > 0) parts.push(`Communication: [${s.communication.join(", ")}]`);
      if (Array.isArray(s.storage) && s.storage.length > 0) parts.push(`Storage: [${s.storage.join(", ")}]`);
      if (Array.isArray(s.power) && s.power.length > 0) parts.push(`Power: [${s.power.join(", ")}]`);
      subsystemsStr = parts.join(" | ");
    }
    const constraints = Array.isArray(ctx.constraints) ? ctx.constraints.join(", ") : "";
    const connectivityStr = Array.isArray(ctx.connectivity) ? ctx.connectivity.join(", ") : (ctx.connectivity || "");
    
    contextBlock = `Project Context:
Core Purpose: ${ctx.corePurpose || ""}
Compute Brain: ${ctx.mcu || ""}
Subsystems: ${subsystemsStr}
Constraints: ${constraints}
Power Source: ${ctx.powerSource || ""}
Connectivity: ${connectivityStr}
Physical Form Factor: ${ctx.formFactor || ""}
Estimated Budget: ${ctx.estimatedBudget || ""}
Open Questions: ${Array.isArray(ctx.openQuestions) ? ctx.openQuestions.join(", ") : ""}`;
  } else {
    contextBlock = `Project Idea: ${session.idea || "No idea provided"}\n\nNote: Full requirements document was not generated. Please formulate based on the idea above.`;
  }

  // ??$$$ newer code - truncate the requirements doc once the BOM is saved to cut per-turn prompt tokens
  if (compact && session.bom && session.bom.length > 0 && contextBlock.length > 800) {
    contextBlock = `${contextBlock.slice(0, 600)}\n\n[Full requirements document truncated — the BOM has already been derived from it]`;
  }

  let blueprintBlock = "";
  if (session.blueprint && Object.keys(session.blueprint).length > 0) {
    blueprintBlock = compact
      ? `\n\n## SYSTEM BLUEPRINT: [Blueprint details loaded]`
      : `\n\n## SYSTEM BLUEPRINT (binding contract — you MUST satisfy this)\n${JSON.stringify(session.blueprint, null, 2)}\n\nRules: fill every "core" subsystem in the BOM. Choose an MCU that satisfies computeRequirements (pin count, peripherals, flash/RAM, voltage). Respect powerProfile. Use the simulation classes when generating the diagram.`;
  }

  const hasBOM = session.bom && session.bom.length > 0;
  let bomDetails = "";
  if (hasBOM) {
    bomDetails = compact
      ? `\n\n### Saved Bill of Materials (BOM):\n[BOM Saved: ${session.bom.length} items]`
      : `\n\n### Saved Bill of Materials (BOM):\n${JSON.stringify(session.bom.map((b: any) => ({
          key: b.key,
          partId: b.partId,
          mpn: b.mpn,
          displayName: b.displayName,
          purpose: b.purpose,
          qty: b.qty
        })), null, 2)}`;
  }

  const hasWiring = session.wiring && session.wiring.length > 0;
  let wiringDetails = "";
  if (hasWiring) {
    wiringDetails = compact
      ? `\n\n### Saved Wiring Connections:\n[Wiring Saved: ${session.wiring.length} connections]`
      : `\n\n### Saved Wiring Connections:\n${JSON.stringify(session.wiring.map((w: any) => ({
          from: w.from,
          to: w.to,
          net: w.net
        })), null, 2)}`;
  }

  const hasMilestones = session.milestones && session.milestones.length > 0;
  let milestoneDetails = "";
  if (hasMilestones) {
    milestoneDetails = compact
      ? `\n\n### Saved Milestones:\n[Milestones Saved: ${session.milestones.length} milestones]`
      : `\n\n### Saved Milestones:\n${JSON.stringify(session.milestones.map((m: any) => ({
          id: m.id,
          order: m.order,
          title: m.title,
          objective: m.objective,
          partsInvolved: m.partsInvolved,
          hasCode: !!(m.code && m.code.trim().length > 0)
        })), null, 2)}`;
  }

  const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;
  let diagramDetails = "";
  if (hasDiagram) {
    diagramDetails = `\n\n### Saved Simulation Diagram:\n[Diagram layout JSON has been successfully saved]`;
  }

  // ??$$$ newer code - enforce active phase task instructions
  const activePhase = determineActivePhase(session);
  let taskInstruction = "";
  if (activePhase === "bom") {
    taskInstruction = `
\n\n## CURRENT TASK: PHASE 1 (BOM SOURCING)
- Goal: Call 'select_compute' first to find the recommended MCU.
- Search for components in the library matching your blueprint subsystems using 'search_library' and 'get_part_details'.
- Validate component compatibility.
- Once ready, save the full BOM using 'save_progress(type="bom")'.
- Do NOT try to assign pin wiring, milestones, diagrams, or integrated code yet. Only focus on selecting and saving parts!`;
  } else if (activePhase === "wiring") {
    taskInstruction = `
\n\n## CURRENT TASK: PHASE 2 (WIRING DESIGN)
- Goal: Create the wiring netlist connecting components to the MCU pins.
- Call 'generate_wiring' to produce the pin connections map.
- Once ready, save the wiring layout using 'save_progress(type="wiring")'.
- Do NOT call 'generate_milestone', 'generate_diagram_json', or 'generate_final_sketch' yet.`;
  } else if (activePhase === "milestone") {
    taskInstruction = `
\n\n## CURRENT TASK: PHASE 3 (MILESTONE & CODE GENERATION)
- Goal: Generate the ordered list of build milestones, complete with firm verification code for each milestone.
- Call 'generate_milestone' to build code and test scripts for each stage.
- CRITICAL: Save each milestone IMMEDIATELY using 'save_progress(type="milestone", milestoneId="<id from the generate_milestone result>")' BEFORE generating the next one. The server resolves the full milestone (including its code) from milestoneId — do NOT re-send the code field.
- Do NOT generate diagram.json or final sketch yet.`;
  } else if (activePhase === "diagram") {
    taskInstruction = `
\n\n## CURRENT TASK: PHASE 4 (SIMULATION LAYOUT)
- Goal: Settle Wokwi part mapping and 2D diagram layout.
- Call 'get_wokwi_part_type' and 'generate_diagram_json' to produce the layout configuration.
- Once ready, save using 'save_progress(type="diagram")'.
- Do NOT call 'generate_final_sketch' yet.`;
  } else if (activePhase === "firmware") {
    taskInstruction = `
\n\n## CURRENT TASK: PHASE 5 (FINAL INTEGRATION)
- Goal: Integrate all milestone parts into the final complete Arduino Sketch.
- Call 'generate_final_sketch' to output the complete source code.`;
  }

  let prompt = `You are formulating a hardware project. The complete project requirements are below:\n\n${contextBlock}${blueprintBlock}${bomDetails}${wiringDetails}${milestoneDetails}${diagramDetails}${taskInstruction}`;

  if (isResume) {
    let resumeStr = "\n\nThis is a resumption of a previously interrupted formulation. Resume from where it stopped, calling the appropriate tool for the active task.";
    prompt += resumeStr;
  }

  return prompt;
}
