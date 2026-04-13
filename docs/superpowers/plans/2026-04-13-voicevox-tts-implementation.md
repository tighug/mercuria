# VOICEVOX サーバーサイド TTS 統合 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VOICEVOX ENGINE によるサーバーサイド TTS を統合し、AudioContext ベースの音声再生と音量解析リップシンクを実現する

**Architecture:** 既存の TTSAdapter インターフェースを実装する VoicevoxAdapter を新規作成し、TTS ルートのスタブを置き換える。クライアントは chat:complete 後に REST API で音声を取得し、AudioContext + AnalyserNode で再生・リップシンクを行う。VOICEVOX 利用不可時は Web Speech API にフォールバック。

**Tech Stack:** VOICEVOX ENGINE (Docker), Fastify 5, Vitest, React 19, Web Audio API

**Spec:** `docs/superpowers/specs/2026-04-13-voicevox-tts-design.md`

---

## ファイル構成

### 新規作成
- `packages/server/src/services/tts/voicevox.ts` — VoicevoxAdapter（VOICEVOX ENGINE への HTTP リクエスト）
- `packages/server/src/services/tts/voicevox.test.ts` — VoicevoxAdapter のユニットテスト
- `packages/server/src/routes/tts.test.ts` — TTS ルートの統合テスト

### 変更
- `packages/shared/src/types.ts` — VoiceConfig 型追加、Character.voiceConfig の型変更
- `packages/server/src/config.ts` — VOICEVOX_URL 追加
- `packages/server/src/db/schema.ts` — voiceConfig カラムの型注釈を VoiceConfig に変更
- `packages/server/src/db/seed.ts` — サンプルキャラクターに speakerId を設定
- `packages/server/src/routes/tts.ts` — スタブを完全実装に置き換え
- `packages/client/src/hooks/useTTS.ts` — AudioContext ベースに書き換え
- `packages/client/src/pages/ChatPage.tsx` — speak() 呼び出しシグネチャ変更
- `docker-compose.yml` — VOICEVOX ENGINE コンテナ追加
- `.env.example` — VOICEVOX_URL 追加

---

## Task 1: VoiceConfig 型定義の追加

**Files:**
- Modify: `packages/shared/src/types.ts:1-27`

- [ ] **Step 1: VoiceConfig インターフェースを追加**

`Emotion` 型の直後（4行目の後）に追加:

```typescript
export interface VoiceConfig {
  speakerId: number;
  emotionSpeakerMap?: Partial<Record<Emotion, number>>;
}
```

- [ ] **Step 2: Character インターフェースの voiceConfig 型を変更**

`Character` インターフェース内の `voiceConfig` フィールドを変更:

```typescript
// 変更前
voiceConfig: Record<string, unknown>;

// 変更後
voiceConfig: VoiceConfig;
```

- [ ] **Step 3: 型チェックを実行**

Run: `pnpm --filter @mercuria/shared typecheck`
Expected: PASS（shared パッケージ内の変更は自己完結しており、server の schema.ts は別パッケージのため影響しない）

- [ ] **Step 4: コミット**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: VoiceConfig型を追加しCharacterインターフェースに適用"
```

---

## Task 2: サーバー設定と DB スキーマの更新

**Files:**
- Modify: `packages/server/src/config.ts:1-17`
- Modify: `packages/server/src/db/schema.ts:22`
- Modify: `packages/server/src/db/seed.ts:13,30`

- [ ] **Step 1: config.ts に VOICEVOX_URL を追加**

`envSchema` の `z.object({...})` 内に追加:

```typescript
VOICEVOX_URL: z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.string().url().optional(),
),
```

注: `z.preprocess` で空文字列を `undefined` に変換する。開発者が `.env` で `VOICEVOX_URL=`（空値）と記述した場合に `.url()` バリデーションエラーでサーバーがクラッシュするのを防ぐ。

- [ ] **Step 2: schema.ts の voiceConfig 型注釈を更新**

`VoiceConfig` を import し、`$type` を変更:

```typescript
// ファイル先頭に追加
import type { VoiceConfig } from "@mercuria/shared";

