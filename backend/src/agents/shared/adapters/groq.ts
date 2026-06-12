// ??$$$
import rotationService from "../keyRotation.service";
import { GROQ_AGENT2_TOOLS } from "../../../services/agent2tools.declarations";
import { LLMResponse, LLMAdapter } from "../../../contracts";

export class GroqAdapter implements LLMAdapter {
  private modelName: string;
  private directApiKey?: string;
  constructor(modelName: string, directApiKey?: string) {
    this.modelName = modelName;
    this.directApiKey = directApiKey;
  }

/* old code
  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
*/
  // ??$$$ newer code
  async chat(systemPrompt: string, messages: any[], activeToolNames?: string[]): Promise<LLMResponse> {
    let client: any;
    if (this.directApiKey) {
      const Groq = require("groq-sdk");
      client = new Groq.default({ apiKey: this.directApiKey });
    } else {
      client = await rotationService.getClient();
    }

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

    // ??$$$ newer code
    const activeTools = activeToolNames
      ? GROQ_AGENT2_TOOLS.filter(t => activeToolNames.includes(t.function.name))
      : GROQ_AGENT2_TOOLS;

    /* old code
    const completion = await client.chat.completions.create({
      model: this.modelName,
      messages: groqMessages as any,
      tools: GROQ_AGENT2_TOOLS as any,
      tool_choice: "auto",
      temperature: 0.2
    });
    */
    // ??$$$ newer code
    const completion = await client.chat.completions.create({
      model: this.modelName,
      messages: groqMessages as any,
      tools: activeTools.length > 0 ? (activeTools as any) : undefined,
      tool_choice: activeTools.length > 0 ? "auto" : undefined,
      temperature: 0.2
    });

    const choice = completion.choices[0];
    const message = choice.message;

    return {
      text: () => message.content || "",
      functionCalls: () => {
        if (!message.tool_calls) return [];
        return message.tool_calls.map((tc: any) => {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch (e) {
            console.error("Failed to parse tool call args:", tc.function.arguments);
          }
          return {
            id: tc.id,
            name: tc.function.name,
            args: parsedArgs
          };
        });
      },
      // ??$$$ newer code - Groq token usage statistics
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens || 0,
        completionTokens: completion.usage.completion_tokens || 0,
        totalTokens: completion.usage.total_tokens || 0
      } : undefined
    };
  }
}
