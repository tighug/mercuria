# Mercuria — AI チャットアプリ設計書

## 概要

Live2Dキャラクターと会話できるWebチャットアプリケーション。AIの返答に連動してキャラクターが表情を変え、音声で読み上げる没入感のある会話体験を提供する。

- **初期フェーズ:** 個人利用
- **将来:** 一般公開

## 要件

| 項目 | 内容 |
|---|---|
| キャラクター | 複数キャラクター切り替え |
| AI API | 複数対応（Claude, OpenAI等）Adapterパターンで切り替え |
| データ保存 | サーバーサイド PostgreSQL |
| 技術スタック | React（フロント） + Fastify（バック）分離構成、モノレポ |
| 認証 | OAuth 2.0 ソーシャルログイン（Google, GitHub） |
| Live2Dモデル | 初期はサンプルモデルで開発 |
| Live2D振る舞い | 待機アニメ + リップシンク + 感情表現 + マウス追従 + タッチ反応 |
| チャット機能 | テキスト + TTS音声読み上げ（リップシンク連動） |
| デプロイ | Docker / Docker Compose |

## 全体アーキテクチャ

```
[ブラウザ]
  ├── React (Vite) — UI, Live2D描画, TTS再生
  ├── pixi-live2d-display — Live2Dモデルの描画・制御
  └── Socket.IO接続
        │
        ▼
[Fastify サーバー]
  ├── REST API — 認証, キャラクター管理, 会話履歴CRUD, TTS音声取得
  ├── Socket.IO — AIチャットのストリーミング配信
  ├── AI Adapter層 — Claude / OpenAI / 他APIの統一インターフェース
  └── TTS Adapter層 — 音声合成APIの統一インターフェース
        │
        ▼
[PostgreSQL] — ユーザー, キャラクター, 会話, メッセージ
```

- AIの返答はSocket.IOでストリーミング配信（トークン単位で逐次表示）
- REST APIは認証やCRUD操作、TTS音声取得に使用、チャットのリアルタイム通信はSocket.IOで分離
- AI Adapter層で各AIプロバイダーの差異を吸収し、切り替えを容易にする
- Live2Dの描画は `pixi-live2d-display`（PixiJS + Live2D Cubism SDK のラッパー）を使用

## データモデル

### User

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| email | string | メールアドレス |
| name | string | 表示名 |
| avatarUrl | string | アバターURL |
| provider | string | 認証プロバイダー (google / github) |
| providerId | string | プロバイダー側のユーザーID |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

### Character

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| name | string | キャラクター名 |
| description | string | キャラクター説明 |
| systemPrompt | text | AIへのシステムプロンプト（性格・口調の定義） |
| modelPath | string | Live2Dモデルファイルのパス |
| voiceConfig | jsonb | TTS設定（声の種類, 速度等） |
| emotionMap | jsonb | 感情→表情ファイル名のマッピング（モデルごとにカスタマイズ可能） |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

### Conversation

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| userId | UUID | → User |
| characterId | UUID | → Character |
| title | string | 会話タイトル（自動生成） |
| aiProvider | string | 使用AIプロバイダー (claude / openai等) |
| aiModel | string | 使用モデル名 |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

### Message

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| conversationId | UUID | → Conversation |
| role | string | user / assistant |
| content | text | テキスト本文 |
| emotion | string | 感情タグ (happy / sad / surprised / angry / neutral)、assistantのみ |
| orderIndex | integer | 表示順序 |
| createdAt | timestamp | 作成日時 |

## フロントエンド構成

### UIレイアウト: フルスクリーン型

Live2Dキャラクターが画面全体に表示され、チャットはオーバーレイで重ねる構成。キャラクターの存在感を最大化するVTuber風の体験。

### コンポーネント構成

```
App
├── AuthProvider (認証状態管理)
├── Sidebar
│   ├── CharacterSelector (キャラクター切り替え)
│   └── ConversationList (会話履歴一覧)
└── MainView
    ├── Live2DCanvas (PixiJS + pixi-live2d-display)
    │   ├── モデル描画
    │   ├── 表情制御 (emotion → モーション/表情マッピング)
    │   ├── リップシンク (TTS音声連動)
    │   ├── マウス追従 (目線・顔の向き)
    │   └── タッチ反応 (クリック → リアクション)
    ├── ChatPanel (オーバーレイ)
    │   ├── MessageList (会話ログ)
    │   └── MessageInput (テキスト入力 + 送信)
    └── TTSController (音声再生管理)
```

### 状態管理

Zustand を使用。ストア分割: `authStore`, `chatStore`, `characterStore`, `live2dStore`

### 主要ライブラリ

| 用途 | ライブラリ |
|---|---|
| Live2D描画 | pixi-live2d-display + PixiJS |
| 状態管理 | Zustand |
| ルーティング | React Router |
| HTTP通信 | ky |
| WebSocket | Socket.IO client (socket.io-client) |
| スタイリング | Tailwind CSS |

