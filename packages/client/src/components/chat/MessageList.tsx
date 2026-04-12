import { useChatStore } from "../../stores/chatStore";
import { useEffect, useRef } from "react";

export function MessageList() {
  const { messages, streamingText, isStreaming } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`max-w-[70%] rounded-lg px-4 py-2 ${
            msg.role === "user"
              ? "self-end bg-indigo-600"
              : "self-start bg-gray-800"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      ))}
      {isStreaming && streamingText && (
        <div className="max-w-[70%] self-start rounded-lg bg-gray-800 px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
