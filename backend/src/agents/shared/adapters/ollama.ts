// ??$$$
import { GROQ_AGENT2_TOOLS } from "../../../services/agent2tools.declarations";
import { LLMResponse, LLMAdapter } from "../../../contracts";

export class OllamaAdapter implements LLMAdapter {
  private model: string;
  private baseUrl: string;

  constructor(model = "qwen2.5:3b", baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

/* old code
  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
    const tools = GROQ_AGENT2_TOOLS;
    const ollamaMessages = [
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
    ];


    // ??$$$ newer code - Over-optimized Ollama parameters for prompt caching, token reduction, and active memory retention
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
*/
  // ??$$$ newer code
  async chat(systemPrompt: string, messages: any[], activeToolNames?: string[]): Promise<LLMResponse> {
    const activeTools = activeToolNames
      ? GROQ_AGENT2_TOOLS.filter(t => activeToolNames.includes(t.function.name))
      : GROQ_AGENT2_TOOLS;

    const ollamaMessages = [
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
    ];

    // ??$$$ newer code - Over-optimized Ollama parameters for prompt caching, token reduction, and active memory retention
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        temperature: 0.2,
        keep_alive: "24h", // Keeps model in memory for 24 hours to eliminate load/unload delay
        options: {
          num_ctx: 8192, // Sufficient context window
          num_predict: 2048, // Prevent run-away generation loops
          mirostat: 0, // Disable mirostat to speed up token generation
          repeat_penalty: 1.1, // Control repetition penalty
          top_p: 0.9 // Restrict candidate pool slightly to improve coherence
        }
      })
    });


    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama failed: ${response.statusText} - ${errText}`);
    }

    const data: any = await response.json();
    const message = data.choices[0]?.message;

    return {
      text: () => message?.content || "",
      functionCalls: () => {
        if (!message?.tool_calls) return [];
        return message.tool_calls.map((tc: any) => {
          let parsedArgs = {};
          try {
            parsedArgs = typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
          } catch (e) {
            console.error("Failed to parse Ollama tool call args:", tc.function.arguments);
          }
          return {
            id: tc.id,
            name: tc.function.name,
            args: parsedArgs
          };
        });
      },
      // ??$$$ newer code - Ollama token usage statistics
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0
      } : undefined
    };
  }
}

export async function checkOllama(baseUrl = "http://localhost:11434"): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModel(baseUrl = "http://localhost:11434"): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.models && data.models.length > 0) {
      const preferred = ["qwen2.5:3b", "qwen2.5:7b", "llama3.2:3b", "mistral:7b"];
      for (const pref of preferred) {
        if (data.models.some((m: any) => m.name.toLowerCase().includes(pref))) {
          return pref;
        }
      }
      return data.models[0].name;
    }
    return "qwen2.5:3b";
  } catch {
    return null;
  }
}
