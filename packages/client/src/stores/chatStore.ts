import { create } from "zustand";
import type { Conversation, Message } from "@mercuria/shared";
import { api } from "../services/api";

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  fetchConversations: () => Promise<void>;
  createConversation: (characterId: string, aiProvider: string, aiModel: string) => Promise<Conversation>;
  selectConversation: (conversation: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
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
}));
