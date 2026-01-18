import { useState, useEffect } from "preact/hooks";
import { useChatContext, useModalContext, MODAL_NAMES } from "@/contexts";
import { Modal } from "./Modal";

export function ChatSettingsModal() {
  const { currentChat, updateSystemPrompt } = useChatContext();
  const { isModalOpen, hideModal } = useModalContext();

  const [draft, setDraft] = useState(currentChat?.systemPrompt || "");

  const isOpen = isModalOpen(MODAL_NAMES.CHAT_SETTINGS);

  useEffect(() => {
    setDraft(currentChat?.systemPrompt || "");
  }, [currentChat?.systemPrompt, isOpen]);

  const handleSave = () => {
    if (currentChat) {
      updateSystemPrompt(currentChat.id, draft);
    }
    hideModal(MODAL_NAMES.CHAT_SETTINGS);
  };

  const handleClose = () => {
    hideModal(MODAL_NAMES.CHAT_SETTINGS);
  };

  if (!currentChat) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Conversation Settings"
      width="w-[32rem]"
    >
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          System Prompt
        </label>
        <textarea
          value={draft}
          onInput={(e) => setDraft(e.currentTarget.value)}
          rows={6}
          class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="You are a helpful assistant..."
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Instructions that guide the model's behavior for this conversation.
        </p>
      </div>

      <div class="flex gap-2">
        <button
          onClick={handleClose}
          class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
