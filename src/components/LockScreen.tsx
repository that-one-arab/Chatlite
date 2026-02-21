import { useState } from "preact/hooks";
import { chatStorage } from "@/services/chatStorage";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      await chatStorage.unlockApp(password);
      onUnlock();
    } catch {
      setError("Incorrect password. Please try again.");
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-app)]">
      <div class="w-80 rounded-2xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] p-8">
        <div class="text-center mb-6">
          <div class="text-2xl font-bold text-[var(--text-1)] mb-1">ChatLite</div>
          <div class="text-sm text-[var(--text-2)]">Enter your password to unlock</div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder="Password"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            class="w-full px-3 py-2 mb-3 text-sm bg-[var(--bg-app)] border border-[var(--border-input)] rounded-lg text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)]"
          />

          {error && <p class="text-xs text-red-400 mb-3">{error}</p>}

          <button
            type="submit"
            disabled={!password || isLoading}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {isLoading ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
