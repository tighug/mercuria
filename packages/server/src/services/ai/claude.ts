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
