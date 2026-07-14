import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Plus, Trash2, Search, Bell } from "lucide-react";

interface NotificationProcess {
  id: string;
  process_key: string;
  process_name: string;
  description: string | null;
  category: string | null;
}

interface NotificationRecipient {
  id: string;
  process_key: string;
  user_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  is_enabled: boolean;
  notes: string | null;
}

interface Profile {
  user_id: string;
  user_name: string | null;
  email: string | null;
}

export default function NotificationSettings() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<NotificationProcess[]>([]);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addProcessKey, setAddProcessKey] = useState<string>("");
  const [addUserId, setAddUserId] = useState<string>("");
  const [addEmail, setAddEmail] = useState<string>("");
  const [addName, setAddName] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [p, r, u] = await Promise.all([
      supabase.from("notification_processes").select("*").order("category").order("process_name"),
      supabase.from("notification_recipients").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, user_name, email").order("user_name"),
    ]);
    if (p.error) toast.error(p.error.message);
    if (r.error) toast.error(r.error.message);
    if (u.error) toast.error(u.error.message);
    setProcesses((p.data as any) || []);
    setRecipients((r.data as any) || []);
    setProfiles((u.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = processes.filter((p) =>
      !term ||
      p.process_name.toLowerCase().includes(term) ||
      p.process_key.toLowerCase().includes(term) ||
      (p.description || "").toLowerCase().includes(term) ||
      (p.category || "").toLowerCase().includes(term)
    );
    const map = new Map<string, NotificationProcess[]>();
    for (const p of filtered) {
      const cat = p.category || (isAr ? "أخرى" : "Other");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries());
  }, [processes, search, isAr]);

  const recipientsByProcess = useMemo(() => {
    const map = new Map<string, NotificationRecipient[]>();
    for (const r of recipients) {
      if (!map.has(r.process_key)) map.set(r.process_key, []);
      map.get(r.process_key)!.push(r);
    }
    return map;
  }, [recipients]);

  const toggleEnabled = async (r: NotificationRecipient, value: boolean) => {
    setRecipients((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_enabled: value } : x)));
    const { error } = await supabase
      .from("notification_recipients")
      .update({ is_enabled: value })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      setRecipients((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_enabled: !value } : x)));
    } else {
      toast.success(value ? (isAr ? "تم التفعيل" : "Enabled") : (isAr ? "تم التعطيل" : "Disabled"));
    }
  };

  const removeRecipient = async (r: NotificationRecipient) => {
    const { error } = await supabase.from("notification_recipients").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRecipients((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(isAr ? "تم الحذف" : "Removed");
  };

  const openAdd = (processKey: string) => {
    setAddProcessKey(processKey);
    setAddUserId("");
    setAddEmail("");
    setAddName("");
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!addProcessKey || !addEmail.trim()) {
      return toast.error(isAr ? "الرجاء إدخال البريد" : "Email is required");
    }
    const { data, error } = await supabase
      .from("notification_recipients")
      .insert({
        process_key: addProcessKey,
        user_id: addUserId || null,
        recipient_email: addEmail.trim(),
        recipient_name: addName.trim() || null,
        is_enabled: true,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setRecipients((prev) => [data as any, ...prev]);
    setAddOpen(false);
    toast.success(isAr ? "تمت الإضافة" : "Added");
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">
            {isAr ? "إعدادات الإشعارات" : "Notification Settings"}
          </h1>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={isAr ? "بحث..." : "Search process..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isAr
          ? "قم بإدارة مستلمي كل إشعار وتفعيل أو تعطيل الاستلام لكل مستخدم على حدة."
          : "Manage recipients for each notification process and enable or disable delivery per user."}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold text-primary">{cat}</h2>
              <div className="grid gap-3">
                {items.map((proc) => {
                  const list = recipientsByProcess.get(proc.process_key) || [];
                  return (
                    <Card key={proc.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {proc.process_name}
                              <Badge variant="outline" className="font-mono text-xs">
                                {proc.process_key}
                              </Badge>
                            </CardTitle>
                            {proc.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {proc.description}
                              </p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => openAdd(proc.process_key)}>
                            <Plus className="h-4 w-4 mr-1" />
                            {isAr ? "إضافة مستلم" : "Add Recipient"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {list.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            {isAr ? "لا يوجد مستلمون" : "No recipients configured"}
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{isAr ? "المستخدم" : "User"}</TableHead>
                                <TableHead>{isAr ? "البريد" : "Email"}</TableHead>
                                <TableHead className="w-32">{isAr ? "الحالة" : "Status"}</TableHead>
                                <TableHead className="w-16" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell>{r.recipient_name || "—"}</TableCell>
                                  <TableCell className="font-mono text-xs">{r.recipient_email}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={r.is_enabled}
                                        onCheckedChange={(v) => toggleEnabled(r, v)}
                                      />
                                      <span className={`text-xs ${r.is_enabled ? "text-green-600" : "text-muted-foreground"}`}>
                                        {r.is_enabled
                                          ? (isAr ? "مفعل" : "Enabled")
                                          : (isAr ? "معطل" : "Disabled")}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeRecipient(r)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? "إضافة مستلم" : "Add Recipient"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isAr ? "المستخدم (اختياري)" : "User (optional)"}</Label>
              <Select
                value={addUserId}
                onValueChange={(v) => {
                  setAddUserId(v);
                  const p = profiles.find((x) => x.user_id === v);
                  if (p) {
                    setAddEmail(p.email || "");
                    setAddName(p.user_name || "");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر مستخدم" : "Select user"} />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter((p) => p.email)
                    .map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.user_name || p.email} — {p.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isAr ? "الاسم" : "Name"}</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
            <div>
              <Label>{isAr ? "البريد الإلكتروني" : "Email"} *</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitAdd}>{isAr ? "إضافة" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
