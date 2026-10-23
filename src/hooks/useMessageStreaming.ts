import { useCallback } from "preact/hooks";
import type { Message, AttachedImage } from "@/types";

// Module-level registry of in-flight streams, keyed by chat id.
// ChatArea remounts on every chat switch / draft→chat transition (keyed by
// chat id in App.tsx), so a component-local ref would lose the controller
// while the stream keeps running — leaving the Stop button dead.
const activeControllers = new Map<string, AbortController>();

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
  chatId: string;
  selectedModel: string;
  setStreamingChatId: (chatId: string | null) => void;
  updateChatMessages: (chatId: string, messages: Message[] | ((prev: Message[]) => Message[])) => void;
  showError: (message: string) => void;
}

export function useMessageStreaming({
  chatId,
  selectedModel,
  setStreamingChatId,
  updateChatMessages,
  showError,
}: UseMessageStreamingParams) {
  const streamResponse = useCallback(
    async (
      systemPrompt: string | undefined,
      conversationHistory: Message[],
      imagesToSend?: AttachedImage[],
      actualChatId?: string
    ) => {
      // Use actualChatId for drafts (when chat was just created), otherwise use captured chatId
      const targetChatId = actualChatId ?? chatId;
      setStreamingChatId(targetChatId);

      const controller = new AbortController();
      activeControllers.set(targetChatId, controller);

      // Add the initial empty assistant message using functional update
      updateChatMessages(targetChatId, (prev) => [
        ...prev,
        { role: "assistant" as const, content: "", timestamp: Date.now() },
      ]);

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
                // Use functional update to append streaming content
                updateChatMessages(targetChatId, (prev) => {
                  if (prev.length === 0) return prev;
                  const lastIndex = prev.length - 1;
                  const lastMsg = prev[lastIndex];
                  if (lastMsg.role !== "assistant") return prev;

                  return [
                    ...prev.slice(0, lastIndex),
                    {
                      ...lastMsg,
                      content: content ? lastMsg.content + content : lastMsg.content,
                      thinking: thinking ? (lastMsg.thinking || "") + thinking : lastMsg.thinking,
                    },
                  ];
                });
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

          // Remove the empty assistant message on error using functional update
          updateChatMessages(targetChatId, (prev) => {
            if (prev.length === 0) return prev;
            const lastMsg = prev[prev.length - 1];
            if (lastMsg.role === "assistant" && !lastMsg.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } finally {
        setStreamingChatId(null);
        if (activeControllers.get(targetChatId) === controller) {
          activeControllers.delete(targetChatId);
        }
      }
    },
    [
      chatId,
      selectedModel,
      setStreamingChatId,
      updateChatMessages,
      showError,
    ]
  );

  const stopGeneration = useCallback(() => {
    activeControllers.get(chatId)?.abort();
  }, [chatId]);

  return {
    streamResponse,
    stopGeneration,
  };
}
