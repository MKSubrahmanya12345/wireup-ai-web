// ??$$$ newer code - Shared LLM utility with TokenLB/Groq key rotation
import dotenv from "dotenv";
import { getOllamaModel } from "../agents/shared/adapters/ollama"; // ??$$$ newer code
dotenv.config();

// ??$$$ newer code - default model in all places must use groq llama 4 scout
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export const MODEL_MAP: Record<string, string> = {
  "WU Lite": "claude-haiku-4-5-20251001",
  "WU Pro":  "meta-llama/llama-4-scout-17b-16e-instruct",
  "WU Max":  "claude-opus-4-8",
};
export const DEFAULT_MODEL    = "WU Pro";
export const DEFAULT_MODEL_ID = MODEL_MAP[DEFAULT_MODEL];

function tokenLBKey():  string   { return process.env.TOKENLB_API_KEY?.trim()  ?? ""; }
function tokenLBBase(): string   { return (process.env.TOKENLB_BASE_URL ?? "https://api.tokenlab.sh/v1").replace(/\/$/, ""); }
function groqKeys():    string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_FALLBACK,
    process.env.GROQ_API_KEY_3,
  ].filter((k): k is string => Boolean(k?.trim()));
}

async function _tokenLB(
  messages:  Array<{ role: string; content: string }>,
  modelId:   string,
  maxTokens: number,
): Promise<string> {
  const key  = tokenLBKey();
  const base = tokenLBBase();
  if (!key) throw new Error("TOKENLB_API_KEY is not set in backend/.env");

  const res = await fetch(`${base}/chat/completions`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TokenLB ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

async function _groq(
  messages: Array<{ role: string; content: string }>,
  modelName = GROQ_MODEL,
  attempt = 0,
): Promise<string> {
  const keys = groqKeys();
  if (attempt >= keys.length) throw new Error("All Groq keys exhausted");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${keys[attempt]}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName, messages, max_tokens: 600, temperature: 0.7 }),
  });
  if (res.status === 429 || res.status === 503) return _groq(messages, modelName, attempt + 1);
  if (!res.ok) { const txt = await res.text(); throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`); }
  const json = await res.json() as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

// ??$$$ newer code - Ollama fallback helper
async function _ollama(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 600,
  specificModel?: string,
): Promise<string> {
  const modelName = specificModel || (await getOllamaModel()) || "qwen2.5:3b";
  console.log(`[llm] Calling Ollama model: ${modelName}`);
  const res = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ollama failed: ${txt.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

// ??$$$ newer code - Ollama stream helper
async function _streamOllama(
  messages: Array<{ role: string; content: string }>,
  modelName: string,
  onToken: (token: string, full: string) => void,
  onDone: (full: string, fallback?: string) => void,
  onError: (err: string) => void,
  maxTokens = 1024,
): Promise<void> {
  try {
    console.log(`[llm] Streaming from Ollama model: ${modelName}`);
    const res = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        model: modelName,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text();
      throw new Error(`Ollama stream failed ${res.status}: ${txt.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    let done = false;

    while (!done) {
      const { done: end, value } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") { done = true; break; }
        try {
          const chunk = JSON.parse(raw);
          const token = String(chunk?.choices?.[0]?.delta?.content ?? "");
          if (token) { full += token; onToken(token, full); }
          const finish = chunk?.choices?.[0]?.finish_reason;
          if (finish && finish !== "null" && finish !== null) done = true;
        } catch { /* skip malformed */ }
      }
    }

    onDone(full, "ollama");
  } catch (err: any) {
    onError(err.message || "Ollama stream error");
  }
}

export async function callLLM(
  messages:  Array<{ role: string; content: string }>,
  modelKey   = DEFAULT_MODEL,
  maxTokens  = 600,
): Promise<string> {
  // ??$$$ newer code - use modelKey directly if it doesn't match MODEL_MAP
  const modelId = MODEL_MAP[modelKey] ?? modelKey ?? DEFAULT_MODEL_ID;

  // ??$$$ newer code - direct routing for Ollama models
  if (modelId.startsWith("ollama/") || modelId.includes("ollama")) {
    const specificOllamaModel = modelId.replace("ollama/", "");
    try {
      return await _ollama(messages, maxTokens, specificOllamaModel);
    } catch (err: any) {
      console.error(`[llm] Specific Ollama model ${specificOllamaModel} failed: ${err.message}`);
      throw err;
    }
  }

  // ??$$$ newer code - default model uses groq llama 4 scout and fallbacks to ollama
  if (modelId === "meta-llama/llama-4-scout-17b-16e-instruct") {
    try {
      console.log(`[llm] Trying Groq with Llama 4 Scout...`);
      return await _groq(messages, "meta-llama/llama-4-scout-17b-16e-instruct");
    } catch (err: any) {
      console.warn(`[llm] Groq Llama 4 Scout failed: ${err.message}. Falling back to Ollama...`);
      try {
        return await _ollama(messages, maxTokens);
      } catch (ollamaErr: any) {
        console.error(`[llm] Ollama fallback failed: ${ollamaErr.message}`);
        throw new Error(`Groq Llama 4 Scout failed (${err.message}) and Ollama fallback failed (${ollamaErr.message}).`);
      }
    }
  }

  try {
    return await _tokenLB(messages, modelId, maxTokens);
  } catch (e1: any) {
    console.warn(`[llm] TokenLB(${modelId}) failed: ${String(e1?.message).slice(0, 80)}`);

    const gKeys = groqKeys();
    if (gKeys.length > 0) {
      try {
        console.warn("[llm] Falling back to Groq…");
        return await _groq(messages);
      } catch (e2: any) {
        console.warn(`[llm] Groq failed: ${String(e2?.message).slice(0, 80)}`);
      }
    }

    const liteId = MODEL_MAP["WU Lite"];
    if (liteId !== modelId) {
      try {
        console.warn(`[llm] Retrying TokenLB with ${liteId}…`);
        return await _tokenLB(messages, liteId, maxTokens);
      } catch (e3: any) {
        throw new Error(`All LLM providers failed. Last: ${String(e3?.message).slice(0, 120)}`);
      }
    }
    throw new Error(`LLM call failed: ${String(e1?.message).slice(0, 120)}`);
  }
}

