import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, UserCircle, Eye, LayoutGrid, List, Upload, FileText, Download, X, Camera, UserPlus, Users } from "lucide-react";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Employee {
  id: string;
  employee_number: string;
  user_id: string | null;
  first_name: string;
  first_name_ar: string | null;
  last_name: string;
  last_name_ar: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  national_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  job_start_date: string;
  termination_date: string | null;
  employment_status: string;
  shift_type: string;
  fixed_shift_start: string | null;
  fixed_shift_end: string | null;
  shift_plan_id: string | null;
  attendance_type_id: string | null;
  attendance_types?: { type_name: string; type_name_ar: string | null; is_shift_based: boolean } | null;
  vacation_code_id: string | null;
  vacation_balance: number | null;
  medical_insurance_plan_id: string | null;
  basic_salary: number | null;
  manager_id: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
  profiles?: { user_name: string } | null;
}

interface Department {
  id: string;
  department_name: string;
}

interface JobPosition {
  id: string;
  position_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

interface VacationCode {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
}

interface MedicalInsurancePlan {
  id: string;
  plan_name: string;
}

interface ShiftPlan {
  id: string;
  plan_name: string;
}

interface AttendanceType {
  id: string;
  type_code: string;
  type_name: string;
  type_name_ar: string | null;
  is_shift_based: boolean;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  allow_late_minutes: number | null;
  allow_early_exit_minutes: number | null;
}

interface DocumentType {
  id: string;
  type_name: string;
  type_name_ar: string | null;
  is_mandatory: boolean;
}

interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  expiry_date: string | null;
  notes: string | null;
  document_types?: { type_name: string; type_name_ar: string | null };
}

interface EmployeeContact {
  id: string;
  employee_id: string;
  contact_type: string;
  contact_name: string;
  contact_phone: string | null;
  contact_address: string | null;
  is_emergency_contact: boolean;
  notes: string | null;
}

interface EmployeeVacationType {
  id?: string;
  employee_id: string;
  vacation_code_id: string;
  vacation_code?: VacationCode;
  balance: number;
  used_days: number;
  custom_days: number | null;
  year: number;
}

