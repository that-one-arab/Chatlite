import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import Markdown from "markdown-to-jsx";
import type { Message as MessageType } from "@/types";

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

export function Message({
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
}: MessageProps) {
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
        className={`group relative max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
        }`}
        onMouseEnter={() => setShowTimestamp(true)}
        onMouseLeave={() => setShowTimestamp(false)}
      >
        {/* Timestamp tooltip */}
        {/* Position below for first message to avoid being cropped by container top edge */}
        {showTimestamp && formattedTimestamp && (
          <div
            className={`absolute ${index === 0 ? "-bottom-8" : "-top-8"} ${isUser ? "right-0" : "left-0"} px-2 py-1 text-xs rounded bg-gray-800 dark:bg-gray-700 text-white whitespace-nowrap z-10`}
          >
            {formattedTimestamp}
          </div>
        )}
        {/* Edit button (only for user messages when canEdit is true) */}
        {canEdit && !isEditing && (
          <button
            onClick={() => onStartEdit(index, message.content)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-blue-700 cursor-pointer"
            aria-label="Edit message"
          >
            🖊️
          </button>
        )}

        {/* Copy button (only for assistant messages) */}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-gray-500 dark:text-gray-400"
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
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
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
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                </span>
              )}
            </button>
            {thinkingExpanded && (
              <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Display mode */}
        {!isEditing && (
          <div className={`break-words text-sm ${isUser ? "whitespace-pre-wrap" : "prose prose-sm dark:prose-invert max-w-none"}`}>
            {isThinking && !hasThinking ? (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
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
                        className: "bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-lg overflow-x-auto my-2",
                      },
                    },
                    code: {
                      component: ({ className, children, ...props }: { className?: string; children?: ComponentChildren; [key: string]: unknown }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code
                            className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm"
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={onCancelEdit}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => onSaveEdit(index, editContent)}
                disabled={!editContent.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
