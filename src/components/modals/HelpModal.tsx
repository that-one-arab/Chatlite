import { HOTKEYS } from "@/hooks/useHotkeys";
import { Modal } from "./Modal";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      width="w-[24rem]"
      clickOutsideToClose
      showCloseButton
    >
      <div class="space-y-2">
        {HOTKEYS.map((hotkey, index) => (
          <div
            key={index}
            class="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
          >
            <span class="text-sm text-[var(--text-2)]">
              {hotkey.description}
            </span>
            <div class="flex gap-1">
              {hotkey.keys.map((key, keyIndex) => (
                <kbd
                  key={keyIndex}
                  class="px-2 py-1 text-xs font-mono bg-[var(--bg-btn)] text-[var(--text-1)] rounded border border-[var(--border-input)]"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p class="text-xs text-[var(--text-2)] mt-4 text-center">
        Use Ctrl instead of ⌘ on Windows/Linux
      </p>
    </Modal>
  );
}
