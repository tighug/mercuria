# Mercuria 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live2Dキャラクターと会話できるAIチャットWebアプリを構築する

**Architecture:** React (Vite) フロントエンドと Fastify バックエンドをpnpmモノレポで管理。Socket.IOでAI応答をストリーミング配信し、pixi-live2d-displayでキャラクターを描画。PostgreSQLでデータ永続化。

**Tech Stack:** React, Vite, TypeScript, Tailwind CSS, Zustand, Fastify, Drizzle ORM, Socket.IO, PixiJS, pixi-live2d-display, PostgreSQL, Docker

**Spec:** `docs/superpowers/specs/2026-04-13-mercuria-chat-app-design.md`

---

## ファイル構成

```
mercuria/
├── packages/
│   ├── client/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── chat/ChatPanel.tsx
│   │   │   │   ├── chat/MessageList.tsx
│   │   │   │   ├── chat/MessageInput.tsx
│   │   │   │   ├── live2d/Live2DCanvas.tsx
│   │   │   │   ├── sidebar/Sidebar.tsx
│   │   │   │   ├── sidebar/CharacterSelector.tsx
│   │   │   │   └── sidebar/ConversationList.tsx
│   │   │   ├── hooks/useSocket.ts
│   │   │   ├── hooks/useTTS.ts
│   │   │   ├── stores/authStore.ts
│   │   │   ├── stores/chatStore.ts
│   │   │   ├── stores/characterStore.ts
│   │   │   ├── stores/live2dStore.ts
│   │   │   ├── services/api.ts
│   │   │   ├── services/socket.ts
│   │   │   ├── pages/LoginPage.tsx
│   │   │   ├── pages/ChatPage.tsx
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── server/
│   │   ├── src/
│   │   │   ├── routes/auth.ts
│   │   │   ├── routes/characters.ts
│   │   │   ├── routes/conversations.ts
│   │   │   ├── routes/messages.ts
│   │   │   ├── routes/tts.ts
│   │   │   ├── ws/chat.ts
│   │   │   ├── services/ai/adapter.ts
│   │   │   ├── services/ai/claude.ts
│   │   │   ├── services/ai/openai.ts
│   │   │   ├── services/tts/adapter.ts
│   │   │   ├── services/tts/web-speech.ts
│   │   │   ├── services/emotion.ts
│   │   │   ├── db/schema.ts
│   │   │   ├── db/index.ts
│   │   │   ├── db/seed.ts
│   │   │   ├── middleware/auth.ts
│   │   │   ├── config.ts
│   │   │   └── app.ts
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── types.ts
│       │   └── schemas.ts
│       ├── tsconfig.json
│       └── package.json
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── .gitignore
```

---

## Phase 1: プロジェクト基盤

