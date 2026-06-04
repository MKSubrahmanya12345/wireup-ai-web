// ??$$$
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "../../../services/keyRotation.service";
import NewFlowSession from "../../../models/newFlowSession.model";
import { parseIfString, retryWithBackoff } from "./utils";

export async function executeGenerateMilestone(args: any, sessionId?: string) {
  const title = args.title;
  const objective = args.objective;
  const subsystem = args.subsystem;
  const mcu = args.mcu;
  const isFirstMilestone = args.isFirstMilestone;
  const partsInvolved = parseIfString(args.partsInvolved);
  const wiringSubset = parseIfString(args.wiringSubset);
  const previousMilestones = parseIfString(args.previousMilestones);

  if (sessionId) {
    try {
      const session = await NewFlowSession.findById(sessionId);
      if (session && session.milestones) {
        const order = typeof args.order === "number" ? args.order : (previousMilestones?.length ?? 0) + 1;
        const existing = session.milestones.find((m: any) => {
          if (m.title === title) return true;
          if (m.order === order) {
            if (order === 1) {
              return m.title.toLowerCase().trim() === title.toLowerCase().trim();
            }
            return true;
          }
          return false;
        });

        if (existing && existing.code && existing.code.trim().length > 0) {
          console.log(`[Agent2] Milestone '${title}' or order ${order} already exists with code. Returning cached milestone.`);
          return {
            code: existing.code,
            explanation: existing.explanation,
            expectedOutput: existing.expectedOutput,
            passCondition: existing.passCondition,
            commonProblems: existing.commonProblems || [],
            simulatable: existing.simulatable,
            requiredLibraries: existing.requiredLibraries || []
          };
        }
      }
    } catch (e) {
      console.error("[Agent2] Failed to check for existing milestone:", e);
    }
  }

  try {
    let modelName = "llama-3.3-70b-versatile";
    if (sessionId) {
      try {
        const session = await NewFlowSession.findById(sessionId);
        if (session && session.selectedModel) {
          modelName = session.selectedModel;
        }
      } catch (e) {
        console.error("[Agent2] Failed to read session model for milestone:", e);
      }
    }

    const wiringText = JSON.stringify(wiringSubset, null, 2);
    const prevText = previousMilestones ? previousMilestones.join(", ") : "None";

    const systemPrompt = "Return ONLY valid JSON. No markdown. No prose. No <think>. Keep compile errors out.";
    const userPrompt = `You are writing firmware for a hardware project milestone.
  
  MCU: ${mcu}
  Milestone: ${title}
  Objective: ${objective}
  Parts involved: ${partsInvolved.join(", ")}
  Wiring for this milestone: ${wiringText}
  Previous milestones completed: ${prevText}
  Is first milestone: ${isFirstMilestone || false}
  
  Rules:
  - Write complete, compilable Arduino code
  - Include only what is needed for THIS milestone
  - If isFirstMilestone: focus on verifying basic MCU and serial communication functionality, utilizing an onboard LED or serial prints suitable for the parts involved, using no external libraries
  - Use exact pin numbers from the wiring subset provided
  - Use exact I2C addresses and register values (not guesses)
  - Add clear comments explaining each section
  - Code must work standalone without previous milestone code
  
  Return ONLY valid JSON, no markdown:
  {
    "code": "full .ino code here",
    "explanation": "why this step matters, what we learn from it",
    "expectedOutput": "exact serial monitor output on success",
    "passCondition": "plain english: what success looks like",
    "commonProblems": ["problem 1 and fix", "problem 2 and fix"],
    "simulatable": true,
    "requiredLibraries": [
      {
        "name": "Wire",
        "type": "core",
        "version": null,
        "installCommand": null
      }
    ]
  }`;

    let raw = "";

    const useGemini = modelName.toLowerCase().includes("gemini");
    const useDeepSeek = modelName.toLowerCase().includes("deepseek");
    const useOllama = modelName.toLowerCase().includes("ollama");
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (useGemini && geminiApiKey) {
      console.log("[Agent2Tools] Generating milestone using Gemini directly...");
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      });
      const result = await retryWithBackoff(() => geminiModel.generateContent(userPrompt));
      raw = result.response.text().trim();
    } else if (useDeepSeek) {
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) throw new Error("DEEPSEEK_API_KEY is missing in env");
      console.log("[Agent2Tools] Generating milestone using DeepSeek directly...");
      const data: any = await retryWithBackoff(async () => {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${deepseekApiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API call failed: ${response.statusText} - ${errText}`);
        }
        return response.json();
      });
      raw = data.choices[0]?.message?.content?.trim() || "";
    } else if (useOllama) {
      const modelTag = modelName.split("/")[1] || "qwen2.5:3b";
      console.log(`[Agent2Tools] Generating milestone locally using Ollama (${modelTag})...`);
      const data: any = await retryWithBackoff(async () => {
        const response = await fetch("http://localhost:11434/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: modelTag,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            options: {
              num_ctx: 8192
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama API call failed: ${response.statusText} - ${errText}`);
        }
        return response.json();
      });
      raw = data.choices[0]?.message?.content?.trim() || "";
    } else {
      try {
        console.log(`[Agent2Tools] Generating milestone using Groq (${modelName})...`);
        const groq = await rotationService.getClient();
        const completion = await retryWithBackoff(() => groq.chat.completions.create({
          model: modelName.toLowerCase().includes("qwen") ? "qwen/qwen3-32b" : "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        }));
        raw = completion.choices[0]?.message?.content?.trim() || "";
      } catch (err: any) {
        console.warn("[Agent2Tools] Groq milestone generation failed. Trying Gemini fallback...", err.message || err);
        if (geminiApiKey) {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
          });
          const result = await retryWithBackoff(() => geminiModel.generateContent(userPrompt));
          raw = result.response.text().trim();
        } else {
          throw err;
        }
      }
    }

    const clean = raw
      .replace(/```json|```/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, (c) => {
        const escapes: Record<string, string> = {
          '\n': '\\n', '\r': '\\r', '\t': '\\t'
        };
        return escapes[c] ?? '';
      })
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.warn("[Agent2Tools] JSON.parse failed, attempting manual extraction/fallback", e);
      const codeMatch = raw.match(/"code"\s*:\s*"([\s\S]*?)(?<!\\)",/);
      if (codeMatch) {
        const fixedRaw = raw.replace(codeMatch[0], 
          `"code": ${JSON.stringify(codeMatch[1])},`
        );
        parsed = JSON.parse(fixedRaw.replace(/```json|```/g, '').trim());
      } else {
        throw e;
      }
    }

    const order = typeof args.order === "number" ? args.order : (previousMilestones?.length ?? 0) + 1;

    return {
      id: `milestone_${Math.floor(Math.random() * 1000)}`,
      order,
      title,
      objective,
      subsystem,
      partsInvolved,
      wiringInstructions: wiringSubset.map((w: any) => `${w.from} -> ${w.to} (${w.net})`).join(", "),
      ...parsed
    };
  } catch (err: any) {
    console.error("executeGenerateMilestone failed:", err);
    return {
      id: `milestone_fallback`,
      order: 1,
      title,
      objective,
      subsystem,
      partsInvolved,
      wiringInstructions: "mcu.GPIO13 -> led.A",
      code: "void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}",
      explanation: "Fallback milestone created.",
      expectedOutput: "Blinking LED",
      passCondition: "LED blinks every second",
      commonProblems: ["Wrong pins assigned"],
      simulatable: true,
      requiredLibraries: []
    };
  }
}
