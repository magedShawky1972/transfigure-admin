import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Trash2, Settings, ChevronDown, ChevronRight, Eye, Shield } from "lucide-react";

const PHASES = [
  { key: "creation", ar: "إنشاء", en: "Creation" },
  { key: "sending", ar: "توجيه", en: "Sending" },
  { key: "receiving", ar: "استلام", en: "Receiving" },
  { key: "coins_entry", ar: "إدخال الكوينز", en: "Coins Entry" },
];

const CoinsWorkflowSetup = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-workflow-setup");

  const [brands, setBrands] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [selectedSupervisorUserId, setSelectedSupervisorUserId] = useState("");
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedPhase, setSelectedPhase] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterBrandId, setFilterBrandId] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [filterBrandId]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    PHASES.forEach(p => { initial[p.key] = true; });
    setExpandedPhases(initial);
  }, []);

  const fetchData = async () => {
    const [brandRes, userRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("profiles").select("id, user_id, user_name, email").order("user_name"),
    ]);
    if (brandRes.data) setBrands(brandRes.data);
    if (userRes.data) setUsers(userRes.data);
    fetchAssignments();
    fetchSupervisors();
  };

  const fetchSupervisors = async () => {
    const { data } = await supabase.from("coins_workflow_supervisors").select("*").eq("is_active", true).order("created_at");
    if (data) setSupervisors(data);
  };

  const fetchAssignments = async () => {
    let query = supabase.from("coins_workflow_assignments").select("*").order("created_at", { ascending: false });
    if (filterBrandId && filterBrandId !== "all") query = query.eq("brand_id", filterBrandId);
    const { data } = await query;
    if (data) setAssignments(data);
  };

  const handleAddSupervisor = async () => {
    if (!selectedSupervisorUserId) {
      toast.error(isArabic ? "يرجى اختيار المستخدم" : "Please select a user");
      return;
    }
    setSavingSupervisor(true);
    try {
      const user = users.find(u => u.user_id === selectedSupervisorUserId || u.id === selectedSupervisorUserId);
      const { error } = await supabase.from("coins_workflow_supervisors").insert({
        user_id: selectedSupervisorUserId,
        user_name: user?.user_name || user?.email || "",
      });
      if (error) throw error;
      toast.success(isArabic ? "تمت إضافة المشرف بنجاح" : "Supervisor added successfully");
      setSelectedSupervisorUserId("");
      fetchSupervisors();
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
        toast.error(isArabic ? "المشرف موجود بالفعل" : "Supervisor already exists");
      } else {
        toast.error(err.message || "Error");
      }
    } finally {
      setSavingSupervisor(false);
    }
  };

  const handleDeleteSupervisor = async (id: string) => {
    await supabase.from("coins_workflow_supervisors").delete().eq("id", id);
    toast.success(isArabic ? "تم حذف المشرف" : "Supervisor removed");
    fetchSupervisors();
  };

  const handleAdd = async () => {
    if (selectedBrandIds.length === 0 || !selectedPhase || !selectedUserId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول" : "Please fill all fields");
      return;
    }
    setSaving(true);
    try {
      const user = users.find(u => u.user_id === selectedUserId || u.id === selectedUserId);
      const inserts = selectedBrandIds.map(brandId => ({
        brand_id: brandId,
        phase: selectedPhase,
        user_id: selectedUserId,
        user_name: user?.user_name || user?.email || "",
      }));
      const { error } = await supabase.from("coins_workflow_assignments").insert(inserts);
      if (error) throw error;
      toast.success(isArabic ? "تمت الإضافة بنجاح" : "Added successfully");

      const phaseLabel = getPhaseLabel(selectedPhase);
      const allBrandNames = selectedBrandIds.map(id => brands.find(b => b.id === id)?.brand_name || "").filter(Boolean);
      const isAllBrands = selectedBrandIds.length === brands.length && brands.length > 0;
      const brandNameDisplay = isAllBrands
        ? (isArabic ? "جميع العلامات التجارية" : "All Brands")
        : allBrandNames.join(", ");
      supabase.functions.invoke("send-coins-workflow-notification", {
        body: {
          type: "assignment_added",
          userId: selectedUserId,
          userName: user?.user_name || user?.email || "",
          brandName: brandNameDisplay,
          phase: selectedPhase,
          phaseLabel,
        },
      }).catch(err => console.error("Notification error:", err));

      setSelectedBrandIds([]); setSelectedPhase(""); setSelectedUserId("");
      fetchAssignments();
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
        toast.error(isArabic ? "بعض التعيينات موجودة بالفعل" : "Some assignments already exist");
      } else {
        toast.error(err.message || "Error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const assignment = assignments.find(a => a.id === id);
    await supabase.from("coins_workflow_assignments").delete().eq("id", id);
    toast.success(isArabic ? "تم الحذف" : "Deleted");

    if (assignment) {
      const brand = brands.find(b => b.id === assignment.brand_id);
      supabase.functions.invoke("send-coins-workflow-notification", {
        body: {
          type: "assignment_removed",
          userId: assignment.user_id,
          userName: assignment.user_name || "",
          brandName: brand?.brand_name || "",
          phase: assignment.phase,
          phaseLabel: getPhaseLabel(assignment.phase),
        },
      }).catch(err => console.error("Notification error:", err));
    }

    fetchAssignments();
  };

  const handleDeleteUserAssignments = async (phaseKey: string, userId: string, items: any[]) => {
    if (!confirm(isArabic ? "هل أنت متأكد من حذف جميع العلامات التجارية لهذا المستخدم؟" : "Are you sure you want to delete all brands for this user?")) return;
    const ids = items.map((a: any) => a.id);
    await supabase.from("coins_workflow_assignments").delete().in("id", ids);
    toast.success(isArabic ? "تم حذف جميع التعيينات" : "All assignments deleted");
    fetchAssignments();
  };

  const getBrandName = (id: string) => brands.find(b => b.id === id)?.brand_name || id;
  const getPhaseLabel = (key: string) => {
    const p = PHASES.find(ph => ph.key === key);
    return isArabic ? p?.ar || key : p?.en || key;
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, Record<string, any[]>> = {};
    PHASES.forEach(p => { grouped[p.key] = {}; });
    assignments.forEach(a => {
      if (!grouped[a.phase]) grouped[a.phase] = {};
      const uid = a.user_id || "unknown";
      if (!grouped[a.phase][uid]) grouped[a.phase][uid] = [];
      grouped[a.phase][uid].push(a);
    });
    return grouped;
  }, [assignments]);

  const getPhaseCount = (phaseKey: string) => {
    const usersMap = groupedAssignments[phaseKey] || {};
    return Object.values(usersMap).reduce((sum, arr) => sum + arr.length, 0);
  };

  const getUserDisplay = (a: any) => {
    if (a.user_name) return a.user_name;
    const user = users.find(u => u.user_id === a.user_id || u.id === a.user_id);
    return user?.user_name || user?.email || a.user_id;
  };

  const getSupervisorDisplay = (s: any) => {
    if (s.user_name) return s.user_name;
    const user = users.find(u => u.user_id === s.user_id || u.id === s.user_id);
    return user?.user_name || user?.email || s.user_id;
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{isArabic ? "إعداد سير عمل الكوينز" : "Coins Workflow Setup"}</h1>
      </div>

      {/* Supervisors Section */}
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Eye className="h-5 w-5" />
            {isArabic ? "المشرفين على سير العمل" : "Workflow Supervisors"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "المشرفين يتلقون إشعارات عند كل مرحلة وتنبيهات عند التأخير أكثر من يوم"
              : "Supervisors receive notifications at every phase transition and delay alerts after 1+ day"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1 space-y-2">
              <Label>{isArabic ? "اختيار مشرف" : "Select Supervisor"}</Label>
              <Select value={selectedSupervisorUserId} onValueChange={setSelectedSupervisorUserId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المستخدم" : "Select user"} /></SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => !supervisors.some(s => s.user_id === (u.user_id || u.id)))
                    .map(u => (
                      <SelectItem key={u.user_id || u.id} value={u.user_id || u.id}>
                        {u.user_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddSupervisor} disabled={savingSupervisor}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة مشرف" : "Add Supervisor"}
            </Button>
          </div>

          {supervisors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "المشرف" : "Supervisor"}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">{getSupervisorDisplay(s)}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSupervisor(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              {isArabic ? "لم يتم إضافة مشرفين بعد" : "No supervisors added yet"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Assignment */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "إضافة مسؤول جديد" : "Add New Assignment"}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>{isArabic ? "العلامات التجارية" : "Brands"}</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                {selectedBrandIds.length === brands.length && brands.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium">
                    {isArabic ? "جميع العلامات التجارية" : "All Brands"}
                    <button type="button" className="hover:text-destructive" onClick={() => setSelectedBrandIds([])}>×</button>
                  </span>
                ) : (
                  selectedBrandIds.map(id => {
                    const brand = brands.find(b => b.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm">
                        {brand?.brand_name}
                        <button type="button" className="hover:text-destructive" onClick={() => setSelectedBrandIds(prev => prev.filter(b => b !== id))}>×</button>
                      </span>
                    );
                  })
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value="" onValueChange={(val) => { if (!selectedBrandIds.includes(val)) setSelectedBrandIds(prev => [...prev, val]); }}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر علامة تجارية" : "Select brand"} /></SelectTrigger>
                  <SelectContent>{brands.filter(b => !selectedBrandIds.includes(b.id)).map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setSelectedBrandIds(brands.map(b => b.id))}
                  disabled={selectedBrandIds.length === brands.length}
                >
                  {isArabic ? "الكل" : "All"}
                </Button>
                {selectedBrandIds.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedBrandIds([])}>
                    {isArabic ? "مسح" : "Clear"}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المرحلة" : "Phase"}</Label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر" : "Select"} /></SelectTrigger>
                <SelectContent>{PHASES.map(p => <SelectItem key={p.key} value={p.key}>{isArabic ? p.ar : p.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المستخدم" : "User"}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر" : "Select"} /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.user_id || u.id} value={u.user_id || u.id}>{u.user_name || u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة" : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>{isArabic ? "تصفية حسب العلامة:" : "Filter by Brand:"}</Label>
            <Select value={filterBrandId} onValueChange={setFilterBrandId}>
              <SelectTrigger className="w-64"><SelectValue placeholder={isArabic ? "الكل" : "All"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {filterBrandId && filterBrandId !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterBrandId("")}>{isArabic ? "مسح" : "Clear"}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grouped Assignments by Phase → Brand */}
      <div className="space-y-3">
        {PHASES.map(phase => {
          const phaseUsers = groupedAssignments[phase.key] || {};
          const userIds = Object.keys(phaseUsers);
          const isPhaseOpen = expandedPhases[phase.key] ?? true;

          return (
            <Card key={phase.key}>
              <Collapsible open={isPhaseOpen} onOpenChange={() => togglePhase(phase.key)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {isPhaseOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        {isArabic ? phase.ar : phase.en}
                        <span className="text-sm font-normal text-muted-foreground">({getPhaseCount(phase.key)})</span>
                      </CardTitle>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0 space-y-0">
                    {userIds.length === 0 ? (
                      <div className="text-center text-muted-foreground py-6">
                        {isArabic ? "لا توجد تعيينات" : "No assignments"}
                      </div>
                    ) : userIds.map(userId => {
                      const userKey = `${phase.key}_${userId}`;
                      const isUserOpen = expandedPhases[userKey] ?? false;
                      const items = phaseUsers[userId];
                      const displayName = getUserDisplay(items[0]);

                      return (
                        <Collapsible key={userId} open={isUserOpen} onOpenChange={() => togglePhase(userKey)}>
                          <div className="flex items-center justify-between px-4 py-2 border-t hover:bg-muted/30">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-2 cursor-pointer flex-1">
                                {isUserOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="font-medium text-sm">{displayName}</span>
                                <span className="text-xs text-muted-foreground">({items.length})</span>
                              </div>
                            </CollapsibleTrigger>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteUserAssignments(phase.key, userId, items)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <CollapsibleContent>
                            <Table>
                              <TableBody>
                                {items.map((a: any) => (
                                  <TableRow key={a.id}>
                                    <TableCell className={isArabic ? "pr-10" : "pl-10"}>{getBrandName(a.brand_id)}</TableCell>
                                    <TableCell className="w-12">
                                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CoinsWorkflowSetup;
