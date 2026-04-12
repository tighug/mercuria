import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

function buildApp() {
  const app = Fastify();
  app.register(cors, { origin: true, credentials: true });
  app.register(cookie);
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}

describe("Health check", () => {
  it("GET /health returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
