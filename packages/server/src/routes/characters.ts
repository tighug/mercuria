import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { characters } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function characterRoutes(app: FastifyInstance) {
  app.get("/api/characters", async () => {
    return db.select().from(characters);
  });

  app.get("/api/characters/:id", async (request) => {
    const { id } = request.params as { id: string };
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    if (!character) throw { statusCode: 404, message: "Character not found" };
    return character;
  });
}
