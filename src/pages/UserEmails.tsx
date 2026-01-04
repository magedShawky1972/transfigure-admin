import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Copy, Check, ChevronsUpDown, Upload, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserEmail {
  id: string;
  user_name: string;
  email: string;
  password: string | null;
  host: string;
  description: string | null;
  owner: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean | null;
  last_error: string | null;
  last_checked_at: string | null;
}

const UserEmails = () => {
  const { language } = useLanguage();
  const [userEmails, setUserEmails] = useState<UserEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<UserEmail | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [pendingPasswordId, setPendingPasswordId] = useState<string | null>(null);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [hostOptions, setHostOptions] = useState<string[]>(["Hostinger", "Google"]);
  const [hostOpen, setHostOpen] = useState(false);
  const [newHostValue, setNewHostValue] = useState("");
  const [checkingEmails, setCheckingEmails] = useState<Record<string, boolean>>({});
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  const [formData, setFormData] = useState({
    user_name: "",
    email: "",
    password: "",
    host: "Hostinger",
    description: "",
    owner: "",
  });

  useEffect(() => {
    fetchUserEmails();
  }, []);

  useEffect(() => {
    // Extract unique hosts from existing data
    const existingHosts = new Set(userEmails.map(e => e.host).filter(Boolean));
    const defaultHosts = ["Hostinger", "Google"];
    const allHosts = [...new Set([...defaultHosts, ...existingHosts])];
    setHostOptions(allHosts);
  }, [userEmails]);

  const fetchUserEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserEmails(data || []);
    } catch (error) {
      console.error("Error fetching user emails:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEmail(null);
    setFormData({
      user_name: "",
      email: "",
      password: "",
      host: "Hostinger",
      description: "",
      owner: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (userEmail: UserEmail) => {
    setEditingEmail(userEmail);
    setFormData({
      user_name: userEmail.user_name,
      email: userEmail.email,
      password: userEmail.password || "",
      host: userEmail.host,
      description: userEmail.description || "",
      owner: userEmail.owner || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.user_name || !formData.email) {
        toast.error(language === "ar" ? "الاسم والبريد مطلوبان" : "Name and email are required");
        return;
      }

      if (editingEmail) {
        const { error } = await supabase
          .from("user_emails")
          .update({
            user_name: formData.user_name,
            email: formData.email,
            password: formData.password || null,
            host: formData.host,
            description: formData.description || null,
            owner: formData.owner || null,
          })
          .eq("id", editingEmail.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        // Get current user id
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("user_emails").insert({
          user_name: formData.user_name,
          email: formData.email,
          password: formData.password || null,
          host: formData.host,
          description: formData.description || null,
          owner: formData.owner || null,
          user_id: user?.id || null,
        });

        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setIsDialogOpen(false);
      fetchUserEmails();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(language === "ar" ? "خطأ في الحفظ" : "Error saving");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) {
      return;
    }

    try {
      const { error } = await supabase.from("user_emails").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      fetchUserEmails();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(language === "ar" ? "خطأ في الحذف" : "Error deleting");
    }
  };

  const handleShowPassword = (id: string) => {
    if (showPasswords[id]) {
      setShowPasswords((prev) => ({ ...prev, [id]: false }));
    } else {
      setPendingPasswordId(id);
      setVerificationPassword("");
      setIsPasswordDialogOpen(true);
    }
  };

  const handleVerifyPassword = () => {
    if (verificationPassword === "159753") {
      if (pendingPasswordId) {
        setShowPasswords((prev) => ({ ...prev, [pendingPasswordId]: true }));
      }
      setIsPasswordDialogOpen(false);
      setPendingPasswordId(null);
      setVerificationPassword("");
    } else {
      toast.error(language === "ar" ? "كلمة المرور غير صحيحة" : "Incorrect password");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === "ar" ? "تم نسخ كلمة المرور" : "Password copied");
  };

  const handleAddNewHost = () => {
    if (newHostValue.trim() && !hostOptions.includes(newHostValue.trim())) {
      const newHost = newHostValue.trim();
      setHostOptions([...hostOptions, newHost]);
      setFormData({ ...formData, host: newHost });
      setNewHostValue("");
      setHostOpen(false);
    }
  };

  const handleUpdateAllUserSetup = async () => {
    if (userEmails.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتحديث" : "No data to update");
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    toast.info(language === "ar" ? "جاري التحديث..." : "Updating...");

    for (const userEmail of userEmails) {
      if (!userEmail.email || !userEmail.password) {
        skippedCount++;
        continue;
      }

      try {
        const { data: profile, error: findError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", userEmail.email)
          .single();

        if (findError || !profile) {
          errorCount++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ email_password: userEmail.password })
          .eq("id", profile.id);

        if (updateError) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        language === "ar" 
          ? `تم تحديث ${successCount} مستخدم بنجاح` 
          : `Updated ${successCount} users successfully`
      );
    }
    if (errorCount > 0) {
      toast.warning(
        language === "ar" 
          ? `لم يتم العثور على ${errorCount} مستخدم في إعدادات المستخدمين` 
          : `${errorCount} users not found in User Setup`
      );
    }
    if (successCount === 0 && errorCount === 0) {
      toast.info(
        language === "ar" 
          ? "لا توجد بيانات صالحة للتحديث" 
          : "No valid data to update"
      );
    }
  };

  // Check single email connection
  const handleCheckEmail = async (userEmail: UserEmail) => {
    if (!userEmail.password) {
      toast.error(language === "ar" ? "كلمة المرور مطلوبة للفحص" : "Password required for check");
      return;
    }

    setCheckingEmails((prev) => ({ ...prev, [userEmail.id]: true }));

    try {
      const { data, error } = await supabase.functions.invoke("test-email-connection", {
        body: {
          emailId: userEmail.id,
          email: userEmail.email,
          password: userEmail.password,
          host: userEmail.host,
        },
      });

      if (error) throw error;

      if (data.isActive) {
        toast.success(language === "ar" ? `${userEmail.email} يعمل بنجاح` : `${userEmail.email} is working`);
      } else {
        toast.error(language === "ar" ? `${userEmail.email}: ${data.error}` : `${userEmail.email}: ${data.error}`);
      }

      fetchUserEmails();
    } catch (error: any) {
      console.error("Error checking email:", error);
      toast.error(language === "ar" ? "خطأ في فحص البريد" : "Error checking email");
    } finally {
      setCheckingEmails((prev) => ({ ...prev, [userEmail.id]: false }));
    }
  };

  // Check all emails
  const handleCheckAllEmails = async () => {
    const emailsWithPassword = userEmails.filter((e) => e.password);
    if (emailsWithPassword.length === 0) {
      toast.error(language === "ar" ? "لا توجد بريدات بكلمات مرور" : "No emails with passwords");
      return;
    }

    setIsCheckingAll(true);
    toast.info(language === "ar" ? `جاري فحص ${emailsWithPassword.length} بريد...` : `Checking ${emailsWithPassword.length} emails...`);

    let activeCount = 0;
    let errorCount = 0;

    for (const userEmail of emailsWithPassword) {
      setCheckingEmails((prev) => ({ ...prev, [userEmail.id]: true }));

      try {
        const { data, error } = await supabase.functions.invoke("test-email-connection", {
          body: {
            emailId: userEmail.id,
            email: userEmail.email,
            password: userEmail.password,
            host: userEmail.host,
          },
        });

        if (error) throw error;

        if (data.isActive) {
          activeCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error("Error checking email:", error);
        errorCount++;
      } finally {
        setCheckingEmails((prev) => ({ ...prev, [userEmail.id]: false }));
      }
    }

    await fetchUserEmails();
    setIsCheckingAll(false);

    toast.success(
      language === "ar"
        ? `تم الفحص: ${activeCount} يعمل، ${errorCount} فشل`
        : `Check complete: ${activeCount} working, ${errorCount} failed`
    );
  };

  const filteredEmails = userEmails.filter(
    (item) =>
      item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.owner || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "المستخدمين والبريد" : "Users & Mails"}
        </h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCheckAllEmails}
            disabled={isCheckingAll}
          >
            {isCheckingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {language === "ar" ? "فحص الكل" : "Check All"}
          </Button>
          <Button variant="secondary" onClick={handleUpdateAllUserSetup}>
            <Upload className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحديث إعدادات المستخدمين" : "Update User Setup"}
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة" : "Add"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "اسم المستخدم" : "User Name"}</TableHead>
                <TableHead>{language === "ar" ? "البريد الإلكتروني" : "Email"}</TableHead>
                <TableHead>{language === "ar" ? "كلمة المرور" : "Password"}</TableHead>
                <TableHead>{language === "ar" ? "الاستضافة" : "Host"}</TableHead>
                <TableHead>{language === "ar" ? "الخطأ" : "Error"}</TableHead>
                <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                <TableHead>{language === "ar" ? "المالك" : "Owner"}</TableHead>
                <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmails.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {checkingEmails[item.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : item.is_active === true ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : item.is_active === false ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleCheckEmail(item)}
                        disabled={checkingEmails[item.id] || !item.password}
                      >
                        {checkingEmails[item.id] ? (
                          language === "ar" ? "جاري..." : "..."
                        ) : (
                          language === "ar" ? "فحص" : "Check"
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{item.user_name}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {showPasswords[item.id] ? item.password || "-" : "••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleShowPassword(item.id)}
                      >
                        {showPasswords[item.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      {showPasswords[item.id] && item.password && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(item.password!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.host}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {item.last_error ? (
                      <span className="text-xs text-destructive line-clamp-2" title={item.last_error}>
                        {item.last_error}
                      </span>
                    ) : item.is_active === true ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {language === "ar" ? "يعمل" : "Working"}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{item.description || "-"}</TableCell>
                  <TableCell>{item.owner || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmails.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingEmail
                ? language === "ar"
                  ? "تعديل"
                  : "Edit"
                : language === "ar"
                ? "إضافة جديد"
                : "Add New"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "اسم المستخدم" : "User Name"}</Label>
              <Input
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "كلمة المرور" : "Password"}</Label>
              <Input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الاستضافة" : "Host"}</Label>
              <Popover open={hostOpen} onOpenChange={setHostOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={hostOpen}
                    className="w-full justify-between"
                  >
                    {formData.host || (language === "ar" ? "اختر الاستضافة..." : "Select host...")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder={language === "ar" ? "بحث أو إضافة جديد..." : "Search or add new..."} 
                      value={newHostValue}
                      onValueChange={setNewHostValue}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={handleAddNewHost}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {language === "ar" ? `إضافة "${newHostValue}"` : `Add "${newHostValue}"`}
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {hostOptions.map((host) => (
                          <CommandItem
                            key={host}
                            value={host}
                            onSelect={() => {
                              setFormData({ ...formData, host });
                              setHostOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.host === host ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {host}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "المالك" : "Owner"}</Label>
              <Input
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-sm" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "أدخل كلمة المرور للعرض" : "Enter Password to View"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={verificationPassword}
              onChange={(e) => setVerificationPassword(e.target.value)}
              placeholder={language === "ar" ? "كلمة المرور" : "Password"}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleVerifyPassword}>
              {language === "ar" ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserEmails;