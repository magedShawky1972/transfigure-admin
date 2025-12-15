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
import { Building2, Plus, Users, Briefcase, Pencil, Trash2, UserPlus, X, GripVertical, Palette, RotateCcw, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import UserSelectionDialog from "@/components/UserSelectionDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AvatarSelector from "@/components/AvatarSelector";
import { Switch } from "@/components/ui/switch";

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
  department_id: string | null;
  is_active: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  job_position_id: string | null;
  default_department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canEditUsers, setCanEditUsers] = useState(false);

  // Dialog states
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignToDeptDialogOpen, setAssignToDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingJob, setEditingJob] = useState<JobPosition | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [colorPickerDeptId, setColorPickerDeptId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<Profile | null>(null);
  const [userProfileDialogOpen, setUserProfileDialogOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState({
    user_name: "",
    email: "",
    mobile_number: "",
    is_active: true,
    job_position_id: null as string | null,
    default_department_id: null as string | null,
    avatar_url: null as string | null,
  });
  const [savingUser, setSavingUser] = useState(false);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", parentId: "__none__" });
  const [jobForm, setJobForm] = useState({ name: "", departmentId: "", existingJobId: "" });
  const [jobMode, setJobMode] = useState<"existing" | "new">("existing");
  const [selectedJobUsers, setSelectedJobUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const handleOpenUserProfile = (user: Profile) => {
    setSelectedUserProfile(user);
    setIsEditingUser(false);
    setUserProfileDialogOpen(true);
  };

  const handleStartEditUser = () => {
    if (!selectedUserProfile) return;
    setUserEditForm({
      user_name: selectedUserProfile.user_name,
      email: selectedUserProfile.email,
      mobile_number: (selectedUserProfile as any).mobile_number || "",
      is_active: selectedUserProfile.is_active,
      job_position_id: selectedUserProfile.job_position_id,
      default_department_id: selectedUserProfile.default_department_id,
      avatar_url: selectedUserProfile.avatar_url,
    });
    setIsEditingUser(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUserProfile) return;
    setSavingUser(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          user_name: userEditForm.user_name,
          mobile_number: userEditForm.mobile_number || null,
          is_active: userEditForm.is_active,
          job_position_id: userEditForm.job_position_id,
          default_department_id: userEditForm.default_department_id,
          avatar_url: userEditForm.avatar_url,
        })
        .eq("id", selectedUserProfile.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully',
      });

      // Update local state
      setProfiles(prev => prev.map(p => 
        p.id === selectedUserProfile.id 
          ? { 
              ...p, 
              user_name: userEditForm.user_name,
              is_active: userEditForm.is_active,
              job_position_id: userEditForm.job_position_id,
              default_department_id: userEditForm.default_department_id,
              avatar_url: userEditForm.avatar_url,
            } 
          : p
      ));
      setSelectedUserProfile(prev => prev ? {
        ...prev,
        user_name: userEditForm.user_name,
        is_active: userEditForm.is_active,
        job_position_id: userEditForm.job_position_id,
        default_department_id: userEditForm.default_department_id,
        avatar_url: userEditForm.avatar_url,
      } : null);
      setIsEditingUser(false);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUser(false);
    }
  };

  const getUserJobPosition = (user: Profile) => {
    if (user.job_position_id) {
      return jobPositions.find(j => j.id === user.job_position_id)?.position_name || null;
    }
    return null;
  };

  const getUserDepartment = (user: Profile) => {
    if (user.default_department_id) {
      return departments.find(d => d.id === user.default_department_id)?.department_name || null;
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

      // Check if user is admin
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

      // Check specific permission for userSetup
      const { data: permission } = await supabase
        .from('user_permissions')
        .select('has_access')
        .eq('user_id', user.id)
        .eq('menu_item', 'userSetup')
        .maybeSingle();

      setCanEditUsers(permission?.has_access === true);
    } catch (error) {
      console.error('Error checking user setup permission:', error);
    }
  };

  // Initialize positions from database or auto-layout
  useEffect(() => {
    if (departments.length > 0 && !loading) {
      initializePositions();
    }
  }, [departments, loading]);

  const initializePositions = () => {
    const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);
    const newPositions = new Map<string, NodePosition>();
    
    activeDepts.forEach((dept) => {
      if (dept.position_x !== null && dept.position_y !== null && 
          dept.position_x !== undefined && dept.position_y !== undefined) {
        newPositions.set(dept.id, { id: dept.id, x: dept.position_x, y: dept.position_y });
      } else {
        // Auto-layout if no position saved
        const index = activeDepts.indexOf(dept);
        const rootDepts = activeDepts.filter(d => !d.parent_department_id);
        const isRoot = !dept.parent_department_id;
        
        if (isRoot) {
          const rootIndex = rootDepts.indexOf(dept);
          newPositions.set(dept.id, { 
            id: dept.id, 
            x: 100 + rootIndex * 300, 
            y: 50 
          });
        } else {
          // Position children below their parent
          const parentPos = newPositions.get(dept.parent_department_id!);
          const siblings = activeDepts.filter(d => d.parent_department_id === dept.parent_department_id);
          const siblingIndex = siblings.indexOf(dept);
          
          if (parentPos) {
            newPositions.set(dept.id, {
              id: dept.id,
              x: parentPos.x + (siblingIndex - (siblings.length - 1) / 2) * 200,
              y: parentPos.y + 180
            });
          } else {
            newPositions.set(dept.id, { id: dept.id, x: 100 + index * 200, y: 50 + index * 100 });
          }
        }
      }
    });
    
    setNodePositions(newPositions);
  };

  const fetchData = async () => {
    try {
      const [deptRes, jobRes, profileRes] = await Promise.all([
        supabase.from("departments").select("*").order("display_order").order("department_name"),
        supabase.from("job_positions").select("*").order("position_name"),
        supabase.from("profiles").select("id, user_id, user_name, email, job_position_id, default_department_id, avatar_url, is_active").eq("is_active", true),
      ]);

      if (deptRes.error) throw deptRes.error;
      if (jobRes.error) throw jobRes.error;
      if (profileRes.error) throw profileRes.error;

      setDepartments(deptRes.data || []);
      setJobPositions(jobRes.data || []);
      setProfiles(profileRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle mouse down on department for dragging
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

  // Handle mouse move for dragging
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

  // Handle mouse up - save position
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

  // Reset all positions (auto-layout)
  const handleResetPositions = async () => {
    try {
      // Clear all positions in database
      const activeDepts = departments.filter(d => d.is_active && !d.is_outsource);
      for (const dept of activeDepts) {
        await supabase.from("departments").update({
          position_x: null,
          position_y: null
        }).eq("id", dept.id);
      }
      
      // Update local state
      setDepartments(prev => prev.map(d => ({ ...d, position_x: null, position_y: null })));
      
      // Re-initialize with auto-layout
      setTimeout(() => initializePositions(), 100);
      
      toast({ title: language === 'ar' ? 'تم إعادة تعيين المواقع' : 'Positions reset' });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  // Handle department color change
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
    setSelectedJobUsers([]);
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
        
        if (selectedJobUsers.length === 0) {
          toast({ title: language === 'ar' ? "اختر موظف واحد على الأقل" : "Select at least one user", variant: "destructive" });
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

        for (const userId of selectedJobUsers) {
          const { error } = await supabase.from("profiles").update({
            job_position_id: targetJobId,
            default_department_id: jobForm.departmentId,
          }).eq("user_id", userId);
          
          if (error) throw error;
        }

        toast({ title: language === 'ar' ? "تم تعيين الوظيفة والموظفين" : "Job and users assigned" });
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

  const getUsersWithJobName = (jobId: string) => {
    const job = jobPositions.find(j => j.id === jobId);
    if (!job) return [];
    const jobIds = jobPositions.filter(j => j.position_name === job.position_name).map(j => j.id);
    return profiles.filter(p => p.job_position_id && jobIds.includes(p.job_position_id));
  };

  const handleJobSelectionChange = (jobId: string) => {
    setJobForm({ ...jobForm, existingJobId: jobId });
    const usersWithJob = getUsersWithJobName(jobId);
    setSelectedJobUsers(usersWithJob.map(u => u.user_id));
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedJobUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleDeleteJob = async (jobId: string) => {
    const hasUsers = profiles.some(p => p.job_position_id === jobId);
    if (hasUsers) {
      toast({
        title: language === 'ar' ? "لا يمكن حذف الوظيفة" : "Cannot delete job",
        description: language === 'ar' ? "الوظيفة مرتبطة بموظفين" : "Job has assigned users",
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

  const handleOpenAssignUser = (jobId: string, departmentId: string) => {
    setSelectedJobId(jobId);
    setSelectedDeptId(departmentId);
    setSelectedUserId("");
    setAssignUserDialogOpen(true);
  };

  const handleOpenAssignToDept = (departmentId: string) => {
    setSelectedDeptId(departmentId);
    setSelectedUserId("");
    setAssignToDeptDialogOpen(true);
  };

  const handleAssignUser = async (userId: string) => {
    await handleAssignMultipleUsers([userId]);
  };

  const handleAssignMultipleUsers = async (userIds: string[]) => {
    if (userIds.length === 0) {
      toast({ title: language === 'ar' ? "اختر موظف واحد على الأقل" : "Select at least one user", variant: "destructive" });
      return;
    }
    
    if (!selectedJobId) {
      toast({ title: language === 'ar' ? "لم يتم تحديد الوظيفة" : "No job selected", variant: "destructive" });
      return;
    }

    try {
      for (const userId of userIds) {
        const { error } = await supabase.from("profiles").update({
          job_position_id: selectedJobId,
          default_department_id: selectedDeptId,
        }).eq("user_id", userId);

        if (error) throw error;
      }
      
      setAssignUserDialogOpen(false);
      await fetchData();
      toast({ title: language === 'ar' ? `تم تعيين ${userIds.length} موظف بنجاح` : `${userIds.length} user(s) assigned successfully` });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleAssignUserToDept = async (userId: string) => {
    if (!userId || !selectedDeptId) return;

    try {
      const { error } = await supabase.from("profiles").update({
        default_department_id: selectedDeptId,
        job_position_id: null,
      }).eq("user_id", userId);

      if (error) throw error;
      toast({ title: language === 'ar' ? "تم تعيين الموظف للقسم" : "User assigned to department" });
      setAssignToDeptDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleRemoveUserFromJob = async (userId: string, userName: string) => {
    try {
      const { error } = await supabase.from("profiles").update({
        default_department_id: null,
      }).eq("user_id", userId);

      if (error) throw error;
      toast({ title: language === 'ar' ? `تم إزالة ${userName} من القسم` : `${userName} removed from department` });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const getJobsForDepartment = (deptId: string) => {
    const jobIdsWithUsersInDept = new Set(
      profiles
        .filter(p => p.default_department_id === deptId && p.job_position_id)
        .map(p => p.job_position_id)
    );
    
    return jobPositions.filter(j => 
      j.is_active && (j.department_id === deptId || jobIdsWithUsersInDept.has(j.id))
    );
  };

  const getUsersForJob = (jobId: string, departmentId: string) => {
    return profiles.filter(p => p.job_position_id === jobId && p.default_department_id === departmentId);
  };

  const getUsersDirectlyInDepartment = (deptId: string) => {
    return profiles.filter(p => p.default_department_id === deptId && !p.job_position_id);
  };

  const getAllActiveUsers = () => {
    return profiles.filter(p => p.is_active);
  };

  const getEligibleUsersForJob = (jobId: string | null) => {
    if (!jobId) return profiles.filter(p => p.is_active);
    
    const job = jobPositions.find(j => j.id === jobId);
    if (!job) return profiles.filter(p => p.is_active);
    
    const sameJobIds = jobPositions
      .filter(j => j.position_name === job.position_name)
      .map(j => j.id);
    
    return profiles.filter(p => 
      p.is_active && (
        !p.job_position_id ||
        sameJobIds.includes(p.job_position_id)
      )
    );
  };

  const getUnassignedUsers = () => {
    return profiles.filter(p => !p.job_position_id && !p.default_department_id);
  };

  // Generate SVG connection lines
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

  // Calculate canvas size
  const getCanvasSize = () => {
    let maxX = 800;
    let maxY = 600;
    
    nodePositions.forEach(pos => {
      maxX = Math.max(maxX, pos.x + 300);
      maxY = Math.max(maxY, pos.y + 300);
    });
    
    return { width: maxX, height: maxY };
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
              {language === 'ar' 
                ? 'اسحب الأقسام لإعادة ترتيبها بحرية' 
                : 'Drag departments to rearrange freely'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
              {language === 'ar' ? 'الموظفين المعينين' : 'Assigned Users'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {profiles.filter(p => p.job_position_id).length}
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
              {getUnassignedUsers().length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Chart'}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : activeDepts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' 
                ? 'لا توجد أقسام. انقر على "إضافة قسم رئيسي" للبدء.' 
                : 'No departments found. Click "Add Main Department" to start.'}
            </div>
          ) : (
            <div
              ref={canvasRef}
              className="relative bg-muted/30 rounded-lg"
              style={{ width: canvasSize.width, height: canvasSize.height, minHeight: 500 }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* SVG Layer for connection lines */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={canvasSize.width}
                height={canvasSize.height}
              >
                {renderConnectionLines()}
              </svg>

              {/* Department nodes */}
              {activeDepts.map(dept => {
                const pos = nodePositions.get(dept.id);
                if (!pos) return null;
                
                const deptColor = dept.color || '#6366f1';
                const jobs = getJobsForDepartment(dept.id);
                const directUsers = getUsersDirectlyInDepartment(dept.id);
                
                return (
                  <div
                    key={dept.id}
                    className={cn(
                      "absolute transition-shadow group",
                      draggingId === dept.id && "z-50"
                    )}
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: 180,
                    }}
                  >
                    {/* Department Box */}
                    <div
                      className={cn(
                        "relative px-4 py-3 rounded-lg text-white font-semibold text-center transition-all cursor-move hover:shadow-lg",
                        draggingId === dept.id && "shadow-2xl ring-2 ring-white"
                      )}
                      style={{ backgroundColor: deptColor }}
                      onMouseDown={(e) => handleMouseDown(e, dept.id)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <GripVertical className="h-4 w-4 opacity-50" />
                        <div>
                          <div className="text-sm font-bold">{dept.department_name}</div>
                          <div className="text-xs opacity-80">{dept.department_code}</div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Popover open={colorPickerDeptId === dept.id} onOpenChange={(open) => setColorPickerDeptId(open ? dept.id : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-6 w-6 rounded-full shadow-md"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Palette className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="grid grid-cols-6 gap-1">
                              {DEPARTMENT_COLORS.map(color => (
                                <button
                                  key={color}
                                  className={cn(
                                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                                    deptColor === color ? "border-foreground" : "border-transparent"
                                  )}
                                  style={{ backgroundColor: color }}
                                  onClick={() => handleColorChange(dept.id, color)}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 rounded-full shadow-md"
                          onMouseDown={(e) => { e.stopPropagation(); handleEditDepartment(dept); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 rounded-full shadow-md"
                          onMouseDown={(e) => { e.stopPropagation(); handleOpenAssignToDept(dept.id); }}
                        >
                          <UserPlus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 rounded-full shadow-md"
                          onMouseDown={(e) => { e.stopPropagation(); handleAddJob(dept.id); }}
                        >
                          <Briefcase className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 rounded-full shadow-md"
                          onMouseDown={(e) => { e.stopPropagation(); handleAddDepartment(dept.id); }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Users directly in department */}
                    {directUsers.length > 0 && (
                      <div className="mt-2 flex items-center justify-center gap-2 px-2 py-2 bg-muted rounded-md flex-wrap">
                        {directUsers.slice(0, 4).map(user => (
                          <TooltipProvider key={user.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar 
                                  className="h-8 w-8 cursor-pointer ring-2 ring-background hover:ring-primary transition-all"
                                  onClick={() => handleOpenUserProfile(user)}
                                >
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs font-medium">{user.user_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>{user.user_name}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                        {directUsers.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{directUsers.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Jobs */}
                    {jobs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {jobs.map(job => {
                          const jobUsers = getUsersForJob(job.id, dept.id);
                          return (
                            <div key={job.id} className="relative group/job">
                              <div className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs text-center">
                                <div className="font-medium">{job.position_name}</div>
                                {jobUsers.length > 0 && (
                                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                                    {jobUsers.slice(0, 3).map(user => (
                                      <TooltipProvider key={user.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="relative group/user">
                                              <Avatar 
                                                className="h-7 w-7 cursor-pointer ring-2 ring-background hover:ring-primary transition-all"
                                                onClick={(e) => { e.stopPropagation(); handleOpenUserProfile(user); }}
                                              >
                                                <AvatarImage src={user.avatar_url || undefined} />
                                                <AvatarFallback className="text-[10px] font-medium">{user.user_name.charAt(0)}</AvatarFallback>
                                              </Avatar>
                                              <button
                                                onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  handleRemoveUserFromJob(user.user_id, user.user_name); 
                                                }}
                                                className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover/user:opacity-100 transition-opacity flex items-center justify-center"
                                              >
                                                <X className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>{user.user_name}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                    {jobUsers.length > 3 && (
                                      <span className="text-xs text-muted-foreground">+{jobUsers.length - 3}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover/job:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-4 w-4 rounded-full shadow-sm bg-background"
                                  onClick={(e) => { e.stopPropagation(); handleEditJob(job); }}
                                >
                                  <Pencil className="h-2 w-2" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-4 w-4 rounded-full shadow-sm bg-background"
                                  onClick={(e) => { e.stopPropagation(); handleOpenAssignUser(job.id, dept.id); }}
                                >
                                  <UserPlus className="h-2 w-2" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept 
                ? (language === 'ar' ? 'تعديل القسم' : 'Edit Department')
                : (language === 'ar' ? 'إضافة قسم' : 'Add Department')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'اسم القسم' : 'Department Name'}</Label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: تقنية المعلومات' : 'e.g. Information Technology'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'رمز القسم' : 'Department Code'}</Label>
              <Input
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: IT' : 'e.g. IT'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'القسم الأب' : 'Parent Department'}</Label>
              <Select value={deptForm.parentId} onValueChange={(v) => setDeptForm({ ...deptForm, parentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'}</SelectItem>
                  {departments
                    .filter(d => d.is_active && d.id !== editingDept?.id)
                    .map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveDepartment} className="w-full">
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Dialog */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJob 
                ? (language === 'ar' ? 'تعديل الوظيفة' : 'Edit Job')
                : (language === 'ar' ? 'إضافة وظيفة' : 'Add Job')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingJob && (
              <div>
                <Label>{language === 'ar' ? 'نوع الإضافة' : 'Add Type'}</Label>
                <Select value={jobMode} onValueChange={(v: "existing" | "new") => setJobMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر وظيفة' : 'Select a job'} />
                    </SelectTrigger>
                    <SelectContent>
                      {getUniqueJobNames().map(j => (
                        <SelectItem key={j.id} value={j.id}>{j.position_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {jobForm.existingJobId && (
                  <div>
                    <Label>{language === 'ar' ? 'اختر الموظفين' : 'Select Users'}</Label>
                    <ScrollArea className="h-48 border rounded-md p-2 mt-1">
                      {(() => {
                        const selectedJob = jobPositions.find(j => j.id === jobForm.existingJobId);
                        const sameJobIds = selectedJob 
                          ? jobPositions.filter(j => j.position_name === selectedJob.position_name).map(j => j.id)
                          : [];
                        const eligibleUsers = profiles.filter(p => 
                          p.is_active && (
                            !p.job_position_id ||
                            (p.job_position_id && sameJobIds.includes(p.job_position_id))
                          )
                        );
                        
                        return eligibleUsers.length > 0 ? (
                          <div className="space-y-2">
                            {eligibleUsers.map(user => (
                              <div key={user.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                                <Checkbox
                                  id={`user-${user.id}`}
                                  checked={selectedJobUsers.includes(user.user_id)}
                                  onCheckedChange={() => toggleUserSelection(user.user_id)}
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{user.user_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex-1">
                                  {user.user_name}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            {language === 'ar' ? 'لا يوجد موظفين متاحين' : 'No users available'}
                          </p>
                        );
                      })()}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'ar' 
                        ? `تم اختيار ${selectedJobUsers.length} موظف`
                        : `${selectedJobUsers.length} user(s) selected`}
                    </p>
                  </div>
                )}
              </>
            )}

            {(editingJob || jobMode === "new") && (
              <div>
                <Label>{language === 'ar' ? 'اسم الوظيفة' : 'Job Title'}</Label>
                <Input
                  value={jobForm.name}
                  onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                  placeholder={language === 'ar' ? 'مثال: مطور برامج' : 'e.g. Software Developer'}
                />
              </div>
            )}

            <div>
              <Label>{language === 'ar' ? 'القسم' : 'Department'}</Label>
              <Select value={jobForm.departmentId} onValueChange={(v) => setJobForm({ ...jobForm, departmentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                </SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d.is_active).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSaveJob} 
              className="w-full"
              disabled={!editingJob && jobMode === "existing" && !jobForm.existingJobId}
            >
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User to Job Dialog */}
      <UserSelectionDialog
        open={assignUserDialogOpen}
        onOpenChange={setAssignUserDialogOpen}
        users={getEligibleUsersForJob(selectedJobId)}
        onSelect={handleAssignUser}
        onMultiSelect={handleAssignMultipleUsers}
        title={language === 'ar' ? 'تعيين موظفين للوظيفة' : 'Assign Users to Job'}
        multiSelect={true}
      />

      {/* Assign User to Department Dialog */}
      <UserSelectionDialog
        open={assignToDeptDialogOpen}
        onOpenChange={setAssignToDeptDialogOpen}
        users={getAllActiveUsers()}
        onSelect={handleAssignUserToDept}
        title={language === 'ar' ? 'تعيين موظف للقسم' : 'Assign User to Department'}
      />

      {/* User Profile Dialog */}
      <Dialog open={userProfileDialogOpen} onOpenChange={(open) => {
        setUserProfileDialogOpen(open);
        if (!open) setIsEditingUser(false);
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditingUser 
                ? (language === 'ar' ? 'تعديل الموظف' : 'Edit Employee')
                : (language === 'ar' ? 'بطاقة الموظف' : 'Employee Card')}
            </DialogTitle>
          </DialogHeader>
          {selectedUserProfile && !isEditingUser && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={selectedUserProfile.avatar_url || undefined} />
                <AvatarFallback className="text-3xl font-bold">{selectedUserProfile.user_name.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold">{selectedUserProfile.user_name}</h3>
                <p className="text-sm text-muted-foreground">{selectedUserProfile.email}</p>
              </div>

              <div className="w-full space-y-3 mt-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {language === 'ar' ? 'الوظيفة' : 'Job Position'}
                  </span>
                  <span className="font-medium">{getUserJobPosition(selectedUserProfile) || (language === 'ar' ? 'غير معين' : 'Not Assigned')}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {language === 'ar' ? 'القسم' : 'Department'}
                  </span>
                  <span className="font-medium">{getUserDepartment(selectedUserProfile) || (language === 'ar' ? 'غير معين' : 'Not Assigned')}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    selectedUserProfile.is_active 
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  )}>
                    {selectedUserProfile.is_active 
                      ? (language === 'ar' ? 'نشط' : 'Active') 
                      : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                  </span>
                </div>
              </div>

              {canEditUsers && (
                <Button
                  className="w-full mt-4"
                  onClick={handleStartEditUser}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
                </Button>
              )}
            </div>
          )}

          {selectedUserProfile && isEditingUser && (
            <div className="space-y-4 py-4">
              <AvatarSelector
                currentAvatar={userEditForm.avatar_url}
                onAvatarChange={(url) => setUserEditForm({ ...userEditForm, avatar_url: url })}
                userName={userEditForm.user_name}
                language={language}
              />

              <div>
                <Label>{language === 'ar' ? 'اسم المستخدم' : 'User Name'}</Label>
                <Input
                  value={userEditForm.user_name}
                  onChange={(e) => setUserEditForm({ ...userEditForm, user_name: e.target.value })}
                />
              </div>

              <div>
                <Label>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
                <Input value={userEditForm.email} disabled className="bg-muted" />
              </div>

              <div>
                <Label>{language === 'ar' ? 'رقم الجوال' : 'Mobile Number'}</Label>
                <Input
                  value={userEditForm.mobile_number}
                  onChange={(e) => setUserEditForm({ ...userEditForm, mobile_number: e.target.value })}
                />
              </div>

              <div>
                <Label>{language === 'ar' ? 'الوظيفة' : 'Job Position'}</Label>
                <Select 
                  value={userEditForm.job_position_id || "__none__"} 
                  onValueChange={(v) => setUserEditForm({ ...userEditForm, job_position_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الوظيفة' : 'Select job position'} />
                  </SelectTrigger>
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
                <Select 
                  value={userEditForm.default_department_id || "__none__"} 
                  onValueChange={(v) => setUserEditForm({ ...userEditForm, default_department_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'ar' ? 'بدون قسم' : 'No department'}</SelectItem>
                    {departments.filter(d => d.is_active).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>{language === 'ar' ? 'نشط' : 'Active'}</Label>
                <Switch
                  checked={userEditForm.is_active}
                  onCheckedChange={(checked) => setUserEditForm({ ...userEditForm, is_active: checked })}
                />
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditingUser(false)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveUser}
                  disabled={savingUser}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingUser 
                    ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                    : (language === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyHierarchy;
