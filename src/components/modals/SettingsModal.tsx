import { useState } from "preact/hooks";
import { Modal } from "./Modal";

interface SettingsModalProps {
  isOpen: boolean;
  storagePath: string;
  customPath: string;
  zoomLevel: number;
  theme: "light" | "dark" | "blue";
  passwordEnabled: boolean;
  onCustomPathChange: (path: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onThemeChange: (theme: "light" | "dark" | "blue") => void;
  onEnablePassword: (password: string) => Promise<void>;
  onDisablePassword: (password: string) => Promise<void>;
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<void>;
  onApply: () => void;
  onClose: () => void;
}

type SecurityMode = "idle" | "enabling" | "disabling" | "changing";

export function SettingsModal({
  isOpen,
  storagePath,
  customPath,
  zoomLevel,
  theme,
  passwordEnabled,
  onCustomPathChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onThemeChange,
  onEnablePassword,
  onDisablePassword,
  onChangePassword,
  onApply,
  onClose,
}: SettingsModalProps) {
  const [secMode, setSecMode] = useState<SecurityMode>("idle");
  const [secError, setSecError] = useState("");
  const [secLoading, setSecLoading] = useState(false);

  // Field values
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [oldPwd, setOldPwd] = useState("");

  const resetSecForm = () => {
    setSecMode("idle");
    setSecError("");
    setNewPwd("");
    setConfirmPwd("");
    setCurrentPwd("");
    setOldPwd("");
  };

  const handleEnable = async (e: Event) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setSecError("Passwords do not match.");
      return;
    }
    if (newPwd.length < 1) {
      setSecError("Password cannot be empty.");
      return;
    }
    setSecLoading(true);
    setSecError("");
    try {
      await onEnablePassword(newPwd);
      resetSecForm();
    } catch (err) {
      setSecError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setSecLoading(false);
    }
  };

  const handleDisable = async (e: Event) => {
    e.preventDefault();
    setSecLoading(true);
    setSecError("");
    try {
      await onDisablePassword(currentPwd);
      resetSecForm();
    } catch (err) {
      setSecError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setSecLoading(false);
    }
  };

  const handleChange = async (e: Event) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setSecError("New passwords do not match.");
      return;
    }
    if (newPwd.length < 1) {
      setSecError("New password cannot be empty.");
      return;
    }
    setSecLoading(true);
    setSecError("");
    try {
      await onChangePassword(oldPwd, newPwd);
      resetSecForm();
    } catch (err) {
      setSecError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setSecLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-input)] rounded-lg text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)]";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="w-96">
      {/* Theme */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">Theme</label>
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
        <label class="block text-sm text-[var(--text-2)] mb-2">Storage Path</label>
        <input
          type="text"
          value={customPath}
          onInput={(e) => onCustomPathChange(e.currentTarget.value)}
          class={inputClass}
          placeholder="/path/to/chats"
        />
        <p class="text-xs text-[var(--text-2)] mt-1">Current: {storagePath}</p>
      </div>

      {/* Zoom Level */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">Zoom Level</label>
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

      {/* Security */}
      <div class="mb-4">
        <label class="block text-sm text-[var(--text-2)] mb-2">Security</label>

        {secMode === "idle" && (
          <div>
            {passwordEnabled ? (
              <div>
                <p class="text-xs text-[var(--text-2)] mb-2">
                  Password protection is <span class="text-green-400 font-medium">enabled</span>.
                  Chat files are encrypted at rest.
                </p>
                <div class="flex gap-2">
                  <button
                    onClick={() => { setSecMode("changing"); setSecError(""); }}
                    class="flex-1 px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => { setSecMode("disabling"); setSecError(""); }}
                    class="flex-1 px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
                  >
                    Disable
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p class="text-xs text-[var(--text-2)] mb-2">
                  Password protection is <span class="text-[var(--text-3)] font-medium">disabled</span>.
                  Chat files are stored as plaintext.
                </p>
                <button
                  onClick={() => { setSecMode("enabling"); setSecError(""); }}
                  class="w-full px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
                >
                  Enable Password Protection
                </button>
              </div>
            )}
          </div>
        )}

        {secMode === "enabling" && (
          <form onSubmit={handleEnable} class="space-y-2">
            <input
              type="password"
              value={newPwd}
              onInput={(e) => setNewPwd(e.currentTarget.value)}
              placeholder="New password"
              class={inputClass}
              autoFocus
            />
            <input
              type="password"
              value={confirmPwd}
              onInput={(e) => setConfirmPwd(e.currentTarget.value)}
              placeholder="Confirm password"
              class={inputClass}
            />
            {secError && <p class="text-xs text-red-400">{secError}</p>}
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetSecForm}
                class="flex-1 px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={secLoading || !newPwd}
                class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                {secLoading ? "Enabling…" : "Enable"}
              </button>
            </div>
          </form>
        )}

        {secMode === "disabling" && (
          <form onSubmit={handleDisable} class="space-y-2">
            <input
              type="password"
              value={currentPwd}
              onInput={(e) => setCurrentPwd(e.currentTarget.value)}
              placeholder="Current password"
              class={inputClass}
              autoFocus
            />
            {secError && <p class="text-xs text-red-400">{secError}</p>}
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetSecForm}
                class="flex-1 px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={secLoading || !currentPwd}
                class="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition text-sm"
              >
                {secLoading ? "Disabling…" : "Disable"}
              </button>
            </div>
          </form>
        )}

        {secMode === "changing" && (
          <form onSubmit={handleChange} class="space-y-2">
            <input
              type="password"
              value={oldPwd}
              onInput={(e) => setOldPwd(e.currentTarget.value)}
              placeholder="Current password"
              class={inputClass}
              autoFocus
            />
            <input
              type="password"
              value={newPwd}
              onInput={(e) => setNewPwd(e.currentTarget.value)}
              placeholder="New password"
              class={inputClass}
            />
            <input
              type="password"
              value={confirmPwd}
              onInput={(e) => setConfirmPwd(e.currentTarget.value)}
              placeholder="Confirm new password"
              class={inputClass}
            />
            {secError && <p class="text-xs text-red-400">{secError}</p>}
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetSecForm}
                class="flex-1 px-3 py-2 bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={secLoading || !oldPwd || !newPwd}
                class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                {secLoading ? "Changing…" : "Change"}
              </button>
            </div>
          </form>
        )}
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
