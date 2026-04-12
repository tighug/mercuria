import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, config.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, config.JWT_SECRET) as { sub: string };
}

export function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string; type: string };
  if (payload.type !== "refresh") throw new Error("Not a refresh token");
  return payload;
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.access_token;
  if (!token) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  try {
    const payload = verifyAccessToken(token);
    request.userId = payload.sub;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

// Fastify type augmentation
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}
