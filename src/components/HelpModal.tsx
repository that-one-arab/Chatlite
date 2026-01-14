import { HOTKEYS } from "@/hooks/useHotkeys";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-[24rem] max-w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none"
          >
            ×
          </button>
        </div>

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
      </div>
    </div>
  );
}
