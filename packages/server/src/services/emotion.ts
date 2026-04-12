import type { Emotion } from "@mercuria/shared";

const EMOTION_TAG_REGEX = /^\[emotion:(happy|sad|surprised|angry|neutral)\]/;

export class EmotionParser {
  private buffer = "";
  private emotion: Emotion | null = null;
  private tagExtracted = false;
  private cleanText = "";

  feed(token: string): void {
    if (this.tagExtracted) {
      this.cleanText += token;
      return;
    }

    this.buffer += token;
    const match = this.buffer.match(EMOTION_TAG_REGEX);
    if (match) {
      this.emotion = match[1] as Emotion;
      this.tagExtracted = true;
      this.cleanText = this.buffer.slice(match[0].length);
    } else if (!this.buffer.startsWith("[") || (this.buffer.length > 30 && !this.buffer.includes("]"))) {
      this.tagExtracted = true;
      this.cleanText = this.buffer;
    }
  }

  getEmotion(): Emotion {
    return this.emotion ?? "neutral";
  }

  getCleanText(): string {
    return this.tagExtracted ? this.cleanText : this.buffer;
  }

  isTagExtracted(): boolean {
    return this.tagExtracted;
  }

  flush(): { emotion: Emotion; remainingText: string } {
    return {
      emotion: this.getEmotion(),
      remainingText: this.getCleanText(),
    };
  }
}
