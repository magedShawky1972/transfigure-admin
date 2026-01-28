import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Users, Briefcase, Pencil, Trash2, UserPlus, X, GripVertical, Palette, RotateCcw, Save, Printer, ZoomIn, ZoomOut, UserMinus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import html2canvas from "html2canvas";
import PositionHierarchyDialog from "@/components/PositionHierarchyDialog";

const DEPARTMENT_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#64748b",
];

interface Department {
  id: string;
  department_name: string;
  department_code: string;
  parent_department_id: string | null;
  is_active: boolean;
  description: string | null;
  is_outsource: boolean;
  display_order?: number;
  color?: string;
  position_x?: number | null;
  position_y?: number | null;
}

interface JobPosition {
  id: string;
  position_name: string;
  position_name_ar: string | null;
  department_id: string | null;
  is_active: boolean;
  position_level: number | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  employee_number: string;
  job_position_id: string | null;
  department_id: string | null;
  photo_url: string | null;
  employment_status: string;
  user_id: string | null;
  email: string | null;
}

interface HierarchyAssignment {
  id: string;
  employee_id: string;
  department_id: string;
  job_position_id: string | null;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

const CompanyHierarchy = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hierarchyAssignments, setHierarchyAssignments] = useState<HierarchyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canEditUsers, setCanEditUsers] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Dialog states
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignToDeptDialogOpen, setAssignToDeptDialogOpen] = useState(false);
  const [positionHierarchyDialogOpen, setPositionHierarchyDialogOpen] = useState(false);
  const [selectedDeptForHierarchy, setSelectedDeptForHierarchy] = useState<Department | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingJob, setEditingJob] = useState<JobPosition | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [colorPickerDeptId, setColorPickerDeptId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [employeeEditForm, setEmployeeEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_position_id: null as string | null,
    department_id: null as string | null,
    photo_url: null as string | null,
  });
  const [savingEmployee, setSavingEmployee] = useState(false);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", parentId: "__none__" });
  const [jobForm, setJobForm] = useState({ name: "", departmentId: "", existingJobId: "" });
  const [jobMode, setJobMode] = useState<"existing" | "new">("existing");
  const [selectedJobEmployees, setSelectedJobEmployees] = useState<string[]>([]);
  const [deptEmployeeSearch, setDeptEmployeeSearch] = useState("");
  const [selectedDeptEmployees, setSelectedDeptEmployees] = useState<string[]>([]);

  const getEmployeeName = (emp: Employee) => {
    if (language === 'ar' && emp.first_name_ar) {
      return `${emp.first_name_ar} ${emp.last_name_ar || ''}`.trim();
    }
    return `${emp.first_name} ${emp.last_name}`.trim();
  };

  const handleOpenEmployeeProfile = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsEditingEmployee(false);
    setEmployeeDialogOpen(true);
  };

  const handleStartEditEmployee = () => {
    if (!selectedEmployee) return;
    setEmployeeEditForm({
      first_name: selectedEmployee.first_name,
      last_name: selectedEmployee.last_name,
      email: selectedEmployee.email || "",
      job_position_id: selectedEmployee.job_position_id,
      department_id: selectedEmployee.department_id,
      photo_url: selectedEmployee.photo_url,
    });
    setIsEditingEmployee(true);
  };

  const handleSaveEmployee = async () => {
    if (!selectedEmployee) return;
    setSavingEmployee(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          first_name: employeeEditForm.first_name,
          last_name: employeeEditForm.last_name,
          job_position_id: employeeEditForm.job_position_id,
          department_id: employeeEditForm.department_id,
          photo_url: employeeEditForm.photo_url,
        })
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم تحديث بيانات الموظف بنجاح' : 'Employee updated successfully',
      });

      // Update local state
      setEmployees(prev => prev.map(e => 
        e.id === selectedEmployee.id 
          ? { 
              ...e, 
              first_name: employeeEditForm.first_name,
              last_name: employeeEditForm.last_name,
              job_position_id: employeeEditForm.job_position_id,
              department_id: employeeEditForm.department_id,
              photo_url: employeeEditForm.photo_url,
            } 
          : e
      ));
      setSelectedEmployee(prev => prev ? {
        ...prev,
        first_name: employeeEditForm.first_name,
        last_name: employeeEditForm.last_name,
        job_position_id: employeeEditForm.job_position_id,
        department_id: employeeEditForm.department_id,
        photo_url: employeeEditForm.photo_url,
      } : null);
      setIsEditingEmployee(false);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEmployee(false);
    }
  };

  const getEmployeeJobPosition = (emp: Employee) => {
    if (emp.job_position_id) {
      return jobPositions.find(j => j.id === emp.job_position_id)?.position_name || null;
    }
    return null;
  };

  const getEmployeeDepartment = (emp: Employee) => {
    if (emp.department_id) {
      return departments.find(d => d.id === emp.department_id)?.department_name || null;
    }
    return null;
  };

  useEffect(() => {
    fetchData();
    checkUserSetupPermission();
  }, []);

  const checkUserSetupPermission = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminRole) {
        setCanEditUsers(true);
        return;
      }

      const { data: permission } = await supabase
        .from('user_permissions')
        .select('has_access')
        .eq('user_id', user.id)
        .eq('menu_item', 'employeeSetup')
        .maybeSingle();

      setCanEditUsers(permission?.has_access === true);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  };

  useEffect(() => {
    if (departments.length > 0 && !loading) {
      initializePositions();
    }
  }, [departments, loading]);

  const initializePositions = () => {
    const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);
    const newPositions = new Map<string, NodePosition>();
    
    // Sort departments: root departments first, then by hierarchy level
    const sortedDepts: Department[] = [];
    const addDeptWithChildren = (parentId: string | null) => {
      const children = activeDepts.filter(d => d.parent_department_id === parentId);
      children.forEach(child => {
        sortedDepts.push(child);
        addDeptWithChildren(child.id);
      });
    };
    addDeptWithChildren(null); // Start from root departments
    
    sortedDepts.forEach((dept) => {
      if (dept.position_x !== null && dept.position_y !== null && 
          dept.position_x !== undefined && dept.position_y !== undefined) {
        newPositions.set(dept.id, { id: dept.id, x: dept.position_x, y: dept.position_y });
      } else {
        const rootDepts = sortedDepts.filter(d => !d.parent_department_id);
        const isRoot = !dept.parent_department_id;
        
        if (isRoot) {
          const rootIndex = rootDepts.indexOf(dept);
          newPositions.set(dept.id, { 
            id: dept.id, 
            x: 100 + rootIndex * 300, 
            y: 50 
          });
        } else {
          const parentPos = newPositions.get(dept.parent_department_id!);
          const siblings = sortedDepts.filter(d => d.parent_department_id === dept.parent_department_id);
          const siblingIndex = siblings.indexOf(dept);
          
          if (parentPos) {
            newPositions.set(dept.id, {
              id: dept.id,
              x: parentPos.x + (siblingIndex - (siblings.length - 1) / 2) * 200,
              y: parentPos.y + 180
            });
          } else {
            const index = sortedDepts.indexOf(dept);
            newPositions.set(dept.id, { id: dept.id, x: 100 + index * 200, y: 50 + index * 100 });
          }
        }
      }
    });
    
    setNodePositions(newPositions);
  };

  const fetchData = async () => {
    try {
      const [deptRes, jobRes, empRes, assignRes] = await Promise.all([
        supabase.from("departments").select("*").order("display_order").order("department_name"),
        supabase.from("job_positions").select("id, position_name, position_name_ar, department_id, is_active, position_level").order("position_level", { ascending: true, nullsFirst: false }).order("position_name"),
        supabase.from("employees").select("id, first_name, last_name, first_name_ar, last_name_ar, employee_number, job_position_id, department_id, photo_url, employment_status, user_id, email").eq("employment_status", "active"),
        supabase.from("hierarchy_assignments").select("id, employee_id, department_id, job_position_id"),
      ]);

      if (deptRes.error) throw deptRes.error;
      if (jobRes.error) throw jobRes.error;
      if (empRes.error) throw empRes.error;
      if (assignRes.error) throw assignRes.error;

      setDepartments(deptRes.data || []);
      setJobPositions(jobRes.data || []);
      setEmployees(empRes.data || []);
      setHierarchyAssignments(assignRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, deptId: string) => {
    e.preventDefault();
    const pos = nodePositions.get(deptId);
    if (!pos) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDraggingId(deptId);
    setDragOffset({
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, e.clientX - rect.left - dragOffset.x);
    const newY = Math.max(0, e.clientY - rect.top - dragOffset.y);
    
    setNodePositions(prev => {
      const newMap = new Map(prev);
      newMap.set(draggingId, { id: draggingId, x: newX, y: newY });
      return newMap;
    });
  }, [draggingId, dragOffset]);

  const handleMouseUp = async () => {
    if (!draggingId) return;
    
    const pos = nodePositions.get(draggingId);
    if (pos) {
      try {
        await supabase.from("departments").update({
          position_x: pos.x,
          position_y: pos.y
        }).eq("id", draggingId);
      } catch (error) {
        console.error("Error saving position:", error);
      }
    }
    
    setDraggingId(null);
  };

  const handleResetPositions = async () => {
    try {
      const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);
      for (const dept of activeDepts) {
        await supabase.from("departments").update({
          position_x: null,
          position_y: null
        }).eq("id", dept.id);
      }
      
      setDepartments(prev => prev.map(d => ({ ...d, position_x: null, position_y: null })));
      setTimeout(() => initializePositions(), 100);
      
      toast({ title: language === 'ar' ? 'تم إعادة تعيين المواقع' : 'Positions reset' });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleColorChange = async (deptId: string, color: string) => {
    try {
      const { error } = await supabase.from("departments").update({ color }).eq("id", deptId);
      if (error) throw error;
      setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, color } : d));
      setColorPickerDeptId(null);
      toast({ title: language === 'ar' ? 'تم تحديث اللون' : 'Color updated' });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleAddDepartment = (parentId: string | null = null) => {
    setEditingDept(null);
    setDeptForm({ name: "", code: "", parentId: parentId || "__none__" });
    setDeptDialogOpen(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.department_name,
      code: dept.department_code,
      parentId: dept.parent_department_id || "__none__",
    });
    setDeptDialogOpen(true);
  };

  const handleSaveDepartment = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim()) {
      toast({ title: language === 'ar' ? "الاسم والرمز مطلوبان" : "Name and code are required", variant: "destructive" });
      return;
    }

    try {
      const data = {
        department_name: deptForm.name.trim(),
        department_code: deptForm.code.trim(),
        parent_department_id: deptForm.parentId === "__none__" ? null : deptForm.parentId,
      };

      if (editingDept) {
        const { error } = await supabase.from("departments").update(data).eq("id", editingDept.id);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم تحديث القسم" : "Department updated" });
      } else {
        const { error } = await supabase.from("departments").insert(data);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم إضافة القسم" : "Department added" });
      }

      setDeptDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    const hasChildren = departments.some(d => d.parent_department_id === deptId);
    const hasJobs = jobPositions.some(j => j.department_id === deptId);

    if (hasChildren || hasJobs) {
      toast({
        title: language === 'ar' ? "لا يمكن حذف القسم" : "Cannot delete department",
        description: language === 'ar' ? "القسم يحتوي على أقسام فرعية أو وظائف" : "Department has sub-departments or jobs",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("departments").delete().eq("id", deptId);
      if (error) throw error;
      toast({ title: language === 'ar' ? "تم حذف القسم" : "Department deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleAddJob = (departmentId: string) => {
    setEditingJob(null);
    setJobForm({ name: "", departmentId, existingJobId: "" });
    setJobMode("existing");
    setSelectedJobEmployees([]);
    setJobDialogOpen(true);
  };

  const handleEditJob = (job: JobPosition) => {
    setEditingJob(job);
    setJobForm({ name: job.position_name, departmentId: job.department_id || "", existingJobId: "" });
    setJobMode("new");
    setJobDialogOpen(true);
  };

  const handleSaveJob = async () => {
    if (!editingJob && jobMode === "existing" && jobForm.existingJobId) {
      try {
        const selectedJob = jobPositions.find(j => j.id === jobForm.existingJobId);
        if (!selectedJob) {
          toast({ title: language === 'ar' ? "الوظيفة غير موجودة" : "Job not found", variant: "destructive" });
          return;
        }
        
        if (selectedJobEmployees.length === 0) {
          toast({ title: language === 'ar' ? "اختر موظف واحد على الأقل" : "Select at least one employee", variant: "destructive" });
          return;
        }

        let targetJobId = jobForm.existingJobId;
        
        const { data: existingJobInDeptCheck } = await supabase
          .from("job_positions")
          .select("id")
          .eq("position_name", selectedJob.position_name)
          .eq("department_id", jobForm.departmentId)
          .maybeSingle();

        if (existingJobInDeptCheck) {
          targetJobId = existingJobInDeptCheck.id;
        } else {
          targetJobId = selectedJob.id;
          if (!selectedJob.department_id) {
            await supabase.from("job_positions").update({
              department_id: jobForm.departmentId,
            }).eq("id", selectedJob.id);
          }
        }

        for (const empId of selectedJobEmployees) {
          const { error } = await supabase.from("employees").update({
            job_position_id: targetJobId,
            department_id: jobForm.departmentId,
          }).eq("id", empId);
          
          if (error) throw error;
        }

        toast({ title: language === 'ar' ? "تم تعيين الوظيفة والموظفين" : "Job and employees assigned" });
        setJobDialogOpen(false);
        fetchData();
        return;
      } catch (error: any) {
        toast({ title: error.message, variant: "destructive" });
        return;
      }
    }

    if (!jobForm.name.trim()) {
      toast({ title: language === 'ar' ? "اسم الوظيفة مطلوب" : "Job name is required", variant: "destructive" });
      return;
    }

    try {
      const data = {
        position_name: jobForm.name.trim(),
        department_id: jobForm.departmentId || null,
      };

      if (editingJob) {
        const { error } = await supabase.from("job_positions").update(data).eq("id", editingJob.id);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم تحديث الوظيفة" : "Job updated" });
      } else {
        const { error } = await supabase.from("job_positions").insert(data);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم إضافة الوظيفة" : "Job added" });
      }

      setJobDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const getUniqueJobNames = () => {
    const uniqueNames = new Map<string, JobPosition>();
    jobPositions.filter(j => j.is_active).forEach(j => {
      if (!uniqueNames.has(j.position_name)) {
        uniqueNames.set(j.position_name, j);
      }
    });
    return Array.from(uniqueNames.values());
  };

  const getEmployeesWithJobName = (jobId: string) => {
    const job = jobPositions.find(j => j.id === jobId);
    if (!job) return [];
    const jobIds = jobPositions.filter(j => j.position_name === job.position_name).map(j => j.id);
    return employees.filter(e => e.job_position_id && jobIds.includes(e.job_position_id));
  };

  const handleJobSelectionChange = (jobId: string) => {
    setJobForm({ ...jobForm, existingJobId: jobId });
    const empsWithJob = getEmployeesWithJobName(jobId);
    setSelectedJobEmployees(empsWithJob.map(e => e.id));
  };

  const toggleEmployeeSelection = (empId: string) => {
    setSelectedJobEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleDeleteJob = async (jobId: string) => {
    const hasEmployees = employees.some(e => e.job_position_id === jobId);
    if (hasEmployees) {
      toast({
        title: language === 'ar' ? "لا يمكن حذف الوظيفة" : "Cannot delete job",
        description: language === 'ar' ? "الوظيفة مرتبطة بموظفين" : "Job has assigned employees",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("job_positions").delete().eq("id", jobId);
      if (error) throw error;
      toast({ title: language === 'ar' ? "تم حذف الوظيفة" : "Job deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleOpenAssignEmployee = (jobId: string, departmentId: string) => {
    setSelectedJobId(jobId);
    setSelectedDeptId(departmentId);
    setAssignUserDialogOpen(true);
  };

  const handleOpenAssignToDept = (departmentId: string) => {
    setSelectedDeptId(departmentId);
    setAssignToDeptDialogOpen(true);
  };

  const handleOpenPositionHierarchy = (dept: Department) => {
    setSelectedDeptForHierarchy(dept);
    setPositionHierarchyDialogOpen(true);
  };

  const handleAssignEmployeeToJob = async (empId: string) => {
    if (!selectedJobId || !selectedDeptId) return;

    try {
      // Use upsert to handle existing assignments
      const { error } = await supabase.from("hierarchy_assignments").upsert({
        employee_id: empId,
        department_id: selectedDeptId,
        job_position_id: selectedJobId,
      }, { onConflict: 'employee_id,department_id' });

      if (error) throw error;
      
      setAssignUserDialogOpen(false);
      await fetchData();
      toast({ title: language === 'ar' ? 'تم تعيين الموظف بنجاح' : 'Employee assigned successfully' });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleAssignEmployeesToDept = async () => {
    if (!selectedDeptId || selectedDeptEmployees.length === 0) return;

    try {
      const assignments = selectedDeptEmployees.map(empId => ({
        employee_id: empId,
        department_id: selectedDeptId,
        job_position_id: null,
      }));

      const { error } = await supabase.from("hierarchy_assignments").upsert(
        assignments,
        { onConflict: 'employee_id,department_id' }
      );

      if (error) throw error;
      toast({ 
        title: language === 'ar' 
          ? `تم تعيين ${selectedDeptEmployees.length} موظف للقسم` 
          : `${selectedDeptEmployees.length} employee(s) assigned to department` 
      });
      setAssignToDeptDialogOpen(false);
      setSelectedDeptEmployees([]);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const toggleDeptEmployeeSelection = (empId: string) => {
    setSelectedDeptEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleRemoveEmployeeFromDept = async (empId: string, empName: string, deptId: string) => {
    try {
      const { error } = await supabase.from("hierarchy_assignments")
        .delete()
        .eq("employee_id", empId)
        .eq("department_id", deptId);

      if (error) throw error;
      toast({ title: language === 'ar' ? `تم إزالة ${empName} من القسم` : `${empName} removed from department` });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const getJobsForDepartment = (deptId: string) => {
    const jobIdsWithEmpsInDept = new Set(
      hierarchyAssignments
        .filter(a => a.department_id === deptId && a.job_position_id)
        .map(a => a.job_position_id)
    );
    
    return jobPositions.filter(j => 
      j.is_active && (j.department_id === deptId || jobIdsWithEmpsInDept.has(j.id))
    );
  };

  const getEmployeesForJob = (jobId: string, departmentId: string) => {
    const assignedEmpIds = hierarchyAssignments
      .filter(a => a.job_position_id === jobId && a.department_id === departmentId)
      .map(a => a.employee_id);
    return employees.filter(e => assignedEmpIds.includes(e.id));
  };

  const getEmployeesDirectlyInDepartment = (deptId: string) => {
    const assignedEmpIds = hierarchyAssignments
      .filter(a => a.department_id === deptId && !a.job_position_id)
      .map(a => a.employee_id);
    return employees.filter(e => assignedEmpIds.includes(e.id));
  };

  // Get job position info for an employee
  const getJobPositionInfo = (emp: Employee) => {
    if (!emp.job_position_id) return null;
    return jobPositions.find(j => j.id === emp.job_position_id) || null;
  };

  // Group employees by their position level for a department
  const getEmployeesGroupedByLevel = (deptId: string) => {
    // Get all employees in this department (both via hierarchy_assignments and department_id)
    const assignedEmpIds = hierarchyAssignments
      .filter(a => a.department_id === deptId)
      .map(a => a.employee_id);
    
    const deptEmployees = employees.filter(e => 
      assignedEmpIds.includes(e.id) || e.department_id === deptId
    );
    
    // Group by position level
    const grouped = new Map<number, { job: JobPosition | null; employees: Employee[] }[]>();
    
    deptEmployees.forEach(emp => {
      const job = emp.job_position_id ? jobPositions.find(j => j.id === emp.job_position_id) : null;
      const level = job?.position_level ?? 999; // Unassigned goes to bottom
      
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      
      const levelGroup = grouped.get(level)!;
      const existingJobGroup = levelGroup.find(g => g.job?.id === job?.id);
      
      if (existingJobGroup) {
        existingJobGroup.employees.push(emp);
      } else {
        levelGroup.push({ job, employees: [emp] });
      }
    });
    
    // Sort levels and return
    const sortedLevels = Array.from(grouped.keys()).sort((a, b) => a - b);
    return sortedLevels.map(level => ({
      level,
      groups: grouped.get(level)!
    }));
  };

  const getAllActiveEmployees = () => {
    return employees.filter(e => e.employment_status === 'active');
  };

  const getEligibleEmployeesForJob = (jobId: string | null) => {
    if (!jobId) return employees;
    
    const job = jobPositions.find(j => j.id === jobId);
    if (!job) return employees;
    
    const sameJobIds = jobPositions
      .filter(j => j.position_name === job.position_name)
      .map(j => j.id);
    
    return employees.filter(e => 
      !e.job_position_id || sameJobIds.includes(e.job_position_id)
    );
  };

  const getUnassignedEmployees = () => {
    return employees.filter(e => !e.job_position_id && !e.department_id);
  };

  const renderConnectionLines = () => {
    const lines: JSX.Element[] = [];
    const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);
    
    activeDepts.forEach(dept => {
      if (dept.parent_department_id) {
        const parentPos = nodePositions.get(dept.parent_department_id);
        const childPos = nodePositions.get(dept.id);
        
        if (parentPos && childPos) {
          const NODE_WIDTH = 180;
          const NODE_HEIGHT = 60;
          
          const startX = parentPos.x + NODE_WIDTH / 2;
          const startY = parentPos.y + NODE_HEIGHT;
          const endX = childPos.x + NODE_WIDTH / 2;
          const endY = childPos.y;
          
          const midY = startY + (endY - startY) / 2;
          
          lines.push(
            <path
              key={`line-${dept.parent_department_id}-${dept.id}`}
              d={`M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
      }
    });
    
    return lines;
  };

  const getCanvasSize = () => {
    let maxX = 800;
    let maxY = 600;
    
    nodePositions.forEach(pos => {
      maxX = Math.max(maxX, pos.x + 300);
      maxY = Math.max(maxY, pos.y + 300);
    });
    
    return { width: maxX, height: maxY };
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.3));
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    
    const title = language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Chart';
    
    try {
      const originalZoom = zoomLevel;
      setZoomLevel(1);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(printRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      
      setZoomLevel(originalZoom);
      
      const imgData = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #6366f1; padding-bottom: 15px; }
            .header h1 { margin: 0 0 8px 0; color: #1f2937; font-size: 24px; }
            .header p { color: #6b7280; font-size: 14px; }
            .chart-image { width: 100%; max-width: 100%; height: auto; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; } .header { margin-bottom: 10px; } }
          </style>
        </head>
        <body>
          <div class="header"><h1>${title}</h1><p>${new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</p></div>
          <img src="${imgData}" class="chart-image" alt="${title}" />
        </body>
        </html>
      `);
      
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    } catch (error) {
      console.error('Error capturing chart:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ أثناء الطباعة' : 'Error printing chart', variant: 'destructive' });
    }
  };

  const canvasSize = getCanvasSize();
  const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ar' ? 'الهيكل التنظيمي' : 'Company Hierarchy'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ar' ? 'اسحب الأقسام لإعادة ترتيبها • انقر مرتين على القسم لهرم الوظائف' : 'Drag to rearrange • Double-click department for position hierarchy'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'طباعة' : 'Print'}
          </Button>
          <Button variant="outline" onClick={handleResetPositions}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'إعادة تعيين' : 'Reset Layout'}
          </Button>
          <Button onClick={() => handleAddDepartment(null)}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'إضافة قسم رئيسي' : 'Add Main Department'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {language === 'ar' ? 'الأقسام' : 'Departments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {departments.filter(d => d.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {language === 'ar' ? 'الوظائف' : 'Jobs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {jobPositions.filter(j => j.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ar' ? 'الموظفين المعينين' : 'Assigned Employees'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {employees.filter(e => e.job_position_id).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ar' ? 'غير معينين' : 'Unassigned'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {getUnassignedEmployees().length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Chart'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoomLevel <= 0.3}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoomLevel >= 2}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : activeDepts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد أقسام. انقر على "إضافة قسم رئيسي" للبدء.' : 'No departments found. Click "Add Main Department" to start.'}
            </div>
          ) : (
            <div
              ref={canvasRef}
              className="relative bg-muted/30 rounded-lg origin-top-left"
              style={{ width: canvasSize.width * zoomLevel, height: canvasSize.height * zoomLevel, minHeight: 500 * zoomLevel }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                ref={printRef}
                className="origin-top-left"
                style={{ transform: `scale(${zoomLevel})`, width: canvasSize.width, height: canvasSize.height }}
              >
                {/* Row alignment lines */}
                <svg className="absolute inset-0 pointer-events-none" width={canvasSize.width} height={canvasSize.height}>
                  {/* Light horizontal row lines for alignment */}
                  {(() => {
                    const yPositions = new Set<number>();
                    nodePositions.forEach((pos) => {
                      yPositions.add(Math.round(pos.y / 10) * 10); // Round to nearest 10 for grouping
                    });
                    const sortedYs = Array.from(yPositions).sort((a, b) => a - b);
                    
                    return sortedYs.map((y, idx) => (
                      <line
                        key={`row-line-${idx}`}
                        x1={0}
                        y1={y + 20}
                        x2={canvasSize.width}
                        y2={y + 20}
                        stroke="hsl(var(--border))"
                        strokeWidth={1}
                        strokeDasharray="8 4"
                        opacity={0.5}
                        className="print:opacity-30"
                      />
                    ));
                  })()}
                  {renderConnectionLines()}
                </svg>

                {activeDepts.map(dept => {
                  const pos = nodePositions.get(dept.id);
                  if (!pos) return null;
                  
                  const deptColor = dept.color || '#6366f1';
                  const jobs = getJobsForDepartment(dept.id);
                  const directEmployees = getEmployeesDirectlyInDepartment(dept.id);
                  
                  return (
                    <div
                      key={dept.id}
                      className={cn("absolute transition-shadow group", draggingId === dept.id && "z-50")}
                      style={{ left: pos.x, top: pos.y, width: 180 }}
                    >
                      <div
                        className={cn(
                          "relative px-4 py-3 rounded-lg text-white font-semibold text-center transition-all cursor-move hover:shadow-lg",
                          draggingId === dept.id && "shadow-2xl ring-2 ring-white"
                        )}
                        style={{ backgroundColor: deptColor }}
                        onMouseDown={(e) => handleMouseDown(e, dept.id)}
                        onDoubleClick={() => handleOpenPositionHierarchy(dept)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <GripVertical className="h-4 w-4 opacity-50" />
                          <div>
                            <div className="text-sm font-bold">{dept.department_name}</div>
                            <div className="text-xs opacity-80">{dept.department_code}</div>
                          </div>
                        </div>
                        
                        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Popover open={colorPickerDeptId === dept.id} onOpenChange={(open) => setColorPickerDeptId(open ? dept.id : null)}>
                            <PopoverTrigger asChild>
                              <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md" onMouseDown={(e) => e.stopPropagation()}>
                                <Palette className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" onMouseDown={(e) => e.stopPropagation()}>
                              <div className="grid grid-cols-6 gap-1">
                                {DEPARTMENT_COLORS.map(color => (
                                  <button
                                    key={color}
                                    className={cn("h-6 w-6 rounded-full border-2 transition-transform hover:scale-110", deptColor === color ? "border-foreground" : "border-transparent")}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleColorChange(dept.id, color)}
                                  />
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md" onMouseDown={(e) => { e.stopPropagation(); handleEditDepartment(dept); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md" onMouseDown={(e) => { e.stopPropagation(); handleOpenAssignToDept(dept.id); }}>
                            <UserPlus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md" onMouseDown={(e) => { e.stopPropagation(); handleAddJob(dept.id); }}>
                            <Briefcase className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md" onMouseDown={(e) => { e.stopPropagation(); handleAddDepartment(dept.id); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Employees grouped by position level */}
                      {(() => {
                        const groupedByLevel = getEmployeesGroupedByLevel(dept.id);
                        if (groupedByLevel.length === 0) return null;
                        
                        return (
                          <div className="mt-2 space-y-1">
                            {groupedByLevel.map(({ level, groups }) => (
                              <div key={level} className="bg-muted/80 rounded-md px-2 py-1.5">
                                {/* Level header */}
                                <div className="flex items-center gap-1 mb-1">
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] px-1.5 py-0 h-4 bg-background/50"
                                  >
                                    {level === 999 
                                      ? (language === 'ar' ? 'غير محدد' : 'N/A')
                                      : `L${level}`
                                    }
                                  </Badge>
                                  <div className="flex-1 h-px bg-border/50" />
                                </div>
                                
                                {/* Employees in this level */}
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {groups.map(({ job, employees: groupEmps }) => (
                                    groupEmps.map(emp => (
                                      <TooltipProvider key={emp.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="relative group/emp">
                                              <Avatar 
                                                className="h-8 w-8 cursor-pointer ring-2 ring-background hover:ring-primary transition-all" 
                                                onClick={() => handleOpenEmployeeProfile(emp)}
                                              >
                                                <AvatarImage src={emp.photo_url || undefined} />
                                                <AvatarFallback className="text-xs font-medium">
                                                  {emp.first_name.charAt(0)}
                                                </AvatarFallback>
                                              </Avatar>
                                              <Button
                                                size="icon"
                                                variant="destructive"
                                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full opacity-0 group-hover/emp:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveEmployeeFromDept(emp.id, getEmployeeName(emp), dept.id);
                                                }}
                                              >
                                                <X className="h-2.5 w-2.5" />
                                              </Button>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom" className="max-w-[200px]">
                                            <div className="text-center space-y-1">
                                              <div className="font-medium">{getEmployeeName(emp)}</div>
                                              {job && (
                                                <>
                                                  <div className="text-xs text-muted-foreground">
                                                    {language === 'ar' && job.position_name_ar 
                                                      ? job.position_name_ar 
                                                      : job.position_name}
                                                  </div>
                                                  <Badge variant="secondary" className="text-[10px]">
                                                    {language === 'ar' ? `المستوى ${job.position_level ?? 0}` : `Level ${job.position_level ?? 0}`}
                                                  </Badge>
                                                </>
                                              )}
                                              {!job && (
                                                <div className="text-xs text-muted-foreground">
                                                  {language === 'ar' ? 'بدون وظيفة' : 'No position'}
                                                </div>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? (language === 'ar' ? 'تعديل القسم' : 'Edit Department') : (language === 'ar' ? 'إضافة قسم' : 'Add Department')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'اسم القسم' : 'Department Name'}</Label>
              <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder={language === 'ar' ? 'مثال: تقنية المعلومات' : 'e.g. Information Technology'} />
            </div>
            <div>
              <Label>{language === 'ar' ? 'رمز القسم' : 'Department Code'}</Label>
              <Input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder={language === 'ar' ? 'مثال: IT' : 'e.g. IT'} />
            </div>
            <div>
              <Label>{language === 'ar' ? 'القسم الأب' : 'Parent Department'}</Label>
              <Select value={deptForm.parentId} onValueChange={(v) => setDeptForm({ ...deptForm, parentId: v })}>
                <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'}</SelectItem>
                  {departments.filter(d => d.is_active && d.id !== editingDept?.id).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveDepartment} className="w-full">{language === 'ar' ? 'حفظ' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Dialog */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJob ? (language === 'ar' ? 'تعديل الوظيفة' : 'Edit Job') : (language === 'ar' ? 'إضافة وظيفة' : 'Add Job')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingJob && (
              <div>
                <Label>{language === 'ar' ? 'نوع الإضافة' : 'Add Type'}</Label>
                <Select value={jobMode} onValueChange={(v: "existing" | "new") => setJobMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">{language === 'ar' ? 'اختيار وظيفة موجودة' : 'Select Existing Job'}</SelectItem>
                    <SelectItem value="new">{language === 'ar' ? 'إضافة وظيفة جديدة' : 'Add New Job'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editingJob && jobMode === "existing" && (
              <>
                <div>
                  <Label>{language === 'ar' ? 'اختر الوظيفة' : 'Select Job'}</Label>
                  <Select value={jobForm.existingJobId} onValueChange={handleJobSelectionChange}>
                    <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر وظيفة' : 'Select a job'} /></SelectTrigger>
                    <SelectContent>
                      {getUniqueJobNames().map(j => (
                        <SelectItem key={j.id} value={j.id}>{j.position_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {jobForm.existingJobId && (
                  <div>
                    <Label>{language === 'ar' ? 'اختر الموظفين' : 'Select Employees'}</Label>
                    <ScrollArea className="h-48 border rounded-md p-2 mt-1">
                      {(() => {
                        const selectedJob = jobPositions.find(j => j.id === jobForm.existingJobId);
                        const sameJobIds = selectedJob ? jobPositions.filter(j => j.position_name === selectedJob.position_name).map(j => j.id) : [];
                        const eligibleEmps = employees.filter(e => !e.job_position_id || (e.job_position_id && sameJobIds.includes(e.job_position_id)));
                        
                        return eligibleEmps.length > 0 ? (
                          <div className="space-y-2">
                            {eligibleEmps.map(emp => (
                              <div key={emp.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                                <Checkbox id={`emp-${emp.id}`} checked={selectedJobEmployees.includes(emp.id)} onCheckedChange={() => toggleEmployeeSelection(emp.id)} />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={emp.photo_url || undefined} />
                                  <AvatarFallback className="text-xs">{emp.first_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">{getEmployeeName(emp)}</label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">{language === 'ar' ? 'لا يوجد موظفين متاحين' : 'No employees available'}</p>
                        );
                      })()}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">{language === 'ar' ? `تم اختيار ${selectedJobEmployees.length} موظف` : `${selectedJobEmployees.length} employee(s) selected`}</p>
                  </div>
                )}
              </>
            )}

            {(editingJob || jobMode === "new") && (
              <div>
                <Label>{language === 'ar' ? 'اسم الوظيفة' : 'Job Title'}</Label>
                <Input value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} placeholder={language === 'ar' ? 'مثال: مطور برامج' : 'e.g. Software Developer'} />
              </div>
            )}

            <div>
              <Label>{language === 'ar' ? 'القسم' : 'Department'}</Label>
              <Select value={jobForm.departmentId} onValueChange={(v) => setJobForm({ ...jobForm, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} /></SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d.is_active).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveJob} className="w-full" disabled={!editingJob && jobMode === "existing" && !jobForm.existingJobId}>
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Employee to Job Dialog */}
      <Dialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعيين موظف للوظيفة' : 'Assign Employee to Job'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {getEligibleEmployeesForJob(selectedJobId).map(emp => (
                <div key={emp.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => handleAssignEmployeeToJob(emp.id)}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={emp.photo_url || undefined} />
                    <AvatarFallback>{emp.first_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{getEmployeeName(emp)}</p>
                    <p className="text-xs text-muted-foreground">{emp.employee_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Assign Employee to Department Dialog */}
      <Dialog open={assignToDeptDialogOpen} onOpenChange={(open) => { setAssignToDeptDialogOpen(open); if (!open) { setDeptEmployeeSearch(""); setSelectedDeptEmployees([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعيين موظفين للقسم' : 'Assign Employees to Department'}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={language === 'ar' ? 'بحث بالاسم...' : 'Search by name...'}
            value={deptEmployeeSearch}
            onChange={(e) => setDeptEmployeeSearch(e.target.value)}
            className="mb-2"
          />
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {getAllActiveEmployees()
                .filter(emp => {
                  if (!deptEmployeeSearch.trim()) return true;
                  const searchLower = deptEmployeeSearch.toLowerCase();
                  const fullName = getEmployeeName(emp).toLowerCase();
                  const fullNameEn = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                  const fullNameAr = emp.first_name_ar && emp.last_name_ar ? `${emp.first_name_ar} ${emp.last_name_ar}`.toLowerCase() : '';
                  return fullName.includes(searchLower) || fullNameEn.includes(searchLower) || fullNameAr.includes(searchLower);
                })
                .map(emp => (
                <div 
                  key={emp.id} 
                  className={cn(
                    "flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer",
                    selectedDeptEmployees.includes(emp.id) && "bg-primary/10"
                  )} 
                  onClick={() => toggleDeptEmployeeSelection(emp.id)}
                >
                  <Checkbox 
                    checked={selectedDeptEmployees.includes(emp.id)}
                    onCheckedChange={() => toggleDeptEmployeeSelection(emp.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={emp.photo_url || undefined} />
                    <AvatarFallback>{emp.first_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getEmployeeName(emp)}</p>
                      {emp.job_position_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {jobPositions.find(j => j.id === emp.job_position_id)?.position_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{emp.employee_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? `تم اختيار ${selectedDeptEmployees.length}` : `${selectedDeptEmployees.length} selected`}
            </span>
            <Button onClick={handleAssignEmployeesToDept} disabled={selectedDeptEmployees.length === 0}>
              {language === 'ar' ? 'تعيين' : 'Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Profile Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={(open) => { setEmployeeDialogOpen(open); if (!open) setIsEditingEmployee(false); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditingEmployee ? (language === 'ar' ? 'تعديل الموظف' : 'Edit Employee') : (language === 'ar' ? 'بطاقة الموظف' : 'Employee Card')}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && !isEditingEmployee && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={selectedEmployee.photo_url || undefined} />
                <AvatarFallback className="text-3xl font-bold">{selectedEmployee.first_name.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold">{getEmployeeName(selectedEmployee)}</h3>
                <p className="text-sm text-muted-foreground">{selectedEmployee.employee_number}</p>
                {selectedEmployee.email && <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>}
              </div>

              <div className="w-full space-y-3 mt-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {language === 'ar' ? 'الوظيفة' : 'Job Position'}
                  </span>
                  <span className="font-medium">{getEmployeeJobPosition(selectedEmployee) || (language === 'ar' ? 'غير معين' : 'Not Assigned')}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {language === 'ar' ? 'القسم' : 'Department'}
                  </span>
                  <span className="font-medium">{getEmployeeDepartment(selectedEmployee) || (language === 'ar' ? 'غير معين' : 'Not Assigned')}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", selectedEmployee.employment_status === 'active' ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300")}>
                    {selectedEmployee.employment_status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                  </span>
                </div>
              </div>

              {canEditUsers && (
                <Button className="w-full mt-4" onClick={handleStartEditEmployee}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'تعديل الموظف' : 'Edit Employee'}
                </Button>
              )}
            </div>
          )}

          {selectedEmployee && isEditingEmployee && (
            <div className="space-y-4 py-4">
              <div>
                <Label>{language === 'ar' ? 'الاسم الأول' : 'First Name'}</Label>
                <Input value={employeeEditForm.first_name} onChange={(e) => setEmployeeEditForm({ ...employeeEditForm, first_name: e.target.value })} />
              </div>

              <div>
                <Label>{language === 'ar' ? 'اسم العائلة' : 'Last Name'}</Label>
                <Input value={employeeEditForm.last_name} onChange={(e) => setEmployeeEditForm({ ...employeeEditForm, last_name: e.target.value })} />
              </div>

              <div>
                <Label>{language === 'ar' ? 'الوظيفة' : 'Job Position'}</Label>
                <Select value={employeeEditForm.job_position_id || "__none__"} onValueChange={(v) => setEmployeeEditForm({ ...employeeEditForm, job_position_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر الوظيفة' : 'Select job position'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'ar' ? 'بدون وظيفة' : 'No job position'}</SelectItem>
                    {jobPositions.filter(j => j.is_active).map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.position_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{language === 'ar' ? 'القسم' : 'Department'}</Label>
                <Select value={employeeEditForm.department_id || "__none__"} onValueChange={(v) => setEmployeeEditForm({ ...employeeEditForm, department_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'ar' ? 'بدون قسم' : 'No department'}</SelectItem>
                    {departments.filter(d => d.is_active).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditingEmployee(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button className="flex-1" onClick={handleSaveEmployee} disabled={savingEmployee}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingEmployee ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Position Hierarchy Dialog */}
      <PositionHierarchyDialog
        open={positionHierarchyDialogOpen}
        onOpenChange={setPositionHierarchyDialogOpen}
        departmentId={selectedDeptForHierarchy?.id || null}
        departmentName={selectedDeptForHierarchy?.department_name || ""}
        language={language}
        onRefresh={fetchData}
      />
    </div>
  );
};

export default CompanyHierarchy;
