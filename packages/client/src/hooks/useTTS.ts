import { useCallback, useRef } from "react";
import { useLive2DStore } from "../stores/live2dStore";

export function useTTS() {
  const animationFrameRef = useRef<number>(0);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.0;

    const { setMouthOpen } = useLive2DStore.getState();

    let speaking = true;
    const animateMouth = () => {
      if (!speaking) {
        setMouthOpen(0);
        return;
      }
      const value = Math.abs(Math.sin(Date.now() / 100)) * 0.8;
      setMouthOpen(value);
      animationFrameRef.current = requestAnimationFrame(animateMouth);
    };

    utterance.onstart = () => {
      speaking = true;
      animateMouth();
    };

    utterance.onend = () => {
      speaking = false;
      setMouthOpen(0);
      cancelAnimationFrame(animationFrameRef.current);
    };

    speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    useLive2DStore.getState().setMouthOpen(0);
    cancelAnimationFrame(animationFrameRef.current);
  }, []);

  return { speak, stop };
}
