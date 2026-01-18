import { useState, useEffect } from "preact/hooks";
import type { RefObject } from "preact";
import { useChatContext, useModelContext, useUIContext, useNotificationContext } from "@/contexts";
import { useImageAttachment } from "@/hooks/useImageAttachment";
import { useMessageStreaming } from "@/hooks/useMessageStreaming";
import { createUserMessage, createAssistantMessage, canSendMessage, getMessageText } from "@/utils/messageHelpers";
import { Message } from "./Message";
import { ImageBadge } from "./ImageBadge";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface ChatAreaProps {
  messagesEndRef: RefObject<HTMLDivElement>;
  messagesContainerRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  llmSelectRef?: RefObject<HTMLButtonElement>;
  onWheel: (e: WheelEvent) => void;
  onUpdateChatTitle: (chatId: string, firstMessage: string, model: string) => void;
  abortControllerRef: RefObject<AbortController | null>;
  setAutoScroll: (autoScroll: boolean) => void;
}

export function ChatArea({
  messagesEndRef,
  messagesContainerRef,
  inputRef,
  llmSelectRef,
  onWheel,
  onUpdateChatTitle,
  abortControllerRef,
  setAutoScroll,
}: ChatAreaProps) {
  const { currentChat, updateChatMessages } = useChatContext();
  const { selectedModel } = useModelContext();
  const {
    input,
    isStreaming,
    zoomLevel,
    showZoomIndicator,
    attachedImages,
    previewImage,
    setInput,
    setIsStreaming,
    setShowChatSettings,
    setShowHelp,
    setShowLlmSelector,
    attachImage,
    removeImage,
    clearImages,
    setPreviewImage,
  } = useUIContext();
  const { showError } = useNotificationContext();

  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // Custom hooks
  const { handlePaste } = useImageAttachment({
    attachedImages,
    attachImage,
    showError,
  });

  const { streamResponse, stopGeneration } = useMessageStreaming({
    selectedModel,
    abortControllerRef,
    setIsStreaming,
    setAutoScroll,
    updateChatMessages,
    showError,
  });

  // Reset edit state when chat changes
  useEffect(() => {
    setEditingMessageIndex(null);
    setEditContent("");
  }, [currentChat?.id]);

  const handleStartEdit = (index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditContent(content);
    clearImages();
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditContent("");
  };

  const sendMessage = async () => {
    if (!currentChat || !canSendMessage(input, attachedImages, isStreaming)) return;

    // Prepare message
    const messageText = getMessageText(input, attachedImages.length > 0);
    const imagesToSend = [...attachedImages];
    const currentMessages = currentChat.messages;

    const userMessage = createUserMessage(messageText, imagesToSend);
    const assistantMessage = createAssistantMessage();

    // Update chat state
    updateChatMessages(currentChat.id, [...currentMessages, userMessage, assistantMessage]);

    // Update title for first message
    if (currentMessages.length === 0) {
      onUpdateChatTitle(currentChat.id, messageText, selectedModel);
    }

    // Clear input
    setInput("");
    clearImages();

    // Stream response
    await streamResponse(
      currentChat.id,
      currentChat.systemPrompt,
      [...currentMessages, userMessage],
      imagesToSend
    );
  };

  const handleSaveEdit = (index: number, newContent: string) => {
    if (!currentChat || !newContent.trim() || isStreaming) return;

    // Truncate messages at edit point and update edited message
    const truncatedMessages = currentChat.messages.slice(0, index + 1);
    truncatedMessages[index] = createUserMessage(newContent);
    const assistantMessage = createAssistantMessage();

    // Update chat state
    updateChatMessages(currentChat.id, [...truncatedMessages, assistantMessage]);

    // Regenerate title if editing first message
    if (index === 0) {
      onUpdateChatTitle(currentChat.id, newContent, selectedModel);
    }

    // Clear edit state
    setEditingMessageIndex(null);
    setEditContent("");

    // Stream new response
    streamResponse(currentChat.id, currentChat.systemPrompt, truncatedMessages);
  };

  if (!currentChat) return null;

  return (
    <>
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
        {/* LLM Selector Button - Centered */}
        <div class="flex-1 flex justify-center">
          <button
            ref={llmSelectRef}
            onClick={() => setShowLlmSelector(true)}
            class="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {selectedModel}
          </button>
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
              onImageClick={setPreviewImage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div class="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div class="max-w-3xl mx-auto">
          {/* Image Badges */}
          {attachedImages.length > 0 && (
            <div class="flex flex-wrap gap-2 mb-3">
              {attachedImages.map((img) => (
                <ImageBadge key={img.id} dataUrl={img.dataUrl} name={img.name} onRemove={() => removeImage(img.id)} onPreview={() => setPreviewImage(img.dataUrl)} />
              ))}
            </div>
          )}

          <div class="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onInput={(e) => setInput(e.currentTarget.value)}
              onPaste={handlePaste}
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
                disabled={!input.trim() && attachedImages.length === 0}
                class="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}