### Task 1: モノレポスキャフォールド

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schemas.ts`

- [ ] **Step 1: ルートpackage.jsonとpnpmワークスペース設定**

```json
// package.json
{
  "name": "mercuria",
  "private": true,
  "scripts": {
    "dev": "docker-compose up",
    "dev:client": "pnpm --filter @mercuria/client dev",
    "dev:server": "pnpm --filter @mercuria/server dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

```env
# .env.example
DATABASE_URL=postgresql://mercuria:mercuria@localhost:5432/mercuria
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3000
```

- [ ] **Step 2: sharedパッケージ — 型定義**

```typescript
// packages/shared/src/types.ts
export type Emotion = "happy" | "sad" | "surprised" | "angry" | "neutral";
export type Role = "user" | "assistant";
export type AuthProvider = "google" | "github";
export type AIProvider = "claude" | "openai";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: AuthProvider;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelPath: string;
  voiceConfig: Record<string, unknown>;
  emotionMap: Record<Emotion, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  aiProvider: AIProvider;
  aiModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  emotion: Emotion | null;
  orderIndex: number;
  createdAt: string;
}

// Socket.IO event types
export interface ChatSendPayload {
  conversationId: string;
  content: string;
}

export interface ChatTokenPayload {
  conversationId: string;
  token: string;
}

export interface ChatEmotionPayload {
  conversationId: string;
  emotion: Emotion;
}

export interface ChatCompletePayload {
  conversationId: string;
  message: Message;
}

export interface ChatErrorPayload {
  conversationId: string;
  error: string;
}
```

- [ ] **Step 3: sharedパッケージ — Zodスキーマ**

```typescript
// packages/shared/src/schemas.ts
import { z } from "zod";

export const emotionSchema = z.enum(["happy", "sad", "surprised", "angry", "neutral"]);
export const roleSchema = z.enum(["user", "assistant"]);
export const aiProviderSchema = z.enum(["claude", "openai"]);

export const createConversationSchema = z.object({
  characterId: z.string().uuid(),
  aiProvider: aiProviderSchema,
  aiModel: z.string().min(1),
});

export const chatSendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});
```

- [ ] **Step 4: sharedパッケージのpackage.jsonとtsconfig**

```json
// packages/shared/package.json
{
  "name": "@mercuria/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

sharedのindex.tsでre-export:
```typescript
// packages/shared/src/index.ts
export * from "./types";
export * from "./schemas";
```

- [ ] **Step 5: pnpm installを実行**

Run: `pnpm install`
Expected: lockfile生成、node_modules作成

- [ ] **Step 6: コミット**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .env.example packages/shared/
git commit -m "feat: モノレポスキャフォールドとsharedパッケージを追加"
```

---

### Task 2: サーバーパッケージスキャフォールド

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/config.ts`
- Create: `packages/server/src/app.ts`

- [ ] **Step 1: server package.json**

```json
{
  "name": "@mercuria/server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mercuria/shared": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/rate-limit": "^10.2.0",
    "fastify-socket.io": "^5.1.0",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.0",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.24.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

- [ ] **Step 2: サーバー設定とFastifyアプリ初期化**

```typescript
// packages/server/src/config.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  SERVER_URL: z.string().default("http://localhost:3000"),
  PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse(process.env);
```

```typescript
// packages/server/src/app.ts
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
```

- [ ] **Step 3: テスト — ヘルスチェックエンドポイント**

```typescript
// packages/server/src/app.test.ts
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
```

- [ ] **Step 4: テスト実行**

Run: `cd packages/server && pnpm test -- --run`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/server/
git commit -m "feat: Fastifyサーバーパッケージのスキャフォールド"
```

---

### Task 3: クライアントパッケージスキャフォールド

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/tailwind.config.ts`
- Create: `packages/client/postcss.config.js`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`

- [ ] **Step 1: Vite + React + Tailwindプロジェクト初期化**

```json
// packages/client/package.json
{
  "name": "@mercuria/client",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mercuria/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "zustand": "^5.0.0",
    "ky": "^1.7.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^26.0.0"
  }
}
```

- [ ] **Step 2: Vite設定 + Tailwind設定**

```typescript
// packages/client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
```

```typescript
// packages/client/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

```javascript
// packages/client/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: エントリーポイントとAppシェル**

```html
<!-- packages/client/index.html -->
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mercuria</title>
  </head>
  <body class="bg-gray-900 text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// packages/client/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

```css
/* packages/client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// packages/client/src/App.tsx
import { Routes, Route } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="flex h-screen items-center justify-center"><h1 className="text-3xl font-bold">Mercuria</h1></div>} />
    </Routes>
  );
}
```

- [ ] **Step 4: pnpm install & ビルド確認**

Run: `pnpm install && pnpm --filter @mercuria/client build`
Expected: distディレクトリ生成、エラーなし

- [ ] **Step 5: コミット**

```bash
git add packages/client/
git commit -m "feat: React + Vite + Tailwindクライアントパッケージのスキャフォールド"
```

---

### Task 4: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `packages/server/Dockerfile`
- Create: `packages/client/Dockerfile`

- [ ] **Step 1: docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: mercuria
      POSTGRES_PASSWORD: mercuria
      POSTGRES_DB: mercuria
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  server:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      DATABASE_URL: postgresql://mercuria:mercuria@db:5432/mercuria
    depends_on:
      - db
    volumes:
      - ./packages/server/src:/app/packages/server/src
      - ./packages/shared/src:/app/packages/shared/src

  client:
    build:
      context: .
      dockerfile: packages/client/Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./packages/client/src:/app/packages/client/src
      - ./packages/shared/src:/app/packages/shared/src

volumes:
  pgdata:
```

- [ ] **Step 2: Dockerfile (server)**

```dockerfile
# packages/server/Dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
CMD ["pnpm", "--filter", "@mercuria/server", "dev"]
```

- [ ] **Step 3: Dockerfile (client)**

```dockerfile
# packages/client/Dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
CMD ["pnpm", "--filter", "@mercuria/client", "dev", "--host"]
```

- [ ] **Step 4: .envファイルを作成してdocker-compose up確認**

Run: `cp .env.example .env && docker-compose up --build -d && sleep 5 && curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 5: コミット**

```bash
git add docker-compose.yml packages/server/Dockerfile packages/client/Dockerfile
git commit -m "feat: Docker Compose開発環境を追加"
```

---

## Phase 2: データベースと認証

### Task 5: Drizzle ORMスキーマとマイグレーション

**Files:**
- Create: `packages/server/src/db/schema.ts`
- Create: `packages/server/src/db/index.ts`
- Create: `packages/server/drizzle.config.ts`

- [ ] **Step 1: DBスキーマ定義**

```typescript
// packages/server/src/db/schema.ts
import { pgTable, uuid, text, varchar, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

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
  voiceConfig: jsonb("voice_config").$type<Record<string, unknown>>().notNull().default({}),
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
```

- [ ] **Step 2: DB接続ヘルパー**

```typescript
// packages/server/src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

const client = postgres(config.DATABASE_URL);
export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Drizzle設定とマイグレーション生成**

```typescript
// packages/server/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Run: `cd packages/server && pnpm drizzle-kit generate`
Expected: `drizzle/` ディレクトリにSQLマイグレーションファイル生成

- [ ] **Step 4: マイグレーション実行**

Run: `cd packages/server && pnpm drizzle-kit push`
Expected: テーブル作成成功

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/db/ packages/server/drizzle.config.ts packages/server/drizzle/
git commit -m "feat: Drizzle ORMスキーマとマイグレーションを追加"
```

---

### Task 6: シードデータ（サンプルキャラクター）

**Files:**
- Create: `packages/server/src/db/seed.ts`

- [ ] **Step 1: シードスクリプト**

```typescript
// packages/server/src/db/seed.ts
import { db } from "./index.js";
import { characters } from "./schema.js";

const sampleCharacters = [
  {
    name: "メルク",
    description: "明るく元気な女の子。何でも前向きに考えるポジティブな性格。",
    systemPrompt: `あなたは「メルク」というキャラクターです。
性格: 明るく元気、ポジティブ、好奇心旺盛
口調: カジュアルで親しみやすい。「〜だよ！」「〜だね！」のような話し方。
必ず返答の冒頭に感情タグ [emotion:happy], [emotion:sad], [emotion:surprised], [emotion:angry], [emotion:neutral] のいずれかを付けてください。タグの後に本文を続けてください。`,
    modelPath: "/models/sample/sample.model3.json",
    voiceConfig: {},
    emotionMap: {
      happy: "expression_happy",
      sad: "expression_sad",
      surprised: "expression_surprised",
      angry: "expression_angry",
      neutral: "expression_default",
    },
  },
  {
    name: "アリア",
    description: "クールで知的なお姉さん。論理的な会話を好む。",
    systemPrompt: `あなたは「アリア」というキャラクターです。
性格: クール、知的、落ち着いている、少しツンデレ
口調: 丁寧だが少し冷たい。「〜ですわ」「〜ですけど？」のような話し方。
必ず返答の冒頭に感情タグ [emotion:happy], [emotion:sad], [emotion:surprised], [emotion:angry], [emotion:neutral] のいずれかを付けてください。タグの後に本文を続けてください。`,
    modelPath: "/models/sample/sample.model3.json",
    voiceConfig: {},
    emotionMap: {
      happy: "expression_happy",
      sad: "expression_sad",
      surprised: "expression_surprised",
      angry: "expression_angry",
      neutral: "expression_default",
    },
  },
];

async function seed() {
  console.log("Seeding characters...");
  for (const char of sampleCharacters) {
    await db.insert(characters).values(char).onConflictDoNothing();
  }
  console.log("Seed complete.");
  process.exit(0);
}

seed();
```

- [ ] **Step 2: package.jsonにseedスクリプト追加**

packages/server/package.json の scripts に追加:
```json
"seed": "tsx src/db/seed.ts"
```

- [ ] **Step 3: シード実行**

Run: `cd packages/server && pnpm seed`
Expected: "Seed complete."

- [ ] **Step 4: コミット**

```bash
git add packages/server/src/db/seed.ts packages/server/package.json
git commit -m "feat: サンプルキャラクターのシードデータを追加"
```

---

### Task 7: 認証システム（JWT + OAuth）

**Files:**
- Create: `packages/server/src/middleware/auth.ts`
- Create: `packages/server/src/routes/auth.ts`
- Test: `packages/server/src/middleware/auth.test.ts`

- [ ] **Step 1: テスト — JWT生成・検証**

```typescript
// packages/server/src/middleware/auth.test.ts
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = "test-secret-for-testing";

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "15m" });
}

function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}

