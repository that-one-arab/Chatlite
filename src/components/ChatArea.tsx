import { useState, useEffect } from "preact/hooks";
import type { RefObject } from "preact";
import type { Message as MessageType } from "@/types";
import { useChatContext, useModelContext, useUIContext, useNotificationContext } from "@/contexts";
import { Message } from "./Message";

interface ChatAreaProps {
  messagesEndRef: RefObject<HTMLDivElement>;
  messagesContainerRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  modelSelectRef?: RefObject<HTMLSelectElement>;
  onWheel: (e: WheelEvent) => void;
  onUpdateChatTitle: (chatId: string, firstMessage: string, model: string) => void;
  abortControllerRef: RefObject<AbortController | null>;
  setAutoScroll: (autoScroll: boolean) => void;
}

export function ChatArea({
  messagesEndRef,
  messagesContainerRef,
  inputRef,
  modelSelectRef,
  onWheel,
  onUpdateChatTitle,
  abortControllerRef,
  setAutoScroll,
}: ChatAreaProps) {
  const { currentChat, updateChatMessages } = useChatContext();
  const { models, selectedModel, setSelectedModel } = useModelContext();
  const {
    input,
    isStreaming,
    zoomLevel,
    showZoomIndicator,
    setInput,
    setIsStreaming,
    setShowChatSettings,
    setShowHelp,
  } = useUIContext();
  const { showError } = useNotificationContext();

  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // Reset edit state when chat changes
  useEffect(() => {
    setEditingMessageIndex(null);
    setEditContent("");
  }, [currentChat?.id]);

  const handleStartEdit = (index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditContent("");
  };

  const streamResponse = async (conversationHistory: MessageType[]) => {
    if (!currentChat) return;

    setIsStreaming(true);
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const messages = currentChat.systemPrompt
      ? [{ role: "system" as const, content: currentChat.systemPrompt }, ...conversationHistory]
      : conversationHistory;

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to connect to Ollama";

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = `Ollama error: ${response.status} ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const content = json.message?.content;
            const thinking = json.message?.thinking;

            if (content || thinking) {
              const messages = [...currentChat.messages];
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.role === "assistant") {
                if (content) {
                  lastMsg.content += content;
                }
                if (thinking) {
                  lastMsg.thinking = (lastMsg.thinking || "") + thinking;
                }
              }
              updateChatMessages(currentChat.id, messages);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Stream error:", error);

        let errorMessage = "Failed to get response from Ollama";

        if (error.message === "Failed to fetch") {
          errorMessage = "Cannot connect to Ollama. Make sure Ollama is running on localhost:11434";
        } else if (error.message) {
          errorMessage = error.message;
        }

        showError(errorMessage);

        // Remove the empty assistant message on error
        const messages = [...currentChat.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === "assistant" && !lastMsg.content) {
          messages.pop();
        }
        updateChatMessages(currentChat.id, messages);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChat || !selectedModel || isStreaming) return;

    const userMessage = { role: "user" as const, content: input, timestamp: Date.now() };
    const assistantMessage = { role: "assistant" as const, content: "", timestamp: Date.now() };

    const newMessages = [...currentChat.messages, userMessage, assistantMessage];

    // Update chat title from first message
    if (currentChat.messages.length === 0) {
      onUpdateChatTitle(currentChat.id, input, selectedModel);
    }

    // Update messages and model
    updateChatMessages(currentChat.id, newMessages);

    setInput("");

    await streamResponse([...currentChat.messages, userMessage]);
  };

  const handleSaveEdit = (index: number, newContent: string) => {
    if (!currentChat || !newContent.trim() || isStreaming) return;

    // Truncate messages at edit point
    const truncatedMessages = currentChat.messages.slice(0, index + 1);
    truncatedMessages[index] = {
      role: "user",
      content: newContent,
      timestamp: Date.now(),
    };

    // Add empty assistant message for streaming
    const messagesWithAssistant = [
      ...truncatedMessages,
      { role: "assistant" as const, content: "", timestamp: Date.now() },
    ];

    // Update chat state
    updateChatMessages(currentChat.id, messagesWithAssistant);

    // Regenerate title if editing first message
    if (index === 0) {
      onUpdateChatTitle(currentChat.id, newContent, selectedModel);
    }

    setEditingMessageIndex(null);
    setEditContent("");

    // Stream new response
    streamResponse(truncatedMessages);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (!currentChat) return null;

  return (
    <>
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
        {/* Model Selector - Centered */}
        <div class="flex-1 flex justify-center">
          <select
            ref={modelSelectRef}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.currentTarget.value)}
            class="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons - Right Aligned */}
        <div class="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(true)}
            class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Keyboard shortcuts"
          >
            <span class="text-base font-medium">?</span>
          </button>
          <button
            onClick={() => setShowChatSettings(true)}
            class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            aria-label="Conversation settings"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Zoom Level Indicator */}
        {showZoomIndicator && (
          <div class="absolute right-8 top-16 bg-gray-800 dark:bg-gray-700 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in-out">
            {Math.round(zoomLevel * 100)}%
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onWheel={onWheel} class="flex-1 overflow-y-auto p-4">
        <div class="max-w-3xl mx-auto space-y-4">
          {currentChat.messages.map((msg, idx) => (
            <Message
              key={idx}
              message={msg}
              index={idx}
              isEditing={editingMessageIndex === idx}
              editContent={editContent}
              canEdit={msg.role === "user" && !isStreaming}
              isStreaming={isStreaming}
              isLastMessage={idx === currentChat.messages.length - 1}
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
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message..."
              class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {isStreaming ? (
              <button
                onClick={stopGeneration}
                class="px-5 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition text-sm font-medium"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={sendMessage}
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
