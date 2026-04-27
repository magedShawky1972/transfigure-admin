import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, ArrowLeft, Save, Plus, Trash2, Users, UserCircle, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type TargetType = "user" | "role" | "group";

interface Integration { id: string; name: string; status: string; }
interface AccessRow {
  id: string;
  integration_id: string;
  target_type: TargetType;
  target_id: string;
  target_label: string | null;
  enabled: boolean;
}
interface UserOpt { user_id: string; user_name: string; }
interface GroupOpt { id: string; group_name: string; }

export default function IntegrationAccessControl() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const tt = (en: string, ar: string) => (isAr ? ar : en);

  const ROLES: Array<{ value: string; label: string }> = [
    { value: "admin", label: tt("Admin", "مدير") },
    { value: "moderator", label: tt("Moderator", "مشرف") },
    { value: "user", label: tt("User", "مستخدم") },
  ];

  const TYPE_META: Record<TargetType, { label: string; icon: any }> = {
    user:  { label: tt("User", "مستخدم"), icon: UserCircle },
    role:  { label: tt("Role", "دور"),    icon: Shield },
    group: { label: tt("Group", "مجموعة"), icon: Users },
  };

  const { hasAccess, isLoading: accessLoading } = usePageAccess("/integration-access-control");
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // add row controls
  const [newType, setNewType] = useState<TargetType>("role");
  const [newTargetId, setNewTargetId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [intRes, usersRes, groupsRes] = await Promise.all([
        supabase.from("integrations").select("id,name,status").order("name"),
        supabase.from("profiles").select("user_id,user_name").order("user_name").limit(500),
        supabase.from("user_groups" as any).select("id,group_name").order("group_name").limit(200),
      ]);
      const list = (intRes.data as any) || [];
      setIntegrations(list);
      setUsers(((usersRes.data as any) || []).filter((u: UserOpt) => u.user_id && u.user_name));
      setGroups(((groupsRes.data as any) || []).filter((g: GroupOpt) => g.id));
      const initial = searchParams.get("integration") || list[0]?.id || "";
      setSelectedId(initial);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) { setRows([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from("integration_access")
        .select("*")
        .eq("integration_id", selectedId)
        .order("target_type");
      if (error) {
        toast({ title: "فشل تحميل الصلاحيات", description: error.message, variant: "destructive" });
        return;
      }
      setRows((data as any) || []);
      setDirty({});
    })();
  }, [selectedId]);

  const selectedIntegration = useMemo(
    () => integrations.find((i) => i.id === selectedId),
    [integrations, selectedId],
  );

  const grouped = useMemo(() => {
    const g: Record<TargetType, AccessRow[]> = { role: [], group: [], user: [] };
    rows.forEach((r) => g[r.target_type].push(r));
    return g;
  }, [rows]);

  const onPick = (id: string) => {
    setSelectedId(id);
    setSearchParams(id ? { integration: id } : {});
  };

  const toggleRow = (id: string, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: value } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const removeRow = async (row: AccessRow) => {
    const { error } = await supabase.from("integration_access").delete().eq("id", row.id);
    if (error) {
      toast({ title: tt("Remove failed", "فشل الحذف"), description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast({ title: tt("Removed", "تم الحذف") });
  };

  const addRow = async () => {
    if (!selectedId || !newTargetId) {
      toast({ title: "اختر هدفاً", variant: "destructive" });
      return;
    }
    let label = newTargetId;
    if (newType === "user") label = users.find((u) => u.user_id === newTargetId)?.user_name || newTargetId;
    if (newType === "group") label = groups.find((g) => g.id === newTargetId)?.group_name || newTargetId;
    if (newType === "role") label = ROLES.find((r) => r.value === newTargetId)?.label || newTargetId;

    const { data, error } = await supabase
      .from("integration_access")
      .insert({
        integration_id: selectedId,
        target_type: newType,
        target_id: newTargetId,
        target_label: label,
        enabled: true,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "فشل الإضافة", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => [...prev, data as any]);
    setNewTargetId("");
    toast({ title: "تمت إضافة قاعدة الصلاحيات" });
  };

  const saveAll = async () => {
    const changed = rows.filter((r) => dirty[r.id]);
    if (changed.length === 0) {
      toast({ title: "لا يوجد ما يتم حفظه" });
      return;
    }
    setSaving(true);
    const updates = await Promise.all(
      changed.map((r) =>
        supabase.from("integration_access").update({ enabled: r.enabled }).eq("id", r.id),
      ),
    );
    setSaving(false);
    const failed = updates.filter((u) => u.error);
    if (failed.length) {
      toast({ title: "فشلت بعض التحديثات", description: failed[0].error!.message, variant: "destructive" });
      return;
    }
    setDirty({});
    toast({ title: "تم الحفظ", description: `تم تحديث ${changed.length} قاعدة` });
  };

  if (accessLoading || hasAccess === null) return <AccessDenied isLoading />;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            صلاحيات التكاملات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تفعيل أو تعطيل كل تكامل لكل مستخدم أو دور أو مجموعة
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/integrations"><ArrowLeft className="h-4 w-4 mr-2" />العودة إلى التكاملات</Link>
          </Button>
          <Button onClick={saveAll} disabled={saving || Object.keys(dirty).length === 0}>
            <Save className="h-4 w-4 mr-2" />
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">التكامل</CardTitle>
          <CardDescription>اختر تكاملاً لإعداد مصفوفة الصلاحيات الخاصة به</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">جارٍ التحميل…</p>
          ) : integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد تكاملات مُعدّة. <Link to="/integrations" className="text-primary hover:underline">أضف واحداً</Link> أولاً.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedId} onValueChange={onPick}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="اختر التكامل" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIntegration && (
                <Badge variant="outline">{selectedIntegration.status}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <>
          {/* Add rule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إضافة قاعدة صلاحية</CardTitle>
              <CardDescription>منح أو تقييد هذا التكامل لدور أو مجموعة أو مستخدم محدد</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={newType} onValueChange={(v) => { setNewType(v as TargetType); setNewTargetId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">دور</SelectItem>
                    <SelectItem value="group">مجموعة</SelectItem>
                    <SelectItem value="user">مستخدم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex gap-2 items-end">
                <div className="flex-1">
                  <Label>الهدف</Label>
                  <Select value={newTargetId} onValueChange={setNewTargetId}>
                    <SelectTrigger><SelectValue placeholder="اختر…" /></SelectTrigger>
                    <SelectContent>
                      {newType === "role" && ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                      {newType === "group" && groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.group_name}</SelectItem>
                      ))}
                      {newType === "user" && users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addRow}><Plus className="h-4 w-4 mr-1" />إضافة</Button>
              </div>
            </CardContent>
          </Card>

          {/* Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مصفوفة الصلاحيات</CardTitle>
              <CardDescription>قم بتبديل الوصول. اضغط حفظ التغييرات عند الانتهاء.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="role">
                <TabsList>
                  <TabsTrigger value="role">الأدوار ({grouped.role.length})</TabsTrigger>
                  <TabsTrigger value="group">المجموعات ({grouped.group.length})</TabsTrigger>
                  <TabsTrigger value="user">المستخدمون ({grouped.user.length})</TabsTrigger>
                </TabsList>
                {(["role", "group", "user"] as TargetType[]).map((t) => (
                  <TabsContent key={t} value={t}>
                    <MatrixSection
                      rows={grouped[t]}
                      type={t}
                      dirty={dirty}
                      onToggle={toggleRow}
                      onRemove={removeRow}
                      typeMeta={TYPE_META}
                      isAr={isAr}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MatrixSection({
  rows, type, dirty, onToggle, onRemove, typeMeta, isAr,
}: {
  rows: AccessRow[];
  type: TargetType;
  dirty: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  onRemove: (row: AccessRow) => void;
  typeMeta: Record<TargetType, { label: string; icon: any }>;
  isAr: boolean;
}) {
  const Icon = typeMeta[type].icon;
  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        {isAr
          ? `لا توجد قواعد ${typeMeta[type].label} بعد. أضف واحدة بالأعلى.`
          : `No ${typeMeta[type].label.toLowerCase()} rules yet. Add one above.`}
      </div>
    );
  }
  return (
    <ul className="divide-y border rounded-md">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{r.target_label || r.target_id}</p>
            <p className="text-xs text-muted-foreground">{typeMeta[type].label}</p>
          </div>
          {dirty[r.id] && <Badge variant="outline" className="text-xs">{isAr ? "غير محفوظ" : "Unsaved"}</Badge>}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{r.enabled ? (isAr ? "مفعّل" : "Enabled") : (isAr ? "معطّل" : "Disabled")}</span>
            <Switch checked={r.enabled} onCheckedChange={(v) => onToggle(r.id, v)} />
          </div>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onRemove(r)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
