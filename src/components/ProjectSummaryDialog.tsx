import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Pencil, FilePlus, CalendarClock, Activity } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { format, formatDistanceToNow, isAfter, subDays, addDays } from "date-fns";

interface SummaryTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  created_at: string;
  assigned_to: string;
  assignees?: string[];
  updated_at?: string;
}
interface SummaryUser {
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
}
interface SummaryPhase {
  phase_key: string;
  phase_label: string;
  phase_color?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  tasks: SummaryTask[];
  users: SummaryUser[];
  phases: SummaryPhase[];
  language: 'ar' | 'en';
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'hsl(var(--muted-foreground))',
  medium: 'hsl(217 91% 60%)',
  high: 'hsl(38 92% 50%)',
  urgent: 'hsl(0 84% 60%)',
};

export function ProjectSummaryDialog({ open, onOpenChange, projectName, tasks, users, phases, language }: Props) {
  const t = useMemo(() => language === 'ar' ? {
    summary: 'ملخص المشروع', completed: 'مكتمل', updated: 'محدث', created: 'تم إنشاؤه', dueSoon: 'مستحق قريبًا',
    last7: 'في آخر 7 أيام', next7: 'في الـ 7 أيام القادمة',
    statusOverview: 'نظرة عامة على الحالة', totalItems: 'إجمالي العناصر',
    recentActivity: 'النشاط الأخير', priorityBreakdown: 'تفصيل الأولوية',
    teamWorkload: 'عبء العمل', assignee: 'الموظف', distribution: 'التوزيع',
    unassigned: 'غير معين', noActivity: 'لا يوجد نشاط', priority: 'الأولوية', count: 'العدد',
  } : {
    summary: 'Project Summary', completed: 'completed', updated: 'updated', created: 'created', dueSoon: 'due soon',
    last7: 'in the last 7 days', next7: 'in the next 7 days',
    statusOverview: 'Status overview', totalItems: 'Total work items',
    recentActivity: 'Recent activity', priorityBreakdown: 'Priority breakdown',
    teamWorkload: 'Team workload', assignee: 'Assignee', distribution: 'Work distribution',
    unassigned: 'Unassigned', noActivity: 'No recent activity', priority: 'Priority', count: 'Count',
  }, [language]);

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const sevenDaysAhead = addDays(now, 7);

  const stats = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'done' && t.updated_at && isAfter(new Date(t.updated_at), sevenDaysAgo)).length;
    const updated = tasks.filter(t => t.updated_at && isAfter(new Date(t.updated_at), sevenDaysAgo)).length;
    const created = tasks.filter(t => isAfter(new Date(t.created_at), sevenDaysAgo)).length;
    const dueSoon = tasks.filter(t => t.deadline && t.status !== 'done' && isAfter(new Date(t.deadline), now) && !isAfter(new Date(t.deadline), sevenDaysAhead)).length;
    return { completed, updated, created, dueSoon };
  }, [tasks]);

  const statusData = useMemo(() => phases.map(p => ({
    name: p.phase_label,
    value: tasks.filter(x => x.status === p.phase_key).length,
    color: p.phase_color || 'hsl(var(--primary))',
  })).filter(x => x.value > 0), [tasks, phases]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: k, value: v, fill: PRIORITY_COLORS[k] }));
  }, [tasks]);

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach(task => {
      const ids = task.assignees && task.assignees.length > 0 ? task.assignees : (task.assigned_to ? [task.assigned_to] : ['__unassigned__']);
      ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const u = users.find(x => x.user_id === id);
        return { id, name: u?.user_name || t.unassigned, avatar: u?.avatar_url, count, pct: Math.round((count / total) * 100) };
      })
      .sort((a, b) => b.count - a.count);
  }, [tasks, users, t.unassigned]);

  const recentActivity = useMemo(() => {
    return [...tasks]
      .filter(x => x.updated_at)
      .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
      .slice(0, 8);
  }, [tasks]);

  const totalItems = tasks.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t.summary} — {projectName}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile icon={<CheckCircle2 className="h-5 w-5" />} value={stats.completed} label={t.completed} sub={t.last7} />
              <StatTile icon={<Pencil className="h-5 w-5" />} value={stats.updated} label={t.updated} sub={t.last7} />
              <StatTile icon={<FilePlus className="h-5 w-5" />} value={stats.created} label={t.created} sub={t.last7} />
              <StatTile icon={<CalendarClock className="h-5 w-5" />} value={stats.dueSoon} label={t.dueSoon} sub={t.next7} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status overview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.statusOverview}</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-12 text-center">—</div>
                  ) : (
                    <div className="h-64 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                            {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="middle" align="right" layout="vertical" />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ left: '-25%' }}>
                        <div className="text-2xl font-bold">{totalItems}</div>
                        <div className="text-xs text-muted-foreground">{t.totalItems}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.recentActivity}</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-12 text-center">{t.noActivity}</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {recentActivity.map(task => {
                        const u = users.find(x => x.user_id === task.assigned_to);
                        const phase = phases.find(p => p.phase_key === task.status);
                        return (
                          <div key={task.id} className="flex items-center gap-2 text-xs border-b pb-2 last:border-b-0">
                            <Avatar className="h-7 w-7">
                              {u?.avatar_url && <AvatarImage src={u.avatar_url} />}
                              <AvatarFallback className="text-[10px]">{u?.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium truncate">{u?.user_name || t.unassigned}</span>
                                <span className="text-muted-foreground">{t.updated}</span>
                                <span className="font-medium truncate">{task.title}</span>
                              </div>
                              <div className="text-muted-foreground">
                                {task.updated_at ? formatDistanceToNow(new Date(task.updated_at), { addSuffix: true }) : ''}
                              </div>
                            </div>
                            {phase && (
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: phase.phase_color || undefined, color: phase.phase_color || undefined }}>
                                {phase.phase_label}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Priority breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.priorityBreakdown}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priorityData}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {priorityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Team workload */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.teamWorkload}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[1fr_2fr] gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <div>{t.assignee}</div>
                    <div>{t.distribution}</div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {workload.map(w => (
                      <div key={w.id} className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6">
                            {w.avatar && <AvatarImage src={w.avatar} />}
                            <AvatarFallback className="text-[10px]">{w.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs">{w.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                            <div className="h-full bg-primary/70 flex items-center justify-end px-2 text-[10px] font-medium text-primary-foreground"
                              style={{ width: `${Math.max(w.pct, 8)}%` }}>
                              {w.pct}%
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground w-6 text-right">{w.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({ icon, value, label, sub }: { icon: React.ReactNode; value: number; label: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">{value} {label}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}
