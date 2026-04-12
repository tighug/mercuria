import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";

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

await app.listen({ port: config.PORT, host: "0.0.0.0" });
