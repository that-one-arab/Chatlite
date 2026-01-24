import { useChatContext, useModelContext, useModalContext, MODAL_NAMES } from "@/contexts";
import { useState, useEffect } from "preact/hooks";
import { chatStorage } from "@/services/chatStorage";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";

export function Sidebar() {
  const {
    chatMetadata,
    currentChatId,
    currentChat,
    createChat,
    selectChat,
    deleteChat,
    loadChatIntoMemory,
    loadedChats,
  } = useChatContext();
  const { selectedModel, setSelectedModel } = useModelContext();
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
    if (currentChat && currentChat.messages.length === 0) {
      return;
    }
    createChat(selectedModel);
  };

  const handleSelectChat = async (chatId: string) => {
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
    <div class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div class="p-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleCreateChat}
          class="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition text-sm font-medium"
        >
          + New Chat
        </button>
      </div>

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

      {/* Settings */}
      <div class="border-t border-gray-200 dark:border-gray-700 p-3">
        <button
          onClick={() => showModal(MODAL_NAMES.SETTINGS)}
          class="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}
