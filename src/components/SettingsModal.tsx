interface SettingsModalProps {
  isOpen: boolean;
  storagePath: string;
  customPath: string;
  zoomLevel: number;
  onCustomPathChange: (path: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  storagePath,
  customPath,
  zoomLevel,
  onCustomPathChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onApply,
  onClose,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Settings
        </h2>

        <div class="mb-4">
          <label class="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            Storage Path
          </label>
          <input
            type="text"
            value={customPath}
            onInput={(e) => onCustomPathChange(e.currentTarget.value)}
            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
            placeholder="/path/to/chats"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Current: {storagePath}
          </p>
        </div>

        <div class="mb-4">
          <label class="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            Zoom Level
          </label>
          <div class="flex items-center gap-2">
            <button
              onClick={onZoomOut}
              class="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm font-medium"
              title="Zoom out (Cmd/Ctrl + -)"
            >
              −
            </button>
            <div class="flex-1 text-center text-sm text-gray-700 dark:text-gray-300 font-medium">
              {Math.round(zoomLevel * 100)}%
            </div>
            <button
              onClick={onZoomIn}
              class="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm font-medium"
              title="Zoom in (Cmd/Ctrl + +)"
            >
              +
            </button>
            <button
              onClick={onZoomReset}
              class="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-xs"
              title="Reset zoom (Cmd/Ctrl + 0)"
            >
              Reset
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use Cmd/Ctrl + Plus/Minus to zoom, Cmd/Ctrl + 0 to reset
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
            onClick={onApply}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