// 22行目を変更
// 変更前
voiceConfig: jsonb("voice_config").$type<Record<string, unknown>>().notNull().default({}),

// 変更後
voiceConfig: jsonb("voice_config").$type<VoiceConfig>().notNull().default({ speakerId: 0 }),
```

- [ ] **Step 3: seed.ts の voiceConfig を更新**

メルクの voiceConfig（13行目付近）:

```typescript
voiceConfig: { speakerId: 3, emotionSpeakerMap: { happy: 4, sad: 5 } },
```

アリアの voiceConfig（30行目付近）:

```typescript
voiceConfig: { speakerId: 2 },
```

注: 実際の speakerId は VOICEVOX ENGINE の `GET /speakers` で確認して調整する。

- [ ] **Step 4: 型チェックを実行**

Run: `pnpm --filter @mercuria/server typecheck`
Expected: PASS（web-speech.ts の `Record<string, unknown>` 引数は VoiceConfig と構造的に互換）

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/config.ts packages/server/src/db/schema.ts packages/server/src/db/seed.ts
git commit -m "feat: VOICEVOX_URL設定追加とDBスキーマ・シードのVoiceConfig対応"
```

---

## Task 3: VoicevoxAdapter の実装（TDD）

**Files:**
- Create: `packages/server/src/services/tts/voicevox.ts`
- Create: `packages/server/src/services/tts/voicevox.test.ts`

- [ ] **Step 1: テストファイルを作成**

`packages/server/src/services/tts/voicevox.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoicevoxAdapter } from "./voicevox.js";

// global.fetch をモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("VoicevoxAdapter", () => {
  let adapter: VoicevoxAdapter;

  beforeEach(() => {
    adapter = new VoicevoxAdapter("http://localhost:50021");
    mockFetch.mockReset();
  });

  it("audio_query と synthesis を正しい speakerId で呼び出す", async () => {
    const mockQuery = { accent_phrases: [] };
    const mockWav = new ArrayBuffer(44);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuery),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockWav),
      });

    const result = await adapter.synthesize("こんにちは", { speakerId: 3 });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // audio_query の URL と method を検証
    const [queryUrl, queryOpts] = mockFetch.mock.calls[0];
    expect(queryUrl).toBe("http://localhost:50021/audio_query?text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF&speaker=3");
    expect(queryOpts.method).toBe("POST");

    // synthesis の URL と method を検証
    const [synthUrl, synthOpts] = mockFetch.mock.calls[1];
    expect(synthUrl).toBe("http://localhost:50021/synthesis?speaker=3");
    expect(synthOpts.method).toBe("POST");
    expect(synthOpts.headers["Content-Type"]).toBe("application/json");

    expect(result).toBeInstanceOf(Buffer);
  });

  it("audio_query が失敗したらエラーを投げる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      adapter.synthesize("テスト", { speakerId: 1 })
    ).rejects.toThrow("VOICEVOX audio_query failed: 500 Internal Server Error");
  });

  it("synthesis が失敗したらエラーを投げる", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accent_phrases: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

    await expect(
      adapter.synthesize("テスト", { speakerId: 1 })
    ).rejects.toThrow("VOICEVOX synthesis failed: 500 Internal Server Error");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/server && pnpm test -- --run src/services/tts/voicevox.test.ts`
Expected: FAIL — `Cannot find module './voicevox.js'`

- [ ] **Step 3: VoicevoxAdapter を実装**

`packages/server/src/services/tts/voicevox.ts`:

