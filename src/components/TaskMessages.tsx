import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TaskMessage {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface UserLite {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

interface Props {
  taskId: string;
  currentUserId: string | null;
  users: UserLite[];
  language?: 'en' | 'ar';
}

export default function TaskMessages({ taskId, currentUserId, users, language = 'en' }: Props) {
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = {
    title: language === 'ar' ? 'المحادثة' : 'Messages',
    placeholder: language === 'ar' ? 'اكتب رسالة...' : 'Type a message...',
    send: language === 'ar' ? 'إرسال' : 'Send',
    empty: language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet',
  };

  const userName = (uid: string) => {
    const u = users.find(x => x.user_id === uid);
    return u?.full_name || u?.email || uid.slice(0, 6);
  };

  const initials = (name: string) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const load = async () => {
    const { data, error } = await supabase
      .from('task_messages')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (!error && data) setMessages(data as TaskMessage[]);
  };

  useEffect(() => {
    if (!taskId) return;
    load();
    const channel = supabase
      .channel(`task_messages_${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_messages', filter: `task_id=eq.${taskId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    setLoading(true);
    const { error } = await supabase.from('task_messages').insert({
      task_id: taskId, user_id: currentUserId, message: text.trim()
    });
    setLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setText("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('task_messages').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="text-sm font-semibold mb-2">{t.title} ({messages.length})</div>
      <ScrollArea className="h-[260px] pr-2" ref={scrollRef as any}>
        <div ref={scrollRef} className="space-y-2 max-h-[260px] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">{t.empty}</div>
          )}
          {messages.map(m => {
            const mine = m.user_id === currentUserId;
            const name = userName(m.user_id);
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  <div className="text-[10px] opacity-70 mb-0.5 flex items-center gap-2">
                    <span>{name}</span>
                    <span>•</span>
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                    {mine && (
                      <button onClick={() => remove(m.id)} className="ml-1 opacity-60 hover:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="flex gap-2 mt-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          className="min-h-[40px] max-h-[120px]"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button onClick={send} disabled={loading || !text.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
