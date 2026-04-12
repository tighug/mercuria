import { CharacterSelector } from "./CharacterSelector";
import { ConversationList } from "./ConversationList";
import { useCharacterStore } from "../../stores/characterStore";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

export function Sidebar() {
  const { selectedCharacter } = useCharacterStore();
  const { createConversation } = useChatStore();
  const { user, logout } = useAuthStore();

  const handleNewChat = async () => {
    if (!selectedCharacter) return;
    await createConversation(selectedCharacter.id, "claude", "claude-sonnet-4-20250514");
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900 border-r border-gray-800">
      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <CharacterSelector />
      </div>
      <button
        onClick={handleNewChat}
        className="mx-2 mt-2 rounded bg-indigo-600 px-3 py-2 text-sm hover:bg-indigo-500"
      >
        + 新しい会話
      </button>
      <ConversationList />
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{user?.name}</span>
          <button onClick={logout} className="hover:text-white">ログアウト</button>
        </div>
      </div>
    </div>
  );
}
