import { describe, it, expect } from "vitest";
import type { AIAdapter } from "./adapter.js";

const mockAdapter: AIAdapter = {
  async streamChat({ onToken, onComplete }) {
    const tokens = ["Hello", " ", "world"];
    for (const t of tokens) onToken(t);
    onComplete("Hello world");
  },
};

describe("AIAdapter interface", () => {
  it("streams tokens and completes", async () => {
    const tokens: string[] = [];
    let result = "";
    await mockAdapter.streamChat({
      systemPrompt: "test",
      messages: [],
      onToken: (t) => tokens.push(t),
      onComplete: (text) => { result = text; },
    });
    expect(tokens).toEqual(["Hello", " ", "world"]);
    expect(result).toBe("Hello world");
  });
});
