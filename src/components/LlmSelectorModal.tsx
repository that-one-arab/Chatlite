import { useState, useEffect, useRef } from "preact/hooks";
import { useModelContext } from "@/contexts";

interface LlmSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: () => void;
}

export function LlmSelectorModal({ isOpen, onClose, onSelect }: LlmSelectorModalProps) {
  const { models, selectedModel, setSelectedModel } = useModelContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const filteredModels = models.filter((model) =>
    model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setIsSearchFocused(true);
      const selectedIndex = filteredModels.findIndex((model) => model === selectedModel);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  // Update highlighted index when search changes
  useEffect(() => {
    if (filteredModels.length > 0) {
      const selectedIndex = filteredModels.findIndex((model) => model === selectedModel);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [searchQuery, filteredModels.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && !isSearchFocused) {
      const element = listItemRefs.current.get(highlightedIndex);
      if (element) {
        element.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isSearchFocused]);

  if (!isOpen) return null;

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    onSelect?.();
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (filteredModels.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (isSearchFocused) {
        setIsSearchFocused(false);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredModels.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isSearchFocused && highlightedIndex === 0) {
        setIsSearchFocused(true);
        searchInputRef.current?.focus();
      } else if (!isSearchFocused) {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === "Enter" && !isSearchFocused && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectModel(filteredModels[highlightedIndex]);
    }
  };

  return (
    <div
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg w-[28rem] max-w-full mx-4 max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-6 pb-4">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Select Model
          </h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div class="px-6 pb-4">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search models..."
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            autoFocus
          />
        </div>

        <div class="overflow-y-auto px-6 pb-6">
          {filteredModels.length === 0 ? (
            <div class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No models found
            </div>
          ) : (
            <div class="space-y-1">
              {filteredModels.map((model, index) => {
                const isSelected = model === selectedModel;
                const isHighlighted = index === highlightedIndex && !isSearchFocused;
                return (
                  <button
                    key={model}
                    ref={(el) => {
                      if (el) listItemRefs.current.set(index, el);
                      else listItemRefs.current.delete(index);
                    }}
                    onClick={() => handleSelectModel(model)}
                    class={`w-full text-left px-4 py-3 rounded-lg transition ${
                      isHighlighted
                        ? "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                        : isSelected
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">{model}</span>
                      {isSelected && (
                        <svg
                          class="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