## バックエンド構成

### ディレクトリ構造

```
packages/server/src/
├── app.ts              # Fastifyアプリ初期化
├── routes/
│   ├── auth.ts         # 認証 (OAuth)
│   ├── characters.ts   # キャラクターCRUD
│   ├── conversations.ts # 会話CRUD
│   └── messages.ts     # メッセージ取得
├── ws/
│   └── chat.ts         # WebSocketチャットハンドラ
├── services/
│   ├── ai/
│   │   ├── adapter.ts  # AI Adapter インターフェース
│   │   ├── claude.ts   # Claude API実装
│   │   └── openai.ts   # OpenAI API実装
│   ├── tts/
│   │   ├── adapter.ts  # TTS Adapter インターフェース
│   │   └── voicevox.ts # VOICEVOX実装
│   └── emotion.ts      # 感情解析サービス
├── db/
│   ├── schema.ts       # Drizzle ORMスキーマ
│   └── migrations/
└── config.ts           # 環境変数・設定
```

### AI Adapter パターン

```typescript
interface AIAdapter {
  streamChat(params: {
    systemPrompt: string;
    messages: ChatMessage[];
    onToken: (token: string) => void;
    onComplete: (fullText: string) => void;
  }): Promise<void>;
}
```

各AI APIの実装がこのインターフェースに従い、チャット処理側はプロバイダーを意識しない。

### チャットのフロー

1. ユーザーがメッセージ送信 → Socket.IOで受信
2. キャラクターの `systemPrompt` + 会話履歴を組み立て（直近50件、トークン上限に応じて切り詰め）
3. AI Adapterでストリーミングリクエスト
4. 冒頭トークンをバッファリングし、感情タグ `[emotion:xxx]` を検出・抽出
5. emotion をクライアントに先行送信（`chat:emotion` イベント） → Live2D表情変更
6. 以降のトークンを逐次Socket.IOでクライアントへ配信（`chat:token` イベント）
7. 完了時にメッセージ + emotion をDBに保存（`chat:complete` イベント）

### 会話履歴のコンテキスト管理

- AI APIへ送信する会話履歴は直近50件を基本とする
- トークン数がモデルのコンテキスト上限の80%を超える場合、古いメッセージから除外
- 将来的に要約による圧縮を検討（初期スコープ外）

### 感情解析

AIの返答テキストから感情を判定する方法:
- AI APIへのリクエスト時に、返答の冒頭に `[emotion:happy]` のようなタグを付けるようシステムプロンプトで指示
- サーバー側でストリーミング開始時にバッファリングし、`]` の閉じタグを検出するまでトークンを蓄積
- タグ検出後、emotion を抽出してクライアントに先行送信し、以降のトークンはそのままストリーミング配信
- クライアントはemotionイベントを受信した時点でLive2Dの表情を即座に切り替え

### 主要ライブラリ

| 用途 | ライブラリ |
|---|---|
| フレームワーク | Fastify |
| WebSocket | fastify-socket.io (Socket.IO サーバー) |
| ORM | Drizzle ORM |
| 認証 | @fastify/oauth2 (Google, GitHub) |
| バリデーション | Zod |

## Live2D統合

### 描画パイプライン

```
PixiJS Application (Canvas)
└── pixi-live2d-display
    ├── モデルロード (.model3.json)
    ├── 待機モーション (idle)
    ├── 表情制御 (expression)
    ├── リップシンク (mouth parameter)
    ├── 目線追従 (eye/head parameter)
    └── タッチ反応 (hit area → motion)
```

### インタラクション詳細

**待機アニメーション**
- モデル付属のidleモーションをループ再生
- 呼吸、まばたき等の自然な動きはモデル側のパラメータで自動制御

**感情表現（emotion → 表情）**

```typescript
const emotionMap: Record<Emotion, string> = {
  happy:     "expression_happy",
  sad:       "expression_sad",
  surprised: "expression_surprised",
  angry:     "expression_angry",
  neutral:   "expression_default",
};
```

モデルの表情ファイル名にマッピング。Character テーブルに `emotionMap` (jsonb) カラムを追加し、モデルごとにカスタマイズ可能にする。デフォルト値は上記のマッピングを使用。

**リップシンク（TTS連動）**
- TTS音声を `AudioContext` で再生しつつ `AnalyserNode` で音量を取得
- 音量値を Live2D の口パラメータ (`ParamMouthOpenY`) にリアルタイム反映
- 音声なし時は `0` にリセット

**マウス追従**
- `mousemove` イベントからカーソル位置を取得
- Live2Dモデルの `ParamAngleX/Y`（顔の向き）と `ParamEyeBallX/Y`（目線）に反映
- `pixi-live2d-display` の `model.focus(x, y)` で簡易実装可能

