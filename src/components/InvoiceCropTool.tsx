import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crop, Trash2, Plus, Check, X, Move } from "lucide-react";
import { cn } from "@/lib/utils";

interface CropRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InvoiceCropToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string;
  onCropsConfirmed: (croppedImages: string[]) => void;
}

const InvoiceCropTool = ({
  open,
  onOpenChange,
  imageDataUrl,
  onCropsConfirmed,
}: InvoiceCropToolProps) => {
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [crops, setCrops] = useState<CropRegion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentCrop, setCurrentCrop] = useState<CropRegion | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageScale, setImageScale] = useState(1);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCrops([]);
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentCrop(null);
      setImageLoaded(false);
    }
  }, [open]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (imageRef.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const imageWidth = imageRef.current.naturalWidth;
      setImageScale(containerWidth / imageWidth);
    }
  };

  const getMousePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const pos = getMousePosition(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentCrop({
      id: `crop-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
  }, [getMousePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const pos = getMousePosition(e);
    
    const x = Math.min(drawStart.x, pos.x);
    const y = Math.min(drawStart.y, pos.y);
    const width = Math.abs(pos.x - drawStart.x);
    const height = Math.abs(pos.y - drawStart.y);
    
    setCurrentCrop(prev => prev ? {
      ...prev,
      x,
      y,
      width,
      height,
    } : null);
  }, [isDrawing, drawStart, getMousePosition]);

  const handleMouseUp = useCallback(() => {
    if (currentCrop && currentCrop.width > 20 && currentCrop.height > 20) {
      setCrops(prev => [...prev, currentCrop]);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentCrop(null);
  }, [currentCrop]);

  const removeCrop = (id: string) => {
    setCrops(prev => prev.filter(c => c.id !== id));
  };

  const clearAllCrops = () => {
    setCrops([]);
  };

  const generateCroppedImages = useCallback(async (): Promise<string[]> => {
    if (!imageRef.current || crops.length === 0) return [];

    const img = imageRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    
    const scaleX = naturalWidth / displayWidth;
    const scaleY = naturalHeight / displayHeight;

    const croppedImages: string[] = [];

    for (const crop of crops) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // Convert display coordinates to natural image coordinates
      const srcX = crop.x * scaleX;
      const srcY = crop.y * scaleY;
      const srcWidth = crop.width * scaleX;
      const srcHeight = crop.height * scaleY;

      canvas.width = srcWidth;
      canvas.height = srcHeight;

      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        0,
        0,
        srcWidth,
        srcHeight
      );

      croppedImages.push(canvas.toDataURL("image/png"));
    }

    return croppedImages;
  }, [crops]);

  const handleConfirm = async () => {
    const croppedImages = await generateCroppedImages();
    if (croppedImages.length > 0) {
      onCropsConfirmed(croppedImages);
    }
    onOpenChange(false);
  };

  const handleSkipCropping = () => {
    // Send the full image if no crops made
    onCropsConfirmed([imageDataUrl]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            {language === "ar" ? "تحديد أجزاء الفاتورة" : "Select Invoice Regions"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? "ارسم مستطيلات حول الأجزاء التي تريد أن يقرأها الذكاء الاصطناعي. يمكنك تحديد عدة أجزاء."
                : "Draw rectangles around the parts you want AI to read. You can select multiple regions."}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="gap-1">
              <Move className="h-3 w-3" />
              {language === "ar" ? `${crops.length} أجزاء محددة` : `${crops.length} regions selected`}
            </Badge>
            {crops.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllCrops}>
                <Trash2 className="h-4 w-4 mr-1" />
                {language === "ar" ? "مسح الكل" : "Clear All"}
              </Button>
            )}
          </div>

          <div
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden cursor-crosshair select-none bg-muted"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={imageDataUrl}
              alt="Invoice"
              className="w-full h-auto"
              onLoad={handleImageLoad}
              draggable={false}
            />

            {/* Existing crops */}
            {crops.map((crop, index) => (
              <div
                key={crop.id}
                className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
                style={{
                  left: crop.x,
                  top: crop.y,
                  width: crop.width,
                  height: crop.height,
                }}
              >
                <div className="absolute -top-6 left-0 flex items-center gap-1">
                  <Badge className="text-xs pointer-events-auto">
                    {index + 1}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-5 w-5 pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCrop(crop.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Current drawing crop */}
            {currentCrop && currentCrop.width > 0 && currentCrop.height > 0 && (
              <div
                className="absolute border-2 border-dashed border-primary bg-primary/10"
                style={{
                  left: currentCrop.x,
                  top: currentCrop.y,
                  width: currentCrop.width,
                  height: currentCrop.height,
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleSkipCropping}>
            {language === "ar" ? "تخطي (استخدام الصورة كاملة)" : "Skip (Use Full Image)"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleConfirm} disabled={crops.length === 0}>
              <Check className="h-4 w-4 mr-2" />
              {language === "ar"
                ? `تأكيد (${crops.length} أجزاء)`
                : `Confirm (${crops.length} regions)`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceCropTool;
