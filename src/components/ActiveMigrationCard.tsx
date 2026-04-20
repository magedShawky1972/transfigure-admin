import { ArrowRightLeft, Database, ExternalLink, Loader2, Square, Pause, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { migrationJobApi, useActiveMigrationJob } from "@/hooks/useMigrationJob";
import { toast } from "sonner";

interface Props {
  onNavigated?: () => void;
}

export function ActiveMigrationCard({ onNavigated }: Props) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const navigate = useNavigate();
  const { job } = useActiveMigrationJob();

  if (!job) return null;

  const percent = Math.min(100, Math.max(0, Number(job.progress_percent ?? 0)));
  const currentIdx = job.current_table_index ?? 0;
  const totalTables = job.total_tables ?? 0;
  const isPaused = Boolean(job.pause_requested || job.is_paused);

  const handleView = () => {
    navigate("/system-restore");
    onNavigated?.();
  };

  const handleCancel = async () => {
    try {
      await migrationJobApi.cancel(job.id);
      toast.success(isRTL ? "تم طلب الإيقاف" : "Termination requested");
    } catch {
      toast.error(isRTL ? "فشل طلب الإيقاف" : "Failed to request termination");
    }
  };

  const handleForceStop = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("migration_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: "Force-stopped by user",
        } as any)
        .eq("id", job.id);
      toast.success(isRTL ? "تم الإنهاء فوراً" : "Migration force-stopped");
    } catch {
      toast.error(isRTL ? "فشل الإنهاء الفوري" : "Force-stop failed");
    }
  };
    try {
      await migrationJobApi.pause(job.id);
      toast.info(isRTL ? "تم إيقاف الترحيل مؤقتاً" : "Migration paused");
    } catch {
      toast.error(isRTL ? "فشل الإيقاف المؤقت" : "Failed to pause");
    }
  };

  const handleResume = async () => {
    try {
      await migrationJobApi.resume(job.id);
      toast.success(isRTL ? "تم استئناف الترحيل" : "Migration resumed");
    } catch {
      toast.error(isRTL ? "فشل الاستئناف" : "Failed to resume");
    }
  };

  return (
    <div className="p-3 rounded-lg border bg-primary/5 border-primary/30 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowRightLeft className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {isRTL ? "ترحيل قيد التشغيل" : "Migration In Progress"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {job.user_email}
            </p>
          </div>
        </div>
        {job.cancel_requested ? (
          <span className="text-[10px] text-destructive font-medium flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {isRTL ? "جاري الإيقاف" : "Stopping…"}
          </span>
        ) : isPaused ? (
          <span className="text-[10px] uppercase font-medium text-warning flex items-center gap-1">
            <Pause className="h-3 w-3" />
            {isRTL ? "متوقف مؤقتاً" : "Paused"}
          </span>
        ) : (
          <span className="text-[10px] uppercase font-medium text-primary flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {job.status}
          </span>
        )}
      </div>

      <Progress value={percent} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate flex items-center gap-1">
          <Database className="h-3 w-3" />
          {job.current_table || (isRTL ? "تجهيز…" : "Preparing…")}
        </span>
        <span className="font-medium">{percent.toFixed(0)}%</span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {isRTL ? "الجدول" : "Table"} {currentIdx}/{totalTables}
        </span>
        <span>
          {Number(job.processed_rows ?? 0).toLocaleString()} /{" "}
          {Number(job.total_rows ?? 0).toLocaleString()} {isRTL ? "صف" : "rows"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={handleView}>
          <ExternalLink className="h-3 w-3 me-1" />
          {isRTL ? "عرض التفاصيل" : "View Details"}
        </Button>
        {!job.cancel_requested && (
          isPaused ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleResume}>
              <Play className="h-3 w-3 me-1" />
              {isRTL ? "استئناف" : "Resume"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePause}>
              <Pause className="h-3 w-3 me-1" />
              {isRTL ? "إيقاف مؤقت" : "Pause"}
            </Button>
          )
        )}
        {!job.cancel_requested && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs col-span-2"
            onClick={handleCancel}
          >
            <Square className="h-3 w-3 me-1" />
            {isRTL ? "إنهاء الترحيل" : "Terminate Migration"}
          </Button>
        )}
      </div>
    </div>
  );
}