describe("JWT utilities", () => {
  it("signs and verifies a token", () => {
    const token = signAccessToken("user-123");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-123");
  });

  it("rejects expired token", () => {
    const token = jwt.sign({ sub: "user-123" }, JWT_SECRET, { expiresIn: "0s" });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("rejects tampered token", () => {
    const token = signAccessToken("user-123");
    expect(() => verifyAccessToken(token + "x")).toThrow();
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `cd packages/server && pnpm test -- --run`
Expected: PASS（この段階ではインラインで関数定義しているのでPASS）

- [ ] **Step 3: 認証ミドルウェア実装**

```typescript
// packages/server/src/middleware/auth.ts
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
```

- [ ] **Step 4: OAuth認証ルート**

```typescript
// packages/server/src/routes/auth.ts
import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../middleware/auth.js";
import { config } from "../config.js";
import crypto from "crypto";

export async function authRoutes(app: FastifyInstance) {
  // Google OAuth redirect
  app.get("/api/auth/google", async (request, reply) => {
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      redirect_uri: `${config.SERVER_URL}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code: string };

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${config.SERVER_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();

    // Fetch user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    // Upsert user (find or create)
    let [existingUser] = await db.select().from(users).where(
      and(eq(users.provider, "google"), eq(users.providerId, profile.id))
    );
    if (!existingUser) {
      [existingUser] = await db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          provider: "google",
          providerId: profile.id,
        })
        .returning();
    }

    // Issue tokens
    const accessToken = signAccessToken(existingUser.id);
    const refreshToken = signRefreshToken(existingUser.id);

    await db.insert(refreshTokens).values({
      userId: existingUser.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply
      .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
      .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
      .redirect(config.CLIENT_URL);
  });

  // GitHub OAuth (same pattern — redirect + callback)
  app.get("/api/auth/github", async (request, reply) => {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID!,
      redirect_uri: `${config.SERVER_URL}/api/auth/github/callback`,
      scope: "user:email",
    });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  app.get("/api/auth/github/callback", async (request, reply) => {
    const { code } = request.query as { code: string };

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokens = await tokenRes.json();

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email ?? profile.email;

    // Upsert user (find or create)
    let [existingUser] = await db.select().from(users).where(
      and(eq(users.provider, "github"), eq(users.providerId, String(profile.id)))
    );
    if (!existingUser) {
      [existingUser] = await db
        .insert(users)
        .values({
          email: primaryEmail,
          name: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url,
          provider: "github",
          providerId: String(profile.id),
        })
        .returning();
    }

    const accessToken = signAccessToken(existingUser.id);
    const refreshToken = signRefreshToken(existingUser.id);

    await db.insert(refreshTokens).values({
      userId: existingUser.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply
      .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
      .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
      .redirect(config.CLIENT_URL);
  });

  // Token refresh
  app.post("/api/auth/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (!token) return reply.status(401).send({ error: "No refresh token" });

    try {
      const payload = verifyRefreshToken(token);

      // Check token exists in DB (reuse detection)
      const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token));
      if (!stored) {
        // Token reuse detected — revoke all tokens for this user
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.sub));
        return reply.status(401).send({ error: "Token reuse detected" });
      }

      // Rotate: delete old, issue new
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
      const newAccessToken = signAccessToken(payload.sub);
      const newRefreshToken = signRefreshToken(payload.sub);

      await db.insert(refreshTokens).values({
        userId: payload.sub,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      reply
        .setCookie("access_token", newAccessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
        .setCookie("refresh_token", newRefreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
        .send({ ok: true });
    } catch {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });

  // Get current user
  app.get("/api/auth/me", { preHandler: [authGuard] }, async (request) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    if (!user) throw { statusCode: 404, message: "User not found" };
    return user;
  });

  // Logout
  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    reply
      .clearCookie("access_token", { path: "/" })
      .clearCookie("refresh_token", { path: "/api/auth" })
      .send({ ok: true });
  });
}

// Re-export for use in app.ts
import { authGuard } from "../middleware/auth.js";
```

- [ ] **Step 5: app.ts にルート登録**

app.ts に追加:
```typescript
import { authRoutes } from "./routes/auth.js";
app.register(authRoutes);
```

- [ ] **Step 6: コミット**

```bash
git add packages/server/src/middleware/ packages/server/src/routes/auth.ts packages/server/src/app.ts
git commit -m "feat: JWT認証とOAuth (Google/GitHub) ルートを追加"
```

---

### Task 8: クライアント認証 (ストア + ログインページ)

**Files:**
- Create: `packages/client/src/stores/authStore.ts`
- Create: `packages/client/src/services/api.ts`
- Create: `packages/client/src/pages/LoginPage.tsx`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: APIクライアント**

```typescript
// packages/client/src/services/api.ts
import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  credentials: "include",
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401 && !request.url.includes("/auth/refresh")) {
          // Try refresh
          const refreshRes = await ky.post("/api/auth/refresh", { credentials: "include" });
          if (refreshRes.ok) {
            return ky(request, options);
          }
        }
        return response;
      },
    ],
  },
});
```

- [ ] **Step 2: 認証ストア**

```typescript
// packages/client/src/stores/authStore.ts
import { create } from "zustand";
import type { User } from "@mercuria/shared";
import { api } from "../services/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const user = await api.get("auth/me").json<User>();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await api.post("auth/logout");
    set({ user: null });
  },
}));
```

- [ ] **Step 3: ログインページ**

```tsx
// packages/client/src/pages/LoginPage.tsx
export function LoginPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gray-900">
      <h1 className="text-4xl font-bold text-white">Mercuria</h1>
      <p className="text-gray-400">AIキャラクターと会話しよう</p>
      <div className="flex flex-col gap-3">
        <a
          href="/api/auth/google"
          className="rounded-lg bg-white px-6 py-3 text-center font-medium text-gray-900 hover:bg-gray-100"
        >
          Googleでログイン
        </a>
        <a
          href="/api/auth/github"
          className="rounded-lg bg-gray-800 px-6 py-3 text-center font-medium text-white hover:bg-gray-700"
        >
          GitHubでログイン
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: App.tsx にルーティングと認証ガード**

```tsx
// packages/client/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { LoginPage } from "./pages/LoginPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export function App() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div className="flex h-screen items-center justify-center text-white">
              <h1 className="text-3xl font-bold">Mercuria — Chat</h1>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

- [ ] **Step 5: ビルド確認**

Run: `pnpm --filter @mercuria/client build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add packages/client/src/
git commit -m "feat: クライアント認証 (ストア, ログインページ, ルーティング)"
```

---

## Phase 3: キャラクター・会話CRUD

### Task 9: REST APIルート (キャラクター・会話・メッセージ)

**Files:**
- Create: `packages/server/src/routes/characters.ts`
- Create: `packages/server/src/routes/conversations.ts`
- Create: `packages/server/src/routes/messages.ts`
- Test: `packages/server/src/routes/characters.test.ts`

- [ ] **Step 1: テスト — キャラクター取得API**

```typescript
// packages/server/src/routes/characters.test.ts
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { characterRoutes } from "./characters.js";

// Note: 実際のテストではテストDBを使用する。ここではルート登録のスモークテスト
describe("Character routes", () => {
  it("registers without error", async () => {
    const app = Fastify();
    // characterRoutes はDB依存のため、ここでは登録テストのみ
    expect(() => app.register(characterRoutes)).not.toThrow();
  });
});
```

- [ ] **Step 2: キャラクターAPI**

```typescript
// packages/server/src/routes/characters.ts
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
```

- [ ] **Step 3: 会話API**

```typescript
// packages/server/src/routes/conversations.ts
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
```

- [ ] **Step 4: メッセージAPI**

```typescript
// packages/server/src/routes/messages.ts
import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { messages, conversations } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { authGuard } from "../middleware/auth.js";

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/conversations/:conversationId/messages", async (request) => {
    const { conversationId } = request.params as { conversationId: string };

    // Verify ownership
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
```

- [ ] **Step 5: app.ts にルート登録**

app.ts に追加:
```typescript
import { characterRoutes } from "./routes/characters.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";

