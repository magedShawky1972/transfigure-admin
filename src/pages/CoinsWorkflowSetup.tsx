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
import { Plus, Trash2, Settings, ChevronDown, ChevronRight } from "lucide-react";

const PHASES = [
  { key: "creation", ar: "إنشاء", en: "Creation" },
  { key: "sending", ar: "توجيه", en: "Sending" },
  { key: "receiving", ar: "استلام", en: "Receiving" },
  { key: "coins_entry", ar: "إدخال العملات", en: "Coins Entry" },
];

const CoinsWorkflowSetup = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-workflow-setup");

  const [brands, setBrands] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

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

  // Initialize all phases as expanded
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
  };

  const fetchAssignments = async () => {
    let query = supabase.from("coins_workflow_assignments").select("*").order("created_at", { ascending: false });
    if (filterBrandId && filterBrandId !== "all") query = query.eq("brand_id", filterBrandId);
    const { data } = await query;
    if (data) setAssignments(data);
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
    await supabase.from("coins_workflow_assignments").delete().eq("id", id);
    toast.success(isArabic ? "تم الحذف" : "Deleted");
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

  // Group by phase -> user
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

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{isArabic ? "إعداد سير عمل العملات" : "Coins Workflow Setup"}</h1>
      </div>

      {/* Add New Assignment */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "إضافة مسؤول جديد" : "Add New Assignment"}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>{isArabic ? "العلامات التجارية" : "Brands"}</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
                {selectedBrandIds.map(id => {
                  const brand = brands.find(b => b.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-sm">
                      {brand?.brand_name}
                      <button type="button" className="hover:text-destructive" onClick={() => setSelectedBrandIds(prev => prev.filter(b => b !== id))}>×</button>
                    </span>
                  );
                })}
              </div>
              <Select value="" onValueChange={(val) => { if (!selectedBrandIds.includes(val)) setSelectedBrandIds(prev => [...prev, val]); }}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر علامة تجارية" : "Select brand"} /></SelectTrigger>
                <SelectContent>{brands.filter(b => !selectedBrandIds.includes(b.id)).map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}</SelectContent>
              </Select>
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
                      const isUserOpen = expandedPhases[userKey] ?? true;
                      const items = phaseUsers[userId];
                      const displayName = getUserDisplay(items[0]);

                      return (
                        <Collapsible key={userId} open={isUserOpen} onOpenChange={() => togglePhase(userKey)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/30 border-t">
                              {isUserOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium text-sm">{displayName}</span>
                              <span className="text-xs text-muted-foreground">({items.length})</span>
                            </div>
                          </CollapsibleTrigger>
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
