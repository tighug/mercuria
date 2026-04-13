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