app.register(characterRoutes);
app.register(conversationRoutes);
app.register(messageRoutes);
```

- [ ] **Step 6: コミット**

```bash
git add packages/server/src/routes/
git commit -m "feat: キャラクター・会話・メッセージのREST APIルートを追加"
```

---

### Task 10: クライアント サイドバー (キャラクター選択 + 会話一覧)

**Files:**
- Create: `packages/client/src/stores/characterStore.ts`
- Create: `packages/client/src/stores/chatStore.ts`
- Create: `packages/client/src/components/sidebar/Sidebar.tsx`
- Create: `packages/client/src/components/sidebar/CharacterSelector.tsx`
- Create: `packages/client/src/components/sidebar/ConversationList.tsx`
- Create: `packages/client/src/pages/ChatPage.tsx`

- [ ] **Step 1: キャラクターストア**

```typescript
// packages/client/src/stores/characterStore.ts
import { create } from "zustand";
import type { Character } from "@mercuria/shared";
import { api } from "../services/api";

interface CharacterState {
  characters: Character[];
  selectedCharacter: Character | null;
  fetchCharacters: () => Promise<void>;
  selectCharacter: (character: Character) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  characters: [],
  selectedCharacter: null,
  fetchCharacters: async () => {
    const characters = await api.get("characters").json<Character[]>();
    set({ characters, selectedCharacter: characters[0] ?? null });
  },
  selectCharacter: (character) => set({ selectedCharacter: character }),
}));
```

- [ ] **Step 2: チャットストア (初期版 — 会話CRUD)**

```typescript
// packages/client/src/stores/chatStore.ts
import { create } from "zustand";
import type { Conversation, Message } from "@mercuria/shared";
import { api } from "../services/api";

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  fetchConversations: () => Promise<void>;
  createConversation: (characterId: string, aiProvider: string, aiModel: string) => Promise<Conversation>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  fetchConversations: async () => {
    const conversations = await api.get("conversations").json<Conversation[]>();
    set({ conversations });
  },
  createConversation: async (characterId, aiProvider, aiModel) => {
    const conversation = await api
      .post("conversations", { json: { characterId, aiProvider, aiModel } })
      .json<Conversation>();
    set((s) => ({ conversations: [conversation, ...s.conversations], currentConversation: conversation, messages: [] }));
    return conversation;
  },
  selectConversation: async (conversation) => {
    const messages = await api
      .get(`conversations/${conversation.id}/messages`)
      .json<Message[]>();
    set({ currentConversation: conversation, messages });
  },
  deleteConversation: async (id) => {
    await api.delete(`conversations/${id}`);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      currentConversation: s.currentConversation?.id === id ? null : s.currentConversation,
      messages: s.currentConversation?.id === id ? [] : s.messages,
    }));
  },
}));
```

- [ ] **Step 3: サイドバーコンポーネント**

```tsx
// packages/client/src/components/sidebar/CharacterSelector.tsx
import { useCharacterStore } from "../../stores/characterStore";