export default function EmployeeSetup() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vacationCodes, setVacationCodes] = useState<VacationCode[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<MedicalInsurancePlan[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [employeeContacts, setEmployeeContacts] = useState<EmployeeContact[]>([]);
  const [usersWithoutEmployee, setUsersWithoutEmployee] = useState<Profile[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [loadUsersDialogOpen, setLoadUsersDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [editingContact, setEditingContact] = useState<EmployeeContact | null>(null);
  
  const [selectedVacationTypes, setSelectedVacationTypes] = useState<string[]>([]);
  const [employeeVacationBalances, setEmployeeVacationBalances] = useState<EmployeeVacationType[]>([]);
  
  const [formData, setFormData] = useState({
    employee_number: "",
    user_id: "",
    first_name: "",
    first_name_ar: "",
    last_name: "",
    last_name_ar: "",
    email: "",
    phone: "",
    mobile: "",
    date_of_birth: "",
    gender: "",
    nationality: "",
    national_id: "",
    passport_number: "",
    marital_status: "",
    department_id: "",
    job_position_id: "",
    job_start_date: "",
    termination_date: "",
    employment_status: "active",
    shift_type: "fixed",
    fixed_shift_start: "",
    fixed_shift_end: "",
    shift_plan_id: "",
    attendance_type_id: "",
    vacation_balance: "",
    medical_insurance_plan_id: "",
    basic_salary: "",
    manager_id: "",
    photo_url: "",
    address: "",
  });

  const [contactFormData, setContactFormData] = useState({
    contact_type: "",
    contact_name: "",
    contact_phone: "",
    contact_address: "",
    is_emergency_contact: false,
    notes: "",
  });

  const [documentFormData, setDocumentFormData] = useState({
    document_type_id: "",
    expiry_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Handle edit query parameter from Employee Profile
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && employees.length > 0) {
      const employeeToEdit = employees.find(emp => emp.id === editId);
      if (employeeToEdit) {
        openEditDialog(employeeToEdit);
        // Clear the query parameter
        setSearchParams({});
      }
    }
  }, [searchParams, employees]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        employeesRes,
        departmentsRes,
        positionsRes,
        profilesRes,
        vacationCodesRes,
        insurancePlansRes,
        shiftPlansRes,
        docTypesRes,
        attendanceTypesRes,
      ] = await Promise.all([
        supabase
          .from("employees")
          .select(`
            *,
            departments(department_name),
            job_positions(position_name),
            attendance_types(type_name, type_name_ar, is_shift_based)
          `)
          .order("employee_number"),
        supabase.from("departments").select("id, department_name").eq("is_active", true).order("department_name"),
        supabase.from("job_positions").select("id, position_name").eq("is_active", true).order("position_name"),
        supabase.from("profiles").select("user_id, user_name, email").eq("is_active", true).order("user_name"),
        supabase.from("vacation_codes").select("id, code, name_en, name_ar").eq("is_active", true).order("code"),
        supabase.from("medical_insurance_plans").select("id, plan_name").eq("is_active", true).order("plan_name"),
        supabase.from("shift_plans").select("id, plan_name").eq("is_active", true).order("plan_name"),
        supabase.from("document_types").select("id, type_name, type_name_ar, is_mandatory").eq("is_active", true).order("type_name"),
        supabase.from("attendance_types").select("id, type_code, type_name, type_name_ar, is_shift_based, fixed_start_time, fixed_end_time, allow_late_minutes, allow_early_exit_minutes").eq("is_active", true).order("type_name"),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      setEmployees(employeesRes.data || []);
      setAllEmployees(employeesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setJobPositions(positionsRes.data || []);
      setProfiles(profilesRes.data || []);
      setVacationCodes(vacationCodesRes.data || []);
      setInsurancePlans(insurancePlansRes.data || []);
      setShiftPlans(shiftPlansRes.data || []);
      setDocumentTypes(docTypesRes.data || []);
      setAttendanceTypes(attendanceTypesRes.data || []);
      // Find users without employee records
      const allProfiles = profilesRes.data || [];
      const existingUserIds = (employeesRes.data || []).map(emp => emp.user_id).filter(Boolean);
      const usersNotLinked = allProfiles.filter(p => !existingUserIds.includes(p.user_id));
      setUsersWithoutEmployee(usersNotLinked);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openLoadUsersDialog = () => {
    setSelectedUsersToAdd([]);
    setLoadUsersDialogOpen(true);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsersToAdd(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddSelectedUsers = async () => {
    if (selectedUsersToAdd.length === 0) {
      toast.error(language === "ar" ? "يرجى اختيار مستخدم واحد على الأقل" : "Please select at least one user");
      return;
    }

    try {
      const usersToAdd = usersWithoutEmployee.filter(u => selectedUsersToAdd.includes(u.user_id));
      const newEmployees = usersToAdd.map((user, index) => {
        // Split user_name into first and last name
        const nameParts = user.user_name.trim().split(/\s+/);
        const firstName = nameParts[0] || user.user_name;
        const lastName = nameParts.slice(1).join(" ") || "-";
        
        // Generate employee number
        const timestamp = Date.now();
        const empNumber = `EMP${timestamp}${index}`;
        
        return {
          employee_number: empNumber,
          user_id: user.user_id,
          first_name: firstName,
          last_name: lastName,
          email: user.email,
          job_start_date: new Date().toISOString().split('T')[0],
          employment_status: 'active' as const,
          shift_type: 'fixed' as const,
        };
      });

      const { error } = await supabase.from("employees").insert(newEmployees);
      if (error) throw error;

      toast.success(
        language === "ar" 
          ? `تم إضافة ${newEmployees.length} موظف بنجاح` 
          : `Successfully added ${newEmployees.length} employee(s)`
      );
      setLoadUsersDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddFromUser = (user: Profile) => {
    // Split user_name into first and last name
    const nameParts = user.user_name.trim().split(/\s+/);
    const firstName = nameParts[0] || user.user_name;
    const lastName = nameParts.slice(1).join(" ") || "-";
    
    setSelectedEmployee(null);
    setFormData({
      employee_number: `EMP${Date.now()}`,
      user_id: user.user_id,
      first_name: firstName,
      first_name_ar: "",
      last_name: lastName,
      last_name_ar: "",
      email: user.email,
      phone: "",
      mobile: "",
      date_of_birth: "",
      gender: "",
      nationality: "",
      national_id: "",
      passport_number: "",
      marital_status: "",
      department_id: "",
      job_position_id: "",
      job_start_date: new Date().toISOString().split('T')[0],
      termination_date: "",
      employment_status: "active",
      shift_type: "fixed",
      fixed_shift_start: "",
      fixed_shift_end: "",
      shift_plan_id: "",
      attendance_type_id: "",
      vacation_balance: "",
      medical_insurance_plan_id: "",
      basic_salary: "",
      manager_id: "",
      photo_url: "",
      address: "",
    });
    setSelectedVacationTypes([]);
    setEmployeeVacationBalances([]);
    setLoadUsersDialogOpen(false);
    setDialogOpen(true);
  };

  const fetchEmployeeDocuments = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_documents")
        .select(`
          *,
          document_types(type_name, type_name_ar)
        `)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmployeeDocuments(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setEmployees(allEmployees);
    } else {
      const filtered = allEmployees.filter(
        (emp) =>
          emp.employee_number.toLowerCase().includes(term.toLowerCase()) ||
          emp.first_name.toLowerCase().includes(term.toLowerCase()) ||
          emp.last_name.toLowerCase().includes(term.toLowerCase()) ||
          emp.email?.toLowerCase().includes(term.toLowerCase())
      );
      setEmployees(filtered);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(language === "ar" ? "يرجى اختيار صورة" : "Please select an image file");
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("employee-photos")
        .getPublicUrl(filePath);

      setFormData({ ...formData, photo_url: urlData.publicUrl });
      toast.success(language === "ar" ? "تم رفع الصورة بنجاح" : "Photo uploaded successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedEmployee || !documentFormData.document_type_id) return;

    setUploadingDocument(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedEmployee.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from("employee_documents").insert({
        employee_id: selectedEmployee.id,
        document_type_id: documentFormData.document_type_id,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        expiry_date: documentFormData.expiry_date || null,
        notes: documentFormData.notes || null,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      toast.success(language === "ar" ? "تم رفع المستند بنجاح" : "Document uploaded successfully");
      fetchEmployeeDocuments(selectedEmployee.id);
      setDocumentFormData({ document_type_id: "", expiry_date: "", notes: "" });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDownloadDocument = async (doc: EmployeeDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    try {
      await supabase.storage.from("employee-documents").remove([filePath]);
      await supabase.from("employee_documents").delete().eq("id", docId);
      toast.success(language === "ar" ? "تم حذف المستند" : "Document deleted");
      if (selectedEmployee) {
        fetchEmployeeDocuments(selectedEmployee.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddDialog = () => {
    setSelectedEmployee(null);
    setFormData({
      employee_number: "",
      user_id: "",
      first_name: "",
      first_name_ar: "",
      last_name: "",
      last_name_ar: "",
      email: "",
      phone: "",
      mobile: "",
      date_of_birth: "",
      gender: "",
      nationality: "",
      national_id: "",
      passport_number: "",
      marital_status: "",
      department_id: "",
      job_position_id: "",
      job_start_date: "",
      termination_date: "",
      employment_status: "active",
      shift_type: "fixed",
      fixed_shift_start: "",
      fixed_shift_end: "",
      shift_plan_id: "",
      attendance_type_id: "",
      vacation_balance: "",
      medical_insurance_plan_id: "",
      basic_salary: "",
      manager_id: "",
      photo_url: "",
      address: "",
    });
    setSelectedVacationTypes([]);
    setEmployeeVacationBalances([]);
    setDialogOpen(true);
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employee_number: employee.employee_number,
      user_id: employee.user_id || "",
      first_name: employee.first_name,
      first_name_ar: employee.first_name_ar || "",
      last_name: employee.last_name,
      last_name_ar: employee.last_name_ar || "",
      email: employee.email || "",
      phone: employee.phone || "",
      mobile: employee.mobile || "",
      date_of_birth: employee.date_of_birth || "",
      gender: employee.gender || "",
      nationality: employee.nationality || "",
      national_id: employee.national_id || "",
      passport_number: (employee as any).passport_number || "",
      marital_status: (employee as any).marital_status || "",
      department_id: employee.department_id || "",
      job_position_id: employee.job_position_id || "",
      job_start_date: employee.job_start_date,
      termination_date: employee.termination_date || "",
      employment_status: employee.employment_status,
      shift_type: employee.shift_type,
      fixed_shift_start: employee.fixed_shift_start || "",
      fixed_shift_end: employee.fixed_shift_end || "",
      shift_plan_id: employee.shift_plan_id || "",
      attendance_type_id: employee.attendance_type_id || "",
      vacation_balance: employee.vacation_balance?.toString() || "",
      medical_insurance_plan_id: employee.medical_insurance_plan_id || "",
      basic_salary: employee.basic_salary?.toString() || "",
      manager_id: employee.manager_id || "",
      photo_url: employee.photo_url || "",
      address: (employee as any).address || "",
    });
    // Fetch employee vacation types and contacts
    fetchEmployeeVacationTypes(employee.id);
    fetchEmployeeContacts(employee.id);
    setDialogOpen(true);
  };

  const fetchEmployeeVacationTypes = async (employeeId: string) => {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("employee_vacation_types")
        .select("*, vacation_codes:vacation_code_id(id, code, name_en, name_ar)")
        .eq("employee_id", employeeId)
        .eq("year", currentYear);
      
      if (error) throw error;
      const vacationTypes = (data || []).map(d => ({
        id: d.id,
        employee_id: d.employee_id,
        vacation_code_id: d.vacation_code_id,
        vacation_code: d.vacation_codes as unknown as VacationCode,
        balance: d.balance || 0,
        used_days: d.used_days || 0,
        custom_days: d.custom_days,
        year: d.year || currentYear,
      }));
      setEmployeeVacationBalances(vacationTypes);
      setSelectedVacationTypes(vacationTypes.map(d => d.vacation_code_id));
    } catch (error: any) {
      console.error("Error fetching vacation types:", error);
      setSelectedVacationTypes([]);
      setEmployeeVacationBalances([]);
    }
  };

  const openDocumentDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    fetchEmployeeDocuments(employee.id);
    setDocumentDialogOpen(true);
  };

  const openContactDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    fetchEmployeeContacts(employee.id);
    setContactDialogOpen(true);
  };

  const fetchEmployeeContacts = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_contacts")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmployeeContacts(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveContact = async () => {
    if (!selectedEmployee || !contactFormData.contact_type || !contactFormData.contact_name) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      if (editingContact) {
        const { error } = await supabase
          .from("employee_contacts")
          .update({
            contact_type: contactFormData.contact_type,
            contact_name: contactFormData.contact_name,
            contact_phone: contactFormData.contact_phone || null,
            contact_address: contactFormData.contact_address || null,
            is_emergency_contact: contactFormData.is_emergency_contact,
            notes: contactFormData.notes || null,
          })
          .eq("id", editingContact.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث جهة الاتصال" : "Contact updated successfully");
      } else {
        const { error } = await supabase.from("employee_contacts").insert({
          employee_id: selectedEmployee.id,
          contact_type: contactFormData.contact_type,
          contact_name: contactFormData.contact_name,
          contact_phone: contactFormData.contact_phone || null,
          contact_address: contactFormData.contact_address || null,
          is_emergency_contact: contactFormData.is_emergency_contact,
          notes: contactFormData.notes || null,
        });

        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة جهة الاتصال" : "Contact added successfully");
      }

      setContactFormData({
        contact_type: "",
        contact_name: "",
        contact_phone: "",
        contact_address: "",
        is_emergency_contact: false,
        notes: "",
      });
      setEditingContact(null);
      fetchEmployeeContacts(selectedEmployee.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditContact = (contact: EmployeeContact) => {
    setEditingContact(contact);
    setContactFormData({
      contact_type: contact.contact_type,
      contact_name: contact.contact_name,
      contact_phone: contact.contact_phone || "",
      contact_address: contact.contact_address || "",
      is_emergency_contact: contact.is_emergency_contact,
      notes: contact.notes || "",
    });
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const { error } = await supabase.from("employee_contacts").delete().eq("id", contactId);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف جهة الاتصال" : "Contact deleted");
      if (selectedEmployee) {
        fetchEmployeeContacts(selectedEmployee.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSave = async () => {
    if (!formData.employee_number || !formData.first_name || !formData.last_name || !formData.job_start_date) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        employee_number: formData.employee_number,
        user_id: formData.user_id || null,
        first_name: formData.first_name,
        first_name_ar: formData.first_name_ar || null,
        last_name: formData.last_name,
        last_name_ar: formData.last_name_ar || null,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        photo_url: formData.photo_url || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        nationality: formData.nationality || null,
        national_id: formData.national_id || null,
        passport_number: formData.passport_number || null,
        marital_status: formData.marital_status || null,
        department_id: formData.department_id || null,
        job_position_id: formData.job_position_id || null,
        job_start_date: formData.job_start_date,
        termination_date: formData.termination_date || null,
        employment_status: formData.employment_status as any,
        shift_type: formData.shift_type as any,
        fixed_shift_start: formData.fixed_shift_start || null,
        fixed_shift_end: formData.fixed_shift_end || null,
        shift_plan_id: formData.shift_plan_id || null,
        attendance_type_id: formData.attendance_type_id || null,
        vacation_balance: formData.vacation_balance ? parseFloat(formData.vacation_balance) : null,
        medical_insurance_plan_id: formData.medical_insurance_plan_id || null,
        basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null,
        manager_id: formData.manager_id || null,
        address: formData.address || null,
      };

      let employeeId: string;

      if (selectedEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", selectedEmployee.id);
        if (error) throw error;
        employeeId = selectedEmployee.id;
        toast.success(language === "ar" ? "تم تحديث الموظف بنجاح" : "Employee updated successfully");
      } else {
        const { data, error } = await supabase.from("employees").insert(payload).select("id").single();
        if (error) throw error;
        employeeId = data.id;
        toast.success(language === "ar" ? "تم إضافة الموظف بنجاح" : "Employee added successfully");
      }

      // Update employee vacation types with balances
      const currentYear = new Date().getFullYear();
      // First delete existing for current year
      await supabase.from("employee_vacation_types").delete().eq("employee_id", employeeId).eq("year", currentYear);
      
      // Then insert new ones with balances
      if (employeeVacationBalances.length > 0) {
        const vacationTypeRecords = employeeVacationBalances.map(vb => ({
          employee_id: employeeId,
          vacation_code_id: vb.vacation_code_id,
          balance: vb.balance,
          used_days: vb.used_days,
          custom_days: vb.custom_days,
          year: currentYear,
        }));
        const { error: vacError } = await supabase.from("employee_vacation_types").insert(vacationTypeRecords);
        if (vacError) console.error("Error saving vacation types:", vacError);
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      const { error } = await supabase.from("employees").delete().eq("id", selectedEmployee.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الموظف بنجاح" : "Employee deleted successfully");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_leave":
        return "bg-yellow-100 text-yellow-800";
      case "terminated":
        return "bg-red-100 text-red-800";
      case "suspended":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            {language === "ar" ? "إعداد الموظفين" : "Employee Setup"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "card" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("card")}
              >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={openLoadUsersDialog} disabled={usersWithoutEmployee.length === 0}>
            <Users className="h-4 w-4 mr-2" />
            {language === "ar" ? `تحميل من المستخدمين (${usersWithoutEmployee.length})` : `Load from Users (${usersWithoutEmployee.length})`}
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة موظف" : "Add Employee"}
          </Button>
        </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {viewMode === "table" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الصورة" : "Photo"}</TableHead>
                    <TableHead>{language === "ar" ? "رقم الموظف" : "Employee #"}</TableHead>
                    <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                    <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                    <TableHead>{language === "ar" ? "المسمى الوظيفي" : "Position"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ البدء" : "Start Date"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        {language === "ar" ? "جاري التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        {language === "ar" ? "لا توجد بيانات" : "No data found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <Avatar>
                            <AvatarImage src={emp.photo_url || undefined} />
                            <AvatarFallback>{getInitials(emp.first_name, emp.last_name)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{emp.employee_number}</TableCell>
                        <TableCell>
                          {language === "ar"
                            ? `${emp.first_name_ar || emp.first_name} ${emp.last_name_ar || emp.last_name}`
                            : `${emp.first_name} ${emp.last_name}`}
                        </TableCell>
                        <TableCell>{emp.departments?.department_name || "-"}</TableCell>
                        <TableCell>{emp.job_positions?.position_name || "-"}</TableCell>
                        <TableCell>{format(new Date(emp.job_start_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(emp.employment_status)}`}>
                            {emp.employment_status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/employee-profile/${emp.id}`)}
                              title={language === "ar" ? "عرض" : "View"}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDocumentDialog(emp)}
                              title={language === "ar" ? "المستندات" : "Documents"}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  {language === "ar" ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : employees.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  {language === "ar" ? "لا توجد بيانات" : "No data found"}
                </div>
              ) : (
                employees.map((emp) => (
                  <Card key={emp.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 mb-3">
                          <AvatarImage src={emp.photo_url || undefined} />
                          <AvatarFallback className="text-xl">{getInitials(emp.first_name, emp.last_name)}</AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold">
                          {language === "ar"
                            ? `${emp.first_name_ar || emp.first_name} ${emp.last_name_ar || emp.last_name}`
                            : `${emp.first_name} ${emp.last_name}`}
                        </h3>
                        <p className="text-sm text-muted-foreground">{emp.employee_number}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {emp.job_positions?.position_name || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {emp.departments?.department_name || "-"}
                        </p>
                        <Badge className={`mt-2 ${getStatusColor(emp.employment_status)}`}>
                          {emp.employment_status}
                        </Badge>
                        <div className="flex items-center gap-1 mt-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/employee-profile/${emp.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDocumentDialog(emp)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee
                ? language === "ar"
                  ? "تعديل موظف"
                  : "Edit Employee"
                : language === "ar"
                ? "إضافة موظف"
                : "Add Employee"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="mb-4">
              <TabsTrigger value="info">{language === "ar" ? "المعلومات الأساسية" : "Basic Info"}</TabsTrigger>
              <TabsTrigger value="contacts">{language === "ar" ? "جهات الاتصال" : "Contacts"}</TabsTrigger>
              <TabsTrigger value="job">{language === "ar" ? "معلومات العمل" : "Job Info"}</TabsTrigger>
              <TabsTrigger value="shift">{language === "ar" ? "الورديات والإجازات" : "Shifts & Leave"}</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Photo Upload */}
                <div className="md:col-span-3 flex justify-center mb-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={formData.photo_url || undefined} />
                      <AvatarFallback>
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الموظف *" : "Employee Number *"}</Label>
                  <Input
                    value={formData.employee_number}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الاسم الأول *" : "First Name *"}</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الاسم الأول (عربي)" : "First Name (Arabic)"}</Label>
                  <Input
                    value={formData.first_name_ar}
                    onChange={(e) => setFormData({ ...formData, first_name_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم العائلة *" : "Last Name *"}</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم العائلة (عربي)" : "Last Name (Arabic)"}</Label>
                  <Input
                    value={formData.last_name_ar}
                    onChange={(e) => setFormData({ ...formData, last_name_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "ربط بمستخدم" : "Link to User"}</Label>
                  <Select
                    value={formData.user_id || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, user_id: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر مستخدم" : "Select User"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "بدون ربط" : "No Link"}</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.user_name} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الهاتف" : "Phone"}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الجوال" : "Mobile"}</Label>
                  <Input
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الجنس" : "Gender"}</Label>
                  <Select
                    value={formData.gender || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, gender: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      <SelectItem value="male">{language === "ar" ? "ذكر" : "Male"}</SelectItem>
                      <SelectItem value="female">{language === "ar" ? "أنثى" : "Female"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الجنسية" : "Nationality"}</Label>
                  <Select
                    value={formData.nationality || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, nationality: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر الجنسية" : "Select Nationality"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      <SelectItem value="Saudi Arabia">{language === "ar" ? "السعودية" : "Saudi Arabia"}</SelectItem>
                      <SelectItem value="United Arab Emirates">{language === "ar" ? "الإمارات" : "United Arab Emirates"}</SelectItem>
                      <SelectItem value="Kuwait">{language === "ar" ? "الكويت" : "Kuwait"}</SelectItem>
                      <SelectItem value="Qatar">{language === "ar" ? "قطر" : "Qatar"}</SelectItem>
                      <SelectItem value="Bahrain">{language === "ar" ? "البحرين" : "Bahrain"}</SelectItem>
                      <SelectItem value="Oman">{language === "ar" ? "عُمان" : "Oman"}</SelectItem>
                      <SelectItem value="Egypt">{language === "ar" ? "مصر" : "Egypt"}</SelectItem>
                      <SelectItem value="Jordan">{language === "ar" ? "الأردن" : "Jordan"}</SelectItem>
                      <SelectItem value="Lebanon">{language === "ar" ? "لبنان" : "Lebanon"}</SelectItem>
                      <SelectItem value="Syria">{language === "ar" ? "سوريا" : "Syria"}</SelectItem>
                      <SelectItem value="Iraq">{language === "ar" ? "العراق" : "Iraq"}</SelectItem>
                      <SelectItem value="Yemen">{language === "ar" ? "اليمن" : "Yemen"}</SelectItem>
                      <SelectItem value="Palestine">{language === "ar" ? "فلسطين" : "Palestine"}</SelectItem>
                      <SelectItem value="Morocco">{language === "ar" ? "المغرب" : "Morocco"}</SelectItem>
                      <SelectItem value="Algeria">{language === "ar" ? "الجزائر" : "Algeria"}</SelectItem>
                      <SelectItem value="Tunisia">{language === "ar" ? "تونس" : "Tunisia"}</SelectItem>
                      <SelectItem value="Libya">{language === "ar" ? "ليبيا" : "Libya"}</SelectItem>
                      <SelectItem value="Sudan">{language === "ar" ? "السودان" : "Sudan"}</SelectItem>
                      <SelectItem value="India">{language === "ar" ? "الهند" : "India"}</SelectItem>
                      <SelectItem value="Pakistan">{language === "ar" ? "باكستان" : "Pakistan"}</SelectItem>
                      <SelectItem value="Bangladesh">{language === "ar" ? "بنغلاديش" : "Bangladesh"}</SelectItem>
                      <SelectItem value="Philippines">{language === "ar" ? "الفلبين" : "Philippines"}</SelectItem>
                      <SelectItem value="Indonesia">{language === "ar" ? "إندونيسيا" : "Indonesia"}</SelectItem>
                      <SelectItem value="Sri Lanka">{language === "ar" ? "سريلانكا" : "Sri Lanka"}</SelectItem>
                      <SelectItem value="Nepal">{language === "ar" ? "نيبال" : "Nepal"}</SelectItem>
                      <SelectItem value="United States">{language === "ar" ? "الولايات المتحدة" : "United States"}</SelectItem>
                      <SelectItem value="United Kingdom">{language === "ar" ? "المملكة المتحدة" : "United Kingdom"}</SelectItem>
                      <SelectItem value="Canada">{language === "ar" ? "كندا" : "Canada"}</SelectItem>
                      <SelectItem value="Australia">{language === "ar" ? "أستراليا" : "Australia"}</SelectItem>
                      <SelectItem value="Germany">{language === "ar" ? "ألمانيا" : "Germany"}</SelectItem>
                      <SelectItem value="France">{language === "ar" ? "فرنسا" : "France"}</SelectItem>
                      <SelectItem value="Italy">{language === "ar" ? "إيطاليا" : "Italy"}</SelectItem>
                      <SelectItem value="Spain">{language === "ar" ? "إسبانيا" : "Spain"}</SelectItem>
                      <SelectItem value="Turkey">{language === "ar" ? "تركيا" : "Turkey"}</SelectItem>
                      <SelectItem value="Iran">{language === "ar" ? "إيران" : "Iran"}</SelectItem>
                      <SelectItem value="China">{language === "ar" ? "الصين" : "China"}</SelectItem>
                      <SelectItem value="Japan">{language === "ar" ? "اليابان" : "Japan"}</SelectItem>
                      <SelectItem value="South Korea">{language === "ar" ? "كوريا الجنوبية" : "South Korea"}</SelectItem>
                      <SelectItem value="Malaysia">{language === "ar" ? "ماليزيا" : "Malaysia"}</SelectItem>
                      <SelectItem value="Singapore">{language === "ar" ? "سنغافورة" : "Singapore"}</SelectItem>
                      <SelectItem value="Thailand">{language === "ar" ? "تايلاند" : "Thailand"}</SelectItem>
                      <SelectItem value="Vietnam">{language === "ar" ? "فيتنام" : "Vietnam"}</SelectItem>
                      <SelectItem value="South Africa">{language === "ar" ? "جنوب أفريقيا" : "South Africa"}</SelectItem>
                      <SelectItem value="Nigeria">{language === "ar" ? "نيجيريا" : "Nigeria"}</SelectItem>
                      <SelectItem value="Kenya">{language === "ar" ? "كينيا" : "Kenya"}</SelectItem>
                      <SelectItem value="Ethiopia">{language === "ar" ? "إثيوبيا" : "Ethiopia"}</SelectItem>
                      <SelectItem value="Brazil">{language === "ar" ? "البرازيل" : "Brazil"}</SelectItem>
                      <SelectItem value="Mexico">{language === "ar" ? "المكسيك" : "Mexico"}</SelectItem>
                      <SelectItem value="Argentina">{language === "ar" ? "الأرجنتين" : "Argentina"}</SelectItem>
                      <SelectItem value="Other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الهوية" : "National ID"}</Label>
                  <Input
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم جواز السفر" : "Passport Number"}</Label>
                  <Input
                    value={formData.passport_number}
                    onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الحالة الاجتماعية" : "Marital Status"}</Label>
                  <Select
                    value={formData.marital_status || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, marital_status: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      <SelectItem value="single">{language === "ar" ? "أعزب" : "Single"}</SelectItem>
                      <SelectItem value="married">{language === "ar" ? "متزوج" : "Married"}</SelectItem>
                      <SelectItem value="divorced">{language === "ar" ? "مطلق" : "Divorced"}</SelectItem>
                      <SelectItem value="widowed">{language === "ar" ? "أرمل" : "Widowed"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label>{language === "ar" ? "العنوان" : "Address"}</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={language === "ar" ? "أدخل العنوان الكامل" : "Enter full address"}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contacts">
              <div className="space-y-4">
                {/* Contact Form */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">
                      {editingContact 
                        ? (language === "ar" ? "تعديل جهة اتصال" : "Edit Contact")
                        : (language === "ar" ? "إضافة جهة اتصال" : "Add Contact")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "نوع جهة الاتصال *" : "Contact Type *"}</Label>
                        <Select
                          value={contactFormData.contact_type || "_none_"}
                          onValueChange={(value) => setContactFormData({ ...contactFormData, contact_type: value === "_none_" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                            <SelectItem value="emergency">{language === "ar" ? "طوارئ" : "Emergency"}</SelectItem>
                            <SelectItem value="spouse">{language === "ar" ? "زوج/زوجة" : "Spouse"}</SelectItem>
                            <SelectItem value="parent">{language === "ar" ? "والد/والدة" : "Parent"}</SelectItem>
                            <SelectItem value="sibling">{language === "ar" ? "أخ/أخت" : "Sibling"}</SelectItem>
                            <SelectItem value="child">{language === "ar" ? "ابن/ابنة" : "Child"}</SelectItem>
                            <SelectItem value="friend">{language === "ar" ? "صديق" : "Friend"}</SelectItem>
                            <SelectItem value="other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "اسم جهة الاتصال *" : "Contact Name *"}</Label>
                        <Input
                          value={contactFormData.contact_name}
                          onChange={(e) => setContactFormData({ ...contactFormData, contact_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "رقم الهاتف" : "Phone Number"}</Label>
                        <Input
                          value={contactFormData.contact_phone}
                          onChange={(e) => setContactFormData({ ...contactFormData, contact_phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "العنوان" : "Address"}</Label>
                        <Input
                          value={contactFormData.contact_address}
                          onChange={(e) => setContactFormData({ ...contactFormData, contact_address: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contactFormData.is_emergency_contact}
                        onChange={(e) => setContactFormData({ ...contactFormData, is_emergency_contact: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label className="cursor-pointer">
                        {language === "ar" ? "جهة اتصال للطوارئ" : "Emergency Contact"}
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveContact} size="sm">
                        {editingContact 
                          ? (language === "ar" ? "تحديث" : "Update")
                          : (language === "ar" ? "إضافة" : "Add")}
                      </Button>
                      {editingContact && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingContact(null);
                            setContactFormData({
                              contact_type: "",
                              contact_name: "",
                              contact_phone: "",
                              contact_address: "",
                              is_emergency_contact: false,
                              notes: "",
                            });
                          }}
                        >
                          {language === "ar" ? "إلغاء" : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Existing Contacts List */}
                {selectedEmployee && employeeContacts.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        {language === "ar" ? "جهات الاتصال المسجلة" : "Registered Contacts"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                            <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                            <TableHead>{language === "ar" ? "الهاتف" : "Phone"}</TableHead>
                            <TableHead>{language === "ar" ? "العنوان" : "Address"}</TableHead>
                            <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <Badge variant={contact.is_emergency_contact ? "destructive" : "secondary"}>
                                  {contact.contact_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{contact.contact_name}</TableCell>
                              <TableCell>{contact.contact_phone || "-"}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{contact.contact_address || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleEditContact(contact)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleDeleteContact(contact.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {selectedEmployee && employeeContacts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    {language === "ar" ? "لا توجد جهات اتصال مسجلة بعد" : "No contacts registered yet"}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="job">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "القسم" : "Department"}</Label>
                  <Select
                    value={formData.department_id || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select Department"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "المسمى الوظيفي" : "Job Position"}</Label>
                  <Select
                    value={formData.job_position_id || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, job_position_id: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر المسمى" : "Select Position"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      {jobPositions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.position_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "تاريخ بدء العمل *" : "Job Start Date *"}</Label>
                  <Input
                    type="date"
                    value={formData.job_start_date}
                    onChange={(e) => setFormData({ ...formData, job_start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "تاريخ انتهاء العقد" : "Termination Date"}</Label>
                  <Input
                    type="date"
                    value={formData.termination_date}
                    onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "حالة التوظيف" : "Employment Status"}</Label>
                  <Select
                    value={formData.employment_status}
                    onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="on_leave">{language === "ar" ? "في إجازة" : "On Leave"}</SelectItem>
                      <SelectItem value="terminated">{language === "ar" ? "منتهي" : "Terminated"}</SelectItem>
                      <SelectItem value="suspended">{language === "ar" ? "موقوف" : "Suspended"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "المدير المباشر" : "Manager"}</Label>
                  <Select
                    value={formData.manager_id || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, manager_id: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر المدير" : "Select Manager"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "بدون مدير" : "No Manager"}</SelectItem>
                      {allEmployees
                        .filter((e) => e.id !== selectedEmployee?.id)
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الراتب الأساسي" : "Basic Salary"}</Label>
                  <Input
                    type="number"
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shift">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع الحضور" : "Attendance Type"}</Label>
                  <Select
                    value={formData.attendance_type_id || "_none_"}
                    onValueChange={(value) => {
                      const selectedAttType = attendanceTypes.find(at => at.id === value);
                      setFormData({ 
                        ...formData, 
                        attendance_type_id: value === "_none_" ? "" : value,
                        // Auto-set shift_type based on attendance type
                        shift_type: selectedAttType?.is_shift_based ? "rotating" : "fixed"
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر نوع الحضور" : "Select Attendance Type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      {attendanceTypes.map((at) => (
                        <SelectItem key={at.id} value={at.id}>
                          {language === "ar" ? at.type_name_ar || at.type_name : at.type_name}
                          {at.is_shift_based && ` (${language === "ar" ? "مرتبط بتقويم الورديات" : "Shift Calendar"})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" 
                      ? "إذا كان نوع الحضور مبني على الورديات، سيتم ربطه تلقائياً بتقويم جلسات الورديات"
                      : "If attendance type is shift-based, it will be linked to shift session calendar"}
                  </p>
                </div>

                {/* Show fixed time fields only if attendance type is NOT shift-based */}
                {formData.attendance_type_id && !attendanceTypes.find(at => at.id === formData.attendance_type_id)?.is_shift_based && (
                  <>
                    {(() => {
                      const selectedAttType = attendanceTypes.find(at => at.id === formData.attendance_type_id);
                      const hasFixedTimes = selectedAttType?.fixed_start_time && selectedAttType?.fixed_end_time;
                      return (
                        <>
                          <div className="space-y-2">
                            <Label>{language === "ar" ? "بداية الدوام" : "Work Start"}</Label>
                            <Input
                              type="time"
                              value={hasFixedTimes ? selectedAttType.fixed_start_time?.slice(0, 5) || "" : formData.fixed_shift_start}
                              onChange={(e) => !hasFixedTimes && setFormData({ ...formData, fixed_shift_start: e.target.value })}
                              disabled={!!hasFixedTimes}
                              className={hasFixedTimes ? "bg-muted" : ""}
                            />
                            {hasFixedTimes && (
                              <p className="text-xs text-muted-foreground">
                                {language === "ar" ? "محدد من إعداد نوع الحضور" : "Set from attendance type setup"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>{language === "ar" ? "نهاية الدوام" : "Work End"}</Label>
                            <Input
                              type="time"
                              value={hasFixedTimes ? selectedAttType.fixed_end_time?.slice(0, 5) || "" : formData.fixed_shift_end}
                              onChange={(e) => !hasFixedTimes && setFormData({ ...formData, fixed_shift_end: e.target.value })}
                              disabled={!!hasFixedTimes}
                              className={hasFixedTimes ? "bg-muted" : ""}
                            />
                            {hasFixedTimes && (
                              <p className="text-xs text-muted-foreground">
                                {language === "ar" ? "محدد من إعداد نوع الحضور" : "Set from attendance type setup"}
                              </p>
                            )}
                          </div>
                          {selectedAttType && (selectedAttType.allow_late_minutes || selectedAttType.allow_early_exit_minutes) ? (
                            <div className="md:col-span-2 p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                {language === "ar" 
                                  ? `السماح بالتأخير: ${selectedAttType.allow_late_minutes || 0} دقيقة | السماح بالخروج المبكر: ${selectedAttType.allow_early_exit_minutes || 0} دقيقة`
                                  : `Late allowance: ${selectedAttType.allow_late_minutes || 0} min | Early exit: ${selectedAttType.allow_early_exit_minutes || 0} min`}
                              </p>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                )}

                {/* Show info message when shift-based attendance type is selected */}
                {formData.attendance_type_id && attendanceTypes.find(at => at.id === formData.attendance_type_id)?.is_shift_based && (
                  <div className="md:col-span-2 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" 
                        ? "سيتم تحديد أوقات الحضور والانصراف بناءً على جلسات الورديات (فتح/إغلاق) في تقويم الورديات"
                        : "Working hours will be determined based on shift sessions (open/close) from the shift calendar"}
                    </p>
                  </div>
                )}

                <div className="space-y-2 md:col-span-3">
                  <Label>{language === "ar" ? "أنواع الإجازات والأرصدة" : "Vacation Types & Balances"}</Label>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">{language === "ar" ? "تفعيل" : "Enable"}</TableHead>
                          <TableHead>{language === "ar" ? "نوع الإجازة" : "Vacation Type"}</TableHead>
                          <TableHead className="w-24">{language === "ar" ? "الرصيد" : "Balance"}</TableHead>
                          <TableHead className="w-24">{language === "ar" ? "المستخدم" : "Used"}</TableHead>
                          <TableHead className="w-24">{language === "ar" ? "المتبقي" : "Remaining"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vacationCodes.map((vc) => {
                          const existingVac = employeeVacationBalances.find(v => v.vacation_code_id === vc.id);
                          const isSelected = selectedVacationTypes.includes(vc.id);
                          return (
                            <TableRow key={vc.id} className={!isSelected ? "opacity-50" : ""}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVacationTypes([...selectedVacationTypes, vc.id]);
                                      setEmployeeVacationBalances([...employeeVacationBalances, {
                                        employee_id: selectedEmployee?.id || "",
                                        vacation_code_id: vc.id,
                                        balance: 0,
                                        used_days: 0,
                                        custom_days: null,
                                        year: new Date().getFullYear(),
                                      }]);
                                    } else {
                                      setSelectedVacationTypes(selectedVacationTypes.filter(id => id !== vc.id));
                                      setEmployeeVacationBalances(employeeVacationBalances.filter(v => v.vacation_code_id !== vc.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {language === "ar" ? vc.name_ar || vc.name_en : vc.name_en}
                                </span>
                                <span className="text-muted-foreground ml-2">({vc.code})</span>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-8 w-20"
                                  value={existingVac?.balance || 0}
                                  disabled={!isSelected}
                                  onChange={(e) => {
                                    const newBalance = parseFloat(e.target.value) || 0;
                                    if (existingVac) {
                                      setEmployeeVacationBalances(employeeVacationBalances.map(v => 
                                        v.vacation_code_id === vc.id ? { ...v, balance: newBalance } : v
                                      ));
                                    } else {
                                      setEmployeeVacationBalances([...employeeVacationBalances, {
                                        employee_id: selectedEmployee?.id || "",
                                        vacation_code_id: vc.id,
                                        balance: newBalance,
                                        used_days: 0,
                                        custom_days: null,
                                        year: new Date().getFullYear(),
                                      }]);
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-8 w-20"
                                  value={existingVac?.used_days || 0}
                                  disabled={!isSelected}
                                  onChange={(e) => {
                                    const newUsed = parseFloat(e.target.value) || 0;
                                    if (existingVac) {
                                      setEmployeeVacationBalances(employeeVacationBalances.map(v => 
                                        v.vacation_code_id === vc.id ? { ...v, used_days: newUsed } : v
                                      ));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <span className={`font-medium ${(existingVac?.balance || 0) - (existingVac?.used_days || 0) < 0 ? "text-destructive" : "text-green-600"}`}>
                                  {((existingVac?.balance || 0) - (existingVac?.used_days || 0)).toFixed(1)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" 
                      ? `تم تحديد ${selectedVacationTypes.length} نوع إجازة للسنة ${new Date().getFullYear()}`
                      : `${selectedVacationTypes.length} vacation type(s) selected for year ${new Date().getFullYear()}`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "التأمين الطبي" : "Medical Insurance"}</Label>
                  <Select
                    value={formData.medical_insurance_plan_id || "_none_"}
                    onValueChange={(value) => setFormData({ ...formData, medical_insurance_plan_id: value === "_none_" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                      {insurancePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.plan_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Management Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "ar"
                ? `مستندات ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`
                : `Documents for ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
            </DialogTitle>
          </DialogHeader>

          {/* Upload Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">{language === "ar" ? "رفع مستند جديد" : "Upload New Document"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المستند *" : "Document Type *"}</Label>
                <Select
                  value={documentFormData.document_type_id || "_none_"}
                  onValueChange={(value) => setDocumentFormData({ ...documentFormData, document_type_id: value === "_none_" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">{language === "ar" ? "اختر" : "Select"}</SelectItem>
                    {documentTypes.map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>
                        {language === "ar" ? dt.type_name_ar || dt.type_name : dt.type_name}
                        {dt.is_mandatory && " *"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</Label>
                <Input
                  type="date"
                  value={documentFormData.expiry_date}
                  onChange={(e) => setDocumentFormData({ ...documentFormData, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Input
                value={documentFormData.notes}
                onChange={(e) => setDocumentFormData({ ...documentFormData, notes: e.target.value })}
              />
            </div>
            <Button
              onClick={() => documentInputRef.current?.click()}
              disabled={!documentFormData.document_type_id || uploadingDocument}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingDocument
                ? language === "ar"
                  ? "جاري الرفع..."
                  : "Uploading..."
                : language === "ar"
                ? "اختيار ملف"
                : "Select File"}
            </Button>
            <input
              ref={documentInputRef}
              type="file"
              className="hidden"
              onChange={handleDocumentUpload}
            />
          </div>

          {/* Documents List */}
          <div className="space-y-2">
            <h4 className="font-medium">{language === "ar" ? "المستندات المرفوعة" : "Uploaded Documents"}</h4>
            {employeeDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {language === "ar" ? "لا توجد مستندات" : "No documents"}
              </p>
            ) : (
              <div className="space-y-2">
                {employeeDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? doc.document_types?.type_name_ar || doc.document_types?.type_name
                            : doc.document_types?.type_name}
                          {doc.expiry_date && ` • ${language === "ar" ? "ينتهي" : "Expires"}: ${doc.expiry_date}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadDocument(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>
              {language === "ar" ? "إغلاق" : "Close"}
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
              ? `هل أنت متأكد من حذف الموظف ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}؟`
              : `Are you sure you want to delete employee ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`}
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

      {/* Load Users Dialog */}
      <Dialog open={loadUsersDialogOpen} onOpenChange={setLoadUsersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === "ar" ? "تحميل موظفين من المستخدمين" : "Load Employees from Users"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === "ar" 
                ? "المستخدمون التاليون ليس لديهم سجل موظف. يمكنك تحديد المستخدمين لإضافتهم كموظفين أو النقر على مستخدم لتعديل بياناته قبل الإضافة."
                : "The following users don't have an employee record. You can select users to add them as employees or click on a user to edit their data before adding."}
            </p>

            {usersWithoutEmployee.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جميع المستخدمين لديهم سجلات موظفين" : "All users have employee records"}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {language === "ar" 
                      ? `${selectedUsersToAdd.length} مستخدم محدد`
                      : `${selectedUsersToAdd.length} user(s) selected`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedUsersToAdd.length === usersWithoutEmployee.length) {
                        setSelectedUsersToAdd([]);
                      } else {
                        setSelectedUsersToAdd(usersWithoutEmployee.map(u => u.user_id));
                      }
                    }}
                  >
                    {selectedUsersToAdd.length === usersWithoutEmployee.length
                      ? (language === "ar" ? "إلغاء تحديد الكل" : "Deselect All")
                      : (language === "ar" ? "تحديد الكل" : "Select All")}
                  </Button>
                </div>

                <div className="border rounded-md max-h-[400px] overflow-y-auto">
                  {usersWithoutEmployee.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUsersToAdd.includes(user.user_id)}
                          onChange={() => toggleUserSelection(user.user_id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div>
                          <p className="font-medium">{user.user_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddFromUser(user)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        {language === "ar" ? "إضافة وتعديل" : "Add & Edit"}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadUsersDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={handleAddSelectedUsers} 
              disabled={selectedUsersToAdd.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar" 
                ? `إضافة ${selectedUsersToAdd.length} موظف`
                : `Add ${selectedUsersToAdd.length} Employee(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
