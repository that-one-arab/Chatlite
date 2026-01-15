import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Chat, Settings, Message } from "@/types";
import { useModels } from "@/hooks/useModels";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useToast } from "@/hooks/useToast";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { EmptyState } from "@/components/EmptyState";
import { SettingsModal } from "@/components/SettingsModal";
import { ChatSettingsModal } from "@/components/ChatSettingsModal";
import { HelpModal } from "@/components/HelpModal";
import { Toast } from "@/components/Toast";

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelSelectRef = useRef<HTMLSelectElement>(null);
  const zoomIndicatorTimeoutRef = useRef<number | null>(null);

  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const { toasts, showError, removeToast } = useToast();
  const currentChat = chats.find((c) => c.id === currentChatId);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messagesEndRef, messagesContainerRef, handleWheel, setAutoScroll } =
    useAutoScroll({
      messages: currentChat?.messages,
      isStreaming,
    });

  // Select a chat and update the model
  const selectChat = (chatId: string | null) => {
    setCurrentChatId(chatId);
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat && chat.model) {
        setSelectedModel(chat.model);
      }
    }
  };

  // Initialize app
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const appData = await appDataDir();
      const defaultPath = `${appData}/llm-chats`;

      // Load settings
      const settingsPath = `${appData}/settings.json`;
      let settings: Settings = {
        storagePath: defaultPath,
        lastModel: "",
        zoomLevel: 1.0,
      };

      try {
        const settingsExists = await exists(settingsPath);
        if (settingsExists) {
          const settingsContent = await readTextFile(settingsPath);
          settings = JSON.parse(settingsContent);
        }
      } catch (e) {
        console.error("Error loading settings:", e);
      }

      setStoragePath(settings.storagePath);
      setCustomPath(settings.storagePath);
      setSelectedModel(settings.lastModel);
      setZoomLevel(settings.zoomLevel ?? 1.0);

      // Apply zoom level
      await applyZoom(settings.zoomLevel ?? 1.0);

      // Ensure storage directory exists
      try {
        const dirExists = await exists(settings.storagePath);
        if (!dirExists) {
          await mkdir(settings.storagePath, { recursive: true });
        }
      } catch (e) {
        console.error("Error creating directory:", e);
      }

      // Load chats
      await loadChats(settings.storagePath);

      // Fetch models (pass lastModel to avoid stale closure issue)
      await fetchModels(settings.lastModel);
    } catch (error) {
      console.error("Init error:", error);
    }
  };

  const loadChats = async (path: string) => {
    try {
      const chatsPath = `${path}/chats.json`;
      const fileExists = await exists(chatsPath);

      if (fileExists) {
        const content = await readTextFile(chatsPath);
        const parsed = JSON.parse(content);
        setChats(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
          if (parsed[0].model) {
            setSelectedModel(parsed[0].model);
          }
        }
      }
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  };

  const saveChats = async (updatedChats: Chat[]) => {
    try {
      const chatsPath = `${storagePath}/chats.json`;
      await writeTextFile(chatsPath, JSON.stringify(updatedChats, null, 2));
    } catch (error) {
      console.error("Error saving chats:", error);
    }
  };

  const saveSettings = async (model: string, path: string, zoom?: number) => {
    try {
      const appData = await appDataDir();
      const settingsPath = `${appData}/settings.json`;
      const settings: Settings = {
        storagePath: path,
        lastModel: model,
        zoomLevel: zoom ?? zoomLevel,
      };
      await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const applyZoom = async (level: number) => {
    try {
      const webview = getCurrentWebview();
      await webview.setZoom(level);
    } catch (error) {
      console.error("Error setting zoom:", error);
    }
  };

  const changeZoom = async (newLevel: number) => {
    // Clamp zoom level between 0.5 and 2.0
    const clampedLevel = Math.max(0.5, Math.min(2.0, newLevel));
    setZoomLevel(clampedLevel);
    await applyZoom(clampedLevel);
    await saveSettings(selectedModel, storagePath, clampedLevel);

    // Show zoom indicator
    setShowZoomIndicator(true);

    // Clear existing timeout
    if (zoomIndicatorTimeoutRef.current) {
      clearTimeout(zoomIndicatorTimeoutRef.current);
    }

    // Hide indicator after 1 second
    zoomIndicatorTimeoutRef.current = window.setTimeout(() => {
      setShowZoomIndicator(false);
    }, 1000);
  };

  const zoomIn = () => changeZoom(Math.round((zoomLevel + 0.1) * 10) / 10);
  const zoomOut = () => changeZoom(Math.round((zoomLevel - 0.1) * 10) / 10);
  const resetZoom = () => changeZoom(1.0);

  // Cleanup zoom indicator timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save chats
  useEffect(() => {
    if (chats.length > 0 && storagePath) {
      saveChats(chats);
    }
  }, [chats, storagePath]);

  // Auto-save model selection
  useEffect(() => {
    if (selectedModel && storagePath) {
      saveSettings(selectedModel, storagePath);
    }
  }, [selectedModel, storagePath]);

  const createNewChat = () => {
    // If current chat is empty, just focus the input instead of creating a new one
    if (currentChat && currentChat.messages.length === 0) {
      inputRef.current?.focus();
      return;
    }

    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      model: selectedModel,
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);

    // Focus input after React re-renders with new chat
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const deleteChat = (chatId: string) => {
    const filtered = chats.filter((c) => c.id !== chatId);
    setChats(filtered);

    if (currentChatId === chatId) {
      if (filtered.length > 0) {
        setCurrentChatId(filtered[0].id);
        if (filtered[0].model) {
          setSelectedModel(filtered[0].model);
        }
      } else {
        setCurrentChatId(null);
      }
    }
  };

  const updateChatTitle = async (chatId: string, firstMessage: string, model: string) => {
    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: `
Generate a concise title (max 50 characters) for a conversation based on the user's first message.
Respond with ONLY the title, no quotes or punctuation.
The title would be used as the chat title in the sidebar.
`,
            },
            {
              role: "user",
              content: firstMessage,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const generatedTitle = data.message?.content?.trim() || firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");

      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: generatedTitle } : c)));
    } catch (error: any) {
      console.error("Error generating title:", error);
      const fallbackTitle = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: fallbackTitle } : c)));

      // Only show error toast if it's a connection issue
      if (error.message === "Failed to fetch") {
        showError("Cannot connect to Ollama for title generation");
      }
    }
  };

  const streamResponse = async (conversationHistory: Message[]) => {
    setIsStreaming(true);
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build messages array with optional system prompt
    const chat = chats.find((c) => c.id === currentChatId);
    const messages = chat?.systemPrompt
      ? [{ role: "system" as const, content: chat.systemPrompt }, ...conversationHistory]
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
              setChats((prev) =>
                prev.map((c) => {
                  if (c.id === currentChatId) {
                    const messages = [...c.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg.role === "assistant") {
                      if (content) {
                        lastMsg.content += content;
                      }
                      if (thinking) {
                        lastMsg.thinking = (lastMsg.thinking || "") + thinking;
                      }
                    }
                    return { ...c, messages };
                  }
                  return c;
                })
              );
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Stream error:", error);

        // Show user-friendly error message
        let errorMessage = "Failed to get response from Ollama";

        if (error.message === "Failed to fetch") {
          errorMessage = "Cannot connect to Ollama. Make sure Ollama is running on localhost:11434";
        } else if (error.message) {
          errorMessage = error.message;
        }

        showError(errorMessage);

        // Remove the empty assistant message on error
        setChats((prev) =>
          prev.map((c) => {
            if (c.id === currentChatId) {
              const messages = [...c.messages];
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.role === "assistant" && !lastMsg.content) {
                messages.pop();
              }
              return { ...c, messages };
            }
            return c;
          })
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId || !selectedModel || isStreaming) return;

    const userMessage = { role: "user" as const, content: input, timestamp: Date.now() };
    const assistantMessage = { role: "assistant" as const, content: "", timestamp: Date.now() };

    // Update chat with user message
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === currentChatId) {
          const newMessages = [...c.messages, userMessage, assistantMessage];

          // Set title from first message
          if (c.messages.length === 0) {
            updateChatTitle(c.id, input, selectedModel);
          }

          return { ...c, messages: newMessages, model: selectedModel };
        }
        return c;
      })
    );

    const currentMessages = currentChat?.messages || [];
    setInput("");

    await streamResponse([...currentMessages, userMessage]);
  };

  const editMessage = async (messageIndex: number, newContent: string) => {
    if (!currentChatId || isStreaming || !newContent.trim()) return;

    const chat = chats.find((c) => c.id === currentChatId);
    if (!chat) return;

    // Step 1: Truncate messages at edit point
    const truncatedMessages = chat.messages.slice(0, messageIndex + 1);
    truncatedMessages[messageIndex] = {
      role: "user",
      content: newContent,
      timestamp: Date.now(),
    };

    // Step 2: Add empty assistant message for streaming
    const messagesWithAssistant = [
      ...truncatedMessages,
      { role: "assistant" as const, content: "", timestamp: Date.now() },
    ];

    // Step 3: Update chat state
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId
          ? { ...c, messages: messagesWithAssistant }
          : c
      )
    );

    // Step 4: Regenerate title if editing first message
    if (messageIndex === 0) {
      updateChatTitle(currentChatId, newContent, selectedModel);
    }

    // Step 5: Stream new response
    await streamResponse(truncatedMessages);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const updateSystemPrompt = (systemPrompt: string) => {
    if (!currentChatId) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId ? { ...c, systemPrompt } : c
      )
    );
  };

  const applyStoragePath = async () => {
    try {
      // Ensure new directory exists
      const dirExists = await exists(customPath);
      if (!dirExists) {
        await mkdir(customPath, { recursive: true });
      }

      // Save current chats to old location
      if (chats.length > 0 && storagePath) {
        await saveChats(chats);
      }

      // Update path
      setStoragePath(customPath);
      await saveSettings(selectedModel, customPath, zoomLevel);

      // Load chats from new location
      await loadChats(customPath);

      setShowSettings(false);
    } catch (error) {
      console.error("Error changing storage path:", error);
      alert("Failed to change storage path. Check console for details.");
    }
  };

  // Navigation helpers for hotkeys
  const navigateToPrevChat = useCallback(() => {
    if (chats.length === 0) return;
    const currentIndex = chats.findIndex((c) => c.id === currentChatId);
    if (currentIndex > 0) {
      selectChat(chats[currentIndex - 1].id);
    }
  }, [chats, currentChatId]);

  const navigateToNextChat = useCallback(() => {
    if (chats.length === 0) return;
    const currentIndex = chats.findIndex((c) => c.id === currentChatId);
    if (currentIndex < chats.length - 1) {
      selectChat(chats[currentIndex + 1].id);
    } else if (currentIndex === -1) {
      selectChat(chats[0].id);
    }
  }, [chats, currentChatId]);

  // Open model dropdown
  const openModelDropdown = useCallback(() => {
    if (modelSelectRef.current) {
      modelSelectRef.current.focus();
      modelSelectRef.current.click();
    }
  }, []);

  // Keyboard shortcuts
  const isAnyModalOpen = showSettings || showChatSettings || showHelp;
  const closeAllModals = useCallback(() => {
    setShowSettings(false);
    setShowChatSettings(false);
    setShowHelp(false);
  }, []);

  useHotkeys(
    {
      onFocusInput: () => inputRef.current?.focus(),
      onNewChat: createNewChat,
      onOpenModelDropdown: openModelDropdown,
      onOpenSettings: () => setShowSettings(true),
      onOpenChatSettings: () => currentChat && setShowChatSettings(true),
      onOpenHelp: () => setShowHelp(true),
      onCloseModals: closeAllModals,
      onNavigatePrev: navigateToPrevChat,
      onNavigateNext: navigateToNextChat,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onZoomReset: resetZoom,
    },
    { isModalOpen: isAnyModalOpen }
  );

  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        selectedModel={selectedModel}
        models={models}
        modelSelectRef={modelSelectRef}
        onCreateChat={createNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onModelChange={setSelectedModel}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      <div class="flex-1 flex flex-col">
        {currentChat ? (
          <ChatArea
            chat={currentChat}
            input={input}
            isStreaming={isStreaming}
            messagesEndRef={messagesEndRef}
            messagesContainerRef={messagesContainerRef}
            inputRef={inputRef}
            zoomLevel={zoomLevel}
            showZoomIndicator={showZoomIndicator}
            onInputChange={setInput}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            onWheel={handleWheel}
            onEditMessage={editMessage}
            onOpenSettings={() => setShowChatSettings(true)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        storagePath={storagePath}
        customPath={customPath}
        zoomLevel={zoomLevel}
        onCustomPathChange={setCustomPath}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={resetZoom}
        onApply={applyStoragePath}
        onClose={() => setShowSettings(false)}
      />

      {currentChat && (
        <ChatSettingsModal
          isOpen={showChatSettings}
          systemPrompt={currentChat.systemPrompt || ""}
          onSave={updateSystemPrompt}
          onClose={() => setShowChatSettings(false)}
        />
      )}

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Toast container */}
      <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
