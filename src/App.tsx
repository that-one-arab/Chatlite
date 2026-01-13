import { useState, useEffect, useRef } from "preact/hooks";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
}

interface Settings {
  storagePath: string;
  lastModel: string;
}

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentChat = chats.find((c) => c.id === currentChatId);

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

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentChat?.messages, autoScroll]);

  // Detect user scrolling during streaming
  const handleWheel = (e: WheelEvent) => {
    if (!isStreaming) return;

    if (autoScroll && e.deltaY < 0) {
      // User scrolled up, disable auto-scroll
      setAutoScroll(false);
    } else if (!autoScroll && e.deltaY > 0) {
      // User scrolled down, check if at bottom to re-enable auto-scroll
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom < 50) {
          setAutoScroll(true);
        }
      }
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      const modelNames = data.models.map((m: any) => m.name);
      setModels(modelNames);

      if (!selectedModel && modelNames.length > 0) {
        setSelectedModel(modelNames[0]);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

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

  const updateChatTitle = (chatId: string, firstMessage: string) => {
    const title =
      firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId || !selectedModel || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };
    const assistantMessage: Message = { role: "assistant", content: "" };

    // Update chat with user message
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === currentChatId) {
          const newMessages = [...c.messages, userMessage, assistantMessage];

          // Set title from first message
          if (c.messages.length === 0) {
            updateChatTitle(c.id, input);
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
      {/* Sidebar */}
      <div class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div class="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            class="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition text-sm font-medium"
          >
            + New Chat
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              class={`p-3 mx-2 my-1 rounded-lg cursor-pointer transition ${
                currentChatId === chat.id
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
              onClick={() => selectChat(chat.id)}
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">
                  {chat.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  class="text-gray-400 hover:text-red-500 transition text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Model Selection & Settings */}
        <div class="border-t border-gray-200 dark:border-gray-700">
          <div class="p-3">
            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-medium">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.currentTarget.value)}
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
            >
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div class="p-3 pt-0">
            <button
              onClick={() => setShowSettings(true)}
              class="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div class="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Messages */}
            <div ref={messagesContainerRef} onWheel={handleWheel} class="flex-1 overflow-y-auto p-4">
              <div class="max-w-3xl mx-auto space-y-4">
                {currentChat.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    class={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      class={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div class="whitespace-pre-wrap break-words text-sm">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div class="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              <div class="max-w-3xl mx-auto">
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onInput={(e) => setInput(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Message..."
                    disabled={isStreaming}
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
        ) : (
          <div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div class="text-center">
              <h2 class="text-2xl font-semibold mb-2">LLM Chat</h2>
              <p class="text-sm">Select a chat or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Settings
            </h2>

            <div class="mb-4">
              <label class="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                Storage Path
              </label>
              <input
                type="text"
                value={customPath}
                onInput={(e) => setCustomPath(e.currentTarget.value)}
                class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
                placeholder="/path/to/chats"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Current: {storagePath}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={applyStoragePath}
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
