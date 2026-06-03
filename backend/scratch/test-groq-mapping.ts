// ??$$$ non-important
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import rotationService from "../src/services/keyRotation.service";
import { GROQ_AGENT2_TOOLS } from "../src/services/agent2tools.declarations";

async function run() {
  const client = await rotationService.getClient();
  const modelName = "meta-llama/llama-4-scout-17b-16e-instruct";

  const systemPrompt = "You are a hardware assistant. You must call get_part_details next.";

  const contextStr = "Arduino Uno, LEDs, Switch";

  const messages = [
    {
      role: "user",
      content: `Please formulate this project: \n${contextStr}`
    },
    {
      role: "assistant",
      content: "",
      functionCalls: [
        {
          id: "call_uno",
          name: "search_library",
          args: { query: "Arduino Uno", limit: 1 }
        }
      ]
    },
    {
      role: "function",
      name: "search_library",
      tool_call_id: "call_uno",
      content: JSON.stringify({
        results: [{
          partId: "6a13ec800c47f410601cfea0",
          mpn: "ARDUINO-UNO-R3",
          name: "Arduino Uno R3",
          price: 15,
          wokwiPartType: "wokwi-arduino-uno",
          inLocalLibrary: true
        }]
      })
    }
  ];

  // Map messages into Groq format exactly as in GroqAdapter
  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => {
      if (m.role === "function") {
        return {
          role: "tool",
          tool_call_id: m.tool_call_id || `call_${m.name}`,
          name: m.name,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
        };
      }

      const role = m.role === "model" || m.role === "assistant" ? "assistant" : "user";
      const msgObj: any = {
        role,
        content: m.content || ""
      };

      if (m.functionCalls && m.functionCalls.length > 0) {
        msgObj.tool_calls = m.functionCalls.map((fc: any) => ({
          id: fc.id || `call_${fc.name}`,
          type: "function",
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args)
          }
        }));
      }

      return msgObj;
    })
  ];

  console.log("Mapped messages:", JSON.stringify(groqMessages, null, 2));

  try {
    console.log("Calling Groq completion...");
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: groqMessages as any,
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
