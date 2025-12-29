import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Play, Eye } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface BackgroundJob {
  id: string;
  from_date: string;
  to_date: string;
  status: string;
  total_orders: number;
  processed_orders: number;
  successful_orders: number;
  failed_orders: number;
  current_order_number: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const BackgroundSyncStatusCard = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeJob, setActiveJob] = useState<BackgroundJob | null>(null);

  useEffect(() => {
    // Fetch active/recent job
    const fetchActiveJob = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('background_sync_jobs')
        .select('*')
        .eq('user_id', user.user.id)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveJob(data as BackgroundJob);
      }
    };

    fetchActiveJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('background_sync_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_sync_jobs',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const job = payload.new as BackgroundJob;
            if (job.status === 'pending' || job.status === 'running') {
              setActiveJob(job);
            } else if (activeJob?.id === job.id) {
              // Job completed - show for a few seconds then hide
              setActiveJob(job);
              setTimeout(() => {
                setActiveJob(null);
              }, 10000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id]);

  if (!activeJob) return null;

  const progress = activeJob.total_orders > 0 
    ? Math.round((activeJob.processed_orders / activeJob.total_orders) * 100) 
    : 0;

  const isRunning = activeJob.status === 'running';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed';

  return (
    <Card 
      className="border-primary/50 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
      onClick={() => navigate(`/odoo-sync-batch?from=${activeJob.from_date}&to=${activeJob.to_date}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
            <span className="font-medium">
              {language === 'ar' ? 'مزامنة Odoo في الخلفية' : 'Background Odoo Sync'}
            </span>
          </div>
          <Badge variant={isRunning ? 'default' : isCompleted ? 'secondary' : 'destructive'}>
            {isRunning 
              ? (language === 'ar' ? 'جاري التشغيل' : 'Running')
              : isCompleted 
                ? (language === 'ar' ? 'مكتمل' : 'Completed')
                : (language === 'ar' ? 'فشل' : 'Failed')
            }
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground mb-2">
          {activeJob.from_date} → {activeJob.to_date}
        </div>

        {isRunning && (
          <>
            <Progress value={progress} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {language === 'ar' 
                  ? `${activeJob.processed_orders} من ${activeJob.total_orders} طلب`
                  : `${activeJob.processed_orders} of ${activeJob.total_orders} orders`
                }
              </span>
              <span>{progress}%</span>
            </div>
            {activeJob.current_order_number && (
              <div className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'الطلب الحالي: ' : 'Current: '}
                {activeJob.current_order_number}
              </div>
            )}
          </>
        )}

        {isCompleted && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">
              ✓ {activeJob.successful_orders}
            </span>
            {activeJob.failed_orders > 0 && (
              <span className="text-destructive">
                ✗ {activeJob.failed_orders}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" className="w-full gap-1">
            <Eye className="h-3 w-3" />
            {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