```typescript
import type { TTSAdapter } from "./adapter.js";

export class VoicevoxAdapter implements TTSAdapter {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async synthesize(text: string, voiceConfig: Record<string, unknown>): Promise<Buffer> {
    const speakerId = voiceConfig.speakerId as number;

    // Step 1: audio_query
    const queryUrl = `${this.baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
    const queryRes = await fetch(queryUrl, { method: "POST" });
    if (!queryRes.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${queryRes.status} ${queryRes.statusText}`);
    }
    const audioQuery = await queryRes.json();

    // Step 2: synthesis
    const synthUrl = `${this.baseUrl}/synthesis?speaker=${speakerId}`;
    const synthRes = await fetch(synthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(audioQuery),
    });
    if (!synthRes.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${synthRes.status} ${synthRes.statusText}`);
    }

    const arrayBuffer = await synthRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

- [ ] **Step 4: テストが成功することを確認**

Run: `cd packages/server && pnpm test -- --run src/services/tts/voicevox.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: コミット**

```bash
git add packages/server/src/services/tts/voicevox.ts packages/server/src/services/tts/voicevox.test.ts
git commit -m "feat: VoicevoxAdapter実装とユニットテスト追加"
```

---

## Task 4: TTS ルートの実装

**Files:**
- Modify: `packages/server/src/routes/tts.ts:1-10`

- [ ] **Step 1: TTS ルートを書き換え**

`packages/server/src/routes/tts.ts` を以下に置き換え:

```typescript
import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { messages, conversations, characters } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authGuard } from "../middleware/auth.js";
import { VoicevoxAdapter } from "../services/tts/voicevox.js";
import { config } from "../config.js";
import type { Emotion } from "@mercuria/shared";

export async function ttsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authGuard);

  app.get("/api/tts/:messageId", async (request, reply) => {
    if (!config.VOICEVOX_URL) {
      return reply.status(501).send({ error: "Server-side TTS not configured. Set VOICEVOX_URL." });
    }

    const { messageId } = request.params as { messageId: string };

    // メッセージ取得
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    // 会話の所有者確認
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, message.conversationId), eq(conversations.userId, request.userId)));
    if (!conv) {
      return reply.status(404).send({ error: "Conversation not found" });
    }

    // キャラクター取得
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, conv.characterId));
    if (!character) {
      return reply.status(404).send({ error: "Character not found" });
    }

    // 話者ID解決: emotionSpeakerMap[emotion] ?? speakerId
    const emotion = message.emotion as Emotion | null;
    const resolvedSpeakerId =
      (emotion && character.voiceConfig.emotionSpeakerMap?.[emotion]) ?? character.voiceConfig.speakerId;

    try {
      const adapter = new VoicevoxAdapter(config.VOICEVOX_URL);
      const wav = await adapter.synthesize(message.content, { speakerId: resolvedSpeakerId });
      return reply.type("audio/wav").send(wav);
    } catch (err) {
      const isConnectionError = err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"));
      if (isConnectionError) {
        return reply.status(503).send({ error: "VOICEVOX ENGINE is not available" });
      }
      return reply.status(500).send({ error: "TTS synthesis failed" });
    }
  });
}
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm --filter @mercuria/server typecheck`
Expected: PASS

- [ ] **Step 3: 既存テストが壊れていないことを確認**

Run: `pnpm --filter @mercuria/server test -- --run`
Expected: ALL PASS

- [ ] **Step 4: コミット**

```bash
git add packages/server/src/routes/tts.ts
git commit -m "feat: TTSルートを実装 (VOICEVOX連携、話者ID解決、エラーハンドリング)"
```

---

## Task 5: 話者ID解決ロジックのユニットテスト

**Files:**
- Create: `packages/server/src/routes/tts.test.ts`

話者ID解決ロジック（`emotionSpeakerMap` による感情→話者の解決）を純粋なユニットテストで検証する。ルートハンドラの統合テスト（認証、DB 所有者確認、HTTP エラーケース）は手動テスト（Task 9）でカバーする。

- [ ] **Step 1: テストファイルを作成**

`packages/server/src/routes/tts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { VoiceConfig, Emotion } from "@mercuria/shared";

