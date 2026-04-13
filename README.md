# Mercuria

Live2D キャラクターと AI チャットができる Web アプリケーション。
キャラクターはチャット内容に応じて表情を変え、音声で読み上げます。

## 主な機能

- **AI チャット** — Claude / OpenAI によるリアルタイムストリーミング応答
- **Live2D キャラクター** — 感情に連動した表情変化、マウス追従、タッチ反応
- **音声読み上げ** — Web Speech API による TTS とリップシンク
- **OAuth 認証** — Google / GitHub ログイン
- **会話管理** — 会話履歴の保存・切り替え・削除

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 19, Vite 6, TypeScript, Tailwind CSS |
| 状態管理 | Zustand |
| Live2D | PixiJS 7, pixi-live2d-display |
| バックエンド | Fastify 5, TypeScript |
| データベース | PostgreSQL 17, Drizzle ORM |
| AI | Anthropic SDK (Claude), OpenAI SDK (GPT-4o) |
| 認証 | OAuth 2.0, JWT (Access + Refresh Token) |
| リアルタイム通信 | Socket.IO |
| パッケージ管理 | pnpm (monorepo) |
| インフラ | Docker, Docker Compose |

## アーキテクチャ

pnpm モノレポで 3 パッケージ構成:

```
packages/
├── client/   — React フロントエンド (port 5173)
├── server/   — Fastify バックエンド (port 3000)
└── shared/   — 共通型定義 & Zod スキーマ
```

## セットアップ

### 前提条件

- Node.js 22+
- pnpm
- Docker & Docker Compose

### 1. リポジトリのクローン

```bash
git clone https://github.com/tighug/mercuria.git
cd mercuria
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して必要な値を設定:

| 変数 | 説明 | 必須 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | Yes |
| `JWT_SECRET` | JWT 署名キー（本番では強固な値に変更） | Yes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | どちらか |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth | どちらか |
| `ANTHROPIC_API_KEY` | Claude API キー | どちらか |
| `OPENAI_API_KEY` | OpenAI API キー | どちらか |

### 4. Live2D Cubism Core の配置

Cubism Core SDK を [Live2D 公式サイト](https://www.live2d.com/sdk/download/web/) からダウンロードし、`live2dcubismcore.min.js` を以下に配置:

```
packages/client/public/lib/live2dcubismcore.min.js
```

### 5. 起動

#### Docker（推奨）

```bash
pnpm dev
```

これにより以下のサービスが起動します:

| サービス | ポート |
|----------|--------|
| Client (Vite) | http://localhost:5173 |
| Server (Fastify) | http://localhost:3000 |
| DB (PostgreSQL) | localhost:5432 |

#### ローカル開発（Docker なし）

PostgreSQL を別途起動した上で:

```bash
pnpm dev:server   # サーバー起動
pnpm dev:client   # クライアント起動（別ターミナル）
```

### 6. データベースのセットアップ

```bash
cd packages/server
pnpm drizzle-kit push   # スキーマ適用
pnpm seed               # サンプルキャラクター投入
```

## 開発コマンド

```bash
pnpm dev              # Docker Compose で全サービス起動
pnpm dev:client       # Vite dev server のみ
pnpm dev:server       # Fastify サーバーのみ
pnpm build            # 全パッケージビルド
pnpm test             # 全パッケージテスト (Vitest)
pnpm lint             # 全パッケージ Lint
```

### パッケージ単位の実行

```bash
pnpm --filter @mercuria/server test -- --run    # サーバーテストのみ
pnpm --filter @mercuria/client build            # クライアントビルドのみ
```

### データベース操作

```bash
cd packages/server
pnpm drizzle-kit generate   # マイグレーション生成
pnpm drizzle-kit push       # マイグレーション適用
pnpm seed                   # サンプルデータ投入
```
