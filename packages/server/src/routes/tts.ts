import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { messages, conversations, characters } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authGuard } from "../middleware/auth.js";
import { VoicevoxAdapter } from "../services/tts/voicevox.js";
import { config } from "../config.js";
import type { Emotion } from "@mercuria/shared";

export async function ttsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/tts/:messageId", async (request, reply) => {
    if (!config.VOICEVOX_URL) {
      return reply.status(501).send({ error: "Server-side TTS not configured. Set VOICEVOX_URL." });
    }

    const { messageId } = request.params as { messageId: string };

    // メッセージ取得
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    // 会話の所有者確認
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, message.conversationId), eq(conversations.userId, request.userId)));
    if (!conv) {
      return reply.status(404).send({ error: "Conversation not found" });
    }

    // キャラクター取得
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, conv.characterId));
    if (!character) {
      return reply.status(404).send({ error: "Character not found" });
    }

    // 話者ID解決: emotionSpeakerMap[emotion] ?? speakerId
    const emotion = message.emotion as Emotion | null;
    const resolvedSpeakerId =
      (emotion && character.voiceConfig.emotionSpeakerMap?.[emotion]) ?? character.voiceConfig.speakerId;

    try {
      const adapter = new VoicevoxAdapter(config.VOICEVOX_URL);
      const wav = await adapter.synthesize(message.content, { speakerId: resolvedSpeakerId });
      return reply.type("audio/wav").send(wav);
    } catch (err) {
      const isConnectionError = err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"));
      if (isConnectionError) {
        return reply.status(503).send({ error: "VOICEVOX ENGINE is not available" });
      }
      return reply.status(500).send({ error: "TTS synthesis failed" });
    }
  });
}
