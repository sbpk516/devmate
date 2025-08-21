export interface ChatRequest {
  prompt: string;
  system?: string;
  model?: string;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latencyMs: number;
}

export interface ChatError {
  error: string;
  message: string;
}

// Note: gpt-4o works with Comcast gateway, gpt-4o-mini may not be supported
export type ModelType = 'gpt-4o' | 'gpt-4o-mini';

// Prioritize gpt-4o as it's confirmed to work with the Comcast gateway
export const ALLOWED_MODELS: ModelType[] = ['gpt-4o', 'gpt-4o-mini'];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStats {
  latencyMs: number;
  approximateTokens: number;
}