export async function streamTokenLB(
  messages:  Array<{ role: string; content: string }>,
  modelId:   string,
  onToken:   (token: string, full: string) => void,
  onDone:    (full: string, fallback?: string) => void,
  onError:   (err: string) => void,
  maxTokens  = 1024,
): Promise<void> {
  // ??$$$ newer code - direct routing for Ollama models
  if (modelId.startsWith("ollama/") || modelId.includes("ollama")) {
    const specificOllamaModel = modelId.replace("ollama/", "");
    await _streamOllama(messages, specificOllamaModel, onToken, onDone, onError, maxTokens);
    return;
  }

  const key  = tokenLBKey();
  const base = tokenLBBase();

  if (!key) {
    onError("TOKENLB_API_KEY is not set in backend/.env — add it and restart the backend.");
    return;
  }

  let usedFallback: string | undefined;

  const tryStream = async (mId: string): Promise<void> => {
    const res = await fetch(`${base}/chat/completions`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept:         "text/event-stream",
      },
      body: JSON.stringify({
        model:       mId,
        messages,
        max_tokens:  maxTokens,
        temperature: 0.7,
        stream:      true,
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text();
      throw new Error(`TokenLB ${res.status}: ${txt.slice(0, 200)}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";
    let   full    = "";
    let   done    = false;

    while (!done) {
      const { done: end, value } = await reader.read();
      if (end) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") { done = true; break; }
        try {
          const chunk  = JSON.parse(raw);
          const token  = String(chunk?.choices?.[0]?.delta?.content ?? "");
          if (token) { full += token; onToken(token, full); }
          const finish = chunk?.choices?.[0]?.finish_reason;
          if (finish && finish !== "null" && finish !== null) done = true;
        } catch { /* skip malformed */ }
      }
    }

    if (full) onDone(full, usedFallback);
  };

  try {
    await tryStream(modelId);
    return;
  } catch (e1: any) {
    console.warn(`[llm] Stream TokenLB(${modelId}) failed: ${String(e1?.message).slice(0, 80)}`);

    const gKeys = groqKeys();
    if (gKeys.length > 0) {
      try {
        console.warn("[llm] Stream → Groq fallback…");
        const content = await _groq(messages);
        let full = "";
        for (const word of content.split(" ")) {
          const tok = (full ? " " : "") + word;
          full += tok;
          onToken(tok, full);
          await new Promise(r => setTimeout(r, 12));
        }
        onDone(full, "groq");
        return;
      } catch (e2: any) {
        console.warn(`[llm] Groq stream fallback failed: ${String(e2?.message).slice(0, 80)}`);
      }
    }

    // ??$$$ newer code - Ollama local fallback
    try {
      console.warn("[llm] Stream → Ollama fallback…");
      const content = await _ollama(messages, maxTokens);
      let full = "";
      for (const word of content.split(" ")) {
        const tok = (full ? " " : "") + word;
        full += tok;
        onToken(tok, full);
        await new Promise(r => setTimeout(r, 12));
      }
      onDone(full, "ollama");
      return;
    } catch (ollamaErr: any) {
      console.warn(`[llm] Ollama stream fallback failed: ${String(ollamaErr?.message).slice(0, 80)}`);
    }

    const liteId = MODEL_MAP["WU Lite"];
    if (liteId !== modelId) {
      try {
        console.warn(`[llm] Stream retry with ${liteId}…`);
        usedFallback = liteId;
        await tryStream(liteId);
        return;
      } catch { /* fall through */ }
    }

    onError(`All providers failed. Last: ${String(e1?.message).slice(0, 100)}`);
  }
}
