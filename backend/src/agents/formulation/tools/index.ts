// ??$$$
import { executeSearchLibrary, executeGetPartDetails, executeSearchDatasheet } from "./search.tool";
import { executeCheckCompatibility, executeValidatePinAssignment, executeEstimatePowerBudget, executeGenerateWiring } from "./wiring.tool";
import { executeGetWokwiPartType, executeCheckSimulationSupport, executeGenerateDiagramJson } from "./diagram.tool";
import { executeGenerateMilestone } from "./milestone.tool";
import { executeSaveProgress, executeGenerateFinalSketch } from "./save.tool";
// ??$$$ newer code
import { executeSelectCompute } from "./mcu.tool";

// ??$$$ newer code
import NewFlowSession from "../../../models/newFlowSession.model";
import { determineActivePhase } from "../formulation.persistence";

export async function executeTool(
  name: string,
  args: any,
  sessionId: string
 ): Promise<any> {
  // ??$$$ newer code - state machine order validation
  try {
    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      return { error: `Session ${sessionId} not found.` };
    }

    const hasBOM = Array.isArray(session.bom) && session.bom.length > 0;
    const hasWiring = Array.isArray(session.wiring) && session.wiring.length > 0;
    const hasMilestones = Array.isArray(session.milestones) && session.milestones.length > 0 && !session.milestones.some((m: any) => !m.code || m.code.trim().length === 0);
    const hasDiagram = session.diagram && Object.keys(session.diagram).length > 0;

    const wiringTools = ["generate_wiring", "validate_pin_assignment", "estimate_power_budget"];
    const milestoneTools = ["generate_milestone"];
    const diagramTools = ["get_wokwi_part_type", "check_simulation_support", "generate_diagram_json"];
    const firmwareTools = ["generate_final_sketch"];

    if (wiringTools.includes(name) && !hasBOM) {
      return {
        error: `State Machine Guard Violation: You are currently in the BOM Sourcing phase. You cannot call "${name}". Please generate and save the Bill of Materials (BOM) first.`
      };
    }
    if ((milestoneTools.includes(name) || diagramTools.includes(name)) && (!hasBOM || !hasWiring)) {
      return {
        error: `State Machine Guard Violation: You are currently in the Wiring Design phase. You cannot call "${name}". Please generate and save the wiring connections first.`
      };
    }
    if (firmwareTools.includes(name) && (!hasBOM || !hasWiring || !hasMilestones || !hasDiagram)) {
      return {
        error: `State Machine Guard Violation: You are currently in the Milestone/Layout phase. You cannot call "${name}". Please complete all prerequisites first.`
      };
    }
  } catch (err: any) {
    console.error(`[Agent2Tools Guard] Failed to check session guards:`, err);
  }
  switch (name) {
    case "search_library":
      return executeSearchLibrary(args);
    case "get_part_details":
      return executeGetPartDetails(args);
    case "check_compatibility":
      return executeCheckCompatibility(args);
    case "validate_pin_assignment":
      return executeValidatePinAssignment(args);
    case "search_datasheet":
      return executeSearchDatasheet(args);
    case "estimate_power_budget":
      return executeEstimatePowerBudget(args);
    case "get_wokwi_part_type":
      return executeGetWokwiPartType(args);
    case "check_simulation_support":
      return executeCheckSimulationSupport(args);
    case "generate_wiring":
      return executeGenerateWiring(args);
    case "generate_milestone":
      return executeGenerateMilestone(args, sessionId);
    case "generate_diagram_json":
      return executeGenerateDiagramJson(args);
    case "save_progress":
      return executeSaveProgress(args, sessionId);
    case "generate_final_sketch":
      return executeGenerateFinalSketch(args, sessionId);
    // ??$$$ newer code
    case "select_compute":
      return executeSelectCompute(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
