import { z } from "zod";

export const emotionSchema = z.enum(["happy", "sad", "surprised", "angry", "neutral"]);
export const roleSchema = z.enum(["user", "assistant"]);
export const authProviderSchema = z.enum(["google", "github"]);
export const aiProviderSchema = z.enum(["claude", "openai"]);

export const createConversationSchema = z.object({
  characterId: z.string().uuid(),
  aiProvider: aiProviderSchema,
  aiModel: z.string().min(1),
});

export const chatSendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});
