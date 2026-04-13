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