**タッチ反応**
- モデルのヒットエリア（head, body等）をクリック判定
- ヒットエリアに応じたリアクションモーションを再生

### TTS（音声読み上げ）

- チャット完了後、サーバーがTTS APIを呼び出し、音声データ（MP3）をREST API (`GET /api/tts/:messageId`) で返却
- 長文の場合は文単位で分割し、最初のチャンクを優先返却してレイテンシを軽減
- クライアント側で `AudioContext` を使い再生 + リップシンク連動
- 初期段階では Web Speech API（ブラウザ内蔵）をフォールバックとして用意
- VOICEVOX等の外部APIにもAdapter構成で対応可能

## 認証とセキュリティ

### OAuth 2.0 フロー

```
[ブラウザ] → /auth/google → [Fastify] → Google OAuth → コールバック
                                          ↓
                                    ユーザー作成/取得
                                          ↓
                                    JWT発行 → Cookie設定 → リダイレクト
```

### WebSocket (Socket.IO) 認証

- Socket.IO接続時に `auth` オプションでCookieに含まれるJWTを送信
- サーバー側の Socket.IO ミドルウェアでJWTを検証、無効な場合は接続を拒否
- トークン期限切れ時はクライアントがREST APIでリフレッシュ後に再接続

### トークン管理

- **Access Token (JWT)** — httpOnly Cookie、有効期限15分
- **Refresh Token** — httpOnly Cookie、有効期限7日、DBに保存してローテーション
- Refresh Token再利用検知時（同一トークンが2回使用された場合）、該当ユーザーの全Refresh Tokenを無効化（トークン盗難対策）

### AI APIキー管理

- 初期フェーズ: サーバー側の環境変数で管理（サーバー共有キー）
- 一般公開フェーズ: ユーザーが自身のAPIキーを登録する仕組みを追加（暗号化してDBに保存）
- APIキーは復号可能な暗号化（AES-256-GCM）で保存し、リクエスト時にのみ復号

### セキュリティ対策

| 脅威 | 対策 |
|---|---|
| CSRF | SameSite=Strict Cookie + Origin検証 |
| XSS | httpOnly Cookie（JSからトークンアクセス不可） |
| API不正利用 | レート制限（`@fastify/rate-limit`） |
| CORS | 許可オリジンをホワイトリスト指定 |
| SQLインジェクション | Drizzle ORM のパラメータバインディング |
| APIキー漏洩 | サーバー側環境変数で管理、クライアントには露出しない |

## Docker構成

### Docker Compose (開発)

```yaml
services:
  client:       # React (Vite) — ホットリロード有効
  server:       # Fastify — ts-node + watch
  db:           # PostgreSQL
```

### 本番デプロイ

- client: 静的ビルド → Nginx配信
- server: Node.js イメージ
- db: PostgreSQL (マネージドDB推奨)

## プロジェクトディレクトリ構成

```
mercuria/
├── packages/
│   ├── client/                # React (Vite + TypeScript)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── chat/      # ChatPanel, MessageList, MessageInput
│   │   │   │   ├── live2d/    # Live2DCanvas, Live2DController
│   │   │   │   ├── sidebar/   # Sidebar, CharacterSelector, ConversationList
│   │   │   │   └── ui/        # 共通UIコンポーネント
│   │   │   ├── hooks/         # カスタムフック
│   │   │   ├── stores/        # Zustand ストア
│   │   │   ├── services/      # API通信, WebSocket管理
│   │   │   ├── types/         # クライアント固有の型
│   │   │   └── App.tsx
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── server/                # Fastify (TypeScript)
│   │   ├── src/
│   │   │   ├── routes/        # REST APIルート
│   │   │   ├── ws/            # WebSocketハンドラ
│   │   │   ├── services/      # AI Adapter, TTS Adapter, 感情解析
│   │   │   ├── db/            # Drizzle スキーマ, マイグレーション
│   │   │   └── app.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   └── shared/                # 共通パッケージ
│       ├── src/
│       │   ├── types.ts       # 共通型定義 (Message, Character等)
│       │   └── schemas.ts     # Zodバリデーションスキーマ
│       └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

## 技術スタック一覧

| レイヤー | 技術 |
|---|---|
| フロントエンド | React, Vite, TypeScript, Tailwind CSS, Zustand, React Router |
| Live2D | PixiJS, pixi-live2d-display |
| バックエンド | Fastify, TypeScript, Drizzle ORM, Zod |
| AI | Claude API, OpenAI API（Adapter パターン） |
| TTS | Web Speech API (フォールバック) + 外部API対応 |
| 認証 | OAuth 2.0 (Google, GitHub), JWT |
| DB | PostgreSQL |
| 通信 | REST (CRUD) + Socket.IO (チャットストリーミング) |
| インフラ | Docker, Docker Compose, pnpm workspaces |
