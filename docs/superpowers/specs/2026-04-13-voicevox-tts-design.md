# VOICEVOX サーバーサイド TTS 統合 — 設計書

## 概要

Mercuria の TTS を Web Speech API（ブラウザ内蔵）から VOICEVOX ENGINE（サーバーサイド）に移行する。REST API 型で音声を取得し、AudioContext による再生と音量ベースのリップシンクを実現する。VOICEVOX をメインとしつつ、将来的に他エンジン（COEIROINK、Style-Bert-VITS2 等）にも切り替え可能な Adapter パターンを維持する。

## 設計方針

- **個人利用向け**: 高品質な音声による会話体験の向上が目的
- **REST API 型**: 既存スタブ `GET /api/tts/:messageId` を実装。チャット完了後にクライアントが音声を取得する
- **都度生成・使い捨て**: 音声キャッシュは行わない。VOICEVOX はローカル実行で十分高速
- **Web Speech API フォールバック**: VOICEVOX が利用不可の場合、既存の Web Speech API に自動フォールバック

## 全体アーキテクチャ

```
ブラウザ                   Fastify サーバー              VOICEVOX ENGINE
                                                        (Docker コンテナ)
  |                            |                            |
  | -- chat:send ----------->  |                            |
  |                            |-- AI Adapter --> Claude/OpenAI
  |   <-- chat:emotion ------  |                            |
  |   <-- chat:token --------  |                            |
  |   <-- chat:complete -----  |                            |
  |                            |                            |
  | -- GET /api/tts/:msgId --> |                            |
  |                            |-- TTSAdapter.synthesize() ->|
  |                            |   (POST /audio_query)       |
  |                            |   (POST /synthesis)         |
  |   <-- WAV バイナリ ------  |   <-- WAV ----------------  |
  |                            |                            |
  |  AudioContext で再生        |                            |
  |  + AnalyserNode リップシンク|                            |
```

### フロー

1. 既存のチャットフロー（`chat:send` → `chat:emotion` → `chat:token` → `chat:complete`）は変更なし
2. `chat:complete` 受信後、クライアントが `GET /api/tts/:messageId` で音声を取得
3. サーバーは VOICEVOX ENGINE の REST API を叩いて WAV を生成・返却
4. クライアントは AudioContext で再生し、AnalyserNode による音量解析でリップシンクを駆動

## サーバーサイド実装

### ファイル構成

```
packages/server/src/
├── config.ts                      # VOICEVOX_URL 追加
├── routes/
│   └── tts.ts                     # 既存スタブを実装
└── services/tts/
    ├── adapter.ts                 # 既存インターフェース (変更なし)
    ├── web-speech.ts              # 既存スタブ (変更なし)
    └── voicevox.ts                # 新規: VOICEVOX Adapter
```

### VoicevoxAdapter

`TTSAdapter` インターフェースの VOICEVOX 実装。Adapter はシンプルに保ち、話者ID の決定ロジックはルート側で行う。

**処理フロー:**

1. `voiceConfig.speakerId` を取り出す（ルート側で解決済みの値）
2. `POST /audio_query?text={text}&speaker={speakerId}` — テキストと話者IDを送り、音声合成用クエリ（JSON）を取得
3. `POST /synthesis?speaker={speakerId}` — クエリを送り、WAV バイナリを受信
4. WAV を Buffer として返却

Adapter は渡された `voiceConfig.speakerId` をそのまま使う。感情による話者切り替えはルート側の責務。

**コンストラクタ引数:**

- `baseUrl: string` — VOICEVOX ENGINE の URL（例: `http://voicevox:50021`）

### TTS ルートの実装

既存スタブ `GET /api/tts/:messageId` を実装:

1. `authGuard` で認証チェック
2. メッセージを DB から取得
3. 会話の所有者確認
4. キャラクターの `voiceConfig` と メッセージの `emotion` から最終的な話者IDを決定:
   - `emotionSpeakerMap[emotion]` があればそれを使用
   - なければ `speakerId`（デフォルト）にフォールバック
5. 解決済みの `speakerId` を含む `voiceConfig` で `VoicevoxAdapter.synthesize(text, { speakerId })` を呼び出し
6. `Content-Type: audio/wav` で返却

`TTSAdapter` インターフェースのシグネチャは変更不要。ルート側で話者IDを解決してから Adapter に渡す。

### config.ts の拡張

```typescript
VOICEVOX_URL: z.string().url().optional()  // デフォルト: undefined（未設定時はTTS無効）
```

### エラーハンドリング

| 状況 | サーバーの応答 |
|------|-------------|
| VOICEVOX 未起動・接続不可 | 503 Service Unavailable |
| 音声合成失敗 | 500 Internal Server Error |
| メッセージ未存在 | 404 Not Found |
| 認証エラー | 401 Unauthorized |
| VOICEVOX_URL 未設定 | 501 Not Implemented（現在のスタブと同じ） |

## Docker Compose 統合

### VOICEVOX ENGINE コンテナの追加

```yaml
voicevox:
  image: voicevox/voicevox_engine:latest
  ports:
    - "50021:50021"
  volumes:
    - voicevox-cache:/home/user/.local/share/voicevox
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:50021/speakers"]
    interval: 5s
    timeout: 3s
    retries: 10
    start_period: 30s

volumes:
  pgdata:          # 既存
  voicevox-cache:  # 追加
```

