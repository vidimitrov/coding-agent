export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface SessionStats {
  totalTokens: number;
  requestCount: number;
  maxContextTokens: number;
  currentConversationTokens: number;
}