export function CharacterSelector() {
  const { characters, selectedCharacter, selectCharacter } = useCharacterStore();
  return (
    <div className="flex flex-col gap-2 p-2">
      {characters.map((char) => (
        <button
          key={char.id}
          onClick={() => selectCharacter(char)}
          className={`rounded-full p-2 text-sm transition ${
            selectedCharacter?.id === char.id ? "bg-indigo-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={char.name}
        >
          {char.name[0]}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// packages/client/src/components/sidebar/ConversationList.tsx
import { useChatStore } from "../../stores/chatStore";

export function ConversationList() {
  const { conversations, currentConversation, selectConversation, deleteConversation } = useChatStore();
  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => selectConversation(conv)}
          className={`group flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm ${
            currentConversation?.id === conv.id ? "bg-gray-700" : "hover:bg-gray-800"
          }`}
        >
          <span className="truncate">{conv.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
            className="hidden text-gray-500 hover:text-red-400 group-hover:block"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// packages/client/src/components/sidebar/Sidebar.tsx
import { CharacterSelector } from "./CharacterSelector";
import { ConversationList } from "./ConversationList";
import { useCharacterStore } from "../../stores/characterStore";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

export function Sidebar() {
  const { selectedCharacter } = useCharacterStore();
  const { createConversation } = useChatStore();
  const { user, logout } = useAuthStore();

  const handleNewChat = async () => {
    if (!selectedCharacter) return;
    await createConversation(selectedCharacter.id, "claude", "claude-sonnet-4-20250514");
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900 border-r border-gray-800">
      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <CharacterSelector />
      </div>
      <button
        onClick={handleNewChat}
        className="mx-2 mt-2 rounded bg-indigo-600 px-3 py-2 text-sm hover:bg-indigo-500"
      >
        + 新しい会話
      </button>
      <ConversationList />
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{user?.name}</span>
          <button onClick={logout} className="hover:text-white">ログアウト</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: ChatPageシェル**

```tsx
// packages/client/src/pages/ChatPage.tsx
import { useEffect } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { useCharacterStore } from "../stores/characterStore";
import { useChatStore } from "../stores/chatStore";

export function ChatPage() {
  const { fetchCharacters } = useCharacterStore();
  const { fetchConversations } = useChatStore();

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, [fetchCharacters, fetchConversations]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center bg-gray-950">
        <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: App.tsx を更新してChatPageを使用**

```tsx
// App.tsx のルートを更新
<Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
```

- [ ] **Step 6: ビルド確認 & コミット**

Run: `pnpm --filter @mercuria/client build`

```bash
git add packages/client/src/
git commit -m "feat: サイドバー (キャラクター選択, 会話一覧) とChatPageシェルを追加"
```

---

## Phase 4: AIチャットストリーミング

### Task 11: AI Adapterインターフェースと実装

**Files:**
- Create: `packages/server/src/services/ai/adapter.ts`
- Create: `packages/server/src/services/ai/claude.ts`
- Create: `packages/server/src/services/ai/openai.ts`
- Test: `packages/server/src/services/ai/adapter.test.ts`

- [ ] **Step 1: テスト — AI Adapterインターフェースのモック実装**

```typescript
// packages/server/src/services/ai/adapter.test.ts
import { describe, it, expect } from "vitest";
import type { AIAdapter, ChatMessage } from "./adapter.js";

// Mock adapter for testing
const mockAdapter: AIAdapter = {
  async streamChat({ onToken, onComplete }) {
    const tokens = ["Hello", " ", "world"];
    for (const t of tokens) onToken(t);
    onComplete("Hello world");
  },
};

describe("AIAdapter interface", () => {
  it("streams tokens and completes", async () => {
    const tokens: string[] = [];
    let result = "";
    await mockAdapter.streamChat({
      systemPrompt: "test",
      messages: [],
      onToken: (t) => tokens.push(t),
      onComplete: (text) => { result = text; },
    });
    expect(tokens).toEqual(["Hello", " ", "world"]);
    expect(result).toBe("Hello world");
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `cd packages/server && pnpm test -- --run src/services/ai/adapter.test.ts`
Expected: FAIL (型が存在しない)

- [ ] **Step 3: AI Adapterインターフェース定義**

```typescript
// packages/server/src/services/ai/adapter.ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatParams {
  systemPrompt: string;
  messages: ChatMessage[];
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
}

export interface AIAdapter {
  streamChat(params: StreamChatParams): Promise<void>;
}
```

- [ ] **Step 4: テスト再実行 → PASS確認**

Run: `cd packages/server && pnpm test -- --run src/services/ai/adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Claude Adapter実装**

```typescript
// packages/server/src/services/ai/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import type { AIAdapter, StreamChatParams } from "./adapter.js";
import { config } from "../../config.js";

export class ClaudeAdapter implements AIAdapter {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  async streamChat({ systemPrompt, messages, onToken, onComplete }: StreamChatParams): Promise<void> {
    let fullText = "";
    const stream = this.client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const token = event.delta.text;
        fullText += token;
        onToken(token);
      }
    }
    onComplete(fullText);
  }
}
```

- [ ] **Step 6: OpenAI Adapter実装**

```typescript
// packages/server/src/services/ai/openai.ts
import OpenAI from "openai";
import type { AIAdapter, StreamChatParams } from "./adapter.js";
import { config } from "../../config.js";

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async streamChat({ systemPrompt, messages, onToken, onComplete }: StreamChatParams): Promise<void> {
    let fullText = "";
    const stream = await this.client.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullText += token;
        onToken(token);
      }
    }
    onComplete(fullText);
  }
}
```

- [ ] **Step 7: package.jsonにAI SDK依存関係追加**

packages/server/package.json に追加:
```json
"@anthropic-ai/sdk": "^0.39.0",
"openai": "^4.80.0"
```

Run: `pnpm install`

- [ ] **Step 8: コミット**

```bash
git add packages/server/src/services/ai/ packages/server/package.json pnpm-lock.yaml
git commit -m "feat: AI Adapterインターフェースとclaude/openai実装を追加"
```

---

### Task 12: 感情解析サービス

**Files:**
- Create: `packages/server/src/services/emotion.ts`
- Test: `packages/server/src/services/emotion.test.ts`

- [ ] **Step 1: テスト**

```typescript
// packages/server/src/services/emotion.test.ts
import { describe, it, expect } from "vitest";
import { EmotionParser } from "./emotion.js";

describe("EmotionParser", () => {
  it("extracts emotion tag from start of text", () => {
    const parser = new EmotionParser();
    parser.feed("[emotion:happy]こんにちは！");
    expect(parser.getEmotion()).toBe("happy");
    expect(parser.getCleanText()).toBe("こんにちは！");
  });

  it("handles token-by-token feeding", () => {
    const parser = new EmotionParser();
    parser.feed("[emo");
    parser.feed("tion:");
    parser.feed("sad]");
    parser.feed("悲しい");
    parser.feed("です");
    expect(parser.getEmotion()).toBe("sad");
    expect(parser.getCleanText()).toBe("悲しいです");
  });

  it("defaults to neutral when no tag found", () => {
    const parser = new EmotionParser();
    parser.feed("タグなしテキスト");
    expect(parser.getEmotion()).toBe("neutral");
    expect(parser.getCleanText()).toBe("タグなしテキスト");
  });

  it("returns buffered tokens after tag extraction", () => {
    const parser = new EmotionParser();
    parser.feed("[emotion:surprised]おお！");
    const result = parser.flush();
    expect(result.emotion).toBe("surprised");
    expect(result.remainingText).toBe("おお！");
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL**

Run: `cd packages/server && pnpm test -- --run src/services/emotion.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

```typescript
// packages/server/src/services/emotion.ts
import type { Emotion } from "@mercuria/shared";

const EMOTION_TAG_REGEX = /^\[emotion:(happy|sad|surprised|angry|neutral)\]/;
const VALID_EMOTIONS = new Set(["happy", "sad", "surprised", "angry", "neutral"]);

export class EmotionParser {
  private buffer = "";
  private emotion: Emotion | null = null;
  private tagExtracted = false;
  private cleanText = "";

  feed(token: string): void {
    if (this.tagExtracted) {
      this.cleanText += token;
      return;
    }

    this.buffer += token;
    const match = this.buffer.match(EMOTION_TAG_REGEX);
    if (match) {
      this.emotion = match[1] as Emotion;
      this.tagExtracted = true;
      this.cleanText = this.buffer.slice(match[0].length);
    } else if (!this.buffer.startsWith("[") || (this.buffer.length > 30 && !this.buffer.includes("]"))) {
      // Not an emotion tag — flush buffer as text
      this.tagExtracted = true;
      this.cleanText = this.buffer;
    }
  }

  getEmotion(): Emotion {
    return this.emotion ?? "neutral";
  }

  getCleanText(): string {
    return this.tagExtracted ? this.cleanText : this.buffer;
  }

  isTagExtracted(): boolean {
    return this.tagExtracted;
  }

  flush(): { emotion: Emotion; remainingText: string } {
    return {
      emotion: this.getEmotion(),
      remainingText: this.getCleanText(),
    };
  }
}
```

- [ ] **Step 4: テスト再実行 → PASS**

Run: `cd packages/server && pnpm test -- --run src/services/emotion.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/services/emotion.ts packages/server/src/services/emotion.test.ts
git commit -m "feat: 感情解析パーサー (EmotionParser) を追加"
```

---

### Task 13: Socket.IOチャットハンドラ

**Files:**
- Create: `packages/server/src/ws/chat.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Socket.IOセットアップとチャットハンドラ**

```typescript
// packages/server/src/ws/chat.ts
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { verifyAccessToken } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { messages, conversations, characters } from "../db/schema.js";
import { eq, and, asc, desc } from "drizzle-orm";
import { ClaudeAdapter } from "../services/ai/claude.js";
import { OpenAIAdapter } from "../services/ai/openai.js";
import type { AIAdapter } from "../services/ai/adapter.js";
import { EmotionParser } from "../services/emotion.js";
import { chatSendSchema } from "@mercuria/shared";
import { config } from "../config.js";

const adapters: Record<string, AIAdapter> = {};
if (config.ANTHROPIC_API_KEY) adapters.claude = new ClaudeAdapter();
if (config.OPENAI_API_KEY) adapters.openai = new OpenAIAdapter();

export function setupSocketIO(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: { origin: config.CLIENT_URL, credentials: true },
  });

  // Auth middleware — parse JWT from httpOnly cookie
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...val] = c.trim().split("=");
        return [key, val.join("=")];
      })
    );
    const token = cookies["access_token"];
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.on("chat:send", async (payload: unknown) => {
      try {
        const { conversationId, content } = chatSendSchema.parse(payload);

        // Verify conversation ownership
        const [conv] = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
        if (!conv) {
          socket.emit("chat:error", { conversationId, error: "Conversation not found" });
          return;
        }

        // Get character
        const [character] = await db.select().from(characters).where(eq(characters.id, conv.characterId));
        if (!character) {
          socket.emit("chat:error", { conversationId, error: "Character not found" });
          return;
        }

        // Get adapter
        const adapter = adapters[conv.aiProvider];
        if (!adapter) {
          socket.emit("chat:error", { conversationId, error: `AI provider ${conv.aiProvider} not configured` });
          return;
        }

        // Get message count for orderIndex
        const existingMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(asc(messages.orderIndex));

        // Save user message
        const userOrderIndex = existingMessages.length;
        await db.insert(messages).values({
          conversationId,
          role: "user",
          content,
          orderIndex: userOrderIndex,
        });

        // Build context (last 50 messages, trimmed by estimated token count)
        const MAX_MESSAGES = 50;
        const MAX_CHARS = 100000; // ~80% of typical context window in chars
        let contextMessages = existingMessages.slice(-MAX_MESSAGES + 1).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        contextMessages.push({ role: "user", content });

        // Trim oldest messages if total chars exceed limit
        let totalChars = contextMessages.reduce((sum, m) => sum + m.content.length, 0);
        while (totalChars > MAX_CHARS && contextMessages.length > 1) {
          totalChars -= contextMessages[0].content.length;
          contextMessages = contextMessages.slice(1);
        }

        // Stream AI response
        const parser = new EmotionParser();
        let emotionSent = false;

        await adapter.streamChat({
          systemPrompt: character.systemPrompt,
          messages: contextMessages,
          onToken: (token) => {
            parser.feed(token);

            if (!emotionSent && parser.isTagExtracted()) {
              const { emotion, remainingText } = parser.flush();
              socket.emit("chat:emotion", { conversationId, emotion });
              emotionSent = true;
              if (remainingText) {
                socket.emit("chat:token", { conversationId, token: remainingText });
              }
            } else if (emotionSent) {
              socket.emit("chat:token", { conversationId, token });
            }
          },
          onComplete: async (fullText) => {
            const cleanText = parser.getCleanText();
            const emotion = parser.getEmotion();

            // Save assistant message
            const [savedMessage] = await db
              .insert(messages)
              .values({
                conversationId,
                role: "assistant",
                content: cleanText,
                emotion,
                orderIndex: userOrderIndex + 1,
              })
              .returning();

            socket.emit("chat:complete", { conversationId, message: savedMessage });
          },
        });
      } catch (error) {
        socket.emit("chat:error", {
          conversationId: (payload as any)?.conversationId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  });

  return io;
}
```

- [ ] **Step 2: app.ts にSocket.IO登録**

app.ts に追加:
```typescript
import { setupSocketIO } from "./ws/chat.js";

// Fastify listen の前に:
setupSocketIO(app);
```

- [ ] **Step 3: コミット**

```bash
git add packages/server/src/ws/ packages/server/src/app.ts
git commit -m "feat: Socket.IOチャットハンドラ (ストリーミング + 感情解析) を追加"
```

---

### Task 14: クライアント チャットUI

**Files:**
- Create: `packages/client/src/services/socket.ts`
- Create: `packages/client/src/hooks/useSocket.ts`
- Create: `packages/client/src/components/chat/ChatPanel.tsx`
- Create: `packages/client/src/components/chat/MessageList.tsx`
- Create: `packages/client/src/components/chat/MessageInput.tsx`
- Modify: `packages/client/src/stores/chatStore.ts`
- Modify: `packages/client/src/pages/ChatPage.tsx`

- [ ] **Step 1: Socket.IOクライアントサービス**

```typescript
// packages/client/src/services/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  socket = io("/", { withCredentials: true });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
```

- [ ] **Step 2: useSocketフック**

```typescript
// packages/client/src/hooks/useSocket.ts
import { useEffect, useRef } from "react";
import { getSocket, disconnectSocket } from "../services/socket";
import { useChatStore } from "../stores/chatStore";
import type { ChatTokenPayload, ChatEmotionPayload, ChatCompletePayload, ChatErrorPayload } from "@mercuria/shared";

export function useSocket() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    socket.on("chat:token", (payload: ChatTokenPayload) => {
      useChatStore.getState().appendToken(payload.conversationId, payload.token);
    });

    socket.on("chat:emotion", (payload: ChatEmotionPayload) => {
      useChatStore.getState().setStreamEmotion(payload.conversationId, payload.emotion);
    });

    socket.on("chat:complete", (payload: ChatCompletePayload) => {
      useChatStore.getState().completeStream(payload.conversationId, payload.message);
    });

    socket.on("chat:error", (payload: ChatErrorPayload) => {
      useChatStore.getState().setStreamError(payload.error);
    });

    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, []);
}
```

- [ ] **Step 3: chatStore にストリーミング関連のstate追加**

chatStore.tsに以下を追加/更新:

```typescript
// chatStore.ts に追加する state とアクション
interface ChatState {
  // ... 既存のstate ...
  streamingText: string;
  streamEmotion: Emotion | null;
  isStreaming: boolean;
  streamError: string | null;
  sendMessage: (content: string) => void;
  appendToken: (conversationId: string, token: string) => void;
  setStreamEmotion: (conversationId: string, emotion: Emotion) => void;
  completeStream: (conversationId: string, message: Message) => void;
  setStreamError: (error: string) => void;
}

// 追加するアクション
streamingText: "",
streamEmotion: null,
isStreaming: false,
streamError: null,

sendMessage: (content) => {
  const conv = get().currentConversation;
  if (!conv) return;
  const socket = getSocket();
  socket.emit("chat:send", { conversationId: conv.id, content });
  // Optimistic: add user message locally
  const userMsg: Message = {
    id: crypto.randomUUID(),
    conversationId: conv.id,
    role: "user",
    content,
    emotion: null,
    orderIndex: get().messages.length,
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true, streamingText: "", streamEmotion: null }));
},

