import { useEffect } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatPanel } from "../components/chat/ChatPanel";
import { Live2DCanvas } from "../components/live2d/Live2DCanvas";
import { useCharacterStore } from "../stores/characterStore";
import { useChatStore } from "../stores/chatStore";
import { useSocket } from "../hooks/useSocket";

export function ChatPage() {
  const { fetchCharacters, selectedCharacter } = useCharacterStore();
  const { fetchConversations, currentConversation } = useChatStore();

  useSocket();

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, [fetchCharacters, fetchConversations]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="relative flex-1 bg-gray-950">
        {/* Live2D — fullscreen background */}
        {selectedCharacter && <Live2DCanvas />}

        {/* Chat overlay */}
        {currentConversation ? (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" />
            <div className="bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent">
              <div className="mx-auto max-w-2xl">
                <ChatPanel />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">キャラクターを選んで会話を始めましょう</p>
          </div>
        )}
      </main>
    </div>
  );
}
