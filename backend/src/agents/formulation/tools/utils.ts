// ??$$$
import {
  LLMAdapter,
  GeminiAdapter,
  GroqAdapter,
  CerebrasAdapter,
  OllamaAdapter,
  getOllamaModel
} from "../../shared/adapters";

export const providerCooldowns = new Map<string, number>();

// ??$$$ newer code - server-side cache of fully generated milestones.
// generate_milestone returns only a compact reference to the LLM; save_progress(type="milestone", milestoneId)
// resolves the full milestone (including code) from this cache, eliminating the costly code echo round-trip.
const milestoneCache = new Map<string, Map<string, any>>();

export function cacheMilestone(sessionId: string, milestone: any) {
  if (!sessionId || !milestone?.id) return;
  if (!milestoneCache.has(sessionId)) {
    milestoneCache.set(sessionId, new Map());
  }
  milestoneCache.get(sessionId)!.set(String(milestone.id), milestone);
}

export function getCachedMilestone(sessionId: string, milestoneId: string): any | undefined {
  return milestoneCache.get(sessionId)?.get(String(milestoneId));
}

export function parseIfString(val: any): any {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch (e) {
      console.error("[Agent2Tools Debugger] Failed to parse stringified parameter:", val, e);
    }
  }
  return val;
}

export function parseRateLimitMessage(msg: string): number {
  msg = String(msg).toLowerCase();
  const hMatch = msg.match(/try again in (\d+)\s*h/);
  const mMatch = msg.match(/try again in (\d+)\s*m/);
  const sMatch = msg.match(/try again in (\d+)\s*s/);
  let totalSeconds = 0;
  if (hMatch) totalSeconds += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) totalSeconds += parseInt(mMatch[1], 10) * 60;
  if (sMatch) totalSeconds += parseInt(sMatch[1], 10);
  if (totalSeconds > 0) return totalSeconds;

  const compoundMatch = msg.match(/try again in (?:(\d+)m)?(?:([\d\.]+)s)?/);
  if (compoundMatch) {
    const m = compoundMatch[1] ? parseInt(compoundMatch[1], 10) : 0;
    const s = compoundMatch[2] ? parseFloat(compoundMatch[2]) : 0;
    return m * 60 + s;
  }
  return 0;
}

