// ??$$$
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
        console.warn(`[Agent2Tools] Rate limit hit (429/quota). Retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed after maximum retries");
}
