import type { TTSAdapter } from "./adapter.js";

export class WebSpeechStub implements TTSAdapter {
  async synthesize(_text: string, _voiceConfig: Record<string, unknown>): Promise<Buffer> {
    throw new Error("Web Speech API is client-side only. Use client TTS.");
  }
}