/**
 * TTS ルートで使用する話者ID解決ロジック。
 * ルート実装と同じアルゴリズムをテスト対象として抽出。
 */
function resolveSpeakerId(voiceConfig: VoiceConfig, emotion: Emotion | null): number {
  return (emotion && voiceConfig.emotionSpeakerMap?.[emotion]) ?? voiceConfig.speakerId;
}

describe("話者ID解決ロジック", () => {
  it("emotionSpeakerMap に該当する感情があれば、そのスピーカーIDを使う", () => {
    const voiceConfig: VoiceConfig = { speakerId: 3, emotionSpeakerMap: { happy: 4, sad: 5 } };
    expect(resolveSpeakerId(voiceConfig, "happy")).toBe(4);
  });

  it("emotionSpeakerMap に該当しない感情はデフォルト speakerId を使う", () => {
    const voiceConfig: VoiceConfig = { speakerId: 3, emotionSpeakerMap: { happy: 4, sad: 5 } };
    expect(resolveSpeakerId(voiceConfig, "angry")).toBe(3);
  });

  it("emotionSpeakerMap が未定義ならデフォルト speakerId を使う", () => {
    const voiceConfig: VoiceConfig = { speakerId: 2 };
    expect(resolveSpeakerId(voiceConfig, "happy")).toBe(2);
  });

  it("emotion が null ならデフォルト speakerId を使う", () => {
    const voiceConfig: VoiceConfig = { speakerId: 3, emotionSpeakerMap: { happy: 4 } };
    expect(resolveSpeakerId(voiceConfig, null)).toBe(3);
  });
});
```

- [ ] **Step 2: テストを実行**

Run: `cd packages/server && pnpm test -- --run src/routes/tts.test.ts`
Expected: 4 tests PASS

- [ ] **Step 3: コミット**

```bash
git add packages/server/src/routes/tts.test.ts
git commit -m "test: 話者ID解決ロジック (emotionSpeakerMap) のユニットテストを追加"
```

---

## Task 6: Docker Compose と環境変数の更新

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: docker-compose.yml に VOICEVOX サービスを追加**

`client` サービスの後（`volumes:` セクションの前）に追加:

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
```

`server` サービスの `depends_on` を変更:

```yaml
    depends_on:
      db:
        condition: service_started
      voicevox:
        condition: service_healthy
```

`server` サービスの `environment` に追加:

```yaml
      VOICEVOX_URL: http://voicevox:50021
```

トップレベル `volumes` に追加:

```yaml
volumes:
  pgdata:
  voicevox-cache:
```

- [ ] **Step 2: .env.example に VOICEVOX_URL を追加**

末尾に追加:

```
VOICEVOX_URL=http://localhost:50021
```

注: `.env.example` ではローカル開発向けに `localhost` を使用する。Docker Compose 内では `docker-compose.yml` の `environment` ブロックで `http://voicevox:50021` に上書きされる（`DATABASE_URL` と同じパターン）。

- [ ] **Step 3: コミット**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: Docker ComposeにVOICEVOX ENGINEコンテナを追加"
```

---

## Task 7: クライアント useTTS フックの書き換え

**Files:**
- Modify: `packages/client/src/hooks/useTTS.ts:1-48`

- [ ] **Step 1: useTTS.ts を AudioContext ベースに書き換え**

`packages/client/src/hooks/useTTS.ts` を以下に置き換え:

```typescript
import { useCallback, useRef, useEffect } from "react";
import { useLive2DStore } from "../stores/live2dStore";

