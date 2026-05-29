import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import rotationService from "../src/services/keyRotation.service";
import { GROQ_AGENT2_TOOLS } from "../src/services/agent2tools.declarations";

async function run() {
  const client = await rotationService.getClient();
  const modelName = "meta-llama/llama-4-scout-17b-16e-instruct";

  const systemPrompt = `You are an autonomous hardware engineering agent working on formulating a project.
Your task is to take the finalized project context and produce:
1. A finalized Bill of Materials (BOM) using components from the library.
2. Electrical wiring connections between these components.
3. A step-by-step milestone curriculum to build the project.
4. A simulator diagram.json config.

You have access to a set of tools to search, analyze, and build.
Work step by step:
1. Search the library to find the best components for the compute and subsystems specified in the project context.
2. Get details and check compatibility for candidates.
3. Once components are finalized, save the BOM using save_progress(type="bom").
4. Generate the wiring connections using generate_wiring and validate them.
5. Save wiring using save_progress(type="wiring").
6. Generate the build milestones one by one using generate_milestone. Milestone 1 must be a bare MCU blink.
7. Save milestones using save_progress(type="milestone").
8. Generate the simulation diagram.json using generate_diagram_json.
9. Save diagram using save_progress(type="diagram").

Follow these guidelines:
- CRITICAL: When calling save_progress(type="bom"), the data must be a JSON array of components where each component is a flat object directly containing: key, partId (use the database _id string from get_part_details, NEVER the MPN string), mpn, displayName, purpose, subsystem, qty, price, interfaces, pinConnections. Do NOT wrap under a 'components' key.
- CRITICAL: The MCU must always use the key 'mcu' everywhere — in the BOM, in generate_wiring, and in generate_diagram_json. Never use 'brain' as a key. The id field in diagram.parts must match the BOM key (which is 'mcu').
- CRITICAL: Call generate_milestone exactly once per milestone. Do not call it twice. Check the session first to see if a milestone with the same order, title, or subsystem already exists.
- CRITICAL: The partId field in save_progress for the BOM must be the exact database _id string returned by get_part_details (e.g. '6a13ec800c47f410601cfea7'), not the MPN string.
- MCU pin layout and wiring must be compatible.
- All milestones must be step-by-step.
- You must call save_progress at each step to persist data and update the frontend UI.
- When done, state that formulation is complete.`;

  const contextStr = `Project Context:
Core Purpose: LED pattern sequence controlled by switch press to cycle through different patterns
Compute Brain: Arduino Uno
Subsystems: 5 LEDs, 1 momentary switch, pattern sequencing logic
Constraints: USB 5V power only, No wireless connectivity required
Power Source: USB 5V
Connectivity: None
Open Questions Resolved: `;

  const messages = [
    {
      role: "user",
      content: `Please formulate this project: \n${contextStr}`
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_uno",
          type: "function",
          function: {
            name: "search_library",
            arguments: JSON.stringify({ query: "Arduino Uno", limit: 1 })
          }
        }
      ]
    },
    {
      role: "tool",
      tool_call_id: "call_uno",
      name: "search_library",
      content: JSON.stringify({
        results: [{
          partId: "6a13ec800c47f410601cfea0",
          mpn: "ARDUINO-UNO-R3",
          name: "Arduino Uno R3",
          manufacturer: "Arduino",
          description: "Microcontroller board based on the ATmega328P",
          interfaces: ["GPIO", "ADC", "UART", "I2C", "SPI"],
          specs: { "Operating Voltage": "5V" },
          price: 15,
          wokwiPartType: "wokwi-arduino-uno",
          inLocalLibrary: true
        }]
      })
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_led",
          type: "function",
          function: {
            name: "search_library",
            arguments: JSON.stringify({ query: "5mm LED", limit: 5 })
          }
        }
      ]
    },
    {
      role: "tool",
      tool_call_id: "call_led",
      name: "search_library",
      content: JSON.stringify({
        results: [{
          partId: "6a13ec800c47f410601cfea1",
          mpn: "LED-5MM-RED",
          name: "Red LED 5mm",
          manufacturer: "Generic",
          description: "Standard 5mm diffused red light emitting diode",
          interfaces: [],
          specs: { "Forward Voltage": "2.0V" },
          price: 0.1,
          wokwiPartType: "wokwi-led",
          inLocalLibrary: true
        }]
      })
    },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_switch",
          type: "function",
          function: {
            name: "search_library",
            arguments: JSON.stringify({ query: "momentary switch", limit: 1 })
          }
        }
      ]
    },
    {
      role: "tool",
      tool_call_id: "call_switch",
      name: "search_library",
      content: JSON.stringify({
        results: [{
          partId: "6a13ec800c47f410601cfea2",
          mpn: "TACTILE-SWITCH-6MM",
          name: "Push Button Tactile Switch 6mm",
          manufacturer: "Generic",
          description: "Miniature momentary tactile push button switch",
          interfaces: [],
          specs: { "Contact Type": "Momentary" },
          price: 0.2,
          wokwiPartType: "wokwi-pushbutton",
          inLocalLibrary: true
        }]
      })
    }
  ];

  try {
    console.log("Calling Groq completion...");
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ] as any,
      tools: GROQ_AGENT2_TOOLS as any,
      tool_choice: "auto",
      temperature: 0.2
    });

    console.log("=== Response ===");
    console.log("Finish Reason:", completion.choices[0].finish_reason);
    console.log("Content:", completion.choices[0].message.content);
    console.log("Tool calls:", JSON.stringify(completion.choices[0].message.tool_calls, null, 2));
  } catch (err: any) {
    console.error("Error:", err);
  }
}

run().catch(console.error);
