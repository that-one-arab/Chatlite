import { useState, memo } from "preact/compat";
import type { ComponentChildren } from "preact";
import Markdown from "markdown-to-jsx";
import type { Message as MessageType } from "@/types";
import { useUIContext } from "@/contexts";

interface MessageProps {
  message: MessageType;
  index: number;
  isEditing: boolean;
  editContent: string;
  canEdit: boolean;
  isStreaming: boolean;
  isLastMessage: boolean;
  onStartEdit: (index: number, content: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onEditContentChange: (content: string) => void;
  onImageClick?: (imageUrl: string) => void;
}

function formatTimestamp(timestamp?: number): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) {
    return timeStr;
  }
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dateStr}, ${timeStr}`;
}

export const Message = memo(function Message({
  message,
  index,
  isEditing,
  editContent,
  canEdit,
  isStreaming,
  isLastMessage,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onImageClick,
}: MessageProps) {
  const { theme } = useUIContext();
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const isThinking = !isUser && isLastMessage && isStreaming && !message.content;
  const hasThinking = !isUser && message.thinking;
  const formattedTimestamp = formatTimestamp(message.timestamp);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative ${isEditing ? "w-full" : isUser ? "max-w-[80%]" : "max-w-[85%]"} px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-[var(--msg-user-bg)] text-[var(--msg-user-text)]"
            : "bg-[var(--msg-ai-bg)] text-[var(--text-1)]"
        }`}
        onMouseEnter={() => setShowTimestamp(true)}
        onMouseLeave={() => setShowTimestamp(false)}
      >
        {/* Timestamp tooltip */}
        {/* Position below for first message to avoid being cropped by container top edge */}
        {showTimestamp && formattedTimestamp && (
          <div
            className={`absolute ${index === 0 ? "-bottom-8" : "-top-8"} ${isUser ? "right-0" : "left-0"} px-2 py-1 text-xs rounded bg-[var(--bg-btn)] text-[var(--text-1)] whitespace-nowrap z-10`}
          >
            {formattedTimestamp}
          </div>
        )}
        {/* Edit button (only for user messages when canEdit is true) */}
        {canEdit && !isEditing && (
          <button
            onClick={() => onStartEdit(index, message.content)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--bg-btn-hover)] cursor-pointer"
            aria-label="Edit message"
          >
            🖊️
          </button>
        )}

        {/* Copy button (only for assistant messages) */}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--bg-btn-hover)] cursor-pointer text-[var(--text-2)]"
            aria-label="Copy message"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}

        {/* Thinking section (collapsible) */}
        {hasThinking && !isEditing && (
          <div className="mb-2">
            <button
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors cursor-pointer"
            >
              <svg
                className={`w-3 h-3 transition-transform ${thinkingExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium">Thinking</span>
              {isStreaming && isLastMessage && !message.content && (
                <span className="flex gap-0.5 ml-1">
                  <span className="w-1 h-1 bg-[var(--text-2)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-[var(--text-2)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-[var(--text-2)] rounded-full animate-bounce"></span>
                </span>
              )}
            </button>
            {thinkingExpanded && (
              <div className="mt-2 pl-3 border-l-2 border-[var(--border-input)] text-xs text-[var(--text-2)] whitespace-pre-wrap">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Images (for user messages) */}
        {isUser && message.images && message.images.length > 0 && !isEditing && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((dataUrl, idx) => (
              <img
                key={idx}
                src={dataUrl}
                alt={`Image ${idx + 1}`}
                onClick={() => onImageClick?.(dataUrl)}
                className="max-w-[200px] max-h-[200px] object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </div>
        )}

        {/* Display mode */}
        {!isEditing && (
          <div className={`break-words text-sm ${isUser ? "whitespace-pre-wrap" : `prose prose-sm ${theme !== "light" ? "prose-invert" : ""} max-w-none`}`}>
            {isThinking && !hasThinking ? (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[var(--text-2)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-[var(--text-2)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-[var(--text-2)] rounded-full animate-bounce"></span>
              </div>
            ) : isUser ? (
              message.content
            ) : (
              <Markdown
                options={{
                  forceBlock: true,
                  overrides: {
                    pre: {
                      props: {
                        className: "bg-[var(--code-block)] text-gray-100 p-3 rounded-lg overflow-x-auto my-2",
                      },
                    },
                    code: {
                      component: ({ className, children, ...props }: { className?: string; children?: ComponentChildren; [key: string]: unknown }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code
                            className="bg-[var(--code-inline)] px-1.5 py-0.5 rounded text-sm"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    },
                    a: {
                      props: {
                        className: "text-blue-500 hover:underline",
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                    },
                  },
                }}
              >
                {message.content}
              </Markdown>
            )}
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div>
            <textarea
              value={editContent}
              onInput={(e) => onEditContentChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onCancelEdit();
                } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  onSaveEdit(index, editContent);
                }
              }}
              autoFocus
              rows={4}
              className="w-full px-3 py-2 border border-[var(--border-input)] rounded-lg bg-[var(--bg-input)] text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--border-ring)] text-sm resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={onCancelEdit}
                className="px-3 py-1.5 text-sm bg-[var(--bg-btn)] text-[var(--text-1)] rounded-lg hover:bg-[var(--bg-btn-hover)] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => onSaveEdit(index, editContent)}
                disabled={!editContent.trim()}
                className="px-3 py-1.5 text-sm bg-[var(--bg-btn-hover)] text-[var(--text-1)] rounded-lg hover:bg-[var(--border-input)] transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
