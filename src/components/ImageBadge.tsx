interface ImageBadgeProps {
  dataUrl: string;
  name: string;
  onRemove: () => void;
  onPreview: () => void;
}

export function ImageBadge({ dataUrl, name, onRemove, onPreview }: ImageBadgeProps) {
  return (
    <div class="relative group">
      <img
        src={dataUrl}
        alt={name}
        onClick={onPreview}
        class="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        class="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 dark:bg-gray-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </div>
  );
}
