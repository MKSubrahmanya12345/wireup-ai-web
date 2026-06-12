// ??$$$
export interface ToolCall {
  id?: string;
  name: string;
  args: any;
}

export interface ToolResult {
  saved: boolean;
  type?: string;
  sessionId?: string;
  timestamp?: string;
  error?: string;
  [key: string]: any;
}
