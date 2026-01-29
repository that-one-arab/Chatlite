import { useChatContext, useModelContext, useModalContext, useUIContext, MODAL_NAMES } from "@/contexts";
import { useState, useEffect } from "preact/hooks";
import { chatStorage } from "@/services/chatStorage";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";

function SidebarToggleIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`transition-transform duration-200 ${isOpen ? "" : "rotate-180"}`}
    >
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </svg>
  );
}

export function Sidebar() {
  const {
    chatMetadata,
    currentChatId,
    currentChat,
    selectChat,
    deleteChat,
    loadChatIntoMemory,
    loadedChats,
  } = useChatContext();
  const { selectedModel, setSelectedModel } = useModelContext();
  const { draftChat, setDraftChat, clearDraft, isSidebarOpen, toggleSidebar } = useUIContext();
  const { showModal } = useModalContext();
  const [storagePath, setStoragePath] = useState("");

  // Load storage path from settings
  useEffect(() => {
    const loadStoragePath = async () => {
      try {
        const appData = await appDataDir();
        const settingsPath = `${appData}/settings.json`;
        const settingsContent = await readTextFile(settingsPath);
        const settings = JSON.parse(settingsContent);
        setStoragePath(settings.storagePath);
      } catch (error) {
        console.error("Failed to load storage path:", error);
      }
    };
    loadStoragePath();
  }, []);

  const handleCreateChat = () => {
    // If already in draft mode or current chat is empty, don't do anything
    if (draftChat || (currentChat && currentChat.messages.length === 0)) {
      return;
    }
    // Clear current chat and enter draft mode - show blank chat area without creating a chat
    selectChat(null);
    setDraftChat({ model: selectedModel });
  };

  const handleSelectChat = async (chatId: string) => {
    // Clear draft mode when selecting an existing chat
    if (draftChat) {
      clearDraft();
    }
    selectChat(chatId);
    const metadata = chatMetadata.find((c) => c.id === chatId);
    if (metadata?.model) {
      setSelectedModel(metadata.model);
    }

    // Load chat if not already loaded
    if (!loadedChats.has(chatId) && storagePath) {
      try {
        const chat = await chatStorage.loadChat(storagePath, chatId);
        loadChatIntoMemory(chat);
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (storagePath) {
      try {
        await chatStorage.deleteChat(storagePath, chatId);
      } catch (error) {
        console.error("Failed to delete chat file:", error);
      }
    }
    deleteChat(chatId);
  };
  return (
    <div
      class={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200 overflow-hidden ${
        isSidebarOpen ? "w-64" : "w-12"
      }`}
    >
      {/* Header with toggle + New Chat (when open) */}
      {isSidebarOpen ? (
        <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 h-[57px]">
          <button
            onClick={handleCreateChat}
            disabled={!!draftChat || (!!currentChat && currentChat.messages.length === 0)}
            class="flex-1 h-9 px-4 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap overflow-hidden"
          >
            + New Chat
          </button>
          <button
            onClick={toggleSidebar}
            class="h-9 w-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition border border-gray-200 dark:border-gray-600"
            title="Collapse sidebar"
          >
            <SidebarToggleIcon isOpen={true} />
          </button>
        </div>
      ) : (
        /* Collapsed: just the toggle button */
        <div class="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-center h-[57px]">
          <button
            onClick={toggleSidebar}
            class="h-9 w-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Expand sidebar"
          >
            <SidebarToggleIcon isOpen={false} />
          </button>
        </div>
      )}

      {/* Chat list - only visible when expanded */}
      {isSidebarOpen && (
        <div class="flex-1 overflow-y-auto">
          {[...chatMetadata]
            .sort((a, b) => b.lastModified - a.lastModified)
            .map((metadata) => (
              <div
                key={metadata.id}
                class={`p-3 mx-2 my-1 rounded-lg cursor-pointer transition ${
                  currentChatId === metadata.id
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
                onClick={() => handleSelectChat(metadata.id)}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">
                    {metadata.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(metadata.id);
                    }}
                    class="text-gray-400 hover:text-red-500 transition text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Settings - only visible when expanded */}
      {isSidebarOpen && (
        <div class="border-t border-gray-200 dark:border-gray-700 p-3">
          <button
            onClick={() => showModal(MODAL_NAMES.SETTINGS)}
            class="w-full px-3 py-4 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}
