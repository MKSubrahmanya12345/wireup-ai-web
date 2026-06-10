// ??$$$
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_AGENT2_TOOLS } from "../../../services/agent2tools.declarations";
import { LLMResponse, LLMAdapter } from "../../../contracts";

export class GeminiAdapter implements LLMAdapter {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
    const keys = Array.from(new Set([
      this.apiKey,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY
    ].filter(Boolean) as string[]));

    const contents = messages.map(m => {
      if (m.role === "function") {
        return {
          role: "function",
          parts: [{
            functionResponse: {
              name: m.name,
              response: m.content
            }
          }]
        };
      }

      const role = m.role === "assistant" || m.role === "model" ? "model" : "user";
      const parts: any[] = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (m.functionCalls) {
        m.functionCalls.forEach((fc: any) => {
          parts.push({
            functionCall: {
              name: fc.name,
              args: fc.args
            }
          });
        });
      }
      return { role, parts };
    });

    let lastError: any = null;
    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[i];
      try {
        const genAI = new GoogleGenerativeAI(activeKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: GEMINI_AGENT2_TOOLS.functionDeclarations }] as any
        });

        const result = await model.generateContent({ contents });
        const response = result.response;

        return {
          text: () => response.text() || "",
          functionCalls: () => {
            const calls = response.functionCalls();
            if (!calls) return [];
            return calls.map(c => ({
              name: c.name,
              args: c.args
            }));
          }
        };
      } catch (err: any) {
        console.warn(`[GeminiAdapter] Attempt ${i + 1} with key prefix ${activeKey.substring(0, 6)} failed:`, err.message || err);
        lastError = err;
      }
    }

    throw lastError || new Error("GeminiAdapter: All API keys exhausted");
  }
}
