import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Eraser,
  Undo2,
  Trash2,
  Image as ImageIcon,
  Plus,
  Download,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type WireframeStroke = {
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: number[][]; // [[x,y], ...] in normalized 0-1 coordinates
};

export type Wireframe = {
  id: string;
  name?: string;
  image_url?: string | null;
  width: number; // canvas reference width
  height: number; // canvas reference height
  strokes: WireframeStroke[];
};

interface Props {
  value: Wireframe[];
  onChange: (next: Wireframe[]) => void;
  language?: "ar" | "en";
}

const DEFAULT_W = 1200;
const DEFAULT_H = 700;
const PALETTE = [
  "#000000",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

export default function WireframeBoard({ value, onChange, language = "en" }: Props) {
  const isAr = language === "ar";
  const [activeId, setActiveId] = useState<string | null>(value[0]?.id ?? null);
  const active = value.find((w) => w.id === activeId) || null;

  const addBoard = (image_url?: string) => {
    const id = crypto.randomUUID();
    const wf: Wireframe = {
      id,
      name: isAr ? `لوحة ${value.length + 1}` : `Board ${value.length + 1}`,
      image_url: image_url || null,
      width: DEFAULT_W,
      height: DEFAULT_H,
      strokes: [],
    };
    onChange([...(value || []), wf]);
    setActiveId(id);
  };

  const updateBoard = (id: string, patch: Partial<Wireframe>) => {
    onChange(value.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const deleteBoard = (id: string) => {
    const next = value.filter((w) => w.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const [uploading, setUploading] = useState(false);
  const handleImageUpload = async (file: File, asNewBoard: boolean) => {
    setUploading(true);
    try {
      const base64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Wireframes", resourceType: "image" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (asNewBoard || !active) {
        addBoard(data.url);
      } else {
        updateBoard(active.id, { image_url: data.url });
      }
      toast({ title: isAr ? "تم رفع الصورة" : "Image uploaded" });
    } catch (e) {
      console.error(e);
      toast({
        title: isAr ? "فشل رفع الصورة" : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Boards strip */}
      <div className="flex items-center gap-2 flex-wrap">
        {value.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setActiveId(w.id)}
            className={cn(
              "group relative h-16 w-24 rounded-md border overflow-hidden text-xs flex items-center justify-center bg-muted",
              activeId === w.id ? "ring-2 ring-primary" : "hover:bg-accent"
            )}
            title={w.name}
          >
            {w.image_url ? (
              <img src={w.image_url} alt={w.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-muted-foreground">{w.name}</span>
            )}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteBoard(w.id);
              }}
              className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addBoard()}>
          <Plus className="h-4 w-4 mr-1" />
          {isAr ? "لوحة جديدة" : "New Board"}
        </Button>
        <label className="inline-flex">
          <Button asChild type="button" variant="outline" size="sm" disabled={uploading}>
            <span>
              <ImageIcon className="h-4 w-4 mr-1" />
              {isAr ? "إضافة صورة" : "Add Image"}
            </span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f, true);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {active ? (
        <BoardEditor
          key={active.id}
          board={active}
          onChange={(patch) => updateBoard(active.id, patch)}
          onUploadBgImage={(file) => handleImageUpload(file, false)}
          uploading={uploading}
          isAr={isAr}
        />
      ) : (
        <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">
          {isAr
            ? "أضف لوحة جديدة أو ارفع صورة للبدء بالرسم"
            : "Add a board or upload an image to start sketching"}
        </div>
      )}
    </div>
  );
}

function BoardEditor({
  board,
  onChange,
  onUploadBgImage,
  uploading,
  isAr,
}: {
  board: Wireframe;
  onChange: (patch: Partial<Wireframe>) => void;
  onUploadBgImage: (file: File) => void;
  uploading: boolean;
  isAr: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ef4444");
  const [size, setSize] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<WireframeStroke[]>(board.strokes || []);
  const currentStroke = useRef<WireframeStroke | null>(null);

  // Sync strokes back to parent when changed
  useEffect(() => {
    onChange({ strokes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // Load background image
  useEffect(() => {
    if (!board.image_url) {
      imgRef.current = null;
      drawBackground();
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      // Adjust canvas aspect to image
      const w = Math.min(1200, img.naturalWidth);
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
      onChange({ width: w, height: h });
      drawBackground();
    };
    img.src = board.image_url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.image_url]);

  const drawBackground = useCallback(() => {
    const c = bgCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, c.width, c.height);
    } else {
      // light grid
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x < c.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, c.height);
        ctx.stroke();
      }
      for (let y = 0; y < c.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(c.width, y);
        ctx.stroke();
      }
    }
  }, []);

  // Redraw strokes
  const redrawStrokes = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const all = currentStroke.current ? [...strokes, currentStroke.current] : strokes;
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.size * (c.width / DEFAULT_W);
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0][0] * c.width, s.points[0][1] * c.height);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i][0] * c.width, s.points[i][1] * c.height);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, [strokes]);

  // Resize canvas to fit container while keeping ratio
  useEffect(() => {
    const resize = () => {
      const wrap = wrapperRef.current;
      const bg = bgCanvasRef.current;
      const fg = canvasRef.current;
      if (!wrap || !bg || !fg) return;
      const containerW = wrap.clientWidth;
      const ratio = board.height / board.width;
      const w = containerW;
      const h = Math.round(containerW * ratio);
      [bg, fg].forEach((c) => {
        c.width = w;
        c.height = h;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      });
      drawBackground();
      redrawStrokes();
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [board.width, board.height, drawBackground, redrawStrokes]);

  useEffect(() => {
    redrawStrokes();
  }, [redrawStrokes]);

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const [x, y] = getPos(e);
    currentStroke.current = { tool, color, size, points: [[x, y]] };
    setDrawing(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing || !currentStroke.current) return;
    const [x, y] = getPos(e);
    currentStroke.current.points.push([x, y]);
    redrawStrokes();
  };
  const onPointerUp = () => {
    if (currentStroke.current && currentStroke.current.points.length > 0) {
      setStrokes((prev) => [...prev, currentStroke.current!]);
    }
    currentStroke.current = null;
    setDrawing(false);
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const downloadPng = () => {
    const bg = bgCanvasRef.current!;
    const fg = canvasRef.current!;
    const out = document.createElement("canvas");
    out.width = bg.width;
    out.height = bg.height;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(fg, 0, 0);
    const link = document.createElement("a");
    link.download = `${board.name || "wireframe"}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/30">
        <Input
          value={board.name || ""}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 w-40"
          placeholder={isAr ? "اسم اللوحة" : "Board name"}
        />
        <div className="h-6 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          variant={tool === "pen" ? "default" : "outline"}
          onClick={() => setTool("pen")}
        >
          <Pencil className="h-4 w-4 mr-1" />
          {isAr ? "قلم" : "Pen"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === "eraser" ? "default" : "outline"}
          onClick={() => setTool("eraser")}
        >
          <Eraser className="h-4 w-4 mr-1" />
          {isAr ? "ممحاة" : "Eraser"}
        </Button>
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                setTool("pen");
              }}
              className={cn(
                "h-6 w-6 rounded-full border",
                color === c && tool === "pen" ? "ring-2 ring-offset-1 ring-primary" : ""
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setTool("pen");
            }}
            className="h-6 w-6 rounded cursor-pointer border"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{isAr ? "السمك" : "Size"}</span>
          <input
            type="range"
            min={1}
            max={30}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className="text-xs w-6 text-center">{size}</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <Button type="button" size="sm" variant="outline" onClick={undo} disabled={!strokes.length}>
          <Undo2 className="h-4 w-4 mr-1" />
          {isAr ? "تراجع" : "Undo"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={!strokes.length}>
          <Trash2 className="h-4 w-4 mr-1" />
          {isAr ? "مسح" : "Clear"}
        </Button>
        <label>
          <Button asChild type="button" size="sm" variant="outline" disabled={uploading}>
            <span>
              <ImageIcon className="h-4 w-4 mr-1" />
              {isAr ? "خلفية" : "Background"}
            </span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadBgImage(f);
              e.target.value = "";
            }}
          />
        </label>
        {board.image_url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange({ image_url: null })}
          >
            <X className="h-4 w-4 mr-1" />
            {isAr ? "إزالة الخلفية" : "Remove BG"}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={downloadPng}>
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className="relative w-full border rounded-md overflow-hidden bg-white"
        style={{ touchAction: "none" }}
      >
        <canvas ref={bgCanvasRef} className="block" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
