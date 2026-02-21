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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = useCallback((e: Event) => {
    const files = (e.currentTarget as HTMLInputElement).files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        showError("Image too large. Maximum size is 5MB");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        attachImage({
          id: Date.now().toString() + Math.random(),
          base64: dataUrl.substring(dataUrl.indexOf(",") + 1),
          dataUrl,
          name: `Image ${attachedImages.length + 1}`,
        });
      };
      reader.readAsDataURL(file);
    }
    (e.currentTarget as HTMLInputElement).value = "";
  }, [attachedImages.length, attachImage, showError]);

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
      display: isActive ? "flex" : "none",
      flexDirection: "column",
      position: isActive ? "relative" : "absolute",
      width: "100%",
      flex: isActive ? 1 : undefined,
      minHeight: 0,
      top: 0,
      left: 0,
    }}>
      {isDraft ? (
        <>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          {/* Centered prompt text */}
          <div class="flex-1 flex items-center justify-center">
            <p class="text-[var(--text-3)] text-lg">Type a message to start chatting</p>
          </div>

          {/* Floating centered input */}
          <div class="px-10 pb-12">
            <div class="max-w-2xl mx-auto">
              {attachedImages.length > 0 && (
                <div class="flex flex-wrap gap-2 mb-2">
                  {attachedImages.map((img) => (
                    <ImageBadge
                      key={img.id}
                      dataUrl={img.dataUrl}
                      name={img.name}
                      onRemove={() => removeImage(img.id)}
                      onPreview={() => handleImagePreview(img.dataUrl)}
                    />
                  ))}
                </div>
              )}

              <div class="bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)] overflow-hidden">
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  value={input}
                  onInput={(e) => setInput(e.currentTarget.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Send a message"
                  rows={1}
                  class="w-full px-4 pt-4 pb-2 bg-transparent text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none text-sm resize-none"
                  style="min-height: 52px; overflow-y: hidden;"
                />
                <div class="flex items-center gap-2 px-3 pb-3">
                  {/* Attach image button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    class="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-btn)] text-[var(--text-2)] hover:bg-[var(--bg-btn-hover)] hover:text-[var(--text-1)] transition"
                    title="Attach image"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <div class="flex-1" />
                  {/* Model selector */}
                  <button
                    ref={llmSelectRef}
                    onClick={() => showModal(MODAL_NAMES.LLM_SELECTOR)}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-btn)] text-[var(--text-1)] text-sm hover:bg-[var(--bg-btn-hover)] transition"
                  >
                    <span class="truncate max-w-[160px]">{chatModel}</span>
                    <svg class="w-3.5 h-3.5 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Send button */}
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() && attachedImages.length === 0}
                    class="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--text-1)] text-[var(--bg-app)] disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition"
                    title="Send"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] relative">
            {/* LLM Selector Button - Centered */}
            <div class="flex-1 flex justify-center">
              <button
                ref={llmSelectRef}
                onClick={() => showModal(MODAL_NAMES.LLM_SELECTOR)}
                class="px-3 py-1.5 text-sm bg-[var(--bg-btn)] rounded-lg text-[var(--text-1)] hover:bg-[var(--bg-btn-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)] transition"
              >
                {chatModel}
              </button>
            </div>

            {/* Action Buttons - Right Aligned */}
            <div class="flex items-center gap-1">
              <button
                onClick={() => showModal(MODAL_NAMES.HELP)}
                class="p-2 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-item-hover)] rounded-lg transition"
                title="Keyboard shortcuts"
              >
                <span class="text-base font-medium">?</span>
              </button>
              <button
                onClick={() => showModal(MODAL_NAMES.CHAT_SETTINGS)}
                class="p-2 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-item-hover)] rounded-lg transition"
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
              <div class="absolute right-8 top-16 bg-[var(--bg-btn)] text-[var(--text-1)] px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in-out">
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
          <div class="p-4 bg-[var(--bg-app)]">
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
                  id="chat-input"
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
                  placeholder="Send a message"
                  rows={1}
                  class="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-input)] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)] text-sm resize-none"
                  style="min-height: 44px; overflow-y: hidden;"
                />
                {isStreaming ? (
                  <button
                    onClick={stopGeneration}
                    class="px-5 py-3 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-2xl hover:bg-[var(--bg-btn-hover)] transition text-sm font-medium flex-shrink-0"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() && attachedImages.length === 0}
                    class="px-5 py-3 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-2xl hover:bg-[var(--bg-btn-hover)] transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium flex-shrink-0"
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleCloseImagePreview} />
    </div>
  );
}
