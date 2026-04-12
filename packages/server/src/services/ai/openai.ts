import OpenAI from "openai";
import type { AIAdapter, StreamChatParams } from "./adapter.js";
import { config } from "../../config.js";

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async streamChat({ systemPrompt, messages, onToken, onComplete }: StreamChatParams): Promise<void> {
    let fullText = "";
    const stream = await this.client.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullText += token;
        onToken(token);
      }
    }
    onComplete(fullText);
  }
}