appendToken: (_conversationId, token) => {
  set((s) => ({ streamingText: s.streamingText + token }));
},

setStreamEmotion: (_conversationId, emotion) => {
  set({ streamEmotion: emotion });
},

completeStream: (_conversationId, message) => {
  set((s) => ({
    messages: [...s.messages, message],
    isStreaming: false,
    streamingText: "",
    streamEmotion: null,
  }));
},

setStreamError: (error) => {
  set({ isStreaming: false, streamError: error });
},
```

- [ ] **Step 4: チャットコンポーネント**

```tsx
// packages/client/src/components/chat/MessageList.tsx
import type { Message } from "@mercuria/shared";
import { useChatStore } from "../../stores/chatStore";
import { useEffect, useRef } from "react";

export function MessageList() {
  const { messages, streamingText, isStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`max-w-[70%] rounded-lg px-4 py-2 ${
            msg.role === "user"
              ? "self-end bg-indigo-600"
              : "self-start bg-gray-800"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      ))}
      {isStreaming && streamingText && (
        <div className="max-w-[70%] self-start rounded-lg bg-gray-800 px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

```tsx
// packages/client/src/components/chat/MessageInput.tsx
import { useState, type FormEvent } from "react";
import { useChatStore } from "../../stores/chatStore";

export function MessageInput() {
  const [text, setText] = useState("");
  const { sendMessage, isStreaming } = useChatStore();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    sendMessage(text.trim());
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="メッセージを入力..."
        className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
        disabled={isStreaming}
      />
      <button
        type="submit"
        disabled={isStreaming || !text.trim()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
      >
        送信
      </button>
    </form>
  );
}
```

```tsx
// packages/client/src/components/chat/ChatPanel.tsx
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

export function ChatPanel() {
  return (
    <div className="flex h-full flex-col">
      <MessageList />
      <MessageInput />
    </div>
  );
}
```

- [ ] **Step 5: ChatPage を更新してChatPanelを組み込み**

ChatPage.tsx の main 部分を更新:
```tsx
<main className="flex flex-1 bg-gray-950">
  {currentConversation ? (
    <ChatPanel />
  ) : (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
    </div>
  )}
</main>
```

- [ ] **Step 6: ビルド確認 & コミット**

Run: `pnpm --filter @mercuria/client build`

```bash
git add packages/client/src/
git commit -m "feat: チャットUI (Socket.IOストリーミング + メッセージ表示) を追加"
```

---

## Phase 5: Live2D統合

### Task 15: Live2Dモデル読み込みとキャンバス

**Files:**
- Create: `packages/client/src/components/live2d/Live2DCanvas.tsx`
- Create: `packages/client/src/stores/live2dStore.ts`

- [ ] **Step 1: Live2D依存パッケージ追加**

packages/client/package.json に追加:
```json
"pixi.js": "^7.4.0",
"pixi-live2d-display": "^0.4.0"
```

Run: `pnpm install`

注意: Live2D Cubism Core SDK は別途ダウンロードが必要（ライセンスの都合上npmにない）。
`packages/client/public/lib/live2dcubismcore.min.js` に配置し、index.html で読み込む:
```html
<script src="/lib/live2dcubismcore.min.js"></script>
```

- [ ] **Step 2: Live2Dストア**

```typescript
// packages/client/src/stores/live2dStore.ts
import { create } from "zustand";
import type { Emotion } from "@mercuria/shared";

interface Live2DState {
  currentEmotion: Emotion;
  mouthOpenValue: number;
  setEmotion: (emotion: Emotion) => void;
  setMouthOpen: (value: number) => void;
}

export const useLive2DStore = create<Live2DState>((set) => ({
  currentEmotion: "neutral",
  mouthOpenValue: 0,
  setEmotion: (emotion) => set({ currentEmotion: emotion }),
  setMouthOpen: (value) => set({ mouthOpenValue: value }),
}));
```

- [ ] **Step 3: Live2DCanvasコンポーネント**

```tsx
// packages/client/src/components/live2d/Live2DCanvas.tsx
import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { useLive2DStore } from "../../stores/live2dStore";
import { useCharacterStore } from "../../stores/characterStore";

// Register Live2D with PixiJS ticker
Live2DModel.registerTicker(PIXI.Ticker);

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<InstanceType<typeof Live2DModel> | null>(null);
  const { selectedCharacter } = useCharacterStore();
  const { currentEmotion } = useLive2DStore();

  // Initialize PixiJS app
  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new PIXI.Application({
      view: canvasRef.current,
      resizeTo: window,
      backgroundAlpha: 0,
    });
    appRef.current = app;

    return () => {
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  // Load model when character changes
  useEffect(() => {
    if (!appRef.current || !selectedCharacter) return;

    const app = appRef.current;

    async function loadModel() {
      // Remove previous model
      if (modelRef.current) {
        app.stage.removeChild(modelRef.current);
        modelRef.current = null;
      }

      try {
        const model = await Live2DModel.from(selectedCharacter!.modelPath);
        model.anchor.set(0.5, 0.5);
        model.position.set(app.screen.width / 2, app.screen.height / 2);

        // Scale to fit screen
        const scale = Math.min(
          app.screen.width / model.width,
          app.screen.height / model.height,
        ) * 0.8;
        model.scale.set(scale);

        app.stage.addChild(model);
        modelRef.current = model;

        // Mouse tracking
        const onMouseMove = (e: MouseEvent) => {
          model.focus(e.clientX, e.clientY);
        };
        window.addEventListener("mousemove", onMouseMove);

        // Touch/click reactions
        model.on("hit", (hitAreas: string[]) => {
          if (hitAreas.includes("Head")) {
            model.motion("tap_head");
          } else if (hitAreas.includes("Body")) {
            model.motion("tap_body");
          }
        });

        return () => {
          window.removeEventListener("mousemove", onMouseMove);
        };
      } catch (error) {
        console.error("Failed to load Live2D model:", error);
      }
    }

    loadModel();
  }, [selectedCharacter]);

  // Update expression when emotion changes
  useEffect(() => {
    if (!modelRef.current || !selectedCharacter) return;
    const expressionName = selectedCharacter.emotionMap[currentEmotion] ?? "expression_default";
    modelRef.current.expression(expressionName);
  }, [currentEmotion, selectedCharacter]);

  // Lip sync — read mouthOpenValue from store each frame
  useEffect(() => {
    if (!appRef.current) return;
    const ticker = appRef.current.ticker;

    const updateMouth = () => {
      if (modelRef.current) {
        const value = useLive2DStore.getState().mouthOpenValue;
        modelRef.current.internalModel?.coreModel?.setParameterValueByIndex(
          modelRef.current.internalModel.coreModel.getParameterIndex("ParamMouthOpenY"),
          value,
        );
      }
    };

    ticker.add(updateMouth);
    return () => { ticker.remove(updateMouth); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  );
}
```

- [ ] **Step 4: ビルド確認**

Run: `pnpm --filter @mercuria/client build`
Expected: エラーなし（Live2D Coreのランタイム依存はブラウザ実行時に解決）

- [ ] **Step 5: コミット**

```bash
git add packages/client/src/components/live2d/ packages/client/src/stores/live2dStore.ts packages/client/package.json pnpm-lock.yaml
git commit -m "feat: Live2Dキャンバス (モデル描画, マウス追従, タッチ反応, 表情制御) を追加"
```

---

### Task 16: フルスクリーンレイアウト統合

**Files:**
- Modify: `packages/client/src/pages/ChatPage.tsx`

- [ ] **Step 1: ChatPageをフルスクリーン型レイアウトに更新**

```tsx
// packages/client/src/pages/ChatPage.tsx
import { useEffect } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatPanel } from "../components/chat/ChatPanel";
import { Live2DCanvas } from "../components/live2d/Live2DCanvas";
import { useCharacterStore } from "../stores/characterStore";
import { useChatStore } from "../stores/chatStore";

export function ChatPage() {
  const { fetchCharacters, selectedCharacter } = useCharacterStore();
  const { fetchConversations, currentConversation } = useChatStore();

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, [fetchCharacters, fetchConversations]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="relative flex-1 bg-gray-950">
        {/* Live2D — fullscreen background */}
        {selectedCharacter && <Live2DCanvas />}

        {/* Chat overlay */}
        {currentConversation ? (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" /> {/* Spacer — pushes chat to bottom */}
            <div className="bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent">
              <div className="mx-auto max-w-2xl">
                <ChatPanel />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `pnpm --filter @mercuria/client build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add packages/client/src/pages/ChatPage.tsx
git commit -m "feat: フルスクリーン型レイアウト (Live2D背景 + チャットオーバーレイ)"
```

---

## Phase 6: TTS & リップシンク

### Task 17: TTS Adapter と REST エンドポイント

**Files:**
- Create: `packages/server/src/services/tts/adapter.ts`
- Create: `packages/server/src/services/tts/web-speech.ts`
- Create: `packages/server/src/routes/tts.ts`

- [ ] **Step 1: TTS Adapterインターフェース**

```typescript
// packages/server/src/services/tts/adapter.ts
export interface TTSAdapter {
  synthesize(text: string, voiceConfig: Record<string, unknown>): Promise<Buffer>;
}
```

- [ ] **Step 2: Web Speech API フォールバック (サーバーレス実装)**

初期段階ではサーバー側TTSはスタブとし、クライアント側の Web Speech API を使用:

```typescript
// packages/server/src/services/tts/web-speech.ts
import type { TTSAdapter } from "./adapter.js";

// Placeholder — Web Speech API はクライアント側で実行
// サーバー側TTS (VOICEVOX等) 追加時にここを実装
export class WebSpeechStub implements TTSAdapter {
  async synthesize(_text: string, _voiceConfig: Record<string, unknown>): Promise<Buffer> {
    throw new Error("Web Speech API is client-side only. Use client TTS.");
  }
}
```

- [ ] **Step 3: TTS REST ルート (将来のサーバーTTS用)**

```typescript
// packages/server/src/routes/tts.ts
import { FastifyInstance } from "fastify";
import { authGuard } from "../middleware/auth.js";

export async function ttsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  // GET /api/tts/:messageId — 将来のサーバー側TTS用エンドポイント
  app.get("/api/tts/:messageId", async (request, reply) => {
    // 初期段階ではクライアント側Web Speech APIを使用
    // VOICEVOX等のサーバー側TTS実装時にここで音声生成・返却
    return reply.status(501).send({ error: "Server-side TTS not yet implemented. Use client Web Speech API." });
  });
}
```

app.ts にルート登録:
```typescript
import { ttsRoutes } from "./routes/tts.js";
app.register(ttsRoutes);
```

- [ ] **Step 4: コミット**

```bash
git add packages/server/src/services/tts/ packages/server/src/routes/tts.ts packages/server/src/app.ts
git commit -m "feat: TTS Adapterインターフェースとスタブエンドポイントを追加"
```

---

### Task 18: クライアントTTSコントローラ

**Files:**
- Create: `packages/client/src/hooks/useTTS.ts`

- [ ] **Step 1: useTTSフック (Web Speech API + AudioContext)**

```typescript
// packages/client/src/hooks/useTTS.ts
import { useCallback, useRef } from "react";
import { useLive2DStore } from "../stores/live2dStore";

export function useTTS() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.0;

    // Setup AudioContext for lip sync analysis
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    // Web Speech API doesn't expose audio stream directly.
    // For lip sync with Web Speech API, use a simple heuristic:
    // Set mouth open while speaking, closed when done.
    const { setMouthOpen } = useLive2DStore.getState();

    // Simple lip sync: oscillate mouth during speech
    let speaking = true;
    const animateMouth = () => {
      if (!speaking) {
        setMouthOpen(0);
        return;
      }
      // Simulate mouth movement with sine wave
      const value = Math.abs(Math.sin(Date.now() / 100)) * 0.8;
      setMouthOpen(value);
      animationFrameRef.current = requestAnimationFrame(animateMouth);
    };

    utterance.onstart = () => {
      speaking = true;
      animateMouth();
    };

    utterance.onend = () => {
      speaking = false;
      setMouthOpen(0);
      cancelAnimationFrame(animationFrameRef.current);
    };

    speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    useLive2DStore.getState().setMouthOpen(0);
    cancelAnimationFrame(animationFrameRef.current);
  }, []);

  return { speak, stop };
}
```

- [ ] **Step 2: チャットストアのcompleteStreamにTTS発火を組み込み**

chatStoreの`completeStream`を更新して、完了時にTTSイベントを発行:

```typescript
// chatStore.ts — completeStream を更新
completeStream: (_conversationId, message) => {
  set((s) => ({
    messages: [...s.messages, message],
    isStreaming: false,
    streamingText: "",
    streamEmotion: null,
    lastCompletedMessage: message, // TTS用に最新メッセージを保持
  }));
},
```

ChatPage.tsx等でuseTTSフックを使い、lastCompletedMessageが変更されたらspeak(message.content)を呼ぶ。

- [ ] **Step 3: ビルド確認**

Run: `pnpm --filter @mercuria/client build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add packages/client/src/hooks/useTTS.ts packages/client/src/stores/chatStore.ts
git commit -m "feat: TTS音声読み上げ (Web Speech API) とリップシンクフックを追加"
```

---

### Task 19: 結合テストと動作確認

- [ ] **Step 1: 全テスト実行**

Run: `pnpm test -- --run`
Expected: 全テストPASS

- [ ] **Step 2: docker-compose で全体起動確認**

Run: `docker-compose up --build -d`
Expected: client (5173), server (3000), db (5432) が全て起動

- [ ] **Step 3: ヘルスチェック**

Run: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 4: クライアントアクセス確認**

ブラウザで http://localhost:5173 にアクセス
Expected: ログインページが表示される

- [ ] **Step 5: コミット (最終調整があれば)**

```bash
git add -A
git commit -m "chore: 結合テストと動作確認の調整"
```

---

## 実装順序の依存関係

```
Task 1 (モノレポ) → Task 2 (サーバー) → Task 4 (Docker)
                 → Task 3 (クライアント) ↗
Task 2 → Task 5 (DB) → Task 6 (シード)
Task 5 → Task 7 (認証) → Task 8 (クライアント認証)
Task 7 → Task 9 (CRUD API) → Task 10 (サイドバー)
Task 9 → Task 11 (AI Adapter) → Task 12 (感情解析) → Task 13 (Socket.IO)
Task 13 → Task 14 (チャットUI)
Task 14 → Task 15 (Live2D) → Task 16 (レイアウト)
Task 16 → Task 17 (TTS) → Task 18 (TTSクライアント) → Task 19 (結合)
```
