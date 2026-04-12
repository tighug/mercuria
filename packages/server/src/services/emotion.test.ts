import { describe, it, expect } from "vitest";
import { EmotionParser } from "./emotion.js";

describe("EmotionParser", () => {
  it("extracts emotion tag from start of text", () => {
    const parser = new EmotionParser();
    parser.feed("[emotion:happy]こんにちは！");
    expect(parser.getEmotion()).toBe("happy");
    expect(parser.getCleanText()).toBe("こんにちは！");
  });

  it("handles token-by-token feeding", () => {
    const parser = new EmotionParser();
    parser.feed("[emo");
    parser.feed("tion:");
    parser.feed("sad]");
    parser.feed("悲しい");
    parser.feed("です");
    expect(parser.getEmotion()).toBe("sad");
    expect(parser.getCleanText()).toBe("悲しいです");
  });

  it("defaults to neutral when no tag found", () => {
    const parser = new EmotionParser();
    parser.feed("タグなしテキスト");
    expect(parser.getEmotion()).toBe("neutral");
    expect(parser.getCleanText()).toBe("タグなしテキスト");
  });

  it("returns buffered tokens after tag extraction", () => {
    const parser = new EmotionParser();
    parser.feed("[emotion:surprised]おお！");
    const result = parser.flush();
    expect(result.emotion).toBe("surprised");
    expect(result.remainingText).toBe("おお！");
  });
});
