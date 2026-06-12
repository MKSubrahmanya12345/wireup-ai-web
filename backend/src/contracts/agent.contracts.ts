// ??$$$
export interface LLMResponse {
  text(): string;
  functionCalls(): { name: string; args: any }[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; // ??$$$ newer code
}

export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[]): Promise<LLMResponse>;
}
