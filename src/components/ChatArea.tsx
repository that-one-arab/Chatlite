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
  zoomLevel: number;
  showZoomIndicator: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onStopGeneration: () => void;
  onWheel: (e: WheelEvent) => void;
  onEditMessage: (messageIndex: number, newContent: string) => void;
  onOpenSettings: () => void;
}

export function ChatArea({
  chat,
  input,
  isStreaming,
  messagesEndRef,
  messagesContainerRef,
  inputRef,
  zoomLevel,
  showZoomIndicator,
  onInputChange,
  onSendMessage,
  onStopGeneration,
  onWheel,
  onEditMessage,
  onOpenSettings,
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
      {/* Header */}
      <div class="flex items-center justify-end px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
        <button
          onClick={onOpenSettings}
          class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          aria-label="Conversation settings"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Zoom Level Indicator */}
        {showZoomIndicator && (
          <div
            class="absolute right-8 top-16 bg-gray-800 dark:bg-gray-700 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in-out"
          >
            {Math.round(zoomLevel * 100)}%
          </div>
        )}
      </div>

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
                if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="Message..."
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
