export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatParams {
  systemPrompt: string;
  messages: ChatMessage[];
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
}

export interface AIAdapter {
  streamChat(params: StreamChatParams): Promise<void>;
}
