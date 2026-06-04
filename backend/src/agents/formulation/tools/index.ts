// ??$$$
import { executeSearchLibrary, executeGetPartDetails, executeSearchDatasheet } from "./search.tool";
import { executeCheckCompatibility, executeValidatePinAssignment, executeEstimatePowerBudget, executeGenerateWiring } from "./wiring.tool";
import { executeGetWokwiPartType, executeCheckSimulationSupport, executeGenerateDiagramJson } from "./diagram.tool";
import { executeGenerateMilestone } from "./milestone.tool";
import { executeSaveProgress, executeGenerateFinalSketch } from "./save.tool";

export async function executeTool(
  name: string,
  args: any,
  sessionId: string
 ): Promise<any> {
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
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
