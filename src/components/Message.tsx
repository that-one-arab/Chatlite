import type { ComponentChildren } from "preact";
import Markdown from "markdown-to-jsx";
import type { Message as MessageType } from "@/types";

interface MessageProps {
  message: MessageType;
  index: number;
  isEditing: boolean;
  editContent: string;
  canEdit: boolean;
  onStartEdit: (index: number, content: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onEditContentChange: (content: string) => void;
}

export function Message({
  message,
  index,
  isEditing,
  editContent,
  canEdit,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
}: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
        }`}
      >
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

        {/* Display mode */}
        {!isEditing && (
          <div className={`break-words text-sm ${isUser ? "whitespace-pre-wrap" : "prose prose-sm dark:prose-invert max-w-none"}`}>
            {isUser ? (
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
