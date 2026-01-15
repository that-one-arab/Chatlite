import { useState, useEffect } from "preact/hooks";

interface ChatSettingsModalProps {
  isOpen: boolean;
  systemPrompt: string;
  onSave: (systemPrompt: string) => void;
  onClose: () => void;
}

export function ChatSettingsModal({
  isOpen,
  systemPrompt,
  onSave,
  onClose,
}: ChatSettingsModalProps) {
  const [draft, setDraft] = useState(systemPrompt);

  useEffect(() => {
    setDraft(systemPrompt);
  }, [systemPrompt, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-[32rem] max-w-full mx-4">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Conversation Settings
        </h2>

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
            onClick={onClose}
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
      </div>
    </div>
  );
}
