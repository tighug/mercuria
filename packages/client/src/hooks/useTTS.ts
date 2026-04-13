import { useCallback, useRef, useEffect } from "react";
import { useLive2DStore } from "../stores/live2dStore";

export function useTTS() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // AudioContext を遅延初期化（ユーザー操作後でないと作成できない場合があるため）
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current = null;
    }
    cancelAnimationFrame(animationFrameRef.current);
    useLive2DStore.getState().setMouthOpen(0);
  }, []);

  const speakWithWebSpeech = useCallback((text: string) => {
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

  const speak = useCallback(async (messageId: string, fallbackText: string) => {
    stop();

    try {
      const res = await fetch(`/api/tts/${messageId}`, { credentials: "include" });

      // 4xx はフォールバックしない（認証・データの問題を隠さない）
      if (res.status >= 400 && res.status < 500) {
        console.warn(`TTS request failed with ${res.status}, skipping audio`);
        return;
      }

      // 5xx / ネットワークエラーは Web Speech API にフォールバック
      if (!res.ok) {
        console.warn(`TTS server error (${res.status}), falling back to Web Speech API`);
        speakWithWebSpeech(fallbackText);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioContext = getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const { setMouthOpen } = useLive2DStore.getState();

      // AnalyserNode でリップシンク
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      sourceNodeRef.current = source;

      // リップシンクアニメーション
      const animateMouth = () => {
        analyser.getByteFrequencyData(dataArray);
        // 低〜中周波数帯（人声の範囲）の平均音量を取得
        const voiceRange = dataArray.slice(0, Math.floor(dataArray.length / 4));
        const avg = voiceRange.reduce((sum, v) => sum + v, 0) / voiceRange.length;
        const normalized = Math.min(avg / 128, 1.0);
        setMouthOpen(normalized);
        animationFrameRef.current = requestAnimationFrame(animateMouth);
      };

      source.onended = () => {
        sourceNodeRef.current = null;
        cancelAnimationFrame(animationFrameRef.current);
        setMouthOpen(0);
      };

      source.start();
      animateMouth();
    } catch (err) {
      // ネットワークエラー等 — Web Speech API にフォールバック
      console.warn("TTS fetch failed, falling back to Web Speech API:", err);
      speakWithWebSpeech(fallbackText);
    }
  }, [stop, getAudioContext, speakWithWebSpeech]);

  // クリーンアップ: コンポーネントアンマウント時に AudioContext を閉じる
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop]);

  return { speak, stop };
}
