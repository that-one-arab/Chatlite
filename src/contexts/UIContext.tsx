import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

interface UIContextValue {
  streamingChatId: string | null;
  zoomLevel: number;
  showZoomIndicator: boolean;
  setStreamingChatId: (chatId: string | null) => void;
  setZoomLevel: (level: number) => void;
  setShowZoomIndicator: (show: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: preact.ComponentChildren }) {
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const value: UIContextValue = {
    streamingChatId,
    zoomLevel,
    showZoomIndicator,
    setStreamingChatId,
    setZoomLevel,
    setShowZoomIndicator,
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
