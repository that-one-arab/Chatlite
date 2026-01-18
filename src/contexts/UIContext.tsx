import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import type { AttachedImage } from "../types";

interface UIContextValue {
  input: string;
  isStreaming: boolean;
  zoomLevel: number;
  showZoomIndicator: boolean;
  attachedImages: AttachedImage[];
  setInput: (input: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setZoomLevel: (level: number) => void;
  setShowZoomIndicator: (show: boolean) => void;
  attachImage: (image: AttachedImage) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: preact.ComponentChildren }) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  const attachImage = useCallback((image: AttachedImage) => {
    setAttachedImages((prev) => [...prev, image]);
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== imageId));
  }, []);

  const clearImages = useCallback(() => {
    setAttachedImages([]);
  }, []);

  const value: UIContextValue = {
    input,
    isStreaming,
    zoomLevel,
    showZoomIndicator,
    attachedImages,
    setInput,
    setIsStreaming,
    setZoomLevel,
    setShowZoomIndicator,
    attachImage,
    removeImage,
    clearImages,
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
