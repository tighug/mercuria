import { useState, type FormEvent } from "react";
import { useChatStore } from "../../stores/chatStore";

export function MessageInput() {
  const [text, setText] = useState("");
  const { sendMessage, isStreaming } = useChatStore();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    sendMessage(text.trim());
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="メッセージを入力..."
        className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
        disabled={isStreaming}
      />
      <button
        type="submit"
        disabled={isStreaming || !text.trim()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
      >
        送信
      </button>
    </form>
  );
}
