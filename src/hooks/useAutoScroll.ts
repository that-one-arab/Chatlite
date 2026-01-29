import { useEffect, useRef, useCallback } from "preact/hooks";
import type { RefObject } from "preact";

interface UseAutoScrollParams {
  isStreaming: boolean;
  messagesContainerRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
}

export function useAutoScroll({
  isStreaming,
  messagesContainerRef,
  messagesEndRef,
}: UseAutoScrollParams) {
  const autoScrollRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const contentVersionRef = useRef(0);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messagesEndRef]);

  // Check if user is near bottom (within 100px)
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom < 100;
  }, [messagesContainerRef]);

  // Handle wheel events to detect user scrolling
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!isStreaming) return;

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Mark that user is actively scrolling
    isUserScrollingRef.current = true;

    // If scrolling up, disable auto-scroll
    if (e.deltaY < 0) {
      autoScrollRef.current = false;
    } else if (e.deltaY > 0 && isNearBottom()) {
      // If scrolling down and near bottom, re-enable auto-scroll
      autoScrollRef.current = true;
    }

    // Reset user scrolling flag after a short delay
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, [isStreaming, isNearBottom]);

  // Handle scroll events to detect manual scroll
  const handleScroll = useCallback(() => {
    if (!isStreaming || isUserScrollingRef.current) return;

    // Check if user manually scrolled (not via auto-scroll)
    if (!isNearBottom()) {
      autoScrollRef.current = false;
    } else {
      autoScrollRef.current = true;
    }
  }, [isStreaming, isNearBottom]);

  // Effect to increment content version when streaming starts
  useEffect(() => {
    if (isStreaming) {
      contentVersionRef.current += 1;
    } else {
      // Reset auto-scroll when streaming ends
      autoScrollRef.current = true;
    }
  }, [isStreaming]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleWheel,
    handleScroll,
    scrollToBottom,
    triggerAutoScroll: () => {
      if (autoScrollRef.current) {
        scrollToBottom("smooth");
      }
    },
    isAutoScrollEnabled: () => autoScrollRef.current,
  };
}
