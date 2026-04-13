import { pgTable, uuid, text, varchar, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { VoiceConfig } from "@mercuria/shared";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  provider: varchar("provider", { length: 20 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_provider_provider_id_idx").on(table.provider, table.providerId),
]);

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  modelPath: varchar("model_path", { length: 500 }).notNull(),
  voiceConfig: jsonb("voice_config").$type<VoiceConfig>().notNull().default({ speakerId: 0 }),
  emotionMap: jsonb("emotion_map").$type<Record<string, string>>().notNull().default({
    happy: "expression_happy",
    sad: "expression_sad",
    surprised: "expression_surprised",
    angry: "expression_angry",
    neutral: "expression_default",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  title: varchar("title", { length: 255 }).notNull().default("新しい会話"),
  aiProvider: varchar("ai_provider", { length: 20 }).notNull(),
  aiModel: varchar("ai_model", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 10 }).notNull(),
  content: text("content").notNull(),
  emotion: varchar("emotion", { length: 20 }),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
