import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "@/types";
import { useHotkeys } from "@/hooks/useHotkeys";
import { chatStorage } from "@/services/chatStorage";
import {
  AppProviders,
  useChatContext,
  useModelContext,
  useUIContext,
  useNotificationContext,
  useModalContext,
  MODAL_NAMES,
} from "@/contexts";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { EmptyState } from "@/components/EmptyState";
import { OllamaStatusBanner } from "@/components/OllamaStatusBanner";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ChatSettingsModal } from "@/components/modals/ChatSettingsModal";
import { HelpModal } from "@/components/modals/HelpModal";
import { LlmSelectorModal } from "@/components/modals/LlmSelectorModal";
import { Toast } from "@/components/Toast";

function AppContent() {
  const {
    chatMetadata,
    currentChat,
    createChat,
    updateChatTitle,
    updateChatModel,
    selectChat,
    refreshMetadata,
    loadChatIntoMemory,
  } = useChatContext();
  const { selectedModel, setSelectedModel, fetchModels } = useModelContext();
  const {
    zoomLevel,
    setZoomLevel,
    setShowZoomIndicator,
    draftChat,
    setDraftChat,
    clearDraft,
    toggleSidebar,
    theme,
    setTheme,
    setOllamaReady,
  } = useUIContext();
  const { toasts, showError, removeToast } = useNotificationContext();
  const { showModal, hideModal, hideAllModals, isModalOpen, isAnyModalOpen } = useModalContext();

  const [storagePath, setStoragePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const llmSelectRef = useRef<HTMLButtonElement>(null);
  const zoomIndicatorTimeoutRef = useRef<number | null>(null);

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
      setTheme(settings.theme ?? "dark");

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

      // Check if Ollama is reachable, then fetch models
      const ready = await invoke<boolean>("check_ollama").catch(() => false);
      setOllamaReady(ready);
      if (ready) {
        await fetchModels(settings.lastModel);
      }
    } catch (error) {
      console.error("Init error:", error);
    }
  };

  const loadChats = async (path: string) => {
    try {
      // Initialize storage (runs migration if needed)
      await chatStorage.initializeStorage(path);

      // Load metadata
      const metadata = await chatStorage.loadMetadata(path);
      refreshMetadata(metadata);

      // Load first chat if available
      if (metadata.length > 0) {
        const firstChat = await chatStorage.loadChat(path, metadata[0].id);
        loadChatIntoMemory(firstChat);
        selectChat(firstChat.id);
        if (firstChat.model) {
          setSelectedModel(firstChat.model);
        }
      }
    } catch (error) {
      console.error("Error loading chats:", error);
      showError("Failed to load chats");
    }
  };


  const saveSettings = async (model: string, path: string, zoom?: number, themeVal?: "light" | "dark" | "blue") => {
    try {
      const appData = await appDataDir();
      const settingsPath = `${appData}/settings.json`;
      const settings: Settings = {
        storagePath: path,
        lastModel: model,
        zoomLevel: zoom ?? zoomLevel,
        theme: themeVal ?? theme,
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
    const clampedLevel = Math.max(0.5, Math.min(2.0, newLevel));
    setZoomLevel(clampedLevel);
    await applyZoom(clampedLevel);
    await saveSettings(selectedModel, storagePath, clampedLevel);

    setShowZoomIndicator(true);

    if (zoomIndicatorTimeoutRef.current) {
      clearTimeout(zoomIndicatorTimeoutRef.current);
    }

    zoomIndicatorTimeoutRef.current = window.setTimeout(() => {
      setShowZoomIndicator(false);
    }, 1000);
  };

  const zoomIn = () => changeZoom(Math.round((zoomLevel + 0.1) * 10) / 10);
  const zoomOut = () => changeZoom(Math.round((zoomLevel - 0.1) * 10) / 10);
  const resetZoom = () => changeZoom(1.0);

  const handleThemeChange = useCallback(async (newTheme: "light" | "dark" | "blue") => {
    setTheme(newTheme);
    await saveSettings(selectedModel, storagePath, zoomLevel, newTheme);
  }, [selectedModel, storagePath, zoomLevel]);

  // Cleanup zoom indicator timeout
  useEffect(() => {
    return () => {
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save current chat (debounced for streaming)
  useEffect(() => {
    if (currentChat && storagePath) {
      const timer = setTimeout(() => {
        chatStorage.saveChat(storagePath, currentChat).catch((error) => {
          console.error("Failed to save chat:", error);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentChat?.messages, currentChat?.title, currentChat?.systemPrompt, storagePath]);

  // Auto-save model selection
  useEffect(() => {
    if (selectedModel && storagePath) {
      saveSettings(selectedModel, storagePath);
    }
  }, [selectedModel, storagePath]);

  const handleUpdateChatTitle = async (chatId: string, firstMessage: string, model: string) => {
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
      const generatedTitle =
        data.message?.content?.trim() ||
        firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");

      updateChatTitle(chatId, generatedTitle);
    } catch (error: any) {
      console.error("Error generating title:", error);
      const fallbackTitle = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");
      updateChatTitle(chatId, fallbackTitle);

      if (error.message === "Failed to fetch") {
        showError("Cannot connect to Ollama for title generation");
      }
    }
  };

  const applyStoragePath = async () => {
    try {
      const dirExists = await exists(customPath);
      if (!dirExists) {
        await mkdir(customPath, { recursive: true });
      }

      // Save current chat to old location first
      if (currentChat && storagePath) {
        await chatStorage.saveChat(storagePath, currentChat);
      }

      setStoragePath(customPath);
      await saveSettings(selectedModel, customPath, zoomLevel);
      await loadChats(customPath);

      hideModal(MODAL_NAMES.SETTINGS);
    } catch (error) {
      console.error("Error changing storage path:", error);
      showError("Failed to change storage path");
    }
  };

  // Navigation helpers for hotkeys
  const navigateToPrevChat = useCallback(async () => {
    if (chatMetadata.length === 0) return;
    const currentIndex = chatMetadata.findIndex((c) => c.id === currentChat?.id);
    if (currentIndex > 0) {
      const prevChat = chatMetadata[currentIndex - 1];
      selectChat(prevChat.id);
      if (prevChat.model) {
        setSelectedModel(prevChat.model);
      }
      // Load chat if not already loaded
      try {
        const chat = await chatStorage.loadChat(storagePath, prevChat.id);
        loadChatIntoMemory(chat);
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    }
  }, [chatMetadata, currentChat, selectChat, setSelectedModel, storagePath, loadChatIntoMemory]);

  const navigateToNextChat = useCallback(async () => {
    if (chatMetadata.length === 0) return;
    const currentIndex = chatMetadata.findIndex((c) => c.id === currentChat?.id);
    if (currentIndex < chatMetadata.length - 1) {
      const nextChat = chatMetadata[currentIndex + 1];
      selectChat(nextChat.id);
      if (nextChat.model) {
        setSelectedModel(nextChat.model);
      }
      // Load chat if not already loaded
      try {
        const chat = await chatStorage.loadChat(storagePath, nextChat.id);
        loadChatIntoMemory(chat);
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    } else if (currentIndex === -1 && chatMetadata.length > 0) {
      const firstChat = chatMetadata[0];
      selectChat(firstChat.id);
      if (firstChat.model) {
        setSelectedModel(firstChat.model);
      }
      // Load chat if not already loaded
      try {
        const chat = await chatStorage.loadChat(storagePath, firstChat.id);
        loadChatIntoMemory(chat);
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    }
  }, [chatMetadata, currentChat, selectChat, setSelectedModel, storagePath, loadChatIntoMemory]);

  const openLlmSelector = useCallback(() => {
    showModal(MODAL_NAMES.LLM_SELECTOR);
  }, [showModal]);

  const handleNewChat = useCallback(() => {
    // If already in draft mode or current chat is empty, don't do anything
    if (draftChat || (currentChat && currentChat.messages.length === 0)) {
      return;
    }
    // Clear current chat and enter draft mode - show blank chat area without creating a chat
    selectChat(null);
    setDraftChat({ model: selectedModel });
  }, [draftChat, currentChat, selectedModel, setDraftChat, selectChat]);

  useHotkeys(
    {
      onFocusInput: () => {
        (document.getElementById("chat-input") as HTMLTextAreaElement)?.focus();
      },
      onNewChat: handleNewChat,
      onOpenModelDropdown: openLlmSelector,
      onOpenSettings: () => showModal(MODAL_NAMES.SETTINGS),
      onOpenChatSettings: () => currentChat && showModal(MODAL_NAMES.CHAT_SETTINGS),
      onOpenHelp: () => showModal(MODAL_NAMES.HELP),
      onCloseModals: hideAllModals,
      onNavigatePrev: navigateToPrevChat,
      onNavigateNext: navigateToNextChat,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onZoomReset: resetZoom,
      onToggleSidebar: toggleSidebar,
    },
    { isModalOpen: isAnyModalOpen() }
  );

  return (
    <div class={`flex h-screen bg-[var(--bg-app)] ${theme === "dark" ? "theme-dark" : theme === "blue" ? "theme-blue" : ""}`}>
      <Sidebar />

      <div class="flex-1 flex flex-col relative">
        <OllamaStatusBanner />
        {currentChat ? (
          <ChatArea
            key={currentChat.id}
            chat={currentChat}
            isActive={true}
            llmSelectRef={llmSelectRef}
            onUpdateChatTitle={handleUpdateChatTitle}
          />
        ) : draftChat ? (
          <ChatArea
            key="draft"
            draft={draftChat}
            isActive={true}
            llmSelectRef={llmSelectRef}
            onUpdateChatTitle={handleUpdateChatTitle}
            onCreateChat={createChat}
            onClearDraft={clearDraft}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <SettingsModal
        isOpen={isModalOpen(MODAL_NAMES.SETTINGS)}
        storagePath={storagePath}
        customPath={customPath}
        zoomLevel={zoomLevel}
        theme={theme}
        onCustomPathChange={setCustomPath}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={resetZoom}
        onThemeChange={handleThemeChange}
        onApply={applyStoragePath}
        onClose={() => hideModal(MODAL_NAMES.SETTINGS)}
      />

      <ChatSettingsModal />

      <HelpModal
        isOpen={isModalOpen(MODAL_NAMES.HELP)}
        onClose={() => hideModal(MODAL_NAMES.HELP)}
      />

      <LlmSelectorModal
        isOpen={isModalOpen(MODAL_NAMES.LLM_SELECTOR)}
        onClose={() => hideModal(MODAL_NAMES.LLM_SELECTOR)}
        onSelect={(model) => {
          // If in draft mode, update the draft model
          if (draftChat) {
            setDraftChat({ ...draftChat, model });
          } else if (currentChat) {
            // Update model for existing chat
            updateChatModel(currentChat.id, model);
          }
        }}
      />

      <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

export default App;
