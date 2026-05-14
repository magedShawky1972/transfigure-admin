import { useEffect, useMemo, useRef, useState } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const t = {
    title: language === 'ar' ? 'المحادثة' : 'Messages',
    placeholder: language === 'ar' ? 'اكتب رسالة... (اكتب @ للإشارة لعضو)' : 'Type a message... (type @ to mention)',
    send: language === 'ar' ? 'إرسال' : 'Send',
    empty: language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet',
    noMatch: language === 'ar' ? 'لا يوجد أعضاء مطابقون' : 'No members match',
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

  const filteredMentions = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    const list = users.filter(u => {
      const name = (u.full_name || u.email || '').toLowerCase();
      return !q || name.includes(q);
    });
    return list.slice(0, 8);
  }, [mentionOpen, mentionQuery, users]);

  const detectMention = (value: string, caret: number) => {
    // Look back from caret for an @ that starts a mention
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at < 0) { setMentionOpen(false); setMentionStart(null); return; }
    // valid if @ is at start or preceded by whitespace
    const prevChar = at === 0 ? ' ' : upto[at - 1];
    if (!/\s/.test(prevChar)) { setMentionOpen(false); setMentionStart(null); return; }
    const query = upto.slice(at + 1);
    if (/\s/.test(query)) { setMentionOpen(false); setMentionStart(null); return; }
    setMentionStart(at);
    setMentionQuery(query);
    setMentionIndex(0);
    setMentionOpen(true);
  };

  const insertMention = (u: UserLite) => {
    if (mentionStart == null || !textareaRef.current) return;
    const ta = textareaRef.current;
    const caret = ta.selectionStart ?? text.length;
    const name = (u.full_name || u.email || '').replace(/\s+/g, '_');
    const before = text.slice(0, mentionStart);
    const after = text.slice(caret);
    const insert = `@${name} `;
    const next = before + insert + after;
    setText(next);
    setMentionOpen(false);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    detectMention(v, e.target.selectionStart ?? v.length);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % filteredMentions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + filteredMentions.length) % filteredMentions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    setLoading(true);
    const { error } = await supabase.from('task_messages').insert({
      task_id: taskId, user_id: currentUserId, message: text.trim()
    });
    setLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setText("");
    setMentionOpen(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('task_messages').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
  };

  // Render message text with @mentions highlighted
  const renderMessage = (msg: string) => {
    const parts = msg.split(/(@[\p{L}0-9_.-]+)/gu);
    return parts.map((p, i) => {
      if (p.startsWith('@')) {
        const tag = p.slice(1).replace(/_/g, ' ').toLowerCase();
        const matched = users.some(u => (u.full_name || u.email || '').toLowerCase() === tag);
        if (matched) {
          return <span key={i} className="font-semibold text-primary bg-primary/10 rounded px-1">{p.replace(/_/g, ' ')}</span>;
        }
      }
      return <span key={i}>{p}</span>;
    });
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
                  <div className="whitespace-pre-wrap break-words">{renderMessage(m.message)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="flex gap-2 mt-2 relative">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            placeholder={t.placeholder}
            className="min-h-[40px] max-h-[120px]"
          />
          {mentionOpen && (
            <div className="absolute bottom-full mb-1 left-0 z-50 w-64 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {filteredMentions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">{t.noMatch}</div>
              ) : (
                filteredMentions.map((u, idx) => {
                  const name = u.full_name || u.email || '';
                  return (
                    <button
                      key={u.user_id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent ${idx === mentionIndex ? 'bg-accent' : ''}`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 truncate">
                        <div className="truncate">{name}</div>
                        {u.email && u.full_name && <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <Button onClick={send} disabled={loading || !text.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
