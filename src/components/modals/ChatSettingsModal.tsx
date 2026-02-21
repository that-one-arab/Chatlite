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
        <label class="block text-sm font-medium text-[var(--text-1)] mb-2">
          System Prompt
        </label>
        <textarea
          value={draft}
          onInput={(e) => setDraft(e.currentTarget.value)}
          rows={6}
          class="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-input)] rounded-lg text-[var(--text-1)] placeholder-[var(--text-3)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)]"
          placeholder="You are a helpful assistant..."
        />
        <p class="text-xs text-[var(--text-2)] mt-1">
          Instructions that guide the model's behavior for this conversation.
        </p>
      </div>

      <div class="flex gap-2">
        <button
          onClick={handleClose}
          class="flex-1 px-4 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
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
