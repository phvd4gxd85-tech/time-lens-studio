export type DownloadResult = "downloaded" | "shared" | "opened";

const isIosDevice = () => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const triggerLink = (href: string, options?: { fileName?: string; newTab?: boolean }) => {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener noreferrer";
  if (options?.newTab) link.target = "_blank";
  if (options?.fileName) link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getMimeType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
};

/**
 * Downloads a file. On mobile (especially iOS), uses the Web Share API
 * so the user gets the native "Save Image" / "Save Video" option.
 * Falls back to blob download on desktop or direct link on failure.
 */
export const downloadFileFromUrl = async (
  fileUrl: string,
  fileName: string
): Promise<DownloadResult> => {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const blob = await response.blob();
    const mimeType = getMimeType(fileName);
    const file = new File([blob], fileName, { type: mimeType });

    // On mobile, try the Web Share API — gives native "Save to Photos/Files"
    if (isMobileDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return "shared";
      } catch (shareErr: any) {
        // User cancelled share — that's fine, don't fallback
        if (shareErr?.name === "AbortError") return "shared";
        console.warn("Share failed, falling back:", shareErr);
      }
    }

    // Desktop or share not supported: blob download
    const objectUrl = window.URL.createObjectURL(blob);

    if (isIosDevice()) {
      // iOS Safari fallback: open blob URL in new tab for long-press save
      triggerLink(objectUrl, { newTab: true });
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 5000);
      return "opened";
    }

    triggerLink(objectUrl, { fileName });
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    return "downloaded";
  } catch (error) {
    console.error("downloadFileFromUrl error:", error);
    // Last resort: open URL directly
    triggerLink(fileUrl, { newTab: true });
    return "opened";
  }
};
