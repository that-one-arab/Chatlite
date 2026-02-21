import { Modal } from "./Modal";

interface SettingsModalProps {
  isOpen: boolean;
  storagePath: string;
  customPath: string;
  zoomLevel: number;
  theme: "light" | "dark" | "blue";
  onCustomPathChange: (path: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onThemeChange: (theme: "light" | "dark" | "blue") => void;
  onApply: () => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  storagePath,
  customPath,
  zoomLevel,
  theme,
  onCustomPathChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onThemeChange,
  onApply,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="w-96">
      {/* Theme */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">
          Theme
        </label>
        <div class="flex gap-2">
          {(["light", "dark", "blue"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition capitalize ${
                theme === t
                  ? "bg-[var(--text-1)] text-[var(--bg-app)]"
                  : "bg-[var(--bg-btn)] text-[var(--text-1)] hover:bg-[var(--bg-btn-hover)]"
              }`}
            >
              {t === "blue" ? "Blue" : t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </div>

      {/* Storage Path */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">
          Storage Path
        </label>
        <input
          type="text"
          value={customPath}
          onInput={(e) => onCustomPathChange(e.currentTarget.value)}
          class="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-input)] rounded-lg text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)]"
          placeholder="/path/to/chats"
        />
        <p class="text-xs text-[var(--text-2)] mt-1">
          Current: {storagePath}
        </p>
      </div>

      {/* Zoom Level */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">
          Zoom Level
        </label>
        <div class="flex items-center gap-2">
          <button
            onClick={onZoomOut}
            class="px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm font-medium"
            title="Zoom out (Cmd/Ctrl + -)"
          >
            −
          </button>
          <div class="flex-1 text-center text-sm text-[var(--text-1)] font-medium">
            {Math.round(zoomLevel * 100)}%
          </div>
          <button
            onClick={onZoomIn}
            class="px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm font-medium"
            title="Zoom in (Cmd/Ctrl + +)"
          >
            +
          </button>
          <button
            onClick={onZoomReset}
            class="px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-xs"
            title="Reset zoom (Cmd/Ctrl + 0)"
          >
            Reset
          </button>
        </div>
        <p class="text-xs text-[var(--text-2)] mt-1">
          Use Cmd/Ctrl + Plus/Minus to zoom, Cmd/Ctrl + 0 to reset
        </p>
      </div>

      <div class="flex gap-2">
        <button
          onClick={onClose}
          class="flex-1 px-4 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
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
    </Modal>
  );
}
