import { useModalContext, MODAL_NAMES } from "@/contexts";
import { Modal } from "./Modal";

interface ImagePreviewModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
  const { isModalOpen } = useModalContext();

  return (
    <Modal
      isOpen={isModalOpen(MODAL_NAMES.IMAGE_PREVIEW)}
      onClose={onClose}
      backdropOpacity="dark"
      clickOutsideToClose
      width="max-w-[90vw]"
      maxHeight="max-h-[90vh]"
      contentClassName="!bg-transparent !p-0 shadow-none"
    >
      <button
        onClick={onClose}
        class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition text-2xl"
        aria-label="Close preview"
      >
        ×
      </button>

      <img
        src={imageUrl || ""}
        alt="Preview"
        class="max-w-full max-h-full object-contain rounded-lg"
      />
    </Modal>
  );
}
