import { useState, useEffect, useRef } from "preact/hooks";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import type { Chat, Settings } from "@/types";
import { useModels } from "@/hooks/useModels";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { EmptyState } from "@/components/EmptyState";
import { SettingsModal } from "@/components/SettingsModal";

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const currentChat = chats.find((c) => c.id === currentChatId);
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
      const defaultPath = `${appData}llm-chats`;

      // Load settings
      const settingsPath = `${appData}settings.json`;
      let settings: Settings = {
        storagePath: defaultPath,
        lastModel: "",
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

      // Fetch models
      await fetchModels();
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

  const saveSettings = async (model: string, path: string) => {
    try {
      const appData = await appDataDir();
      const settingsPath = `${appData}settings.json`;
      const settings: Settings = {
        storagePath: path,
        lastModel: model,
      };
      await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

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
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      model: selectedModel,
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);
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

      const data = await response.json();
      const generatedTitle = data.message?.content?.trim() || firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");

      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: generatedTitle } : c)));
    } catch (error) {
      console.error("Error generating title:", error);
      const fallbackTitle = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: fallbackTitle } : c)));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId || !selectedModel || isStreaming) return;

    const userMessage = { role: "user" as const, content: input };
    const assistantMessage = { role: "assistant" as const, content: "" };

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

    setInput("");
    setIsStreaming(true);
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [...(currentChat?.messages || []), userMessage],
          stream: true,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              setChats((prev) =>
                prev.map((c) => {
                  if (c.id === currentChatId) {
                    const messages = [...c.messages];
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg.role === "assistant") {
                      lastMsg.content += json.message.content;
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
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
      await saveSettings(selectedModel, customPath);

      // Load chats from new location
      await loadChats(customPath);

      setShowSettings(false);
    } catch (error) {
      console.error("Error changing storage path:", error);
      alert("Failed to change storage path. Check console for details.");
    }
  };

  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        selectedModel={selectedModel}
        models={models}
        onCreateChat={createNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onModelChange={setSelectedModel}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div class="flex-1 flex flex-col">
        {currentChat ? (
          <ChatArea
            chat={currentChat}
            input={input}
            isStreaming={isStreaming}
            messagesEndRef={messagesEndRef}
            messagesContainerRef={messagesContainerRef}
            onInputChange={setInput}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            onWheel={handleWheel}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        storagePath={storagePath}
        customPath={customPath}
        onCustomPathChange={setCustomPath}
        onApply={applyStoragePath}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
