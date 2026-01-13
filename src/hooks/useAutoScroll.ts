import { useState, useRef, useEffect } from "preact/hooks";
import type { Message } from "@/types";

interface UseAutoScrollProps {
  messages: Message[] | undefined;
  isStreaming: boolean;
}

export function useAutoScroll({ messages, isStreaming }: UseAutoScrollProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect user scrolling during streaming
  const handleWheel = (e: WheelEvent) => {
    if (!isStreaming) return;

    if (autoScroll && e.deltaY < 0) {
      // User scrolled up, disable auto-scroll
      setAutoScroll(false);
    } else if (!autoScroll && e.deltaY > 0) {
      // User scrolled down, check if at bottom to re-enable auto-scroll
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom < 50) {
          setAutoScroll(true);
        }
      }
    }
  };

  return {
    autoScroll,
    setAutoScroll,
    messagesEndRef,
    messagesContainerRef,
    handleWheel,
  };
}
