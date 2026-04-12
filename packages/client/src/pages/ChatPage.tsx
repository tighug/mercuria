import { useEffect } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { useCharacterStore } from "../stores/characterStore";
import { useChatStore } from "../stores/chatStore";

export function ChatPage() {
  const { fetchCharacters } = useCharacterStore();
  const { fetchConversations } = useChatStore();

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, [fetchCharacters, fetchConversations]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center bg-gray-950">
        <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
      </main>
    </div>
  );
}
