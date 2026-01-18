import { useEffect } from "preact/hooks";

interface ImagePreviewModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (imageUrl) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      class="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition text-2xl"
        aria-label="Close preview"
      >
        ×
      </button>

      <img
        src={imageUrl}
        alt="Preview"
        class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
      />
    </div>
  );
}
