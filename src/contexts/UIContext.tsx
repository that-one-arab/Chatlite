import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

interface DraftChat {
  model: string;
  systemPrompt?: string;
}

interface UIContextValue {
  streamingChatId: string | null;
  zoomLevel: number;
  showZoomIndicator: boolean;
  draftChat: DraftChat | null;
  setStreamingChatId: (chatId: string | null) => void;
  setZoomLevel: (level: number) => void;
  setShowZoomIndicator: (show: boolean) => void;
  setDraftChat: (draft: DraftChat | null) => void;
  clearDraft: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: preact.ComponentChildren }) {
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [draftChat, setDraftChat] = useState<DraftChat | null>(null);

  const clearDraft = () => setDraftChat(null);

  const value: UIContextValue = {
    streamingChatId,
    zoomLevel,
    showZoomIndicator,
    draftChat,
    setStreamingChatId,
    setZoomLevel,
    setShowZoomIndicator,
    setDraftChat,
    clearDraft,
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
