import { useState, useEffect } from "preact/hooks";
import type { RefObject } from "preact";
import type { Chat } from "@/types";
import { Message } from "./Message";

interface ChatAreaProps {
  chat: Chat;
  input: string;
  isStreaming: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  messagesContainerRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onStopGeneration: () => void;
  onWheel: (e: WheelEvent) => void;
  onEditMessage: (messageIndex: number, newContent: string) => void;
}

export function ChatArea({
  chat,
  input,
  isStreaming,
  messagesEndRef,
  messagesContainerRef,
  inputRef,
  onInputChange,
  onSendMessage,
  onStopGeneration,
  onWheel,
  onEditMessage,
}: ChatAreaProps) {
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // Reset edit state when chat changes
  useEffect(() => {
    setEditingMessageIndex(null);
    setEditContent("");
  }, [chat.id]);

  const handleStartEdit = (index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditContent("");
  };

  const handleSaveEdit = (index: number, newContent: string) => {
    if (!newContent.trim()) {
      handleCancelEdit();
      return;
    }

    setEditingMessageIndex(null);
    setEditContent("");
    onEditMessage(index, newContent);
  };

  return (
    <>
      {/* Messages */}
      <div ref={messagesContainerRef} onWheel={onWheel} class="flex-1 overflow-y-auto p-4">
        <div class="max-w-3xl mx-auto space-y-4">
          {chat.messages.map((msg, idx) => (
            <Message
              key={idx}
              message={msg}
              index={idx}
              isEditing={editingMessageIndex === idx}
              editContent={editContent}
              canEdit={msg.role === "user" && !isStreaming}
              isStreaming={isStreaming}
              isLastMessage={idx === chat.messages.length - 1}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onEditContentChange={setEditContent}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div class="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div class="max-w-3xl mx-auto">
          <div class="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onInput={(e) => onInputChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="Message..."
              disabled={isStreaming}
              class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {isStreaming ? (
              <button
                onClick={onStopGeneration}
                class="px-5 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition text-sm font-medium"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={onSendMessage}
                disabled={!input.trim()}
                class="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
