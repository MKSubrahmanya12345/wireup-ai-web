// ??$$$

export const SYSTEM_PROMPT = `You are an autonomous hardware project formulation agent.

## Your Role
Your job is ONLY to orchestrate, plan, and call tools. You call tools to search parts, generate wiring, save progress, and plan milestones. You do NOT write code yourself.

## Tool Responsibilities  
- search_library, get_part_details, check_compatibility → find and validate parts
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
   - Search + select parts → save BOM
   - Generate wiring → save wiring
   - Generate ALL milestones via generate_milestone → save each milestone
   - Get Wokwi part types → generate diagram → save diagram
   - Generate final sketch via generate_final_sketch
6. Do NOT call generate_diagram_json until ALL milestones are saved.
7. Do NOT call generate_final_sketch more than once.
8. CRITICAL: When calling save_progress(type="bom"), the data must be a JSON array of components where each component is a flat object directly containing: key, partId (use the database _id string from get_part_details, NEVER the MPN string), mpn, displayName, purpose, subsystem, qty, price, interfaces, pinConnections. Do NOT wrap under a 'components' key.
9. CRITICAL: The MCU must always use the key 'mcu' everywhere — in the BOM, in generate_wiring, and in generate_diagram_json. Never use 'brain' as a key. The id field in diagram.parts must match the BOM key (which is 'mcu').
10. CRITICAL: The partId field in save_progress for the BOM must be the exact database _id string returned by get_part_details (e.g. '6a13ec800c47f410601cfea7'), not the MPN string.

## You are running on a small local model. Stay focused, use tools, don't ramble.`;

export function buildContextStr(session: any): string {
  const subsystems = Array.isArray(session.context?.subsystems) ? session.context.subsystems.join(", ") : "";
  const constraints = Array.isArray(session.context?.constraints) ? session.context.constraints.join(", ") : "";
  const qaHistory = Array.isArray(session.qaHistory)
    ? session.qaHistory.map((h: any) => `Q: ${h.question} -> A: ${h.answer}`).join(" | ")
    : "";

  return `Project Context:
Core Purpose: ${session.context?.corePurpose || ""}
Compute Brain: ${session.context?.mcu || ""}
Subsystems: ${subsystems}
Constraints: ${constraints}
Power Source: ${session.context?.powerSource || ""}
Connectivity: ${session.context?.connectivity || ""}
Open Questions Resolved: ${qaHistory}`;
}

export function buildInitialPrompt(session: any, isResume: boolean): string {
  const contextStr = buildContextStr(session);
  let initialPrompt = `Please formulate this project: \n${contextStr}`;

  if (isResume) {
    const hasBOM = session.bom && session.bom.length > 0;
    const hasWiring = session.wiring && session.wiring.length > 0;
    const hasMilestones = session.milestones && session.milestones.length > 0;
    const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;

    let resumeStr = "\n\nThis is a resumption of a previously interrupted formulation run. Here is the progress that was already saved:\n";
    if (hasBOM) {
      resumeStr += `- BOM has been saved with ${session.bom.length} items.\n`;
    } else {
      resumeStr += `- BOM is NOT saved yet.\n`;
    }
    if (hasWiring) {
      resumeStr += `- Wiring has been saved with ${session.wiring.length} connections.\n`;
    } else {
      resumeStr += `- Wiring is NOT saved yet.\n`;
    }
    if (hasMilestones) {
      resumeStr += `- Build milestones have been saved with ${session.milestones.length} milestones.\n`;
    } else {
      resumeStr += `- Build milestones are NOT saved yet.\n`;
    }
    if (hasDiagram) {
      resumeStr += `- Simulator diagram.json configuration has been saved.\n`;
    } else {
      resumeStr += `- Simulator diagram.json is NOT saved yet.\n`;
    }
    resumeStr += "\nPlease inspect the current status and resume formulation from where it stopped, calling the remaining tools to complete all pending parts.";
    initialPrompt += resumeStr;
  }

  return initialPrompt;
}
