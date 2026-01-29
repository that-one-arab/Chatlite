import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  maxHeight?: string;
  backdropOpacity?: "light" | "medium" | "dark";
  clickOutsideToClose?: boolean;
  showCloseButton?: boolean;
  escapeToClose?: boolean;
  contentClassName?: string;
  headerClassName?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
  children: ComponentChildren;
}

export function Modal({
  isOpen,
  onClose,
  title,
  width = "w-96",
  maxHeight = "max-h-[80vh]",
  backdropOpacity = "medium",
  clickOutsideToClose = false,
  showCloseButton = false,
  escapeToClose = true,
  contentClassName = "",
  headerClassName = "",
  onKeyDown,
  children,
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!escapeToClose || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, escapeToClose]);

  // Handle fade in/out animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to allow the element to be in the DOM before starting animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const backdropClass = {
    light: "bg-black/60",
    medium: "bg-black/80",
    dark: "bg-black/90",
  }[backdropOpacity];

  const handleBackdropClick = (e: MouseEvent) => {
    if (clickOutsideToClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  const opacityClass = isAnimating ? "opacity-100" : "opacity-0";
  const scaleClass = isAnimating ? "scale-100" : "scale-95";

  return (
    <div
      class={`fixed inset-0 ${backdropClass} flex items-center justify-center z-50 transition-all duration-200 ease-out ${opacityClass}`}
      onClick={handleBackdropClick}
      onKeyDown={onKeyDown}
    >
      <div
        class={`bg-white dark:bg-gray-800 rounded-lg p-6 ${width} max-w-full mx-4 ${maxHeight} overflow-y-auto ${contentClassName} transition-all duration-200 ease-out ${opacityClass} ${scaleClass}`}
      >
        {(title || showCloseButton) && (
          <div class={`flex items-center justify-between mb-4 ${headerClassName}`}>
            {title && (
              <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none ml-auto"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
