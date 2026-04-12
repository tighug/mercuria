import { create } from "zustand";
import type { Emotion } from "@mercuria/shared";

interface Live2DState {
  currentEmotion: Emotion;
  mouthOpenValue: number;
  setEmotion: (emotion: Emotion) => void;
  setMouthOpen: (value: number) => void;
}

export const useLive2DStore = create<Live2DState>((set) => ({
  currentEmotion: "neutral",
  mouthOpenValue: 0,
  setEmotion: (emotion) => set({ currentEmotion: emotion }),
  setMouthOpen: (value) => set({ mouthOpenValue: value }),
}));
