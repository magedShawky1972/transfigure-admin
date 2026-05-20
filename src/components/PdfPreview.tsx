import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, FileText, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const openUrl = useMemo(() => src || url, [src, url]);

  useEffect(() => {
    let cancelled = false;

    const renderPdf = async () => {
      setLoading(true);
      setFailed(false);
      setPageImages([]);
      setCurrentPage(0);

      const [first] = buildCandidateUrls(url);
      setSrc(first);

      try {
        const response = await fetch(first);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const renderedPages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) throw new Error("Could not create PDF canvas context");

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;
          renderedPages.push(canvas.toDataURL("image/png"));
        }

        if (!cancelled) {
          setPageImages(renderedPages);
        }
      } catch (error) {
        console.error("PDF preview failed:", error);
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
    };
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
            <Button variant="outline" size="sm" onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}>
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
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pageImages.length > 0 ? (
          <div className="h-full overflow-auto bg-background/80">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-3 py-2 backdrop-blur">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">
                  {currentPage + 1} / {pageImages.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pageImages.length - 1))}
                  disabled={currentPage === pageImages.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex min-h-full items-start justify-center p-4">
              <img
                src={pageImages[currentPage]}
                alt={`${name} page ${currentPage + 1}`}
                className="h-auto max-w-full rounded border bg-background shadow-sm"
                loading="eager"
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}>
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
