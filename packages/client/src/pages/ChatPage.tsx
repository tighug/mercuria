import { useEffect } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatPanel } from "../components/chat/ChatPanel";
import { useCharacterStore } from "../stores/characterStore";
import { useChatStore } from "../stores/chatStore";
import { useSocket } from "../hooks/useSocket";

export function ChatPage() {
  const { fetchCharacters } = useCharacterStore();
  const { fetchConversations, currentConversation } = useChatStore();

  useSocket();

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, [fetchCharacters, fetchConversations]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 bg-gray-950">
        {currentConversation ? (
          <ChatPanel />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
          </div>
        )}
      </main>
    </div>
  );
}
