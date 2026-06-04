// ??$$$ group 2 - Ideation Stage (Phase 1)
import { GoogleGenerativeAI } from "@google/generative-ai";
import rotationService from "./keyRotation.service";
import { GEMINI_AGENT2_TOOLS, GROQ_AGENT2_TOOLS } from "../../services/agent2tools.declarations";

export interface LLMResponse {
  text(): string;
  functionCalls(): { name: string; args: any }[];
}

export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[]): Promise<LLMResponse>;
}

// Gemini Adapter implementation
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

// Groq Adapter implementation
export class GroqAdapter implements LLMAdapter {
  private modelName: string;
  private directApiKey?: string;
  constructor(modelName: string, directApiKey?: string) {
    this.modelName = modelName;
    this.directApiKey = directApiKey;
  }

  async chat(systemPrompt: string, messages: any[]): Promise<LLMResponse> {
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

    const completion = await client.chat.completions.create({
      model: this.modelName,
      messages: groqMessages as any,
      tools: GROQ_AGENT2_TOOLS as any,
      tool_choice: "auto",
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
      }
    };
  }
}

// Cerebras Adapter implementation
export class CerebrasAdapter implements LLMAdapter {
  private apiKey: string;
  private modelName: string;
  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

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

// Ollama Adapter implementation for local orchestration
export class OllamaAdapter implements LLMAdapter {
  private model: string;
  private baseUrl: string;

  constructor(model = "qwen2.5:3b", baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

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

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        temperature: 0.2,
        options: { num_ctx: 8192 }
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
      }
    };
  }
}

// Check if local Ollama is active
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

// Get the first preferred model pulled in Ollama
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
