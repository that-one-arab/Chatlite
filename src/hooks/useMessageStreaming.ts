import { useCallback } from "preact/hooks";
import type { RefObject } from "preact";
import type { Message, AttachedImage, Chat } from "@/types";

// Extract base64 data from a data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;
}

// Prepare messages for Ollama API (convert dataUrls to raw base64)
function prepareMessagesForAPI(
  messages: (Message | { role: "system"; content: string })[],
  imagesToSend?: AttachedImage[]
) {
  return messages.map((msg, idx) => {
    const isLastUserMsg = idx === messages.length - 1 && msg.role === "user";

    // Add new images to the last user message
    if (isLastUserMsg && imagesToSend && imagesToSend.length > 0) {
      return {
        ...msg,
        images: imagesToSend.map((img) => img.base64),
      };
    }

    // Convert existing stored images from dataUrl to base64
    if ("images" in msg && msg.images && msg.images.length > 0) {
      return {
        ...msg,
        images: msg.images.map(extractBase64FromDataUrl),
      };
    }

    return msg;
  });
}

interface UseMessageStreamingParams {
  selectedModel: string;
  abortControllerRef: RefObject<AbortController | null>;
  setIsStreaming: (streaming: boolean) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  updateChatMessages: (chatId: string, messages: Message[]) => void;
  showError: (message: string) => void;
}

export function useMessageStreaming({
  selectedModel,
  abortControllerRef,
  setIsStreaming,
  setAutoScroll,
  updateChatMessages,
  showError,
}: UseMessageStreamingParams) {
  const streamResponse = useCallback(
    async (
      chatId: string,
      systemPrompt: string | undefined,
      conversationHistory: Message[],
      imagesToSend?: AttachedImage[]
    ) => {
      setIsStreaming(true);
      setAutoScroll(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Create local copy of messages to track state during streaming
      const streamingMessages = [
        ...conversationHistory,
        { role: "assistant" as const, content: "", timestamp: Date.now() },
      ];

      // Prepare messages with optional system prompt
      const messages = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...conversationHistory]
        : conversationHistory;

      const messagesToSend = prepareMessagesForAPI(messages, imagesToSend);

      try {
        const response = await fetch("http://localhost:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: messagesToSend,
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
                const lastMsg = streamingMessages[streamingMessages.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  if (content) {
                    lastMsg.content += content;
                  }
                  if (thinking) {
                    lastMsg.thinking = (lastMsg.thinking || "") + thinking;
                  }
                  updateChatMessages(chatId, streamingMessages);
                }
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
          const lastMsg = streamingMessages[streamingMessages.length - 1];
          if (lastMsg.role === "assistant" && !lastMsg.content) {
            streamingMessages.pop();
          }
          updateChatMessages(chatId, streamingMessages);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      selectedModel,
      abortControllerRef,
      setIsStreaming,
      setAutoScroll,
      updateChatMessages,
      showError,
    ]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [abortControllerRef]);

  return {
    streamResponse,
    stopGeneration,
  };
}
