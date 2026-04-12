import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { conversations } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authGuard } from "../middleware/auth.js";
import { createConversationSchema } from "@mercuria/shared";

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/conversations", async (request) => {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, request.userId))
      .orderBy(desc(conversations.updatedAt));
  });

  app.post("/api/conversations", async (request) => {
    const body = createConversationSchema.parse(request.body);
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId: request.userId,
        characterId: body.characterId,
        aiProvider: body.aiProvider,
        aiModel: body.aiModel,
      })
      .returning();
    return conversation;
  });

  app.delete("/api/conversations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, request.userId)));
    return reply.status(204).send();
  });
}
