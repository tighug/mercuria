import { create } from "zustand";
import type { User } from "@mercuria/shared";
import { api } from "../services/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const user = await api.get("auth/me").json<User>();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await api.post("auth/logout");
    set({ user: null });
  },
}));
