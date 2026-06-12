// ??$$$ newer code
import "dotenv/config";
import mongoose from "mongoose";
import Project from "../models/project.model";
import NewFlowSession from "../models/newFlowSession.model";
import { runAgent2 } from "../agents/formulation/formulation.agent";

const idea = `I want to build a portable ESP32-based MP3 player from scratch.

It should have:
* An OLED display that shows track information, playback status, volume, and progress.
* A MicroSD card for storing MP3 files.
* A 3.5mm headphone output.
* Physical buttons for controls.

The controls should include:
* Play/Pause
* Previous Track
* Next Track
* Volume Up
* Volume Down
* Rewind 10 Seconds
* Forward 10 Seconds`;

const requirementsDoc = `
# Portable ESP32-based MP3 Player PRD

## Subsystems
- **Compute**: ESP32 DevKit V1
- **Audio Output**: I2S DAC (MAX98357A or similar) -> 3.5mm Headphone Jack
- **Storage**: MicroSD Card Module (SPI interface) for MP3 files
- **Display**: OLED Display (SSD1306, I2C interface) for track info
- **User Input**: 7 Physical Buttons (Play/Pause, Prev, Next, Vol Up, Vol Down, Rewind, Forward)

## Core Functionality
- Plays MP3 files from the MicroSD card.
- Directs audio to the headphone jack via DAC.
- Shows playback status, volume level, and track progress on the OLED screen.
- Allows playback and volume control using the physical buttons.
`;

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup";
  console.log("⚡ Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB!");

  const uniqueId = new mongoose.Types.ObjectId();
  const sessionId = uniqueId.toString();

  console.log(`Creating test session ID: ${sessionId}`);

  // Create mock Project and Session
  const mockProject = new Project({
    _id: uniqueId,
    owner: new mongoose.Types.ObjectId(),
    name: "CLI Test ESP32 MP3 Player",
    description: idea,
    meta: {
      stage: "ideation",
      isAgentic: true
    },
    stageStatus: {
      ideation: "done",
      components: "ready",
      build: "locked",
      simulation: "locked",
      assembly: "locked",
      shopping: "locked"
    },
    ideation: {
      brief: requirementsDoc,
      objective: requirementsDoc,
      compute: "ESP32",
      readyForComponents: true,
      messages: []
    }
  });

  const mockSession = new NewFlowSession({
    _id: uniqueId,
    projectId: uniqueId,
    owner: mockProject.owner,
    idea,
    requirementsDoc,
    qaHistory: [],
    phase1Complete: true,
    phase2Complete: false,
    selectedModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    bom: [],
    wiring: [],
    milestones: [],
    agentLog: []
  });

  await mockProject.save();
  await mockSession.save();

  console.log("🚀 Starting Agent 2 Formulation Loop...");
  
  let retryCount = 0;
  const maxRetries = 6;
  let activeRun = false;

  const triggerAgent = async (resume = false) => {
    activeRun = true;
    try {
      console.log(`\n[Runner] Launching runAgent2 (resume: ${resume}, attempt: ${retryCount + 1}/${maxRetries})...`);
      await runAgent2(sessionId, "meta-llama/llama-4-scout-17b-16e-instruct", resume);
    } catch (e) {
      console.error("[Runner] runAgent2 execution threw exception:", e);
    } finally {
      activeRun = false;
    }
  };

  await triggerAgent(false);

  // Polling loop to display logs
  let seenLogCount = 0;
  let finished = false;
  let lastLogTime = Date.now();

  const interval = setInterval(async () => {
    const session = await NewFlowSession.findById(sessionId);
    if (!session) {
      console.log("Session not found (deleted?). Exiting.");
      clearInterval(interval);
      process.exit(1);
    }

    // Print new agent logs
    if (session.agentLog && session.agentLog.length > seenLogCount) {
      for (let i = seenLogCount; i < session.agentLog.length; i++) {
        const log = session.agentLog[i];
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        if (log.type === "thinking") {
          console.log(`\n[${timeStr}] 🤔 Thinking: ${log.text}`);
        } else if (log.type === "tool_call") {
          console.log(`[${timeStr}] 🛠️ Tool Call: ${log.name} (status: ${log.status})`);
          if (log.input) console.log(`    Input: ${JSON.stringify(log.input)}`);
          if (log.output) console.log(`    Output: ${JSON.stringify(log.output).substring(0, 160)}...`);
        } else if (log.type === "context_received") {
          console.log(`[${timeStr}] 📥 Context: ${log.text}`);
        } else if (log.type === "decision") {
          console.log(`[${timeStr}] 📢 Decision: ${log.text}`);
        } else if (log.type === "error") {
          console.error(`[${timeStr}] ❌ Error: ${log.text}`);
        }
      }
      seenLogCount = session.agentLog.length;
      lastLogTime = Date.now();
    }

    // Check if formulation finished
    const isCompleted = session.phase2Complete || 
      (session.bom && session.bom.length > 0 && 
       session.wiring && session.wiring.length > 0 && 
       session.milestones && session.milestones.length > 0 && 
       session.finalSketch);

    if (isCompleted && !finished) {
      finished = true;
      clearInterval(interval);
      console.log("\n==================================================");
      console.log("🎉 FORMULATION COMPLETED!");
      console.log("==================================================");
      console.log("BOM (Components):");
      session.bom.forEach((b: any) => console.log(` - [${b.key}] ${b.displayName} (${b.mpn || "generic"})`));
      
      console.log("\nWIRING NETLIST:");
      session.wiring.forEach((w: any) => console.log(` - ${w.from} -> ${w.to} (${w.net || "signal"})`));
      
      console.log("\nMILESTONES:");
      session.milestones.forEach((m: any) => {
        console.log(`\nMilestone ${m.order}: ${m.title}`);
        console.log(`  Objective: ${m.objective}`);
        if (m.code) {
          console.log(`  Code length: ${m.code.length} chars`);
        }
      });
      
      console.log("\nCleaning up DB records...");
      await Project.deleteOne({ _id: uniqueId });
      await NewFlowSession.deleteOne({ _id: uniqueId });
      console.log("Cleanup complete. Exiting!");
      mongoose.disconnect();
      process.exit(0);
    }

    // Auto-resume if the agent loop died and it's been idle for 10 seconds
    if (!isCompleted && !activeRun && (Date.now() - lastLogTime > 12000)) {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`\n[Runner] Detected agent idle/exit. Waiting 10 seconds for API rate limit reset...`);
        lastLogTime = Date.now() + 10000; // delay next check/resume by 10s to give rate limits a breather
        setTimeout(() => {
          triggerAgent(true);
        }, 10000);
      } else {
        console.error("\n❌ Maximum resume retries exceeded. Exiting in failure.");
        clearInterval(interval);
        mongoose.disconnect();
        process.exit(1);
      }
    }
  }, 2000);
}

main().catch(err => {
  console.error("Main execution failed:", err);
  process.exit(1);
});
