// packages/server/src/ws/chat.ts
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { verifyAccessToken } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { messages, conversations, characters } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { ClaudeAdapter } from "../services/ai/claude.js";
import { OpenAIAdapter } from "../services/ai/openai.js";
import type { AIAdapter } from "../services/ai/adapter.js";
import { EmotionParser } from "../services/emotion.js";
import { chatSendSchema } from "@mercuria/shared";
import { config } from "../config.js";

const adapters: Record<string, AIAdapter> = {};
if (config.ANTHROPIC_API_KEY) adapters.claude = new ClaudeAdapter();
if (config.OPENAI_API_KEY) adapters.openai = new OpenAIAdapter();

export function setupSocketIO(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: { origin: config.CLIENT_URL, credentials: true },
  });

  // Auth middleware — parse JWT from httpOnly cookie
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...val] = c.trim().split("=");
        return [key, val.join("=")];
      })
    );
    const token = cookies["access_token"];
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.on("chat:send", async (payload: unknown) => {
      try {
        const { conversationId, content } = chatSendSchema.parse(payload);

        // Verify conversation ownership
        const [conv] = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
        if (!conv) {
          socket.emit("chat:error", { conversationId, error: "Conversation not found" });
          return;
        }

        // Get character
        const [character] = await db.select().from(characters).where(eq(characters.id, conv.characterId));
        if (!character) {
          socket.emit("chat:error", { conversationId, error: "Character not found" });
          return;
        }

        // Get adapter
        const adapter = adapters[conv.aiProvider];
        if (!adapter) {
          socket.emit("chat:error", { conversationId, error: `AI provider ${conv.aiProvider} not configured` });
          return;
        }

        // Get existing messages
        const existingMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(asc(messages.orderIndex));

        // Save user message
        const userOrderIndex = existingMessages.length;
        await db.insert(messages).values({
          conversationId,
          role: "user",
          content,
          orderIndex: userOrderIndex,
        });

        // Build context (last 50 messages, trimmed by estimated token count)
        const MAX_MESSAGES = 50;
        const MAX_CHARS = 100000;
        let contextMessages = existingMessages.slice(-MAX_MESSAGES + 1).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        contextMessages.push({ role: "user" as const, content });

        // Trim oldest messages if total chars exceed limit
        let totalChars = contextMessages.reduce((sum, m) => sum + m.content.length, 0);
        while (totalChars > MAX_CHARS && contextMessages.length > 1) {
          totalChars -= contextMessages[0].content.length;
          contextMessages = contextMessages.slice(1);
        }

        // Stream AI response
        const parser = new EmotionParser();
        let emotionSent = false;

        await adapter.streamChat({
          systemPrompt: character.systemPrompt,
          messages: contextMessages,
          onToken: (token) => {
            parser.feed(token);

            if (!emotionSent && parser.isTagExtracted()) {
              const { emotion, remainingText } = parser.flush();
              socket.emit("chat:emotion", { conversationId, emotion });
              emotionSent = true;
              if (remainingText) {
                socket.emit("chat:token", { conversationId, token: remainingText });
              }
            } else if (emotionSent) {
              socket.emit("chat:token", { conversationId, token });
            }
          },
          onComplete: async (fullText) => {
            const cleanText = parser.getCleanText();
            const emotion = parser.getEmotion();

            const [savedMessage] = await db
              .insert(messages)
              .values({
                conversationId,
                role: "assistant",
                content: cleanText,
                emotion,
                orderIndex: userOrderIndex + 1,
              })
              .returning();

            socket.emit("chat:complete", { conversationId, message: savedMessage });
          },
        });
      } catch (error) {
        socket.emit("chat:error", {
          conversationId: (payload as any)?.conversationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  });

  return io;
}
