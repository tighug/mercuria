import { FastifyInstance } from "fastify";
import { authGuard } from "../middleware/auth.js";

export async function ttsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/tts/:messageId", async (request, reply) => {
    return reply.status(501).send({ error: "Server-side TTS not yet implemented. Use client Web Speech API." });
  });
}