- CPU 版イメージを使用（GPU 版は `voicevox/voicevox_engine:nvidia-latest` で別途対応可能）
- `server` サービスに `depends_on: voicevox: condition: service_healthy` を追加（VOICEVOX のモデルロード完了を待機）
- キャッシュ用 volume でモデルデータの再ダウンロードを防止（トップレベル `volumes` に `voicevox-cache` を宣言）
- `.env.example` に `VOICEVOX_URL=http://voicevox:50021` を追加

## クライアントサイド実装

### ファイル構成

```
packages/client/src/
├── hooks/
│   └── useTTS.ts               # 書き換え: AudioContext ベースに変更
├── pages/
│   └── ChatPage.tsx            # 変更: speak() の呼び出しシグネチャ変更
└── services/
    └── api.ts                   # 既存 (変更なし、ky で /api/tts/:id を fetch)
```

### useTTS.ts の書き換え

**現在:** `speak(text: string)` — Web Speech API でテキスト読み上げ → `Math.sin` ベースの疑似リップシンク

**変更後のシグネチャ:** `speak(messageId: string, fallbackText: string)` — messageId でサーバーから WAV を取得、失敗時は fallbackText で Web Speech API フォールバック

**AudioContext のライフサイクル:** AudioContext はフック内で `useRef` により 1 つだけ保持する。再生のたびに生成・破棄しない（Chrome の同時 AudioContext 数制限を回避）。コンポーネントのアンマウント時のみ `AudioContext.close()` を呼ぶ。

**処理フロー:**

1. `chat:complete` でメッセージ受信
2. `GET /api/tts/:messageId` で WAV バイナリを fetch
3. `AudioContext.decodeAudioData()` で WAV をデコード
4. `AudioBufferSourceNode` で再生（AudioContext は `useRef` で保持した単一インスタンスを使用）
5. `AnalyserNode` で音量をリアルタイム取得（`getByteFrequencyData()`）
6. `requestAnimationFrame` ループで音量を 0.0〜1.0 に正規化し `setMouthOpen(value)` を更新
7. 再生完了時に `AudioBufferSourceNode` と `requestAnimationFrame` をクリーンアップ（AudioContext は破棄しない）

### ChatPage.tsx の変更

`lastCompletedMessage` 受信時の呼び出しを変更:

```typescript
// 変更前
speak(lastCompletedMessage.content)

// 変更後
speak(lastCompletedMessage.id, lastCompletedMessage.content)
```

### Web Speech API フォールバック

- `GET /api/tts/:messageId` が **5xx またはネットワークエラー** を返した場合のみ、`fallbackText` を使って Web Speech API にフォールバック
- **4xx エラー（401, 404 等）ではフォールバックしない** — 認証やデータの問題を隠さないため、音声再生をスキップする
- フォールバックはサイレントに行い、`console.warn` で警告を出力

### リップシンクの改善

現在の `Math.sin` ベースから、実際の音声波形に基づくリップシンクへ:

```
AudioBufferSourceNode → AnalyserNode → getByteFrequencyData()
→ 低〜中周波数帯の平均音量を算出 → 0.0〜1.0 に正規化 → setMouthOpen(value)
```

発声していない区間は口が閉じ、声の大きさに応じて口が動く自然な動作になる。

## 型定義の追加

`packages/shared/src/types.ts` に `VoiceConfig` 型を追加し、型安全性を確保する:

```typescript
export interface VoiceConfig {
  speakerId: number;
  emotionSpeakerMap?: Partial<Record<Emotion, number>>;
}
```

DB スキーマ（`packages/server/src/db/schema.ts`）の `voiceConfig` カラムの型も `$type<Record<string, unknown>>()` から `$type<VoiceConfig>()` に更新する。

## DB スキーマ変更

新しいテーブルやカラムの追加は不要。既存の `characters.voiceConfig` (JSONB) を活用する。`VoiceConfig` 型による型注釈の変更のみ。

### シードデータの更新

```typescript
// メルク（明るい声）
voiceConfig: {
  speakerId: 3,
  emotionSpeakerMap: {
    happy: 4,
    sad: 5
  }
}

// アリア（落ち着いた声）
voiceConfig: {
  speakerId: 2,
  emotionSpeakerMap: {}
}
```

実際の speakerId は VOICEVOX ENGINE の `GET /speakers` で利用可能な話者を確認して決定する。

## テスト方針

- `VoicevoxAdapter` のユニットテスト: VOICEVOX API 呼び出しをモックし、正しい話者ID選択ロジックを検証
- `GET /api/tts/:messageId` の統合テスト: 認証チェック、所有者確認、エラーケースの検証
- 手動テスト: Docker Compose 起動後、チャットで応答を受け取り音声が再生されることを確認

## 将来の拡張ポイント

- **他の TTS エンジン追加**: `TTSAdapter` を実装するだけで COEIROINK、Style-Bert-VITS2 等に対応可能
- **音声キャッシュ**: REST API 層にキャッシュミドルウェアを挿入可能
- **文分割ストリーミング**: Socket.IO 経由で文単位の音声を逐次送信する方式への発展
- **GPU 対応**: Docker イメージを `nvidia-latest` に切り替え、NVIDIA Container Toolkit で高速化