export function getRateLimitDelay(err: any): number {
  if (!err) return 0;
  if (err.headers) {
    const retryAfter = typeof err.headers.get === 'function' ? err.headers.get('retry-after') : err.headers['retry-after'];
    if (retryAfter) {
      const sec = parseFloat(retryAfter);
      if (!isNaN(sec) && sec > 0) return sec;
    }
  }
  const msg = err.message || (err.error?.error?.message) || "";
  if (msg) {
    const sec = parseRateLimitMessage(msg);
    if (sec > 0) return sec;
  }
  return 0;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delayMs = 6000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const errMsg = String(err?.message || err || "").toLowerCase();
      const isRateLimit = err?.status === 429 ||
        errMsg.includes("rate limit") ||
        errMsg.includes("429") ||
        errMsg.includes("quota") ||
        errMsg.includes("exhausted") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("too many requests");

      if (isRateLimit && i < retries - 1) {
        const isDailyQuota =
          errMsg.includes("daily") ||
          errMsg.includes("per day") ||
          errMsg.includes("tokens per day") ||
          errMsg.includes("try again in") && /try again in (\d+)m/.test(errMsg) && (() => {
            const m = errMsg.match(/try again in (\d+)m/);
            return m ? parseInt(m[1], 10) > 2 : false;
          })();

        if (isDailyQuota) {
          console.warn(`[Agent2Tools] Daily quota exhausted — skipping retries, propagating to failover chain.`);
          throw err;
        }

        console.warn(`[Agent2Tools] Rate limit hit (429/quota). Retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed after maximum retries");
}

export async function unifiedLlmCall(systemPrompt: string, userPrompt: string): Promise<string> {
  const adapters: { name: string; type: string; getAdapter: () => Promise<LLMAdapter> }[] = [];

  // ??$$$ newer code - failover adapter chain instantiation
  // ??$$$ newer code - use key rotation for Groq in unifiedLlmCall
  const hasGroqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3;
  if (hasGroqKey) {
    adapters.push({
      name: "Groq",
      type: "groq",
      getAdapter: async () => new GroqAdapter("meta-llama/llama-4-scout-17b-16e-instruct")
    });
  }
  if (process.env.GEMINI_API_KEY) {
    const key = process.env.GEMINI_API_KEY;
    adapters.push({
      name: "Gemini",
      type: "gemini",
      getAdapter: async () => new GeminiAdapter(key)
    });
  }
  if (process.env.CEREBRAS_API_KEY) {
    const key = process.env.CEREBRAS_API_KEY;
    adapters.push({
      name: "Cerebras",
      type: "cerebras",
      getAdapter: async () => new CerebrasAdapter(key, "gpt-oss-120b")
    });
  }
  adapters.push({
    name: "Ollama (Local)",
    type: "ollama",
    getAdapter: async () => {
      let localModel = "qwen2.5:3b";
      try {
        localModel = (await getOllamaModel()) || "qwen2.5:3b";
      } catch {}
      return new OllamaAdapter(localModel);
    }
  });

  let lastError: any = null;

  for (const provider of adapters) {
    const cooldownUntil = providerCooldowns.get(provider.type) || 0;
    if (cooldownUntil > Date.now()) {
      console.log(`[unifiedLlmCall] Skipping provider ${provider.name} due to active cooldown (remains: ${Math.round((cooldownUntil - Date.now()) / 1000)}s)`);
      continue;
    }

    try {
      console.log(`[unifiedLlmCall] Trying provider: ${provider.name}`);
      const adapter = await provider.getAdapter();
      const response = await adapter.chat(systemPrompt, [{ role: "user", content: userPrompt }]);
      const text = typeof response.text === "function" ? response.text() : (response as any).text;
      if (text) {
        return text;
      }
      throw new Error(`Empty response from ${provider.name}`);
    } catch (err: any) {
      lastError = err;

      // ??$$$ newer code - Groq key rotation & immediate retry in unifiedLlmCall
      if (provider.type === "groq") {
        try {
          console.warn(`[unifiedLlmCall] Groq provider failed: ${err.message || err}. Rotating key...`);
          const rotService = require("../../shared/keyRotation.service").default;
          await rotService.handleRateLimit();
          
          console.warn("[unifiedLlmCall] Retrying with new Groq key...");
          const adapter = await provider.getAdapter();
          const response = await adapter.chat(systemPrompt, [{ role: "user", content: userPrompt }]);
          const text = typeof response.text === "function" ? response.text() : (response as any).text;
          if (text) {
            return text;
          }
        } catch (retryErr: any) {
          console.error("[unifiedLlmCall] Groq key rotation retry also failed:", retryErr.message || retryErr);
          lastError = retryErr;
        }
      }

      const delay = getRateLimitDelay(err);
      if (delay > 0) {
        if (delay > 15) {
          console.warn(`[unifiedLlmCall] Rate limit of ${delay}s exceeds threshold. Skipping provider ${provider.name} and putting on cooldown.`);
          providerCooldowns.set(provider.type, Date.now() + (delay * 1000));
        } else {
          console.warn(`[unifiedLlmCall] Rate limit of ${delay}s is short. Pausing for ${delay} seconds before retry.`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          try {
            const adapter = await provider.getAdapter();
            const response = await adapter.chat(systemPrompt, [{ role: "user", content: userPrompt }]);
            const text = typeof response.text === "function" ? response.text() : (response as any).text;
            if (text) return text;
          } catch (retryErr) {
            console.error(`[unifiedLlmCall] Retry after short pause failed for ${provider.name}:`, retryErr);
          }
        }
      } else {
        console.warn(`[unifiedLlmCall] Error on provider ${provider.name}: ${err?.message || err}. Putting on 30s cooldown.`);
        providerCooldowns.set(provider.type, Date.now() + 30000);
      }
    }
  }

  throw new Error(`All LLM providers in unified failover chain failed. Last error: ${lastError?.message || lastError}`);
}
