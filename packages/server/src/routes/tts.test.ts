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
