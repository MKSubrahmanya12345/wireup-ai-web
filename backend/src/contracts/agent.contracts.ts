// ??$$$
export interface LLMResponse {
  text(): string;
  functionCalls(): { name: string; args: any }[];
}

export interface LLMAdapter {
  chat(systemPrompt: string, messages: any[]): Promise<LLMResponse>;
}
