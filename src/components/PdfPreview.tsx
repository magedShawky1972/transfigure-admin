import { useEffect, useState } from "react";
import { Loader2, Download, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/fileDownload";

interface PdfPreviewProps {
  url: string;
  name: string;
  language: string;
}

/**
 * Build a list of URLs to try for inline PDF rendering.
 * Cloudinary's `/raw/upload/` path serves PDFs with a generic content-type
 * which Chrome refuses to render in an iframe. Switching to `/image/upload/`
 * (Cloudinary's image pipeline) serves the same file as `application/pdf`,
 * which browsers render natively.
 */
const buildCandidateUrls = (url: string): string[] => {
  const out: string[] = [];
  if (url.includes("res.cloudinary.com") && url.includes("/raw/upload/")) {
    out.push(url.replace("/raw/upload/", "/image/upload/"));
  }
  out.push(url);
  return Array.from(new Set(out));
};

export const PdfPreview = ({ url, name, language }: PdfPreviewProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    // Pick the first candidate immediately; the browser's native PDF viewer
    // will render it. We can't reliably detect iframe load failures across
    // origins, so we trust the first viable URL.
    const [first] = buildCandidateUrls(url);
    setSrc(first);
  }, [url]);

  if (failed) {
    return (
      <div className="w-full">
        <div className="w-full h-[60vh] rounded border bg-muted/30 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {language === "ar"
              ? "تعذر عرض الملف داخل المتصفح. افتحه في تبويب جديد أو نزّله."
              : "Your browser blocked the inline preview. Open it in a new tab or download it."}
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => window.open(src || url, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-4 w-4 mr-1" />
              {language === "ar" ? "فتح في تبويب جديد" : "Open in new tab"}
            </Button>
            <Button variant="default" size="sm" onClick={() => downloadFile(url, name)}>
              <Download className="h-4 w-4 mr-1" />
              {language === "ar" ? "تنزيل" : "Download"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full h-[80vh] rounded border bg-muted/30 overflow-hidden">
        {src ? (
          <object data={src} type="application/pdf" className="w-full h-full">
            {/* Fallback when <object> can't render: try Google's viewer */}
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(src)}&embedded=true`}
              title={name}
              className="w-full h-full"
              onError={() => setFailed(true)}
            />
          </object>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => window.open(src || url, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="h-4 w-4 mr-1" />
          {language === "ar" ? "فتح في تبويب جديد" : "Open in new tab"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadFile(url, name)}>
          <Download className="h-4 w-4 mr-1" />
          {language === "ar" ? "تنزيل" : "Download"}
        </Button>
      </div>
    </div>
  );
};
