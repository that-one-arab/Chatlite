import type { Message, AttachedImage } from "@/types";

/**
 * Creates a user message with optional images
 */
export function createUserMessage(
  content: string,
  images?: AttachedImage[]
): Message {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
    images: images && images.length > 0 ? images.map((img) => img.dataUrl) : undefined,
  };
}

/**
 * Creates an empty assistant message for streaming
 */
export function createAssistantMessage(): Message {
  return {
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  };
}

/**
 * Validates if a message can be sent
 */
export function canSendMessage(
  input: string,
  attachedImages: AttachedImage[],
  isStreaming: boolean
): boolean {
  const hasContent = input.trim() || attachedImages.length > 0;
  return hasContent && !isStreaming;
}

/**
 * Gets message text with fallback for image-only messages
 */
export function getMessageText(input: string, hasImages: boolean): string {
  return input.trim() || (hasImages ? "What is in this image?" : "");
}
