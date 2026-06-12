// ??$$$
import { GROQ_AGENT2_TOOLS } from "../../../services/agent2tools.declarations";
import { LLMResponse, LLMAdapter } from "../../../contracts";

export class CerebrasAdapter implements LLMAdapter {
  private apiKey: string;
  private modelName: string;
  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

/* old code
  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + this.apiKey
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => {
            if (m.role === "function") {
              return {
                role: "tool",
                tool_call_id: m.tool_call_id || ("call_" + m.name),
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
                id: fc.id || ("call_" + fc.name),
                type: "function",
                function: {
                  name: fc.name,
                  arguments: JSON.stringify(fc.args)
                }
              }));
            }

            return msgObj;
          })
        ],
        tools: GROQ_AGENT2_TOOLS as any,
        tool_choice: "auto",
        temperature: 0.2
      })
    });
*/
  // ??$$$ newer code
  async chat(systemPrompt: string, messages: any[], activeToolNames?: string[]): Promise<LLMResponse> {
    const activeTools = activeToolNames
      ? GROQ_AGENT2_TOOLS.filter(t => activeToolNames.includes(t.function.name))
      : GROQ_AGENT2_TOOLS;

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + this.apiKey
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => {
            if (m.role === "function") {
              return {
                role: "tool",
                tool_call_id: m.tool_call_id || ("call_" + m.name),
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
                id: fc.id || ("call_" + fc.name),
                type: "function",
                function: {
                  name: fc.name,
                  arguments: JSON.stringify(fc.args)
                }
              }));
            }

            return msgObj;
          })
        ],
        tools: activeTools.length > 0 ? (activeTools as any) : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error("Cerebras API call failed: " + response.statusText + " - " + errText);
    }

    const data: any = await response.json();
    const choice = data.choices[0];
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
      }
    };
  }
}
