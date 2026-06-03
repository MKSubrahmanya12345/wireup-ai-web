// ??$$$ non-important
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import rotationService from "../src/services/keyRotation.service";
import { GROQ_AGENT2_TOOLS } from "../src/services/agent2tools.declarations";

async function run() {
  console.log("Initializing test...");
  const client = await rotationService.getClient();
  const modelName = "meta-llama/llama-4-scout-17b-16e-instruct";
  
  console.log("Model:", modelName);
  
  try {
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: "You are a hardware assistant. Search the library for 'Arduino Uno' first." },
        { role: "user", content: "Please formulate a project with Arduino Uno, 2 LEDs and a switch." }
      ],
      tools: GROQ_AGENT2_TOOLS as any,
      tool_choice: "auto",
      temperature: 0.2
    });

    console.log("=== Response ===");
    console.log("Content:", completion.choices[0].message.content);
    console.log("Tool calls:", JSON.stringify(completion.choices[0].message.tool_calls, null, 2));
  } catch (err: any) {
    console.error("Error during completion:", err);
  }
}

run().catch(console.error);
