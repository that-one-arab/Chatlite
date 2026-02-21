import { Modal } from "./Modal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  chatTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  chatTitle,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Delete Conversation"
      width="w-[400px]"
      clickOutsideToClose={true}
      escapeToClose={true}
    >
      <div class="space-y-4">
        <p class="text-[var(--text-2)] text-sm">
          Are you sure you want to delete <span class="font-medium text-[var(--text-1)]">"{chatTitle}"</span>?
          This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            class="px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-btn)] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
