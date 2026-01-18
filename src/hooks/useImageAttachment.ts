import { useCallback } from "preact/hooks";
import type { AttachedImage } from "@/types";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

// Extract base64 data from a data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;
}

// Process pasted image blob
async function processImageBlob(
  blob: Blob,
  currentImageCount: number,
  onSuccess: (image: AttachedImage) => void,
  onError: (message: string) => void
): Promise<void> {
  // Check file size
  if (blob.size > MAX_IMAGE_SIZE_BYTES) {
    onError(`Image too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB`);
    return;
  }

  // Convert blob to base64
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const base64 = extractBase64FromDataUrl(dataUrl);

    const image: AttachedImage = {
      id: Date.now().toString() + Math.random(),
      base64,
      dataUrl,
      name: `Image ${currentImageCount + 1}`,
    };

    onSuccess(image);
  };
  reader.onerror = () => {
    onError("Failed to read image");
  };
  reader.readAsDataURL(blob);
}

interface UseImageAttachmentParams {
  attachedImages: AttachedImage[];
  attachImage: (image: AttachedImage) => void;
  showError: (message: string) => void;
}

export function useImageAttachment({
  attachedImages,
  attachImage,
  showError,
}: UseImageAttachmentParams) {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();


          const blob = item.getAsFile();
          if (!blob) continue;

          // Process the image blob
          await processImageBlob(blob, attachedImages.length, attachImage, showError);
        }
      }
    },
    [attachedImages.length, attachImage, showError]
  );

  return {
    handlePaste,
  };
}
