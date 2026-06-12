// ??$$$
import Groq from "groq-sdk";
import { ARCHITECT_SYSTEM_PROMPT, buildArchitectPrompt } from "./architect.prompts";
import { safeParse } from "../shared/jsonRepair";

export async function runArchitect(requirementsDoc: string): Promise<any> {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error("No Groq API keys for Architect.");
  }

  let lastError: any = null;
  for (const apiKey of keys) {
    try {
      const client = new Groq({ apiKey });
      const completion = await client.chat.completions.create({
        model: "qwen/qwen3-32b",
        messages: [
          { role: "system", content: ARCHITECT_SYSTEM_PROMPT },
          { role: "user", content: buildArchitectPrompt(requirementsDoc) }
        ],
        temperature: 0.3
      });

      const text = completion.choices[0]?.message?.content?.trim() || "";
      console.log("[runArchitect] RAW text output:\n", text);
      // ??$$$ newer code
      return safeParse(text);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Architect failed: ${lastError?.message || lastError}`);
}
