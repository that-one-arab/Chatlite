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
            class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {hotkey.description}
            </span>
            <div class="flex gap-1">
              {hotkey.keys.map((key, keyIndex) => (
                <kbd
                  key={keyIndex}
                  class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        Use Ctrl instead of ⌘ on Windows/Linux
      </p>
    </Modal>
  );
}
