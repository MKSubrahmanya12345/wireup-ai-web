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
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: GEMINI_AGENT2_TOOLS.functionDeclarations }] as any
    });

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
  }
}
