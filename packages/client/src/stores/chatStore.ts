import { create } from "zustand";
import type { Conversation, Message, Emotion } from "@mercuria/shared";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  streamingText: string;
  streamEmotion: Emotion | null;
  isStreaming: boolean;
  streamError: string | null;
  lastCompletedMessage: Message | null;
  fetchConversations: () => Promise<void>;
  createConversation: (characterId: string, aiProvider: string, aiModel: string) => Promise<Conversation>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => void;
  appendToken: (conversationId: string, token: string) => void;
  setStreamEmotion: (conversationId: string, emotion: Emotion) => void;
  completeStream: (conversationId: string, message: Message) => void;
  setStreamError: (error: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  streamingText: "",
  streamEmotion: null,
  isStreaming: false,
  streamError: null,
  lastCompletedMessage: null,

  fetchConversations: async () => {
    const conversations = await api.get("conversations").json<Conversation[]>();
    set({ conversations });
  },

  createConversation: async (characterId, aiProvider, aiModel) => {
    const conversation = await api
      .post("conversations", { json: { characterId, aiProvider, aiModel } })
      .json<Conversation>();
    set((s) => ({ conversations: [conversation, ...s.conversations], currentConversation: conversation, messages: [] }));
    return conversation;
  },

  selectConversation: async (conversation) => {
    const messages = await api
      .get(`conversations/${conversation.id}/messages`)
      .json<Message[]>();
    set({ currentConversation: conversation, messages });
  },

  deleteConversation: async (id) => {
    await api.delete(`conversations/${id}`);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      currentConversation: s.currentConversation?.id === id ? null : s.currentConversation,
      messages: s.currentConversation?.id === id ? [] : s.messages,
    }));
  },

  sendMessage: (content) => {
    const conv = get().currentConversation;
    if (!conv) return;
    const socket = getSocket();
    socket.emit("chat:send", { conversationId: conv.id, content });
    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: conv.id,
      role: "user",
      content,
      emotion: null,
      orderIndex: get().messages.length,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true, streamingText: "", streamEmotion: null, streamError: null }));
  },

  appendToken: (_conversationId, token) => {
    set((s) => ({ streamingText: s.streamingText + token }));
  },

  setStreamEmotion: (_conversationId, emotion) => {
    set({ streamEmotion: emotion });
  },

  completeStream: (_conversationId, message) => {
    set((s) => ({
      messages: [...s.messages, message],
      isStreaming: false,
      streamingText: "",
      streamEmotion: null,
      lastCompletedMessage: message,
    }));
  },

  setStreamError: (error) => {
    set({ isStreaming: false, streamError: error });
  },
}));
