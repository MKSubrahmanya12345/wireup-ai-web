// file_churn.js
// Run from the project root:  node file_churn.js
// Collects every file Kiro needs and writes them into one bundle (churn_output.txt)
// Each file is wrapped with its full path so context is preserved.

const fs = require("fs");
const path = require("path");

// ---- exact list of files needed -------------------------------------------
const FILES = [
  // Entry / wiring
  "backend/src/index.ts",
  "frontend/src/App.tsx",
  "frontend/src/main.tsx",
  "backend/package.json",
  "frontend/package.json",

  // Routes
  "backend/src/routes/newflow.route.ts",
  "backend/src/routes/ideation.route.ts",
  "backend/src/routes/pipeline.route.ts",
  "backend/src/routes/project.routes.ts",
  "backend/src/routes/build.route.ts",

  // Controllers
  "backend/src/controllers/newflow.controller.ts",
  "backend/src/controllers/ideation.controller.ts",
  "backend/src/controllers/pipeline.controller.ts",
  "backend/src/controllers/project.controller.ts",

  // Agent 1 - discovery
  "backend/src/agents/discovery/discovery.agent.ts",
  "backend/src/agents/discovery/discovery.prompts.ts",
  "backend/src/agents/discovery/discovery.utils.ts",
  "backend/src/agents/discovery/index.ts",

  // Agent 2 - formulation + tools
  "backend/src/agents/formulation/formulation.agent.ts",
  "backend/src/agents/formulation/formulation.persistence.ts",
  "backend/src/agents/formulation/formulation.prompts.ts",
  "backend/src/agents/formulation/formulation.types.ts",
  "backend/src/agents/formulation/index.ts",
  "backend/src/agents/formulation/tools/index.ts",
  "backend/src/agents/formulation/tools/search.tool.ts",
  "backend/src/agents/formulation/tools/wiring.tool.ts",
  "backend/src/agents/formulation/tools/diagram.tool.ts",
  "backend/src/agents/formulation/tools/milestone.tool.ts",
  "backend/src/agents/formulation/tools/save.tool.ts",
  "backend/src/agents/formulation/tools/utils.ts",

  // Parallel services stack
  "backend/src/services/newflow.agent.ts",
  "backend/src/services/agent2tools.service.ts",
  "backend/src/services/agent2tools.declarations.ts",
  "backend/src/services/ai.services.ts",

  // Shared LLM layer
  "backend/src/agents/shared/adapters/index.ts",
  "backend/src/agents/shared/adapters.ts",
  "backend/src/agents/shared/keyRotation.service.ts",

  // Contracts
  "backend/src/contracts/agent.contracts.ts",
  "backend/src/contracts/project.contracts.ts",
  "backend/src/contracts/tool.contracts.ts",
  "backend/src/contracts/index.ts",

  // Models
  "backend/src/models/newFlowSession.model.ts",
  "backend/src/models/project.model.ts",

  // Frontend core loop
  "frontend/src/components/DiscoveryModal/DiscoveryModal.tsx",
  "frontend/src/components/DiscoveryModal/phases/DiscoveryPhase.tsx",
  "frontend/src/components/DiscoveryModal/phases/FormulationPhase.tsx",
  "frontend/src/components/DiscoveryModal/hooks/useDiscoverySession.ts",
  "frontend/src/components/DiscoveryModal/hooks/useFormulationSocket.ts",
  "frontend/src/components/DiscoveryModal/services/discoveryApi.ts",
  "frontend/src/components/DiscoveryModal/services/formulationApi.ts",
];

const OUTPUT = "churn_output.txt";
const SEP = "=".repeat(80);

const root = process.cwd();
let bundle = "";
const found = [];
const missing = [];

for (const rel of FILES) {
  const abs = path.join(root, rel);
  // normalize the path shown in the header to forward slashes
  const shown = rel.split(path.sep).join("/");

  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    const code = fs.readFileSync(abs, "utf8");
    bundle += `${SEP}\n`;
    bundle += `FILE: ${shown}\n`;
    bundle += `${SEP}\n`;
    bundle += code;
    if (!code.endsWith("\n")) bundle += "\n";
    bundle += "\n";
    found.push(shown);
  } else {
    bundle += `${SEP}\n`;
    bundle += `FILE: ${shown}\n`;
    bundle += `STATUS: !!! MISSING / NOT A FILE !!!\n`;
    bundle += `${SEP}\n\n`;
    missing.push(shown);
  }
}

// header summary at the very top
const header =
  `${SEP}\nWIREUP.AI CODE CHURN\n` +
  `Generated: ${new Date().toISOString()}\n` +
  `Found: ${found.length} / ${FILES.length}\n` +
  `Missing: ${missing.length}\n` +
  (missing.length ? `Missing files:\n${missing.map((m) => "  - " + m).join("\n")}\n` : "") +
  `${SEP}\n\n`;

fs.writeFileSync(OUTPUT, header + bundle, "utf8");

console.log(`Done. Wrote ${OUTPUT}`);
console.log(`Found ${found.length}/${FILES.length} files.`);
if (missing.length) {
  console.log(`Missing ${missing.length}:`);
  missing.forEach((m) => console.log("  - " + m));
}
