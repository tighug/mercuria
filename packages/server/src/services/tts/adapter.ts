export interface TTSAdapter {
  synthesize(text: string, voiceConfig: Record<string, unknown>): Promise<Buffer>;
}
