import { useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { useUIContext } from "@/contexts/UIContext";
import { useModelContext } from "@/contexts/ModelContext";

export function OllamaStatusBanner() {
  const { ollamaReady, setOllamaReady } = useUIContext();
  const { fetchModels } = useModelContext();
  const pollingRef = useRef<number | null>(null);

  const check = async () => {
    const ready = await invoke<boolean>("check_ollama").catch(() => false);
    if (ready) {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setOllamaReady(true);
      await fetchModels();
    }
    return ready;
  };

  // Poll every 5s while unreachable so the banner auto-dismisses when the user starts Ollama
  useEffect(() => {
    if (ollamaReady === false) {
      pollingRef.current = window.setInterval(check, 5000);
    }
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [ollamaReady]);

  // Only show when explicitly unreachable
  if (ollamaReady !== false) return null;

  return (
    <div class="flex items-center gap-2.5 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm flex-shrink-0">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>

      <span>Ollama is not running</span>

      <div class="flex-1" />

      <button
        onClick={check}
        class="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 transition text-xs"
      >
        Retry
      </button>
    </div>
  );
}
