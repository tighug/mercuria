import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { setupSocketIO } from "./ws/chat.js";
import { authRoutes } from "./routes/auth.js";
import { characterRoutes } from "./routes/characters.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { ttsRoutes } from "./routes/tts.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.CLIENT_URL,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authRoutes);
  app.register(characterRoutes);
  app.register(conversationRoutes);
  app.register(messageRoutes);
  app.register(ttsRoutes);

  setupSocketIO(app);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main();
