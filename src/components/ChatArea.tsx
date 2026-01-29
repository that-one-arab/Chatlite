import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import type { RefObject } from "preact";
import type { Chat, AttachedImage } from "@/types";
import { useModelContext, useUIContext, useNotificationContext, useModalContext, MODAL_NAMES, useChatContext } from "@/contexts";
import { useImageAttachment } from "@/hooks/useImageAttachment";
import { useMessageStreaming } from "@/hooks/useMessageStreaming";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { createUserMessage, canSendMessage, getMessageText } from "@/utils/messageHelpers";
import { Message } from "./Message";
import { ImageBadge } from "./ImageBadge";
import { ImagePreviewModal } from "./modals/ImagePreviewModal";

interface DraftChat {
  model: string;
  systemPrompt?: string;
}

interface ChatAreaProps {
  chat?: Chat;
  draft?: DraftChat;
  isActive: boolean;
  llmSelectRef?: RefObject<HTMLButtonElement>;
  onUpdateChatTitle: (chatId: string, firstMessage: string, model: string) => void;
  onCreateChat?: (model: string) => string;
  onClearDraft?: () => void;
}

export function ChatArea({
  chat,
  draft,
  isActive,
  llmSelectRef,
  onUpdateChatTitle,
  onCreateChat,
  onClearDraft,
}: ChatAreaProps) {
  const { updateChatMessages } = useChatContext();
  const { selectedModel } = useModelContext();
  const {
    streamingChatId,
    zoomLevel,
    showZoomIndicator,
    setStreamingChatId,
  } = useUIContext();
  const { showModal, hideModal } = useModalContext();
  const { showError } = useNotificationContext();

  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasScrolledInitially = useRef(false);

  // Determine if this is a draft chat
  const isDraft = !!draft;
  const chatId = chat?.id ?? "draft";
  const chatModel = chat?.model ?? draft?.model ?? selectedModel;
  const chatSystemPrompt = chat?.systemPrompt ?? draft?.systemPrompt;
  const chatMessages = chat?.messages ?? [];
  const isStreaming = streamingChatId === chatId;

  // Auto-scroll hook
  const { handleWheel, handleScroll, triggerAutoScroll } = useAutoScroll({
    isStreaming,
    messagesContainerRef,
    messagesEndRef,
  });

  // Trigger auto-scroll when streaming content changes
  useEffect(() => {
    if (isStreaming && isActive) {
      // Get the last message content to track changes
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage?.role === "assistant") {
        triggerAutoScroll();
      }
    }
  }, [chatMessages, isStreaming, isActive, triggerAutoScroll]);

  // Initial scroll to bottom when first opened
  useEffect(() => {
    if (isActive && !hasScrolledInitially.current) {
      hasScrolledInitially.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isActive]);

  // Auto-focus input when chat changes (component mounts due to key prop)
  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  const handleImagePreview = useCallback((imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    showModal(MODAL_NAMES.IMAGE_PREVIEW);
  }, [showModal]);

  const handleCloseImagePreview = useCallback(() => {
    hideModal(MODAL_NAMES.IMAGE_PREVIEW);
    setPreviewImageUrl(null);
  }, [hideModal]);

  // Image attachment
  const attachImage = useCallback((image: AttachedImage) => {
    setAttachedImages((prev) => [...prev, image]);
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== imageId));
  }, []);

  const clearImages = useCallback(() => {
    setAttachedImages([]);
  }, []);

  const { handlePaste } = useImageAttachment({
    attachedImages,
    attachImage,
    showError,
  });

  const { streamResponse, stopGeneration } = useMessageStreaming({
    chatId,
    selectedModel: chatModel,
    abortControllerRef,
    setStreamingChatId,
    updateChatMessages,
    showError,
  });

  // Reset edit state when chat changes
  useEffect(() => {
    setEditingMessageIndex(null);
    setEditContent("");
  }, [chatId]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      const textarea = inputRef.current;
      textarea.style.height = "44px"; // Reset to min height
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;

      // Only show scrollbar when content exceeds max height
      textarea.style.overflowY = scrollHeight > 200 ? "auto" : "hidden";
    }
  }, [input]);

  const handleStartEdit = useCallback((index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditContent(content);
    clearImages();
  }, [clearImages]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageIndex(null);
    setEditContent("");
  }, []);

  const sendMessage = useCallback(async () => {
    if (!canSendMessage(input, attachedImages, isStreaming)) return;

    // Prepare message
    const messageText = getMessageText(input, attachedImages.length > 0);
    const imagesToSend = [...attachedImages];

    // If in draft mode, create the chat first
    let actualChatId = chatId;
    if (isDraft && onCreateChat) {
      actualChatId = onCreateChat(chatModel);
      onClearDraft?.();
      // Create initial messages - only add user message, assistant will be added by streamResponse
      const userMessage = createUserMessage(messageText, imagesToSend);
      updateChatMessages(actualChatId, [userMessage]);
    } else {
      // Update existing chat state using functional update to avoid stale closure
      const userMessage = createUserMessage(messageText, imagesToSend);
      updateChatMessages(actualChatId, (prev) => [...prev, userMessage]);
    }

    // Update title for first message
    if (chatMessages.length === 0 || isDraft) {
      onUpdateChatTitle(actualChatId, messageText, chatModel);
    }

    // Clear input
    setInput("");
    clearImages();

    // Stream response - pass actualChatId for drafts to ensure updates go to correct chat
    await streamResponse(
      chatSystemPrompt,
      [{ role: "user" as const, content: messageText, timestamp: Date.now() }],
      imagesToSend,
      isDraft ? actualChatId : undefined
    );
  }, [input, attachedImages, isStreaming, chatMessages, chatId, chatSystemPrompt, chatModel, isDraft, onCreateChat, onClearDraft, updateChatMessages, onUpdateChatTitle, clearImages, streamResponse]);

  const handleSaveEdit = useCallback((index: number, newContent: string) => {
    if (!newContent.trim() || isStreaming || isDraft) return;

    // Update chat state using functional update to avoid stale closure
    // Only add user message, assistant will be added by streamResponse
    updateChatMessages(chatId, (prev) => {
      // Truncate messages at edit point and update edited message
      const truncatedMessages = prev.slice(0, index + 1);
      truncatedMessages[index] = createUserMessage(newContent);
      return truncatedMessages;
    });

    // Regenerate title if editing first message
    if (index === 0) {
      onUpdateChatTitle(chatId, newContent, chatModel);
    }

    // Clear edit state
    setEditingMessageIndex(null);
    setEditContent("");

    // Stream new response - need to compute truncated messages for the API
    const currentMessages = chatMessages;
    const truncatedMessages = currentMessages.slice(0, index + 1);
    truncatedMessages[index] = createUserMessage(newContent);
    streamResponse(chatSystemPrompt, truncatedMessages);
  }, [isStreaming, isDraft, chatId, chatModel, chatMessages, updateChatMessages, onUpdateChatTitle, streamResponse]);

  return (
    <div style={{
      display: isActive ? 'flex' : 'none',
      flexDirection: 'column',
      position: isActive ? 'relative' : 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
    }}>
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
        {/* LLM Selector Button - Centered */}
        <div class="flex-1 flex justify-center">
          <button
            ref={llmSelectRef}
            onClick={() => showModal(MODAL_NAMES.LLM_SELECTOR)}
            class="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {chatModel}
          </button>
        </div>

        {/* Action Buttons - Right Aligned */}
        <div class="flex items-center gap-1">
          <button
            onClick={() => showModal(MODAL_NAMES.HELP)}
            class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Keyboard shortcuts"
          >
            <span class="text-base font-medium">?</span>
          </button>
          <button
            onClick={() => showModal(MODAL_NAMES.CHAT_SETTINGS)}
            disabled={isDraft}
            class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
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
      <div ref={messagesContainerRef} onWheel={handleWheel} onScroll={handleScroll} class="flex-1 overflow-y-auto p-4">
        <div class="max-w-3xl mx-auto space-y-4">
          {chatMessages.map((msg, idx) => (
            <Message
              key={idx}
              message={msg}
              index={idx}
              isEditing={editingMessageIndex === idx}
              editContent={editContent}
              canEdit={msg.role === "user" && !isStreaming}
              isStreaming={isStreaming}
              isLastMessage={idx === chatMessages.length - 1}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onEditContentChange={setEditContent}
              onImageClick={handleImagePreview}
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
                <ImageBadge key={img.id} dataUrl={img.dataUrl} name={img.name} onRemove={() => removeImage(img.id)} onPreview={() => handleImagePreview(img.dataUrl)} />
              ))}
            </div>
          )}

          <div class="flex gap-2 items-center">
            <textarea
              ref={inputRef}
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
              rows={1}
              class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              style="min-height: 44px; overflow-y: hidden;"
            />
            {isStreaming ? (
              <button
                onClick={stopGeneration}
                class="px-5 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition text-sm font-medium flex-shrink-0"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() && attachedImages.length === 0}
                class="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex-shrink-0"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleCloseImagePreview} />
    </div>
  );
}
