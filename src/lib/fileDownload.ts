/**
 * Downloads a file from a URL, preserving the original file type.
 * Uses fetch + blob to force a real download instead of opening in browser.
 */
export const downloadFile = async (url: string, fallbackName = "download") => {
  try {
    // For Cloudinary raw uploads, use fl_attachment to get proper Content-Disposition
    let fetchUrl = url;
    if (url.includes("res.cloudinary.com") && url.includes("/raw/upload/")) {
      // Insert fl_attachment after /upload/ to force proper download headers
      fetchUrl = url.replace("/raw/upload/", "/raw/upload/fl_attachment/");
    } else if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
      fetchUrl = url.replace("/image/upload/", "/image/upload/fl_attachment/");
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      window.open(url, "_blank");
      return;
    }

    const blob = await response.blob();
    const contentType = blob.type || response.headers.get("content-type") || "";
    const baseMime = contentType.split(";")[0].trim().toLowerCase();

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

    // If filename has no extension, add one based on content-type or URL hints
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

      let ext = mimeToExt[baseMime] || "";

      // If still no extension (octet-stream), try to detect from magic bytes
      if (!ext || baseMime === "application/octet-stream") {
        const detectedExt = await detectFileTypeFromBlob(blob);
        if (detectedExt) ext = detectedExt;
      }

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

/**
 * Detect file type from the first few bytes (magic bytes) of a blob.
 */
async function detectFileTypeFromBlob(blob: Blob): Promise<string> {
  try {
    const slice = blob.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PDF: starts with %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return ".pdf";
    }
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return ".png";
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return ".jpg";
    }
    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return ".gif";
    }
    // XLSX/DOCX (ZIP): 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return ".zip"; // Could be xlsx/docx but zip is safest
    }
  } catch {
    // ignore
  }
  return "";
}
