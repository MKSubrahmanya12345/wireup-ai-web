// @ts-nocheck
// ??$$$ FORGE: parseAIResponse.js — Bulletproof AI output parser
// Never throws. Always returns something or null with a reason field.

/**
 * extractJSON(rawText)
 * Tries 3 strategies to extract a JSON object from raw AI output.
 * @returns {{ parsed: object|null, method: string, confidence: number, error?: string }}
 */
export const extractJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return { parsed: null, method: 'none', confidence: 0, error: 'Empty or non-string input' };
  }

  const text = rawText.trim();

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(text);
    return { parsed, method: 'direct', confidence: 1.0 };
  } catch {
    // continue
  }

  // Strategy 2: Extract ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      return { parsed, method: 'codeblock', confidence: 0.9 };
    } catch {
      // continue
    }
  }

  // Strategy 3: Find the first { ... } or [ ... ] block
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    // Find matching closing bracket by tracking depth
    const openChar = text[startIdx];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === openChar) depth++;
      else if (text[i] === closeChar) {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }

    if (endIdx !== -1) {
      try {
        const parsed = JSON.parse(text.slice(startIdx, endIdx + 1));
        return { parsed, method: 'heuristic', confidence: 0.6 };
      } catch {
        // continue
      }
    }
  }

  return {
    parsed: null,
    method: 'failed',
    confidence: 0,
    error: 'Could not extract JSON from AI response',
    raw: text.slice(0, 300) // truncated for logging
  };
};

/**
 * extractCode(rawText, lang)
 * Extracts a code block by language tag from AI output.
 * @param {string} rawText
 * @param {string} lang - e.g. 'cpp', 'javascript', 'json'
 * @returns {{ code: string|null, language: string }}
 */
export const extractCode = (rawText, lang = '') => {
  if (!rawText || typeof rawText !== 'string') {
    return { code: null, language: lang };
  }

  // Try specific language tag first
  if (lang) {
    const langMatch = rawText.match(new RegExp('```' + lang + '\\s*([\\s\\S]*?)```', 'i'));
    if (langMatch?.[1]) {
      return { code: langMatch[1].trim(), language: lang };
    }
  }

  // Try any code block
  const anyMatch = rawText.match(/```(?:\w+)?\s*([\s\S]*?)```/i);
  if (anyMatch?.[1]) {
    return { code: anyMatch[1].trim(), language: lang || 'unknown' };
  }

  // Fallback: return raw text if it looks like code
  if (rawText.includes('void setup') || rawText.includes('void loop')) {
    return { code: rawText.trim(), language: 'cpp' };
  }

  return { code: null, language: lang };
};

export default { extractJSON, extractCode };
