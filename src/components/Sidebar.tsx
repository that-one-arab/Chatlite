import { useChatContext, useModelContext, useModalContext, useUIContext, MODAL_NAMES } from "@/contexts";
import { useState, useEffect } from "preact/hooks";
import { chatStorage } from "@/services/chatStorage";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { DeleteConfirmationModal } from "./modals/DeleteConfirmationModal";

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
  const { showModal, hideModal, isModalOpen } = useModalContext();
  const [storagePath, setStoragePath] = useState("");
  const [chatToDelete, setChatToDelete] = useState<{ id: string; title: string } | null>(null);

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
    if (draftChat || (currentChat && currentChat.messages.length === 0)) {
      return;
    }
    selectChat(null);
    setDraftChat({ model: selectedModel });
  };

  const handleSelectChat = async (chatId: string) => {
    if (draftChat) {
      clearDraft();
    }
    selectChat(chatId);
    const metadata = chatMetadata.find((c) => c.id === chatId);
    if (metadata?.model) {
      setSelectedModel(metadata.model);
    }

    if (!loadedChats.has(chatId) && storagePath) {
      try {
        const chat = await chatStorage.loadChat(storagePath, chatId);
        loadChatIntoMemory(chat);
      } catch (error) {
        console.error("Failed to load chat:", error);
      }
    }
  };

  const handleDeleteClick = (e: MouseEvent, chatId: string, title: string) => {
    e.stopPropagation();
    setChatToDelete({ id: chatId, title });
    showModal(MODAL_NAMES.DELETE_CONFIRMATION);
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return;

    if (storagePath) {
      try {
        await chatStorage.deleteChat(storagePath, chatToDelete.id);
      } catch (error) {
        console.error("Failed to delete chat file:", error);
      }
    }
    deleteChat(chatToDelete.id);
    setChatToDelete(null);
    hideModal(MODAL_NAMES.DELETE_CONFIRMATION);
  };

  const handleCancelDelete = () => {
    setChatToDelete(null);
    hideModal(MODAL_NAMES.DELETE_CONFIRMATION);
  };

  return (
    <div
      class={`bg-[var(--bg-surface)] border-r border-[var(--border)] flex flex-col transition-all duration-200 overflow-hidden ${
        isSidebarOpen ? "w-64" : "w-12"
      }`}
    >
      {/* Header with toggle + New Chat (when open) */}
      {isSidebarOpen ? (
        <div class="px-3 py-2 flex items-center gap-2 h-[57px]">
          <button
            onClick={handleCreateChat}
            disabled={!!draftChat || (!!currentChat && currentChat.messages.length === 0)}
            class="flex-1 h-9 px-3 flex items-center gap-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>New Chat</span>
          </button>
          <button
            onClick={toggleSidebar}
            class="h-9 w-9 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-item-hover)] rounded-lg transition"
            title="Collapse sidebar"
          >
            <SidebarToggleIcon isOpen={true} />
          </button>
        </div>
      ) : (
        /* Collapsed: just the toggle button */
        <div class="px-2 py-2 flex justify-center h-[57px]">
          <button
            onClick={toggleSidebar}
            class="h-9 w-9 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-item-hover)] rounded-lg transition"
            title="Expand sidebar"
          >
            <SidebarToggleIcon isOpen={false} />
          </button>
        </div>
      )}

      {/* Chat list - only visible when expanded */}
      {isSidebarOpen && (
        <div class="flex-1 overflow-y-auto">
          {(() => {
            const now = Date.now();
            const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
            const sorted = [...chatMetadata].sort((a, b) => b.lastModified - a.lastModified);
            const thisWeek = sorted.filter((c) => now - c.lastModified < ONE_WEEK_MS);
            const older = sorted.filter((c) => now - c.lastModified >= ONE_WEEK_MS);

            const renderChat = (metadata: typeof sorted[0]) => (
              <div
                key={metadata.id}
                class={`p-3 mx-2 my-0.5 rounded-lg cursor-pointer transition ${
                  currentChatId === metadata.id
                    ? "bg-[var(--bg-item-selected)]"
                    : "hover:bg-[var(--bg-item-hover)]"
                }`}
                onClick={() => handleSelectChat(metadata.id)}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm text-[var(--text-1)] truncate flex-1">
                    {metadata.title}
                  </span>
                  <button
                    onClick={(e) => handleDeleteClick(e as unknown as MouseEvent, metadata.id, metadata.title)}
                    class="text-[var(--text-2)] hover:text-red-500 transition text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            );

            return (
              <>
                {thisWeek.length > 0 && (
                  <>
                    <div class="px-4 pt-3 pb-1 text-xs font-medium text-[var(--text-3)]">This week</div>
                    {thisWeek.map(renderChat)}
                  </>
                )}
                {older.length > 0 && (
                  <>
                    <div class="px-4 pt-3 pb-1 text-xs font-medium text-[var(--text-3)]">Older</div>
                    {older.map(renderChat)}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Settings - only visible when expanded */}
      {isSidebarOpen && (
        <div class="border-t border-[var(--border)] p-3">
          <button
            onClick={() => showModal(MODAL_NAMES.SETTINGS)}
            class="w-full px-3 py-2 flex items-center justify-center gap-2 text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-item-hover)] rounded-lg transition"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={isModalOpen(MODAL_NAMES.DELETE_CONFIRMATION)}
        chatTitle={chatToDelete?.title ?? ""}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
