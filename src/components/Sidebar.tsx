import { useChatContext, useModelContext, useModalContext, MODAL_NAMES } from "@/contexts";

export function Sidebar() {
  const { chats, currentChatId, createChat, selectChat, deleteChat } = useChatContext();
  const { selectedModel, setSelectedModel } = useModelContext();
  const { showModal } = useModalContext();

  const handleCreateChat = () => {
    const chat = chats.find((c) => c.id === currentChatId);
    if (chat && chat.messages.length === 0) {
      return;
    }
    createChat(selectedModel);
  };

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId);
    const chat = chats.find((c) => c.id === chatId);
    if (chat && chat.model) {
      setSelectedModel(chat.model);
    }
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
        {chats.map((chat) => (
          <div
            key={chat.id}
            class={`p-3 mx-2 my-1 rounded-lg cursor-pointer transition ${
              currentChatId === chat.id
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
            onClick={() => handleSelectChat(chat.id)}
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
