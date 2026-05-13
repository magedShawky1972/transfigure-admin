import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSummaryDialog } from "@/components/ProjectSummaryDialog";

interface Props {
  project: { id: string; name: string };
  onClose: () => void;
  allProjectUsers: Array<{ user_id: string; user_name: string; avatar_url?: string | null }>;
  activePhases: Array<{ phase_key: string; phase_name: string; phase_name_ar?: string | null; phase_color?: string | null }>;
  language: 'ar' | 'en';
}

export function ProjectSummaryDialogLoader({ project, onClose, allProjectUsers, activePhases, language }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: taskRows } = await (supabase as any)
        .from('project_tasks')
        .select('id, title, status, priority, deadline, created_at, updated_at, assigned_to')
        .eq('project_id', project.id);
      const ids = ((taskRows as any[]) || []).map((t: any) => t.id);
      let assigneesMap = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: ar } = await (supabase as any)
          .from('project_task_assignees')
          .select('task_id, user_id')
          .in('task_id', ids);
        (ar || []).forEach((a: any) => {
          if (!assigneesMap.has(a.task_id)) assigneesMap.set(a.task_id, []);
          assigneesMap.get(a.task_id)!.push(a.user_id);
        });
      }
      if (cancelled) return;
      setTasks((taskRows || []).map((t: any) => ({
        ...t,
        assignees: assigneesMap.get(t.id) || (t.assigned_to ? [t.assigned_to] : []),
      })));
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  return (
    <ProjectSummaryDialog
      open={true}
      onOpenChange={(v) => !v && onClose()}
      projectName={project.name}
      tasks={tasks}
      users={allProjectUsers.map(u => ({ user_id: u.user_id, user_name: u.user_name, avatar_url: u.avatar_url }))}
      phases={activePhases.map(p => ({
        phase_key: p.phase_key,
        phase_label: language === 'ar' ? (p.phase_name_ar || p.phase_name) : p.phase_name,
        phase_color: p.phase_color,
      }))}
      language={language}
    />
  );
}
