import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Plug, Plus, Search, Settings, Trash2, AlertTriangle, ShieldCheck, Activity,
  CheckCircle2, XCircle, MinusCircle, Power, ShieldAlert, Clock,
} from "lucide-react";

type IntegrationType = "oauth" | "api_key" | "webhook";
type IntegrationStatus = "active" | "warning" | "error" | "disabled";

interface Integration {
  id: string;
  name: string;
  app_key: string | null;
  description: string | null;
  type: IntegrationType;
  status: IntegrationStatus;
  icon_url: string | null;
  scopes: string[];
  connected_at: string;
  last_sync_at: string | null;
  daily_requests: number;
  monthly_requests: number;
  success_rate: number;
  start_date: string | null;
  expires_at: string | null;
  warning_message: string | null;
}

interface ActivityRow {
  id: string;
  integration_id: string | null;
  app_name: string;
  action: string;
  status: string;
  created_at: string;
}

const STATUS_META: Record<IntegrationStatus, { label: string; dot: string; pill: string; icon: any }> = {
  active:   { label: "نشط",   dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  warning:  { label: "تحذير",  dot: "bg-amber-500",   pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",       icon: AlertTriangle },
  error:    { label: "خطأ",    dot: "bg-red-500",     pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",                icon: XCircle },
  disabled: { label: "معطل", dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border",                              icon: MinusCircle },
};

const TYPE_LABEL: Record<IntegrationType, string> = {
  oauth: "OAuth",
  api_key: "مفتاح API",
  webhook: "Webhook",
};

function formatRel(date: string | null): string {
  if (!date) return "أبداً";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} ي`;
  return d.toLocaleDateString();
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

const FILTERS: Array<{ key: "all" | IntegrationStatus; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشط" },
  { key: "disabled", label: "معطل" },
  { key: "error", label: "خطأ" },
];

const EMPTY_FORM = {
  name: "",
  app_key: "",
  description: "",
  type: "oauth" as IntegrationType,
  status: "active" as IntegrationStatus,
  scopes: "",
  start_date: "",
  expires_at: "",
};

export default function Integrations() {
  const [items, setItems] = useState<Integration[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | IntegrationStatus>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [intRes, actRes] = await Promise.all([
      supabase.from("integrations").select("*").order("created_at", { ascending: false }),
      supabase.from("integration_activity").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (intRes.error) toast({ title: "Failed to load integrations", description: intRes.error.message, variant: "destructive" });
    if (actRes.error) console.warn(actRes.error);
    setItems((intRes.data as any) || []);
    setActivity((actRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("integrations-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "integrations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "integration_activity" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (!i.name.toLowerCase().includes(s) && !(i.description || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "active").length;
    const requests = items.reduce((sum, i) => sum + (i.monthly_requests || 0), 0);
    const attention = items.filter((i) => i.status === "warning" || i.status === "error").length;
    return { total, active, requests, attention };
  }, [items]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAddOpen(true);
  };

  const openEdit = (i: Integration) => {
    setEditingId(i.id);
    setForm({
      name: i.name,
      app_key: i.app_key || "",
      description: i.description || "",
      type: i.type,
      status: i.status,
      scopes: (i.scopes || []).join(", "),
      start_date: i.start_date ? i.start_date.slice(0, 10) : "",
      expires_at: i.expires_at ? i.expires_at.slice(0, 10) : "",
    });
    setAddOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      app_key: form.app_key.trim() || null,
      description: form.description.trim() || null,
      type: form.type,
      status: form.status,
      scopes: form.scopes.split(",").map((s) => s.trim()).filter(Boolean),
      start_date: form.start_date || null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.from("integrations").update(payload).eq("id", editingId));
    } else {
      ({ error: err } = await supabase.from("integrations").insert(payload));
    }
    if (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Integration updated" : "Integration added" });
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    load();
  };

  const toggleStatus = async (i: Integration) => {
    const next: IntegrationStatus = i.status === "disabled" ? "active" : "disabled";
    const { error } = await supabase.from("integrations").update({ status: next }).eq("id", i.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("integration_activity").insert({
      integration_id: i.id,
      app_name: i.name,
      action: next === "disabled" ? "Integration disabled" : "Integration enabled",
      status: "success",
    });
  };

  const disconnect = async (i: Integration) => {
    if (!confirm(`Disconnect ${i.name}? This removes the integration and its access rules.`)) return;
    const { error } = await supabase.from("integrations").delete().eq("id", i.id);
    if (error) {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("integration_activity").insert({
      integration_id: null,
      app_name: i.name,
      action: "Integration disconnected",
      status: "success",
    });
    toast({ title: "Disconnected" });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-7 w-7 text-primary" />
            التكاملات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.active} من {stats.total} تطبيقات متصلة
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/integration-access-control">
              <ShieldCheck className="h-4 w-4 mr-2" />
              صلاحيات الوصول
            </Link>
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            إضافة تكامل
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي التكاملات" value={stats.total} icon={Plug} />
        <StatCard label="نشط" value={stats.active} icon={CheckCircle2} accent="text-emerald-600" />
        <StatCard label="طلبات API / شهرياً" value={stats.requests.toLocaleString()} icon={Activity} accent="text-primary" />
        <StatCard label="يحتاج إلى انتباه" value={stats.attention} icon={ShieldAlert} accent="text-amber-600" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key !== "all" && (
                <span className="ml-2 text-xs opacity-75">
                  {items.filter((i) => i.status === f.key).length}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="sm:ml-auto relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في التكاملات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Plug className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {items.length === 0 ? "لا توجد تكاملات بعد" : "لا توجد تكاملات تطابق الفلاتر"}
            </p>
            {items.length === 0 && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />أضف أول تكامل</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((i) => (
            <IntegrationCard
              key={i.id}
              item={i}
              onEdit={() => openEdit(i)}
              onToggle={() => toggleStatus(i)}
              onDisconnect={() => disconnect(i)}
            />
          ))}
        </div>
      )}

      {/* Activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            النشاط الأخير
          </CardTitle>
          <CardDescription>أحدث الأحداث عبر جميع التكاملات المتصلة</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا يوجد نشاط حديث</p>
          ) : (
            <ul className="divide-y">
              {activity.map((a) => {
                const ok = a.status === "success";
                const fail = a.status === "fail" || a.status === "error";
                const dot = ok ? "bg-emerald-500" : fail ? "bg-red-500" : "bg-amber-500";
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-1.5 h-2 w-2 rounded-full ${dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{a.app_name}</span>
                        <span className="text-sm text-muted-foreground">{a.action}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRel(a.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل التكامل" : "إضافة تكامل"}</DialogTitle>
            <DialogDescription>
              قم بإعداد تفاصيل الاتصال. تتم إدارة الوصول لكل مستخدم/دور من صلاحيات الوصول.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: Slack" />
            </div>
            <div>
              <Label>معرّف التطبيق</Label>
              <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} placeholder="slack" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as IntegrationType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="api_key">مفتاح API</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as IntegrationStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="warning">تحذير</SelectItem>
                    <SelectItem value="error">خطأ</SelectItem>
                    <SelectItem value="disabled">معطل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>الصلاحيات (مفصولة بفاصلة)</Label>
              <Input value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} placeholder="read:users, write:messages" />
            </div>
            <div>
              <Label>تاريخ الانتهاء</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={save}>{editingId ? "حفظ التغييرات" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: any; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${accent || "text-muted-foreground"} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationCard({
  item, onEdit, onToggle, onDisconnect,
}: {
  item: Integration; onEdit: () => void; onToggle: () => void; onDisconnect: () => void;
}) {
  const meta = STATUS_META[item.status];
  const StatusIcon = meta.icon;
  const expiringDays = daysUntil(item.expires_at);
  const expiringSoon = expiringDays !== null && expiringDays >= 0 && expiringDays <= 14;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* header row */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0">
            {item.icon_url ? (
              <img src={item.icon_url} alt="" className="h-12 w-12 object-contain" />
            ) : (
              item.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{item.name}</h3>
              <Badge variant="outline" className="text-xs">{TYPE_LABEL[item.type]}</Badge>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${meta.pill}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {meta.label}
          </div>
        </div>

        {/* warning banner */}
        {(expiringSoon || item.warning_message) && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {item.warning_message || `ينتهي مفتاح API خلال ${expiringDays} يوم`}
            </span>
          </div>
        )}

        {/* metadata grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Meta label="تاريخ الاتصال" value={formatDate(item.connected_at)} />
          <Meta label="آخر مزامنة" value={formatRel(item.last_sync_at)} />
          <Meta label="الطلبات اليومية" value={item.daily_requests.toLocaleString()} />
          <Meta label="معدل النجاح" value={`${item.success_rate}%`} />
        </div>

        {/* scopes */}
        {item.scopes && item.scopes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1.5">الصلاحيات الممنوحة</p>
            <div className="flex flex-wrap gap-1">
              {item.scopes.map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground/80 border">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* security access shortcut */}
        <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">الوصول:</span>
            <Link to={`/integration-access-control?integration=${item.id}`} className="font-medium text-primary hover:underline">
              إدارة الأدوار والمستخدمين
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{item.status === "disabled" ? "إيقاف" : "تشغيل"}</span>
            <Switch checked={item.status !== "disabled"} onCheckedChange={onToggle} />
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Settings className="h-4 w-4 mr-1.5" />
            الإعدادات
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={onDisconnect}>
            <Power className="h-4 w-4 mr-1.5" />
            قطع الاتصال
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
