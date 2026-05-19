import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, LogOut, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Project { id: string; name: string; description: string | null; status: string; start_date: string | null; end_date: string | null; }
interface Task { id: string; title: string; description: string | null; status: string; priority: string; start_date: string | null; deadline: string | null; created_by: string; }
interface Msg { id: string; task_id: string; user_id: string; message: string; created_at: string; }

const STATUS = ["todo", "in_progress", "review", "done"];
const PRIORITY = ["low", "medium", "high", "urgent"];

export default function GuestProject() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [role, setRole] = useState<"editor" | "viewer" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", start_date: "", deadline: "" });
  const [chatTask, setChatTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const canEdit = role === "editor";

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth", { replace: true }); return; }
    setUserId(user.id);
    const { data: guestRow } = await supabase
      .from("project_guests").select("role")
      .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
    setRole(((guestRow as any)?.role as any) || null);
    const [{ data: proj }, { data: t }] = await Promise.all([
      supabase.from("projects").select("id,name,description,status,start_date,end_date").eq("id", projectId).maybeSingle(),
      supabase.from("tasks").select("id,title,description,status,priority,start_date,deadline,created_by").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setProject(proj as any);
    setTasks((t as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);

  const logout = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", status: "todo", priority: "medium", start_date: "", deadline: "" });
    setTaskDialog(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title, description: t.description || "", status: t.status, priority: t.priority,
      start_date: t.start_date || "", deadline: t.deadline ? t.deadline.slice(0, 10) : "",
    });
    setTaskDialog(true);
  };
  const saveTask = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (!userId || !project) return;
    const payload: any = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    };
    if (editing) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editing.id).select();
      if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    } else {
      // need department_id and assigned_to (NOT NULL). Use project's department + self.
      const { data: p } = await supabase.from("projects").select("department_id").eq("id", project.id).maybeSingle();
      const { error } = await supabase.from("tasks").insert({
        ...payload,
        project_id: project.id,
        department_id: (p as any)?.department_id,
        assigned_to: userId,
        created_by: userId,
      });
      if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    }
    setTaskDialog(false);
    load();
  };
  const delTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    load();
  };

  const openChat = async (t: Task) => {
    setChatTask(t);
    const { data } = await supabase.from("task_messages").select("*").eq("task_id", t.id).order("created_at");
    setMessages((data as any) || []);
  };
  const sendMsg = async () => {
    if (!newMsg.trim() || !chatTask || !userId) return;
    const { error } = await supabase.from("task_messages").insert({
      task_id: chatTask.id, user_id: userId, message: newMsg.trim(),
    });
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }
    setNewMsg("");
    const { data } = await supabase.from("task_messages").select("*").eq("task_id", chatTask.id).order("created_at");
    setMessages((data as any) || []);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!project) return <div className="min-h-screen flex items-center justify-center"><p>Project not found or access revoked.</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">Guest access — {role === "editor" ? "Editor" : "View only"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {project.description && (
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{project.description}</p></CardContent></Card>
        )}

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Tasks</h2>
              {canEdit && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Task</Button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {STATUS.map(st => (
                <Card key={st}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{st.replace("_", " ")}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.filter(t => t.status === st).map(t => (
                      <div key={t.id} className="p-2 rounded border bg-card hover:bg-accent/30">
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                          {t.deadline && <Badge variant="secondary" className="text-xs">{format(new Date(t.deadline), "MMM d")}</Badge>}
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openChat(t)}><MessageSquare className="h-3 w-3" /></Button>
                          {canEdit && <>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(t)}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => delTask(t.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </>}
                        </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.status === st).length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-2">
              {tasks.map(t => (
                <Card key={t.id}>
                  <CardContent className="pt-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium">{t.title}</div>
                      {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{t.status}</Badge>
                        <Badge variant="outline">{t.priority}</Badge>
                        {t.deadline && <Badge variant="secondary">{format(new Date(t.deadline), "yyyy-MM-dd")}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openChat(t)}><MessageSquare className="h-4 w-4" /></Button>
                      {canEdit && <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => delTask(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Task edit dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button>
            <Button onClick={saveTask}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat dialog */}
      <Dialog open={!!chatTask} onOpenChange={(o) => !o && setChatTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{chatTask?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-2 border rounded p-2 bg-muted/30">
              {messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> :
                messages.map(m => (
                  <div key={m.id} className={`p-2 rounded text-sm ${m.user_id === userId ? "bg-primary/10 ml-8" : "bg-card mr-8"}`}>
                    <p>{m.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(m.created_at), "MMM d, HH:mm")}</p>
                  </div>
                ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === "Enter") sendMsg(); }} />
                <Button onClick={sendMsg}><Send className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
