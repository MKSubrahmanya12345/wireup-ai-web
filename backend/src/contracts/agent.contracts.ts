// ??$$$
// ??$$$ newer code
export interface LLMResponse {
  text(): string;
  functionCalls(): { name: string; args: any }[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; // ??$$$ newer code
}

/* old code
export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[]): Promise<LLMResponse>;
}
*/
// ??$$$ newer code
export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[], activeToolNames?: string[]): Promise<LLMResponse>;
}
