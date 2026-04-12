import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { messages, conversations } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { authGuard } from "../middleware/auth.js";

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/conversations/:conversationId/messages", async (request) => {
    const { conversationId } = request.params as { conversationId: string };

    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, request.userId)));
    if (!conv) throw { statusCode: 404, message: "Conversation not found" };

    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.orderIndex));
  });
}
