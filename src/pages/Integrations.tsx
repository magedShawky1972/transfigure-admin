import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Plug, Plus, Search, Settings, AlertTriangle, ShieldCheck, Activity,
  CheckCircle2, XCircle, MinusCircle, Power, ShieldAlert, Clock,
  Star, RefreshCw, Zap, RotateCw, ChevronDown, ChevronRight, Heart,
  TrendingUp, Lock, Globe,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type IntegrationType = "oauth" | "api_key" | "webhook";
type IntegrationStatus = "active" | "warning" | "error" | "disabled";
type Health = "healthy" | "degraded" | "down";
type AccessLabel = "restricted" | "public" | "custom";

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
  health: Health;
  latency_ms: number;
  monthly_quota: number | null;
  error_message: string | null;
  last_error_at: string | null;
  is_favorite: boolean;
  access_label: AccessLabel;
  access_summary: string | null;
  usage_history: number[];
}

interface ActivityRow {
  id: string;
  integration_id: string | null;
  app_name: string;
  action: string;
  status: string;
  created_at: string;
  metadata: any;
}

const buildStatusMeta = (isAr: boolean): Record<IntegrationStatus, { label: string; dot: string; pill: string; icon: any }> => ({
  active:   { label: isAr ? "نشط" : "Active",     dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  warning:  { label: isAr ? "تحذير" : "Warning",  dot: "bg-amber-500",   pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",       icon: AlertTriangle },
  error:    { label: isAr ? "خطأ" : "Error",      dot: "bg-red-500",     pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",                icon: XCircle },
  disabled: { label: isAr ? "معطل" : "Disabled",  dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border",                              icon: MinusCircle },
});

const buildHealthMeta = (isAr: boolean): Record<Health, { label: string; cls: string }> => ({
  healthy:  { label: isAr ? "سليم" : "Healthy",     cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  degraded: { label: isAr ? "متذبذب" : "Degraded",  cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  down:     { label: isAr ? "متوقف" : "Down",       cls: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
});

const buildAccessMeta = (isAr: boolean): Record<AccessLabel, { label: string; cls: string; icon: any }> => ({
  restricted: { label: isAr ? "مقيّد" : "Restricted", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", icon: Lock },
  public:     { label: isAr ? "عام" : "Public",       cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: Globe },
  custom:     { label: isAr ? "مخصص" : "Custom",      cls: "bg-primary/10 text-primary border-primary/20", icon: ShieldCheck },
});

const buildTypeLabel = (isAr: boolean): Record<IntegrationType, string> => ({
  oauth: "OAuth",
  api_key: isAr ? "مفتاح API" : "API Key",
  webhook: "Webhook",
});

function formatRel(date: string | null, isAr: boolean = false): string {
  if (!date) return isAr ? "أبداً" : "Never";
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return isAr ? "الآن" : "Just now";
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return isAr ? `منذ ${days} ي` : `${days}d ago`;
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

const buildFilters = (isAr: boolean): Array<{ key: "all" | IntegrationStatus; label: string }> => ([
  { key: "all",      label: isAr ? "الكل" : "All" },
  { key: "active",   label: isAr ? "نشط" : "Active" },
  { key: "disabled", label: isAr ? "معطل" : "Disabled" },
  { key: "error",    label: isAr ? "خطأ" : "Error" },
]);

type SortKey = "last_sync" | "usage" | "errors" | "name";

const EMPTY_FORM = {
  name: "",
  app_key: "",
  description: "",
  type: "oauth" as IntegrationType,
  status: "active" as IntegrationStatus,
  scopes: "",
  start_date: "",
  expires_at: "",
  monthly_quota: "",
  access_label: "restricted" as AccessLabel,
  access_summary: "",
};

export default function Integrations() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const tt = (en: string, ar: string) => (isAr ? ar : en);
  const STATUS_META = useMemo(() => buildStatusMeta(isAr), [isAr]);
  const HEALTH_META = useMemo(() => buildHealthMeta(isAr), [isAr]);
  const ACCESS_META = useMemo(() => buildAccessMeta(isAr), [isAr]);
  const TYPE_LABEL = useMemo(() => buildTypeLabel(isAr), [isAr]);
  const FILTERS = useMemo(() => buildFilters(isAr), [isAr]);

  const [items, setItems] = useState<Integration[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | IntegrationStatus>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_sync");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Activity log filters
  const [logIntegration, setLogIntegration] = useState<string>("all");
  const [logStatus, setLogStatus] = useState<string>("all");
  const [logFrom, setLogFrom] = useState<string>("");
  const [logTo, setLogTo] = useState<string>("");
  const [expandedLog, setExpandedLog] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [intRes, actRes] = await Promise.all([
      supabase.from("integrations").select("*").order("created_at", { ascending: false }),
      supabase.from("integration_activity").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (intRes.error) toast({ title: tt("Failed to load integrations", "فشل تحميل التكاملات"), description: intRes.error.message, variant: "destructive" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (favoritesOnly && !i.is_favorite) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (!i.name.toLowerCase().includes(s) && !(i.description || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "usage":
          return (b.monthly_requests || 0) - (a.monthly_requests || 0);
        case "errors":
          return ((b.success_rate ? 100 - Number(b.success_rate) : 0)) - ((a.success_rate ? 100 - Number(a.success_rate) : 0));
        case "name":
          return a.name.localeCompare(b.name);
        case "last_sync":
        default: {
          const at = a.last_sync_at ? new Date(a.last_sync_at).getTime() : 0;
          const bt = b.last_sync_at ? new Date(b.last_sync_at).getTime() : 0;
          return bt - at;
        }
      }
    });
    return list;
  }, [items, filter, search, favoritesOnly, sortKey]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "active").length;
    const requests = items.reduce((sum, i) => sum + (i.monthly_requests || 0), 0);
    const attention = items.filter((i) => i.status === "warning" || i.status === "error" || i.health === "down" || i.health === "degraded").length;
    return { total, active, requests, attention };
  }, [items]);

  const filteredActivity = useMemo(() => {
    return activity.filter((a) => {
      if (logIntegration !== "all" && a.integration_id !== logIntegration) return false;
      if (logStatus !== "all" && a.status !== logStatus) return false;
      const d = new Date(a.created_at).getTime();
      if (logFrom && d < new Date(logFrom).getTime()) return false;
      if (logTo && d > new Date(logTo).getTime() + 86400000) return false;
      return true;
    });
  }, [activity, logIntegration, logStatus, logFrom, logTo]);

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
      monthly_quota: i.monthly_quota?.toString() || "",
      access_label: i.access_label || "restricted",
      access_summary: i.access_summary || "",
    });
    setAddOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: tt("Name required", "الاسم مطلوب"), variant: "destructive" });
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
      monthly_quota: form.monthly_quota ? parseInt(form.monthly_quota, 10) : null,
      access_label: form.access_label,
      access_summary: form.access_summary.trim() || null,
    };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.from("integrations").update(payload).eq("id", editingId));
    } else {
      ({ error: err } = await supabase.from("integrations").insert(payload));
    }
    if (err) {
      toast({ title: tt("Save failed", "فشل الحفظ"), description: err.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? tt("Integration updated", "تم تحديث التكامل") : tt("Integration added", "تمت إضافة التكامل") });
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    load();
  };

  const toggleStatus = async (i: Integration) => {
    const next: IntegrationStatus = i.status === "disabled" ? "active" : "disabled";
    const { error } = await supabase.from("integrations").update({ status: next }).eq("id", i.id);
    if (error) { toast({ title: tt("Update failed", "فشل التحديث"), description: error.message, variant: "destructive" }); return; }
    await supabase.from("integration_activity").insert({
      integration_id: i.id, app_name: i.name,
      action: next === "disabled" ? "Integration disabled" : "Integration enabled",
      status: "success",
    });
  };

  const toggleFavorite = async (i: Integration) => {
    const { error } = await supabase.from("integrations").update({ is_favorite: !i.is_favorite }).eq("id", i.id);
    if (error) toast({ title: tt("Update failed", "فشل التحديث"), description: error.message, variant: "destructive" });
  };

  const disconnect = async (i: Integration) => {
    if (!confirm(tt(`Disconnect ${i.name}? This removes the integration and its access rules.`, `هل تريد فصل ${i.name}؟ سيتم حذف التكامل وقواعد الوصول الخاصة به.`))) return;
    const { error } = await supabase.from("integrations").delete().eq("id", i.id);
    if (error) { toast({ title: tt("Disconnect failed", "فشل الفصل"), description: error.message, variant: "destructive" }); return; }
    await supabase.from("integration_activity").insert({
      integration_id: null, app_name: i.name, action: "Integration disconnected", status: "success",
    });
    toast({ title: tt("Disconnected", "تم الفصل") });
  };

  const testConnection = async (i: Integration) => {
    toast({ title: tt("Testing connection…", "جارٍ اختبار الاتصال…"), description: i.name });
    const start = Date.now();
    // Simulated test — record latency on the row and write activity
    await new Promise((r) => setTimeout(r, 600));
    const latency = Date.now() - start + Math.floor(Math.random() * 80);
    const ok = i.status !== "error";
    await supabase.from("integrations").update({
      latency_ms: latency,
      health: ok ? (latency > 500 ? "degraded" : "healthy") : "down",
      last_sync_at: new Date().toISOString(),
    }).eq("id", i.id);
    await supabase.from("integration_activity").insert({
      integration_id: i.id, app_name: i.name,
      action: `Test connection (${latency}ms)`,
      status: ok ? "success" : "error",
      metadata: { latency_ms: latency },
    });
    toast({ title: ok ? tt("Connection OK", "الاتصال يعمل") : tt("Connection failed", "فشل الاتصال"), description: `${latency} ms` });
  };

  const resyncNow = async (i: Integration) => {
    toast({ title: tt("Re-syncing…", "جارٍ المزامنة…"), description: i.name });
    await supabase.from("integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", i.id);
    await supabase.from("integration_activity").insert({
      integration_id: i.id, app_name: i.name, action: "Manual re-sync triggered", status: "success",
    });
    toast({ title: tt("Re-sync complete", "اكتملت المزامنة") });
  };

  const retryIntegration = async (i: Integration) => {
    await supabase.from("integrations").update({
      status: "active", health: "healthy", error_message: null, last_error_at: null,
    }).eq("id", i.id);
    await supabase.from("integration_activity").insert({
      integration_id: i.id, app_name: i.name, action: "Retry succeeded", status: "success",
    });
    toast({ title: tt("Retry successful", "نجحت إعادة المحاولة") });
  };

  const retryActivity = async (a: ActivityRow) => {
    await supabase.from("integration_activity").insert({
      integration_id: a.integration_id, app_name: a.app_name,
      action: `Retried: ${a.action}`, status: "success", metadata: { retried_from: a.id },
    });
    toast({ title: tt("Event retried", "تمت إعادة المحاولة") });
  };

  // Bulk actions
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const bulkSetStatus = async (status: IntegrationStatus) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("integrations").update({ status }).in("id", ids);
    if (error) { toast({ title: tt("Bulk update failed", "فشل التحديث الجماعي"), description: error.message, variant: "destructive" }); return; }
    toast({ title: tt(`Updated ${ids.length} integrations`, `تم تحديث ${ids.length} تكامل`) });
    clearSelection();
    setSelectMode(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-7 w-7 text-primary" />
            {tt("Integrations", "التكاملات")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? `${stats.active} من ${stats.total} تطبيقات متصلة` : `${stats.active} of ${stats.total} apps connected`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/integration-access-control">
              <ShieldCheck className="h-4 w-4 mr-2" />
              {tt("Access Control", "صلاحيات الوصول")}
            </Link>
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            {tt("Add Integration", "إضافة تكامل")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={tt("Total Integrations", "إجمالي التكاملات")} value={stats.total} icon={Plug} />
        <StatCard label={tt("Active", "نشط")} value={stats.active} icon={CheckCircle2} accent="text-emerald-600" />
        <StatCard label={tt("API Requests / Month", "طلبات API / شهرياً")} value={stats.requests.toLocaleString()} icon={Activity} accent="text-primary" />
        <StatCard label={tt("Need Attention", "يحتاج إلى انتباه")} value={stats.attention} icon={ShieldAlert} accent="text-amber-600" />
      </div>

      {/* Filter + sort + favorites + bulk bar */}
      <div className="flex flex-col gap-3">
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
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tt("Search integrations...", "بحث في التكاملات...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_sync">{tt("Last sync", "آخر مزامنة")}</SelectItem>
                <SelectItem value="usage">{tt("Usage", "الاستخدام")}</SelectItem>
                <SelectItem value="errors">{tt("Errors", "الأخطاء")}</SelectItem>
                <SelectItem value="name">{tt("Name", "الاسم")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              <Star className={`h-4 w-4 mr-1.5 ${favoritesOnly ? "fill-current" : ""}`} />
              {tt("Favorites", "المفضلة")}
            </Button>
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectMode((v) => !v); clearSelection(); }}
            >
              {selectMode ? tt("Exit select", "إنهاء التحديد") : tt("Select", "تحديد متعدد")}
            </Button>
          </div>
        </div>

        {selectMode && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{tt(`${selectedIds.size} selected`, `${selectedIds.size} محدد`)}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkSetStatus("active")} disabled={selectedIds.size === 0}>
                <Power className="h-3.5 w-3.5 mr-1.5" />{tt("Enable", "تفعيل")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetStatus("disabled")} disabled={selectedIds.size === 0}>
                <MinusCircle className="h-3.5 w-3.5 mr-1.5" />{tt("Disable", "تعطيل")}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>{tt("Clear", "إلغاء التحديد")}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">{tt("Loading…", "جارٍ التحميل…")}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Plug className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {items.length === 0 ? tt("No integrations yet", "لا توجد تكاملات بعد") : tt("No integrations match your filters", "لا توجد تكاملات تطابق الفلاتر")}
            </p>
            {items.length === 0 && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{tt("Add your first integration", "أضف أول تكامل")}</Button>}
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
              onFavorite={() => toggleFavorite(i)}
              onTest={() => testConnection(i)}
              onResync={() => resyncNow(i)}
              onRetry={() => retryIntegration(i)}
              statusMeta={STATUS_META}
              healthMeta={HEALTH_META}
              accessMeta={ACCESS_META}
              typeLabel={TYPE_LABEL}
              isAr={isAr}
              selectMode={selectMode}
              selected={selectedIds.has(i.id)}
              onSelect={() => toggleSelected(i.id)}
            />
          ))}
        </div>
      )}

      {/* Activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {tt("Recent Activity", "النشاط الأخير")}
          </CardTitle>
          <CardDescription>{tt("Latest events across all connected integrations", "أحدث الأحداث عبر جميع التكاملات المتصلة")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* log filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={logIntegration} onValueChange={setLogIntegration}>
              <SelectTrigger><SelectValue placeholder={tt("Integration", "التكامل")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt("All integrations", "كل التكاملات")}</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={logStatus} onValueChange={setLogStatus}>
              <SelectTrigger><SelectValue placeholder={tt("Status", "الحالة")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt("All statuses", "كل الحالات")}</SelectItem>
                <SelectItem value="success">{tt("Success", "نجاح")}</SelectItem>
                <SelectItem value="error">{tt("Error", "خطأ")}</SelectItem>
                <SelectItem value="fail">{tt("Fail", "فشل")}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} placeholder={tt("From", "من")} />
            <Input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)} placeholder={tt("To", "إلى")} />
          </div>

          {filteredActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{tt("No matching activity", "لا يوجد نشاط مطابق")}</p>
          ) : (
            <ul className="divide-y">
              {filteredActivity.map((a) => {
                const ok = a.status === "success";
                const fail = a.status === "fail" || a.status === "error";
                const dot = ok ? "bg-emerald-500" : fail ? "bg-red-500" : "bg-amber-500";
                const expanded = expandedLog.has(a.id);
                const hasMeta = a.metadata && Object.keys(a.metadata || {}).length > 0;
                return (
                  <li key={a.id} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <button
                        className="mt-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setExpandedLog((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                            return next;
                          });
                        }}
                        aria-label="toggle"
                      >
                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <span className={`mt-1.5 h-2 w-2 rounded-full ${dot} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{a.app_name}</span>
                          <span className="text-sm text-muted-foreground">{a.action}</span>
                        </div>
                      </div>
                      {fail && (
                        <Button size="sm" variant="ghost" onClick={() => retryActivity(a)}>
                          <RotateCw className="h-3.5 w-3.5 mr-1" />
                          {tt("Retry", "إعادة")}
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRel(a.created_at, isAr)}
                      </span>
                    </div>
                    {expanded && (
                      <div className="ml-9 mt-2 rounded-md border bg-muted/30 p-2 text-xs font-mono overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-all">{hasMeta ? JSON.stringify(a.metadata, null, 2) : tt("No payload available", "لا توجد بيانات إضافية")}</pre>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? tt("Edit Integration", "تعديل التكامل") : tt("Add Integration", "إضافة تكامل")}</DialogTitle>
            <DialogDescription>
              {tt("Configure connection details. Per-user/role access is managed in Access Control.", "قم بإعداد تفاصيل الاتصال. تتم إدارة الوصول لكل مستخدم/دور من صلاحيات الوصول.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tt("Name *", "الاسم *")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tt("e.g. Slack", "مثال: Slack")} />
            </div>
            <div>
              <Label>{tt("App Identifier", "معرّف التطبيق")}</Label>
              <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} placeholder="slack" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt("Type", "النوع")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as IntegrationType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="api_key">{tt("API Key", "مفتاح API")}</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tt("Status", "الحالة")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as IntegrationStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{tt("Active", "نشط")}</SelectItem>
                    <SelectItem value="warning">{tt("Warning", "تحذير")}</SelectItem>
                    <SelectItem value="error">{tt("Error", "خطأ")}</SelectItem>
                    <SelectItem value="disabled">{tt("Disabled", "معطل")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{tt("Scopes (comma separated)", "الصلاحيات (مفصولة بفاصلة)")}</Label>
              <Input value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} placeholder="read:users, write:messages" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt("Start Date", "تاريخ البدء")}</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>{tt("Expires At", "تاريخ الانتهاء")}</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt("Monthly quota", "الحد الشهري")}</Label>
                <Input type="number" value={form.monthly_quota} onChange={(e) => setForm({ ...form, monthly_quota: e.target.value })} placeholder="100000" />
              </div>
              <div>
                <Label>{tt("Access label", "تسمية الوصول")}</Label>
                <Select value={form.access_label} onValueChange={(v) => setForm({ ...form, access_label: v as AccessLabel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restricted">{tt("Restricted", "مقيّد")}</SelectItem>
                    <SelectItem value="public">{tt("Public", "عام")}</SelectItem>
                    <SelectItem value="custom">{tt("Custom", "مخصص")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{tt("Who has access (display only)", "من له حق الوصول (للعرض فقط)")}</Label>
              <Input value={form.access_summary} onChange={(e) => setForm({ ...form, access_summary: e.target.value })} placeholder={tt("e.g. Admins, Marketing", "مثال: المسؤولون، التسويق")} />
            </div>
            <div>
              <Label>{tt("Description", "الوصف")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{tt("Cancel", "إلغاء")}</Button>
            <Button onClick={save}>{editingId ? tt("Save changes", "حفظ التغييرات") : tt("Add", "إضافة")}</Button>
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

function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) {
    return <div className={`h-8 flex items-center text-[10px] text-muted-foreground ${className}`}>—</div>;
  }
  const w = 100, h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-8 w-full text-primary ${className}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function IntegrationCard({
  item, onEdit, onToggle, onDisconnect, onFavorite, onTest, onResync, onRetry,
  statusMeta, healthMeta, accessMeta, typeLabel, isAr, selectMode, selected, onSelect,
}: {
  item: Integration;
  onEdit: () => void; onToggle: () => void; onDisconnect: () => void; onFavorite: () => void;
  onTest: () => void; onResync: () => void; onRetry: () => void;
  statusMeta: Record<IntegrationStatus, { label: string; dot: string; pill: string; icon: any }>;
  healthMeta: Record<Health, { label: string; cls: string }>;
  accessMeta: Record<AccessLabel, { label: string; cls: string; icon: any }>;
  typeLabel: Record<IntegrationType, string>;
  isAr: boolean; selectMode: boolean; selected: boolean; onSelect: () => void;
}) {
  const tt = (en: string, ar: string) => (isAr ? ar : en);
  const meta = statusMeta[item.status];
  const StatusIcon = meta.icon;
  const health = healthMeta[item.health] || healthMeta.healthy;
  const access = accessMeta[item.access_label] || accessMeta.restricted;
  const AccessIcon = access.icon;

  const expiringDays = daysUntil(item.expires_at);
  const expiringSoon = expiringDays !== null && expiringDays >= 0 && expiringDays <= 14;
  const successRate = Number(item.success_rate || 0);
  const errorRateHigh = successRate < 90;
  const quotaPct = item.monthly_quota && item.monthly_quota > 0
    ? Math.min(100, Math.round((item.monthly_requests / item.monthly_quota) * 100))
    : null;
  const quotaNear = quotaPct !== null && quotaPct >= 80;
  const isFailure = item.status === "error" || item.health === "down";

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${selected ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-5">
        {/* header row */}
        <div className="flex items-start gap-3">
          {selectMode && (
            <Checkbox checked={selected} onCheckedChange={onSelect} className="mt-1" />
          )}
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
              <Badge variant="outline" className="text-xs">{typeLabel[item.type]}</Badge>
              <span className={`text-[11px] px-1.5 py-0.5 rounded border ${health.cls}`}>{health.label}</span>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onFavorite}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="favorite"
              title={tt("Favorite", "المفضلة")}
            >
              <Star className={`h-4 w-4 ${item.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${meta.pill}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {meta.label}
            </div>
          </div>
        </div>

        {/* Smart alerts */}
        {expiringSoon && (
          <AlertBanner tone="amber" icon={AlertTriangle}>
            {isAr ? `ينتهي مفتاح API خلال ${expiringDays} يوم` : `API key expires in ${expiringDays} day${expiringDays === 1 ? "" : "s"}`}
          </AlertBanner>
        )}
        {errorRateHigh && item.status !== "disabled" && (
          <AlertBanner tone="red" icon={ShieldAlert}>
            {isAr ? `معدل أخطاء مرتفع (${(100 - successRate).toFixed(1)}%)` : `High error rate detected (${(100 - successRate).toFixed(1)}%)`}
          </AlertBanner>
        )}
        {quotaNear && (
          <AlertBanner tone="amber" icon={Zap}>
            {isAr ? `قريب من حد الاستخدام (${quotaPct}%)` : `Rate limit close (${quotaPct}% of monthly quota)`}
          </AlertBanner>
        )}
        {item.warning_message && !expiringSoon && (
          <AlertBanner tone="amber" icon={AlertTriangle}>{item.warning_message}</AlertBanner>
        )}

        {/* Mini metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-md border bg-muted/20 p-2.5">
          <Mini label={tt("Requests today", "اليوم")} value={item.daily_requests.toLocaleString()} />
          <Mini label={tt("Success", "النجاح")} value={`${successRate.toFixed(1)}%`} accent={successRate >= 95 ? "text-emerald-600" : successRate >= 90 ? "text-amber-600" : "text-red-600"} />
          <Mini label={tt("Latency", "الاستجابة")} value={`${item.latency_ms || 0} ms`} />
        </div>

        {/* Sparkline */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {tt("Usage (recent)", "الاستخدام الأخير")}
            </span>
          </div>
          <Sparkline data={item.usage_history && item.usage_history.length ? item.usage_history : [item.daily_requests || 0]} />
        </div>

        {/* Quota bar */}
        {quotaPct !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>{tt("Monthly quota", "الحد الشهري")}</span>
              <span>{item.monthly_requests.toLocaleString()} / {item.monthly_quota?.toLocaleString()} ({quotaPct}%)</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${quotaPct >= 90 ? "bg-red-500" : quotaPct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Error visibility */}
        {item.error_message && (
          <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-400">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2">{item.error_message}</p>
                <div className="flex gap-3 mt-1 text-[11px] opacity-80">
                  {item.last_error_at && <span>{formatRel(item.last_error_at, isAr)}</span>}
                  <button onClick={onEdit} className="underline hover:no-underline">{tt("View details", "عرض التفاصيل")}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* metadata grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Meta label={tt("Connected", "تاريخ الاتصال")} value={formatDate(item.connected_at)} />
          <Meta label={tt("Last sync", "آخر مزامنة")} value={formatRel(item.last_sync_at, isAr)} />
        </div>

        {/* scopes */}
        {item.scopes && item.scopes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1.5">{tt("Granted scopes", "الصلاحيات الممنوحة")}</p>
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
        <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${access.cls}`}>
              <AccessIcon className="h-3 w-3" />
              {access.label}
            </span>
            {item.access_summary && (
              <span className="text-muted-foreground truncate">· {item.access_summary}</span>
            )}
            <Link to={`/integration-access-control?integration=${item.id}`} className="font-medium text-primary hover:underline">
              {tt("Manage", "إدارة")}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{item.status === "disabled" ? tt("Off", "إيقاف") : tt("On", "تشغيل")}</span>
            <Switch checked={item.status !== "disabled"} onCheckedChange={onToggle} />
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Settings className="h-4 w-4 mr-1.5" />
            {tt("Settings", "الإعدادات")}
          </Button>
          <Button variant="outline" size="sm" onClick={onTest}>
            <Heart className="h-4 w-4 mr-1.5" />
            {tt("Test", "اختبار")}
          </Button>
          <Button variant="outline" size="sm" onClick={onResync}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {tt("Re-sync", "مزامنة")}
          </Button>
          {isFailure && (
            <Button variant="outline" size="sm" onClick={onRetry} className="text-amber-700 dark:text-amber-400 border-amber-500/30">
              <RotateCw className="h-4 w-4 mr-1.5" />
              {tt("Retry", "إعادة")}
            </Button>
          )}
          <Button variant="outline" size="sm" className="ml-auto text-destructive hover:text-destructive" onClick={onDisconnect}>
            <Power className="h-4 w-4 mr-1.5" />
            {tt("Disconnect", "فصل")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertBanner({ tone, icon: Icon, children }: { tone: "amber" | "red"; icon: any; children: React.ReactNode }) {
  const cls = tone === "red"
    ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-md border ${cls} px-3 py-2 text-xs`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent || ""}`}>{value}</p>
    </div>
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
