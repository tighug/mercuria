export type Emotion = "happy" | "sad" | "surprised" | "angry" | "neutral";
export type Role = "user" | "assistant";
export type AuthProvider = "google" | "github";
export type AIProvider = "claude" | "openai";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: AuthProvider;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelPath: string;
  voiceConfig: Record<string, unknown>;
  emotionMap: Record<Emotion, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  aiProvider: AIProvider;
  aiModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  emotion: Emotion | null;
  orderIndex: number;
  createdAt: string;
}

// Socket.IO event types
export interface ChatSendPayload {
  conversationId: string;
  content: string;
}

export interface ChatTokenPayload {
  conversationId: string;
  token: string;
}

export interface ChatEmotionPayload {
  conversationId: string;
  emotion: Emotion;
}

export interface ChatCompletePayload {
  conversationId: string;
  message: Message;
}

export interface ChatErrorPayload {
  conversationId: string;
  error: string;
}
