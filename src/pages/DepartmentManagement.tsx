import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const departmentSchema = z.object({
  department_name: z.string().min(2, "Name must be at least 2 characters"),
  department_code: z.string().min(2, "Code must be at least 2 characters"),
  description: z.string().optional(),
});

type Department = {
  id: string;
  department_name: string;
  department_code: string;
  description: string | null;
  is_active: boolean;
};

type Profile = {
  user_id: string;
  user_name: string;
  email: string;
};

type DepartmentAdmin = {
  id: string;
  department_id: string;
  user_id: string;
  profiles: {
    user_name: string;
    email: string;
  };
};

type DepartmentMember = {
  id: string;
  department_id: string;
  user_id: string;
  profiles: {
    user_name: string;
    email: string;
  };
};

const DepartmentManagement = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<DepartmentAdmin[]>([]);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDept, setOpenDept] = useState(false);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("");

  const form = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      department_name: "",
      department_code: "",
      description: "",
    },
  });

  useEffect(() => {
    fetchDepartments();
    fetchProfiles();
    fetchAdmins();
    fetchMembers();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("department_admins")
        .select("*");

      if (error) throw error;
      
      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name, email")
          .in("user_id", userIds);
        
        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
        
        const adminsWithProfiles = data.map(admin => ({
          ...admin,
          profiles: profileMap.get(admin.user_id) || { user_name: "Unknown", email: "" }
        }));
        
        setAdmins(adminsWithProfiles);
      } else {
        setAdmins([]);
      }
    } catch (error: any) {
      console.error("Error fetching admins:", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("department_members")
        .select("*");

      if (error) throw error;
      
      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name, email")
          .in("user_id", userIds);
        
        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
        
        const membersWithProfiles = data.map(member => ({
          ...member,
          profiles: profileMap.get(member.user_id) || { user_name: "Unknown", email: "" }
        }));
        
        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error("Error fetching members:", error);
    }
  };

  const onSubmitDepartment = async (values: z.infer<typeof departmentSchema>) => {
    try {
      const { error } = await supabase
        .from("departments")
        .insert({
          department_name: values.department_name,
          department_code: values.department_code,
          description: values.description || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      setOpenDept(false);
      form.reset();
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddAdmin = async (userId: string) => {
    if (!selectedDept) return;

    try {
      const { error } = await supabase.from("department_admins").insert({
        department_id: selectedDept,
        user_id: userId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Admin added to department",
      });

      setOpenAdmin(false);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedDept) return;

    try {
      const { error } = await supabase.from("department_members").insert({
        department_id: selectedDept,
        user_id: userId,
      });

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تمت إضافة عضو إلى القسم' : 'Member added to department',
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("department_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تمت إزالة العضو من القسم' : 'Member removed from department',
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    try {
      const { error } = await supabase
        .from("department_admins")
        .delete()
        .eq("id", adminId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Admin removed from department",
      });

      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getDepartmentAdmins = (deptId: string) => {
    return admins.filter(a => a.department_id === deptId);
  };

  const getDepartmentMembers = (deptId: string) => {
    return members.filter(m => m.department_id === deptId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'إدارة الأقسام' : 'Department Management'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' ? 'إدارة الأقسام وتعيين المسؤولين' : 'Manage departments and assign admins'}
          </p>
        </div>
        <Dialog open={openDept} onOpenChange={setOpenDept}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إنشاء قسم' : 'Create Department'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إنشاء قسم جديد' : 'Create New Department'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitDepartment)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="department_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'اسم القسم' : 'Department Name'}</FormLabel>
                      <FormControl>
                        <Input placeholder={language === 'ar' ? 'مثال: الدعم الفني' : 'e.g. Technical Support'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'كود القسم' : 'Department Code'}</FormLabel>
                      <FormControl>
                        <Input placeholder={language === 'ar' ? 'مثال: TECH' : 'e.g. TECH'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الوصف (اختياري)' : 'Description (Optional)'}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={language === 'ar' ? 'وصف القسم' : 'Department description'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenDept(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button type="submit">{language === 'ar' ? 'إنشاء' : 'Create'}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading departments...'}</div>
      ) : (
        <div className="grid gap-4">
          {departments.map((dept) => {
            const deptAdmins = getDepartmentAdmins(dept.id);
            const deptMembers = getDepartmentMembers(dept.id);
            return (
              <Card key={dept.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{dept.department_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === 'ar' ? 'الكود' : 'Code'}: {dept.department_code}
                      </p>
                      {dept.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {dept.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={dept.is_active ? "default" : "secondary"}>
                      {dept.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-sm">{language === 'ar' ? 'مسؤولو القسم' : 'Department Admins'}</h4>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDept(dept.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {language === 'ar' ? 'إضافة مسؤول' : 'Add Admin'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{language === 'ar' ? 'إضافة مسؤول قسم' : 'Add Department Admin'}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            {profiles.map((profile) => (
                              <div
                                key={profile.user_id}
                                className="flex justify-between items-center p-3 border rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{profile.user_name}</p>
                                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddAdmin(profile.user_id)}
                                  disabled={deptAdmins.some(a => a.user_id === profile.user_id)}
                                >
                                  {deptAdmins.some(a => a.user_id === profile.user_id)
                                    ? (language === 'ar' ? 'مسؤول بالفعل' : 'Already Admin')
                                    : (language === 'ar' ? 'إضافة' : 'Add')}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {deptAdmins.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{language === 'ar' ? 'لم يتم تعيين مسؤولين' : 'No admins assigned'}</p>
                    ) : (
                      <div className="space-y-2">
                        {deptAdmins.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex justify-between items-center p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{admin.profiles.user_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {admin.profiles.email}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveAdmin(admin.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-sm">{language === 'ar' ? 'موظفو القسم' : 'Department Staff'}</h4>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDept(dept.id)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              {language === 'ar' ? 'إضافة موظف' : 'Add Staff'}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{language === 'ar' ? 'إضافة موظف إلى القسم' : 'Add Staff to Department'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2">
                              {profiles.map((profile) => (
                                <div
                                  key={profile.user_id}
                                  className="flex justify-between items-center p-3 border rounded-lg"
                                >
                                  <div>
                                    <p className="font-medium">{profile.user_name}</p>
                                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddMember(profile.user_id)}
                                    disabled={deptMembers.some(m => m.user_id === profile.user_id)}
                                  >
                                    {deptMembers.some(m => m.user_id === profile.user_id)
                                      ? (language === 'ar' ? 'موظف بالفعل' : 'Already Staff')
                                      : (language === 'ar' ? 'إضافة' : 'Add')}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {deptMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{language === 'ar' ? 'لم يتم تعيين موظفين' : 'No staff assigned'}</p>
                      ) : (
                        <div className="space-y-2">
                          {deptMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{member.profiles.user_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {member.profiles.email}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;
