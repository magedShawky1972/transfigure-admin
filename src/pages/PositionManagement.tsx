import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Briefcase, Users, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";

interface JobPosition {
  id: string;
  position_name: string;
  position_name_ar: string | null;
  department_id: string | null;
  is_active: boolean;
  position_level: number | null;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: string;
  department_name: string;
  department_name_ar: string | null;
  department_code: string;
}

interface LinkedEmployee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  employee_number: string;
  employment_status: string;
  department_id: string | null;
}

const PositionManagement = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("positionManagement");
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeesByPosition, setEmployeesByPosition] = useState<Record<string, LinkedEmployee[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(null);
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [formData, setFormData] = useState({
    position_name: "",
    position_name_ar: "",
    department_id: "",
    position_level: 0,
    is_active: true,
  });

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [posRes, deptRes, empRes] = await Promise.all([
        supabase
          .from("job_positions")
          .select("*")
          .order("position_level", { ascending: true, nullsFirst: false })
          .order("position_name"),
        supabase
          .from("departments")
          .select("id, department_name, department_name_ar, department_code")
          .eq("is_active", true)
          .order("department_name"),
        supabase
          .from("employees")
          .select("id, first_name, last_name, first_name_ar, last_name_ar, employee_number, employment_status, job_position_id, department_id")
          .not("job_position_id", "is", null),
      ]);

      if (posRes.error) throw posRes.error;
      if (deptRes.error) throw deptRes.error;
      if (empRes.error) throw empRes.error;

      setPositions(posRes.data || []);
      setDepartments(deptRes.data || []);

      // Group employees by position
      const grouped: Record<string, LinkedEmployee[]> = {};
      (empRes.data || []).forEach((emp: any) => {
        if (!grouped[emp.job_position_id]) {
          grouped[emp.job_position_id] = [];
        }
        grouped[emp.job_position_id].push(emp);
      });
      setEmployeesByPosition(grouped);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (positionId: string) => {
    setExpandedPositions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  };

  const openAddDialog = () => {
    setSelectedPosition(null);
    setFormData({
      position_name: "",
      position_name_ar: "",
      department_id: "",
      position_level: 0,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (position: JobPosition) => {
    setSelectedPosition(position);
    setFormData({
      position_name: position.position_name,
      position_name_ar: position.position_name_ar || "",
      department_id: position.department_id || "",
      position_level: position.position_level ?? 0,
      is_active: position.is_active,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (position: JobPosition) => {
    setSelectedPosition(position);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.position_name.trim()) {
      toast.error(language === "ar" ? "اسم الوظيفة مطلوب" : "Position name is required");
      return;
    }

    try {
      const positionData = {
        position_name: formData.position_name.trim(),
        position_name_ar: formData.position_name_ar.trim() || null,
        department_id: formData.department_id || null,
        position_level: formData.position_level,
        is_active: formData.is_active,
      };

      if (selectedPosition) {
        const { error } = await supabase
          .from("job_positions")
          .update(positionData)
          .eq("id", selectedPosition.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الوظيفة بنجاح" : "Position updated successfully");
      } else {
        const { error } = await supabase
          .from("job_positions")
          .insert(positionData);

        if (error) throw error;
        toast.success(language === "ar" ? "تمت إضافة الوظيفة بنجاح" : "Position added successfully");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving position:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الوظيفة" : "Error saving position");
    }
  };

  const handleDelete = async () => {
    if (!selectedPosition) return;

    const linkedCount = employeesByPosition[selectedPosition.id]?.length || 0;
    if (linkedCount > 0) {
      toast.error(
        language === "ar"
          ? `لا يمكن حذف الوظيفة - مرتبطة بـ ${linkedCount} موظف`
          : `Cannot delete position - linked to ${linkedCount} employee(s)`
      );
      setDeleteDialogOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("job_positions")
        .delete()
        .eq("id", selectedPosition.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الوظيفة بنجاح" : "Position deleted successfully");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error deleting position:", error);
      toast.error(language === "ar" ? "خطأ في حذف الوظيفة" : "Error deleting position");
    }
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return language === "ar" ? "بدون قسم" : "No Department";
    const dept = departments.find((d) => d.id === departmentId);
    if (!dept) return "-";
    return language === "ar" && dept.department_name_ar ? dept.department_name_ar : dept.department_name;
  };

  const getEmployeeName = (emp: LinkedEmployee) => {
    if (language === "ar" && emp.first_name_ar) {
      return `${emp.first_name_ar} ${emp.last_name_ar || ""}`.trim();
    }
    return `${emp.first_name} ${emp.last_name}`.trim();
  };

  const filteredPositions = positions.filter((pos) => {
    const matchesSearch =
      pos.position_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pos.position_name_ar || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !filterDepartment || pos.department_id === filterDepartment;
    return matchesSearch && matchesDept;
  });

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {language === "ar" ? "إدارة الوظائف" : "Position Management"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 me-2" />
            {language === "ar" ? "إضافة وظيفة" : "Add Position"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Input
              placeholder={language === "ar" ? "بحث بالاسم..." : "Search by name..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === "ar" ? "كل الأقسام" : "All Departments"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{language === "ar" ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {language === "ar" && dept.department_name_ar ? dept.department_name_ar : dept.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{language === "ar" ? "اسم الوظيفة" : "Position Name"}</TableHead>
                  <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "المستوى" : "Level"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "الموظفين" : "Employees"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPositions.map((position) => {
                  const employees = employeesByPosition[position.id] || [];
                  const isExpanded = expandedPositions.has(position.id);
                  
                  return (
                    <Collapsible key={position.id} open={isExpanded} asChild>
                      <>
                        <TableRow className="hover:bg-muted/50">
                          <TableCell>
                            {employees.length > 0 && (
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleExpand(position.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{position.position_name}</p>
                              {position.position_name_ar && (
                                <p className="text-sm text-muted-foreground">{position.position_name_ar}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {getDepartmentName(position.department_id)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{position.position_level ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              <Users className="h-3 w-3 me-1" />
                              {employees.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={position.is_active ? "default" : "destructive"}>
                              {position.is_active
                                ? language === "ar" ? "نشط" : "Active"
                                : language === "ar" ? "غير نشط" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon" onClick={() => openEditDialog(position)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                onClick={() => openDeleteDialog(position)}
                                disabled={employees.length > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="p-0">
                              <div className="p-4 ps-12">
                                <p className="text-sm font-medium mb-2">
                                  {language === "ar" ? "الموظفون المرتبطون:" : "Linked Employees:"}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {employees.map((emp) => (
                                    <div
                                      key={emp.id}
                                      className="flex items-center justify-between p-2 bg-background rounded-lg border"
                                    >
                                      <div>
                                        <p className="font-medium text-sm">{getEmployeeName(emp)}</p>
                                        <p className="text-xs text-muted-foreground">{emp.employee_number}</p>
                                      </div>
                                      <Badge
                                        variant={emp.employment_status === "active" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {emp.employment_status === "active"
                                          ? language === "ar" ? "نشط" : "Active"
                                          : language === "ar" ? "غير نشط" : "Inactive"}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
                {filteredPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد وظائف" : "No positions found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPosition
                ? language === "ar" ? "تعديل الوظيفة" : "Edit Position"
                : language === "ar" ? "إضافة وظيفة" : "Add Position"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم بالإنجليزية" : "English Name"} *</Label>
              <Input
                value={formData.position_name}
                onChange={(e) => setFormData({ ...formData, position_name: e.target.value })}
                placeholder={language === "ar" ? "أدخل الاسم بالإنجليزية" : "Enter English name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم بالعربية" : "Arabic Name"}</Label>
              <Input
                value={formData.position_name_ar}
                onChange={(e) => setFormData({ ...formData, position_name_ar: e.target.value })}
                placeholder={language === "ar" ? "أدخل الاسم بالعربية" : "Enter Arabic name"}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "القسم" : "Department"}</Label>
              <Select
                value={formData.department_id || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, department_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === "ar" ? "بدون قسم" : "No department"}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {language === "ar" && dept.department_name_ar ? dept.department_name_ar : dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "المستوى الوظيفي" : "Position Level"}</Label>
              <Input
                type="number"
                min={0}
                value={formData.position_level}
                onChange={(e) => setFormData({ ...formData, position_level: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "0 = أعلى مستوى (رئيس)" : "0 = Highest level (CEO)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {selectedPosition
                ? language === "ar" ? "تحديث" : "Update"
                : language === "ar" ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p>
            {language === "ar"
              ? `هل أنت متأكد من حذف الوظيفة "${selectedPosition?.position_name}"؟`
              : `Are you sure you want to delete the position "${selectedPosition?.position_name}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {language === "ar" ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PositionManagement;
