/**
 * Downloads a file from a URL, preserving the original file type.
 * Uses fetch + blob to force a real download instead of opening in browser.
 */
export const downloadFile = async (url: string, fallbackName = "download") => {
  try {
    // Extract filename from URL
    const urlPath = new URL(url).pathname;
    const segments = urlPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || fallbackName;
    
    // Determine a good filename
    let filename = decodeURIComponent(lastSegment);
    
    // If no extension, try to detect from content-type after fetch
    const response = await fetch(url);
    if (!response.ok) {
      // Fallback: open in new tab
      window.open(url, "_blank");
      return;
    }

    const blob = await response.blob();
    
    // If filename has no extension, add one based on MIME type
    if (!filename.includes(".")) {
      const mimeToExt: Record<string, string> = {
        "application/pdf": ".pdf",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.ms-excel": ".xls",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      };
      const ext = mimeToExt[blob.type] || "";
      filename = fallbackName + ext;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
};
