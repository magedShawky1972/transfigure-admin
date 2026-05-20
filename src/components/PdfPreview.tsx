import { useEffect, useState } from "react";
import { Loader2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/fileDownload";

interface PdfPreviewProps {
  url: string;
  name: string;
  language: string;
}

/**
 * Renders a PDF reliably even when the source (e.g. Cloudinary /raw/upload/)
 * serves the file with a generic Content-Type. We fetch the bytes and create
 * a blob URL with the explicit application/pdf type, which all browsers can
 * render inline via <iframe>.
 */
export const PdfPreview = ({ url, name, language }: PdfPreviewProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setBlobUrl(null);
    setError(false);

    (async () => {
      try {
        // For Cloudinary raw uploads, also try the image pipeline as a fallback
        const candidates = [url];
        if (url.includes("/raw/upload/")) {
          candidates.push(url.replace("/raw/upload/", "/image/upload/"));
        }

        let blob: Blob | null = null;
        for (const u of candidates) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const raw = await res.blob();
            // Force the correct mime so the iframe renders inline
            blob = new Blob([raw], { type: "application/pdf" });
            break;
          } catch {
            // try next
          }
        }

        if (!blob) {
          if (!cancelled) setError(true);
          return;
        }

        createdUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(createdUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  return (
    <div className="w-full">
      <div className="relative w-full h-[80vh] rounded border bg-muted/30 overflow-hidden">
        {blobUrl ? (
          <iframe src={blobUrl} title={name} className="w-full h-full" />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {language === "ar"
                ? "تعذرت معاينة الملف. يمكنك تنزيله بدلاً من ذلك."
                : "Couldn't preview this file. You can download it instead."}
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => downloadFile(url, name)}>
          <Download className="h-4 w-4 mr-1" />
          {language === "ar" ? "تنزيل" : "Download"}
        </Button>
      </div>
    </div>
  );
};
