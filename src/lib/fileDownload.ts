/**
 * Downloads a file from a URL, preserving the original file type.
 * Uses fetch + blob to force a real download instead of opening in browser.
 */
export const downloadFile = async (url: string, fallbackName = "download") => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      window.open(url, "_blank");
      return;
    }

    const blob = await response.blob();
    const contentType = blob.type || response.headers.get("content-type") || "";

    // Try to get filename from Content-Disposition header
    const disposition = response.headers.get("content-disposition");
    let filename = "";
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]*)\1/);
      if (match?.[2]) filename = decodeURIComponent(match[2]);
    }

    // If no filename from header, use fallbackName
    if (!filename) {
      filename = fallbackName;
    }

    // If filename has no extension, add one based on content-type
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
        "text/plain": ".txt",
        "text/csv": ".csv",
      };
      // Match base mime type (ignore charset etc.)
      const baseMime = contentType.split(";")[0].trim().toLowerCase();
      const ext = mimeToExt[baseMime] || "";
      filename = filename + ext;
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
    window.open(url, "_blank");
  }
};
