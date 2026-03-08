export type DownloadResult = "downloaded" | "opened";

const isIosDevice = () => {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const triggerLink = (href: string, options?: { fileName?: string; newTab?: boolean }) => {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener noreferrer";

  if (options?.newTab) {
    link.target = "_blank";
  }

  if (options?.fileName) {
    link.download = options.fileName;
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadFileFromUrl = async (fileUrl: string, fileName: string): Promise<DownloadResult> => {
  try {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    // iOS Safari often blocks forced blob downloads; open instead.
    if (isIosDevice()) {
      triggerLink(objectUrl, { newTab: true });
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
      return "opened";
    }

    triggerLink(objectUrl, { fileName });
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    return "downloaded";
  } catch (error) {
    console.error("downloadFileFromUrl fallback:", error);
    triggerLink(fileUrl, { newTab: true });
    return "opened";
  }
};
