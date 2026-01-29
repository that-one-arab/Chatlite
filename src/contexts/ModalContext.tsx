import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";

export const MODAL_NAMES = {
  SETTINGS: "settings",
  CHAT_SETTINGS: "chatSettings",
  HELP: "help",
  LLM_SELECTOR: "llmSelector",
  IMAGE_PREVIEW: "imagePreview",
  DELETE_CONFIRMATION: "deleteConfirmation",
} as const;

export type ModalName = (typeof MODAL_NAMES)[keyof typeof MODAL_NAMES];

interface ModalContextValue {
  showModal: (name: ModalName) => void;
  hideModal: (name?: ModalName) => void;
  hideAllModals: () => void;
  isModalOpen: (name: ModalName) => boolean;
  isAnyModalOpen: () => boolean;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

interface ModalProviderProps {
  children: ComponentChildren;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [openModals, setOpenModals] = useState<Set<ModalName>>(new Set());

  const showModal = useCallback((name: ModalName) => {
    setOpenModals((prev) => new Set(prev).add(name));
  }, []);

  const hideModal = useCallback((name?: ModalName) => {
    if (!name) {
      // If no name provided, close the most recently opened modal
      setOpenModals((prev) => {
        const newSet = new Set(prev);
        const lastModal = Array.from(newSet).pop();
        if (lastModal) newSet.delete(lastModal);
        return newSet;
      });
    } else {
      setOpenModals((prev) => {
        const newSet = new Set(prev);
        newSet.delete(name);
        return newSet;
      });
    }
  }, []);

  const hideAllModals = useCallback(() => {
    setOpenModals(new Set());
  }, []);

  const isModalOpen = useCallback(
    (name: ModalName) => {
      return openModals.has(name);
    },
    [openModals]
  );

  const isAnyModalOpen = useCallback(() => {
    return openModals.size > 0;
  }, [openModals]);

  return (
    <ModalContext.Provider
      value={{ showModal, hideModal, hideAllModals, isModalOpen, isAnyModalOpen }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModalContext must be used within a ModalProvider");
  }
  return context;
}
