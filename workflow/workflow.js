
/*
Schema for progress.json state file:
{
  "task": string,                   // The overall goal description of the chained workflow run
  "steps": Array<{                   // Order of steps defined at startup
    "id": string,                    // Unique ID, e.g. "step_1"
    "name": string,                  // Name/Title of the step
    "status": "pending" | "running" | "completed",
    "result": string | null          // Response output contents from the API call
  }>,
  "current_step_index": number,      // 0-indexed index of the current active or next pending step
  "provider_index": number,          // 0-indexed index of the current provider (rotated automatically)
  "carry_over_context": object       // Optional metadata or structured key-value state carried over
}
*/

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables. First look in local folder, then fallback to backend folder
const localEnvPath = path.join(__dirname, ".env");
const backendEnvPath = path.join(__dirname, "..", "backend", ".env");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
  console.log(`[INFO] Loaded environment variables from local .env: ${localEnvPath}`);
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
  console.log(`[INFO] Loaded environment variables from backend .env fallback: ${backendEnvPath}`);
} else {
  console.warn("[WARNING] No .env file found in local directory or backend fallback. API keys must be set in environment.");
}

const STATE_FILE = path.join(__dirname, "progress.json");

// Define providers and their native fetch calling functions
const PROVIDERS = [
  {
    name: "Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    model: "gemini-2.5-flash",
    async call(prompt, apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Status ${response.status}: ${err}`);
      }
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  },
  {
    name: "Cerebras",
    apiKeyEnv: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
    async call(prompt, apiKey) {
      const url = "https://api.cerebras.ai/v1/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-oss-120b",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Status ${response.status}: ${err}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  },
  {
    name: "Groq",
    apiKeyEnv: "GROQ_API_KEY",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    async call(prompt, apiKey) {
      const url = "https://api.groq.com/openai/v1/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Status ${response.status}: ${err}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  }
];

// Helper to retrieve API key including support for multiple Groq key slots from backend
function getApiKey(provider) {
  if (provider.apiKeyEnv === "GROQ_API_KEY") {
    return process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3;
  }
  return process.env[provider.apiKeyEnv];
}

// Parse simple CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].substring(2);
      const val = args[i + 1];
      if (val && !val.startsWith("--")) {
        parsed[key] = val;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

// Initialize state
function getOrInitState(options) {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      console.log(`[INFO] Found existing state. Resuming workflow from step index ${data.current_step_index}...`);
      return data;
    } catch (e) {
      console.error("[ERROR] Failed to parse progress.json, reinitializing...", e);
    }
  }

  // Create new state
  const task = options.task || "Create a comprehensive layout and configuration plan for a smart home microcontroller system.";
  const stepList = (options.steps || "Research requirements,Component selection,Wiring planning,Final overview").split(",");
  
  const state = {
    task,
    steps: stepList.map((name, index) => ({
      id: `step_${index + 1}`,
      name: name.trim(),
      status: "pending",
      result: null
    })),
    current_step_index: 0,
    provider_index: 0,
    carry_over_context: {}
  };
  
  saveState(state);
  console.log(`[INFO] Initialized new workflow with ${state.steps.length} steps.`);
  return state;
}

// Save state to progress.json
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Run the main workflow loop
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
Usage:
  node workflow.js [options]

Options:
  --task "Overall goal of the workflow"
  --steps "Step1,Step2,Step3" (comma-separated list of step names)
  --help Shows this message
`);
    process.exit(0);
  }

  const state = getOrInitState(options);

  while (state.current_step_index < state.steps.length) {
    const currentStep = state.steps[state.current_step_index];
    console.log(`\n========================================`);
    console.log(`[RUNNING] Step ${state.current_step_index + 1}/${state.steps.length}: "${currentStep.name}"`);
    
    // Construct the context of previously completed steps
    const completedStepsContext = state.steps
      .slice(0, state.current_step_index)
      .map(s => `### Result of Step "${s.name}":\n${s.result}`)
      .join("\n\n");

    const prompt = `You are a chained workflow agent executing a multi-step task.
Overall Goal/Task: ${state.task}

Here are the results of the previous steps executed so far:
${completedStepsContext || "No steps completed yet."}

Current Step: "${currentStep.name}"
Instructions: Execute the actions required for this step. Build on the previous step results if applicable.
Please respond directly with the output for this step. Do not include introductory or concluding conversational text.`;

    let success = false;
    let attemptsThisStep = 0;

    while (!success && attemptsThisStep < PROVIDERS.length) {
      const provider = PROVIDERS[state.provider_index];
      const apiKey = getApiKey(provider);
      attemptsThisStep++;

      console.log(`[ATTEMPT] Trying provider ${provider.name} (${provider.model})...`);

      if (!apiKey) {
        console.warn(`[WARNING] Missing key for ${provider.name} (${provider.apiKeyEnv}). Rotating...`);
        state.provider_index = (state.provider_index + 1) % PROVIDERS.length;
        continue;
      }

      try {
        currentStep.status = "running";
        saveState(state);

        const responseText = await provider.call(prompt, apiKey);
        
        // Save success state
        currentStep.result = responseText.trim();
        currentStep.status = "completed";
        
        console.log(`[SUCCESS] Step "${currentStep.name}" completed via ${provider.name}.`);
        console.log(`----------------------------------------`);
        console.log(currentStep.result.substring(0, 150) + "...\n----------------------------------------");

        // Advance to next step and rotate provider index for next step
        state.current_step_index++;
        state.provider_index = (state.provider_index + 1) % PROVIDERS.length;
        saveState(state);
        
        success = true;
      } catch (err) {
        console.error(`[ERROR] Attempt failed on ${provider.name} with error: ${err.message}`);
        // Rotate to next provider
        state.provider_index = (state.provider_index + 1) % PROVIDERS.length;
        saveState(state);
        console.log(`[ROTATE] Fallback to next provider...`);
      }
    }

    if (!success) {
      console.error(`\n[FATAL] All available providers failed on Step "${currentStep.name}". Workflow paused.`);
      process.exit(1);
    }
  }

  console.log(`\n========================================`);
  console.log(`[COMPLETE] Workflow finished successfully!`);
  
  // Write final combined output
  const finalSummaryFile = path.join(__dirname, "final_output.txt");
  const summaryContent = `Workflow Goal: ${state.task}\n\n` + state.steps
    .map(s => `## Step: ${s.name}\n\n${s.result}`)
    .join("\n\n");
  fs.writeFileSync(finalSummaryFile, summaryContent, "utf-8");
  console.log(`[INFO] Final combined output written to: ${finalSummaryFile}`);
}

main().catch(err => {
  console.error("[FATAL ERROR] Uncaught exception in main loop:", err);
  process.exit(1);
});
