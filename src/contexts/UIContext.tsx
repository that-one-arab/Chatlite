import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";

interface UIContextValue {
  input: string;
  isStreaming: boolean;
  showSettings: boolean;
  showChatSettings: boolean;
  showHelp: boolean;
  showLlmSelector: boolean;
  zoomLevel: number;
  showZoomIndicator: boolean;
  setInput: (input: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowChatSettings: (show: boolean) => void;
  setShowHelp: (show: boolean) => void;
  setShowLlmSelector: (show: boolean) => void;
  setZoomLevel: (level: number) => void;
  setShowZoomIndicator: (show: boolean) => void;
  toggleSettings: () => void;
  toggleChatSettings: () => void;
  toggleHelp: () => void;
  toggleLlmSelector: () => void;
  closeAllModals: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: preact.ComponentChildren }) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLlmSelector, setShowLlmSelector] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const toggleChatSettings = useCallback(() => {
    setShowChatSettings((prev) => !prev);
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  const toggleLlmSelector = useCallback(() => {
    setShowLlmSelector((prev) => !prev);
  }, []);

  const closeAllModals = useCallback(() => {
    setShowSettings(false);
    setShowChatSettings(false);
    setShowHelp(false);
    setShowLlmSelector(false);
  }, []);

  const value: UIContextValue = {
    input,
    isStreaming,
    showSettings,
    showChatSettings,
    showHelp,
    showLlmSelector,
    zoomLevel,
    showZoomIndicator,
    setInput,
    setIsStreaming,
    setShowSettings,
    setShowChatSettings,
    setShowHelp,
    setShowLlmSelector,
    setZoomLevel,
    setShowZoomIndicator,
    toggleSettings,
    toggleChatSettings,
    toggleHelp,
    toggleLlmSelector,
    closeAllModals,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within UIProvider");
  }
  return context;
}
