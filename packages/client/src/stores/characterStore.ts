import { create } from "zustand";
import type { Character } from "@mercuria/shared";
import { api } from "../services/api";

interface CharacterState {
  characters: Character[];
  selectedCharacter: Character | null;
  fetchCharacters: () => Promise<void>;
  selectCharacter: (character: Character) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  characters: [],
  selectedCharacter: null,
  fetchCharacters: async () => {
    const characters = await api.get("characters").json<Character[]>();
    set({ characters, selectedCharacter: characters[0] ?? null });
  },
  selectCharacter: (character) => set({ selectedCharacter: character }),
}));
