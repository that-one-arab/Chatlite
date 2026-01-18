import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Settings } from "@/types";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useHotkeys } from "@/hooks/useHotkeys";
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
import { SettingsModal } from "@/components/modals/SettingsModal";
import { ChatSettingsModal } from "@/components/modals/ChatSettingsModal";
import { HelpModal } from "@/components/modals/HelpModal";
import { LlmSelectorModal } from "@/components/modals/LlmSelectorModal";
import { Toast } from "@/components/Toast";

function AppContent() {
  const { chats, currentChat, setChats, updateChatTitle, selectChat } = useChatContext();
  const { selectedModel, setSelectedModel, fetchModels } = useModelContext();
  const {
    isStreaming,
    zoomLevel,
    setZoomLevel,
    setShowZoomIndicator,
  } = useUIContext();
  const { toasts, showError, removeToast } = useNotificationContext();
  const { showModal, hideModal, hideAllModals, isModalOpen, isAnyModalOpen } = useModalContext();

  const [storagePath, setStoragePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const llmSelectRef = useRef<HTMLButtonElement>(null);
  const zoomIndicatorTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messagesEndRef, messagesContainerRef, handleWheel, setAutoScroll } = useAutoScroll({
    messages: currentChat?.messages,
    isStreaming,
  });

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

      // Fetch models
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
          selectChat(parsed[0].id);
          if (parsed[0].model) {
            setSelectedModel(parsed[0].model);
          }
        }
      }
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  };

  const saveChats = async (updatedChats: typeof chats) => {
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

  // Cleanup zoom indicator timeout
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

      if (chats.length > 0 && storagePath) {
        await saveChats(chats);
      }

      setStoragePath(customPath);
      await saveSettings(selectedModel, customPath, zoomLevel);
      await loadChats(customPath);

      hideModal(MODAL_NAMES.SETTINGS);
    } catch (error) {
      console.error("Error changing storage path:", error);
      alert("Failed to change storage path. Check console for details.");
    }
  };

  // Navigation helpers for hotkeys
  const navigateToPrevChat = useCallback(() => {
    if (chats.length === 0) return;
    const currentIndex = chats.findIndex((c) => c.id === currentChat?.id);
    if (currentIndex > 0) {
      selectChat(chats[currentIndex - 1].id);
      if (chats[currentIndex - 1].model) {
        setSelectedModel(chats[currentIndex - 1].model);
      }
    }
  }, [chats, currentChat, selectChat, setSelectedModel]);

  const navigateToNextChat = useCallback(() => {
    if (chats.length === 0) return;
    const currentIndex = chats.findIndex((c) => c.id === currentChat?.id);
    if (currentIndex < chats.length - 1) {
      selectChat(chats[currentIndex + 1].id);
      if (chats[currentIndex + 1].model) {
        setSelectedModel(chats[currentIndex + 1].model);
      }
    } else if (currentIndex === -1) {
      selectChat(chats[0].id);
      if (chats[0].model) {
        setSelectedModel(chats[0].model);
      }
    }
  }, [chats, currentChat, selectChat, setSelectedModel]);

  const openLlmSelector = useCallback(() => {
    showModal(MODAL_NAMES.LLM_SELECTOR);
  }, [showModal]);

  useHotkeys(
    {
      onFocusInput: () => inputRef.current?.focus(),
      onNewChat: () => {}, // Will be handled in Sidebar
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
    },
    { isModalOpen: isAnyModalOpen() }
  );

  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div class="flex-1 flex flex-col">
        {currentChat ? (
          <ChatArea
            messagesEndRef={messagesEndRef}
            messagesContainerRef={messagesContainerRef}
            inputRef={inputRef}
            llmSelectRef={llmSelectRef}
            onWheel={handleWheel}
            onUpdateChatTitle={handleUpdateChatTitle}
            abortControllerRef={abortControllerRef}
            setAutoScroll={setAutoScroll}
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
        onCustomPathChange={setCustomPath}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={resetZoom}
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
        onSelect={() => inputRef.current?.focus()}
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
