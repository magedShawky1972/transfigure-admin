import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Play, Pause, ChevronLeft, ChevronRight, Maximize2, RefreshCw, Presentation, Star, Trophy } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Project { id: string; name: string; status: string | null; }
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
  assigned_to: string | null;
}

const PENDING_STATUSES = ["todo", "in_progress", "review"];

const priorityTone = (p: string) => {
  switch ((p || "").toLowerCase()) {
    case "urgent": return "bg-destructive text-destructive-foreground";
    case "high": return "bg-primary text-primary-foreground";
    case "medium": return "bg-secondary text-secondary-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function ProjectPresentation() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [seconds, setSeconds] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("projects").select("id,name,status").order("name"),
        supabase.from("profiles").select("user_id,user_name"),
      ]);
      setProjects((p as any) || []);
      setNames(Object.fromEntries(((prof as any) || []).map((x: any) => [x.user_id, x.user_name])));
      if ((p as any)?.length) setProjectId((p as any)[0].id);
      setLoading(false);
    })();
  }, []);

  const loadTasks = async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id,title,description,status,priority,start_date,deadline,assigned_to")
      .eq("project_id", pid)
      .in("status", PENDING_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false });
    setTasks((data as any) || []);
    setIndex(0);
    setLoading(false);
  };

  useEffect(() => { loadTasks(projectId); }, [projectId]);

  // Group by assignee → one slide per person
  const slides = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      const key = t.assigned_to || "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    const out: { owner: string; tasks: Task[] }[] = [];
    map.forEach((list, owner) => {
      for (let i = 0; i < list.length; i += 5) out.push({ owner, tasks: list.slice(i, i + 5) });
    });
    return out;
  }, [tasks]);

  useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), seconds * 1000);
    return () => clearInterval(t);
  }, [playing, seconds, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex(i => (i + 1) % Math.max(slides.length, 1));
      if (e.key === "ArrowLeft") setIndex(i => (i - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));
      if (e.key === " ") { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  // auto refresh data every 5 minutes for the LCD screen
  useEffect(() => {
    const t = setInterval(() => loadTasks(projectId), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [projectId]);

  const goFullscreen = () => containerRef.current?.requestFullscreen?.();

  const project = projects.find(p => p.id === projectId);
  const current = slides[index];

  return (
    <div ref={containerRef} className="min-h-screen bg-background p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Presentation className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold mr-2">Project Presentation</h1>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(seconds)} onValueChange={v => setSeconds(Number(v))}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[5, 8, 10, 15, 20, 30].map(s => <SelectItem key={s} value={String(s)}>{s}s / slide</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setIndex(i => (i - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setPlaying(p => !p)}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
        <Button variant="outline" size="icon" onClick={() => setIndex(i => (i + 1) % Math.max(slides.length, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => loadTasks(projectId)}><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={goFullscreen}><Maximize2 className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <div className="h-[70vh] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : slides.length === 0 ? (
        <div className="h-[70vh] flex items-center justify-center text-2xl text-muted-foreground">
          No pending tasks for this project 🎉
        </div>
      ) : (
        <Card key={index} className="animate-fade-in border-2">
          <CardContent className="p-8 min-h-[72vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b pb-4 mb-6">
              <div>
                <p className="text-sm uppercase tracking-widest text-muted-foreground">{project?.name}</p>
                <h2 className="text-5xl font-bold mt-1">
                  {current.owner === "unassigned" ? "Unassigned" : (names[current.owner] || "Unknown")}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Slide {index + 1} / {slides.length}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(), "EEE dd MMM yyyy HH:mm")}</p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {current.tasks.map(t => (
                <div key={t.id} className="rounded-lg border p-4 flex items-start justify-between gap-6 bg-card">
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold truncate">{t.title}</p>
                    {t.description && <p className="text-base text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={priorityTone(t.priority)}>{t.priority}</Badge>
                    <Badge variant="outline" className="text-base capitalize">{t.status.replace("_", " ")}</Badge>
                    {t.deadline && (
                      <Badge variant="secondary" className="text-base">
                        {format(new Date(t.deadline), "dd MMM")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 h-2 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((index + 1) / slides.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
