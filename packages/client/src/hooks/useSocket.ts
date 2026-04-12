import { useEffect, useRef } from "react";
import { getSocket, disconnectSocket } from "../services/socket";
import { useChatStore } from "../stores/chatStore";
import type { ChatTokenPayload, ChatEmotionPayload, ChatCompletePayload, ChatErrorPayload } from "@mercuria/shared";

export function useSocket() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = getSocket();

    socket.on("chat:token", (payload: ChatTokenPayload) => {
      useChatStore.getState().appendToken(payload.conversationId, payload.token);
    });

    socket.on("chat:emotion", (payload: ChatEmotionPayload) => {
      useChatStore.getState().setStreamEmotion(payload.conversationId, payload.emotion);
    });

    socket.on("chat:complete", (payload: ChatCompletePayload) => {
      useChatStore.getState().completeStream(payload.conversationId, payload.message);
    });

    socket.on("chat:error", (payload: ChatErrorPayload) => {
      useChatStore.getState().setStreamError(payload.error);
    });

    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, []);
}
