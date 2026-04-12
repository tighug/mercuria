import { useChatStore } from "../../stores/chatStore";

export function ConversationList() {
  const { conversations, currentConversation, selectConversation, deleteConversation } = useChatStore();
  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => selectConversation(conv)}
          className={`group flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm ${
            currentConversation?.id === conv.id ? "bg-gray-700" : "hover:bg-gray-800"
          }`}
        >
          <span className="truncate">{conv.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
            className="hidden text-gray-500 hover:text-red-400 group-hover:block"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
