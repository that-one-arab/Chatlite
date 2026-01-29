import { useEffect, useCallback } from "preact/hooks";

interface HotkeyActions {
  onFocusInput: () => void;
  onNewChat: () => void;
  onOpenModelDropdown: () => void;
  onOpenSettings: () => void;
  onOpenChatSettings: () => void;
  onOpenHelp: () => void;
  onCloseModals: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleSidebar: () => void;
}

interface UseHotkeysOptions {
  enabled?: boolean;
  isModalOpen?: boolean;
}

export function useHotkeys(
  actions: HotkeyActions,
  options: UseHotkeysOptions = {}
) {
  const { enabled = true, isModalOpen = false } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle hotkeys when disabled
      if (!enabled) return;

      // Check if user is typing in an input/textarea (except for specific shortcuts)
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isMod = e.metaKey || e.ctrlKey;

      // Escape - close modals or blur input
      if (e.key === "Escape") {
        e.preventDefault();
        if (isModalOpen) {
          actions.onCloseModals();
        } else if (isTyping) {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      // When a modal is open, only Escape works (handled above)
      if (isModalOpen) return;

      // Cmd/Ctrl + K - Focus input
      if (isMod && e.key === "k") {
        e.preventDefault();
        actions.onFocusInput();
        return;
      }

      // Cmd/Ctrl + N - New chat
      if (isMod && e.key === "n") {
        e.preventDefault();
        actions.onNewChat();
        return;
      }

      // Cmd/Ctrl + M - Open model dropdown
      if (isMod && e.key === "m") {
        e.preventDefault();
        actions.onOpenModelDropdown();
        return;
      }

      // Cmd/Ctrl + , - Open settings
      if (isMod && e.key === ",") {
        e.preventDefault();
        if (e.shiftKey) {
          actions.onOpenChatSettings();
        } else {
          actions.onOpenSettings();
        }
        return;
      }

      // Cmd/Ctrl + B - Toggle sidebar
      if (isMod && e.key === "b") {
        e.preventDefault();
        actions.onToggleSidebar();
        return;
      }

      // Cmd/Ctrl + / or ? - Open help
      if ((isMod && e.key === "/") || e.key === "?") {
        // Don't trigger ? when typing
        if (e.key === "?" && isTyping) return;
        e.preventDefault();
        actions.onOpenHelp();
        return;
      }

      // Cmd/Ctrl + Plus/= - Zoom in
      if (isMod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        actions.onZoomIn();
        return;
      }

      // Cmd/Ctrl + Minus - Zoom out
      if (isMod && e.key === "-") {
        e.preventDefault();
        actions.onZoomOut();
        return;
      }

      // Cmd/Ctrl + 0 - Reset zoom
      if (isMod && e.key === "0") {
        e.preventDefault();
        actions.onZoomReset();
        return;
      }

      // Alt + Up - Previous chat (works even when typing)
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        actions.onNavigatePrev();
        return;
      }

      // Alt + Down - Next chat (works even when typing)
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        actions.onNavigateNext();
        return;
      }

      // J/K vim-style navigation - only when not typing
      if (!isTyping) {
        if (e.key === "j") {
          e.preventDefault();
          actions.onNavigateNext();
          return;
        }

        if (e.key === "k") {
          e.preventDefault();
          actions.onNavigatePrev();
          return;
        }
      }
    },
    [actions, enabled, isModalOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export const HOTKEYS = [
  { keys: ["⌘", "K"], description: "Focus message input" },
  { keys: ["⌘", "N"], description: "New conversation" },
  { keys: ["⌘", "M"], description: "Select model" },
  { keys: ["⌘", ","], description: "Open settings" },
  { keys: ["⌘", "⇧", ","], description: "Conversation settings" },
  { keys: ["⌘", "B"], description: "Toggle sidebar" },
  { keys: ["Alt", "↑"], description: "Previous conversation" },
  { keys: ["Alt", "↓"], description: "Next conversation" },
  { keys: ["J / K"], description: "Navigate conversations" },
  { keys: ["⌘", "+"], description: "Zoom in" },
  { keys: ["⌘", "-"], description: "Zoom out" },
  { keys: ["⌘", "0"], description: "Reset zoom" },
  { keys: ["⌘", "/"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close modal / Blur input" },
] as const;