export function useTTS() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // AudioContext を遅延初期化（ユーザー操作後でないと作成できない場合があるため）
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current = null;
    }
    cancelAnimationFrame(animationFrameRef.current);
    useLive2DStore.getState().setMouthOpen(0);
  }, []);

  const speakWithWebSpeech = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.0;

    const { setMouthOpen } = useLive2DStore.getState();

    let speaking = true;
    const animateMouth = () => {
      if (!speaking) {
        setMouthOpen(0);
        return;
      }
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

  const speak = useCallback(async (messageId: string, fallbackText: string) => {
    stop();

    try {
      const res = await fetch(`/api/tts/${messageId}`, { credentials: "include" });

      // 4xx はフォールバックしない（認証・データの問題を隠さない）
      if (res.status >= 400 && res.status < 500) {
        console.warn(`TTS request failed with ${res.status}, skipping audio`);
        return;
      }

      // 5xx / ネットワークエラーは Web Speech API にフォールバック
      if (!res.ok) {
        console.warn(`TTS server error (${res.status}), falling back to Web Speech API`);
        speakWithWebSpeech(fallbackText);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioContext = getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const { setMouthOpen } = useLive2DStore.getState();

      // AnalyserNode でリップシンク
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      sourceNodeRef.current = source;

      // リップシンクアニメーション
      const animateMouth = () => {
        analyser.getByteFrequencyData(dataArray);
        // 低〜中周波数帯（人声の範囲）の平均音量を取得
        const voiceRange = dataArray.slice(0, Math.floor(dataArray.length / 4));
        const avg = voiceRange.reduce((sum, v) => sum + v, 0) / voiceRange.length;
        const normalized = Math.min(avg / 128, 1.0);
        setMouthOpen(normalized);
        animationFrameRef.current = requestAnimationFrame(animateMouth);
      };

      source.onended = () => {
        sourceNodeRef.current = null;
        cancelAnimationFrame(animationFrameRef.current);
        setMouthOpen(0);
      };

      source.start();
      animateMouth();
    } catch (err) {
      // ネットワークエラー等 — Web Speech API にフォールバック
      console.warn("TTS fetch failed, falling back to Web Speech API:", err);
      speakWithWebSpeech(fallbackText);
    }
  }, [stop, getAudioContext, speakWithWebSpeech]);

  // クリーンアップ: コンポーネントアンマウント時に AudioContext を閉じる
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop]);

  return { speak, stop };
}
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm --filter @mercuria/client typecheck`
Expected: FAIL — `ChatPage.tsx` の `speak(lastCompletedMessage.content)` が引数不一致でエラー。次の Task 8 で修正する。

- [ ] **Step 3: コミット**

```bash
git add packages/client/src/hooks/useTTS.ts
git commit -m "feat: useTTSフックをAudioContextベースに書き換え (VOICEVOX対応、リップシンク改善)"
```

---

## Task 8: ChatPage.tsx の speak() 呼び出し更新

**Files:**
- Modify: `packages/client/src/pages/ChatPage.tsx:29`

- [ ] **Step 1: speak() 呼び出しを変更**

29行目を変更:

```typescript
// 変更前
speak(lastCompletedMessage.content);

// 変更後
speak(lastCompletedMessage.id, lastCompletedMessage.content);
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm --filter @mercuria/client typecheck`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add packages/client/src/pages/ChatPage.tsx
git commit -m "feat: ChatPageのspeak呼び出しをmessageId+fallbackText形式に変更"
```

---

## Task 9: 全体テストと動作確認

**Files:** なし（テスト実行のみ）

- [ ] **Step 1: サーバーの全テストを実行**

Run: `pnpm --filter @mercuria/server test -- --run`
Expected: ALL PASS

- [ ] **Step 2: クライアントの型チェック**

Run: `pnpm --filter @mercuria/client typecheck`
Expected: PASS

- [ ] **Step 3: 全体ビルド**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: 手動テスト（Docker Compose 起動後）**

Run: `pnpm dev`

確認項目:
1. VOICEVOX ENGINE が正常に起動すること（`curl http://localhost:50021/speakers` でレスポンスが返る）
2. チャット送信後、AI 応答完了時にサーバーサイド音声が再生されること
3. リップシンクが音声波形に連動して動くこと
4. VOICEVOX コンテナを停止した場合、Web Speech API にフォールバックすること
