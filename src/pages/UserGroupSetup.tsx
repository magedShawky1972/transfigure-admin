import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, X } from "lucide-react";

interface UserGroup {
  id: string;
  group_name: string;
  group_code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  is_active: boolean;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
}

const UserGroupSetup = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  
  const [formData, setFormData] = useState({
    group_name: "",
    group_code: "",
    description: "",
    is_active: true,
  });

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const translations = {
    ar: {
      title: "إعداد مجموعات المستخدمين",
      addGroup: "إضافة مجموعة",
      editGroup: "تعديل المجموعة",
      groupName: "اسم المجموعة",
      groupCode: "كود المجموعة",
      description: "الوصف",
      active: "نشط",
      actions: "الإجراءات",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      members: "الأعضاء",
      manageMembers: "إدارة الأعضاء",
      selectUsers: "اختر المستخدمين",
      noGroups: "لا توجد مجموعات",
      groupCreated: "تم إنشاء المجموعة بنجاح",
      groupUpdated: "تم تحديث المجموعة بنجاح",
      groupDeleted: "تم حذف المجموعة بنجاح",
      membersUpdated: "تم تحديث الأعضاء بنجاح",
      confirmDelete: "هل أنت متأكد من حذف هذه المجموعة؟",
      userName: "اسم المستخدم",
      email: "البريد الإلكتروني",
      memberCount: "عدد الأعضاء",
      status: "الحالة",
      activeStatus: "نشط",
      inactiveStatus: "غير نشط",
      currentMembers: "الأعضاء الحاليين",
    },
    en: {
      title: "User Groups Setup",
      addGroup: "Add Group",
      editGroup: "Edit Group",
      groupName: "Group Name",
      groupCode: "Group Code",
      description: "Description",
      active: "Active",
      actions: "Actions",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      members: "Members",
      manageMembers: "Manage Members",
      selectUsers: "Select Users",
      noGroups: "No groups found",
      groupCreated: "Group created successfully",
      groupUpdated: "Group updated successfully",
      groupDeleted: "Group deleted successfully",
      membersUpdated: "Members updated successfully",
      confirmDelete: "Are you sure you want to delete this group?",
      userName: "User Name",
      email: "Email",
      memberCount: "Member Count",
      status: "Status",
      activeStatus: "Active",
      inactiveStatus: "Inactive",
      currentMembers: "Current Members",
    },
  };

  const t = translations[language];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, profilesRes, membersRes] = await Promise.all([
        supabase.from("user_groups").select("*").order("group_name"),
        supabase.from("profiles").select("id, user_id, user_name, email, is_active").eq("is_active", true),
        supabase.from("user_group_members").select("*"),
      ]);

      if (groupsRes.data) setGroups(groupsRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (membersRes.data) setGroupMembers(membersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (group?: UserGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        group_name: group.group_name,
        group_code: group.group_code,
        description: group.description || "",
        is_active: group.is_active,
      });
    } else {
      setEditingGroup(null);
      setFormData({
        group_name: "",
        group_code: "",
        description: "",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.group_name || !formData.group_code) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("user_groups")
          .update({
            group_name: formData.group_name,
            group_code: formData.group_code,
            description: formData.description || null,
            is_active: formData.is_active,
          })
          .eq("id", editingGroup.id);

        if (error) throw error;
        toast.success(t.groupUpdated);
      } else {
        const { error } = await supabase.from("user_groups").insert({
          group_name: formData.group_name,
          group_code: formData.group_code,
          description: formData.description || null,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success(t.groupCreated);
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving group:", error);
      toast.error(error.message || "Error saving group");
    }
  };

  const handleDelete = async (group: UserGroup) => {
    if (!confirm(t.confirmDelete)) return;

    try {
      const { error } = await supabase.from("user_groups").delete().eq("id", group.id);
      if (error) throw error;
      toast.success(t.groupDeleted);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast.error(error.message || "Error deleting group");
    }
  };

  const handleOpenMembersDialog = (group: UserGroup) => {
    setSelectedGroup(group);
    const currentMembers = groupMembers
      .filter((m) => m.group_id === group.id)
      .map((m) => m.user_id);
    setSelectedUsers(currentMembers);
    setMembersDialogOpen(true);
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveMembers = async () => {
    if (!selectedGroup) return;

    try {
      // Delete existing members
      await supabase.from("user_group_members").delete().eq("group_id", selectedGroup.id);

      // Insert new members
      if (selectedUsers.length > 0) {
        const newMembers = selectedUsers.map((userId) => ({
          group_id: selectedGroup.id,
          user_id: userId,
        }));
        const { error } = await supabase.from("user_group_members").insert(newMembers);
        if (error) throw error;
      }

      toast.success(t.membersUpdated);
      setMembersDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving members:", error);
      toast.error(error.message || "Error saving members");
    }
  };

  const getMemberCount = (groupId: string) => {
    return groupMembers.filter((m) => m.group_id === groupId).length;
  };

  const getSelectedUsersText = () => {
    return selectedUsers
      .map((userId) => profiles.find((p) => p.user_id === userId)?.user_name)
      .filter(Boolean)
      .join("\n");
  };

  const getGroupMembersText = (groupId: string) => {
    const memberUserIds = groupMembers.filter((m) => m.group_id === groupId).map((m) => m.user_id);
    return memberUserIds
      .map((userId) => profiles.find((p) => p.user_id === userId)?.user_name)
      .filter(Boolean)
      .join("\n");
  };

  return (
    <div className={`container mx-auto p-4 md:p-6 ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl md:text-2xl">{t.title}</CardTitle>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.addGroup}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">{t.noGroups}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.groupCode}</TableHead>
                    <TableHead>{t.groupName}</TableHead>
                    <TableHead>{t.description}</TableHead>
                    <TableHead>{t.memberCount}</TableHead>
                    <TableHead>{t.currentMembers}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-mono">{group.group_code}</TableCell>
                      <TableCell className="font-medium">{group.group_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{group.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getMemberCount(group.id)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Textarea
                          value={getGroupMembersText(group.id)}
                          readOnly
                          rows={2}
                          className="bg-muted resize-none text-xs min-w-[150px]"
                          placeholder={language === "ar" ? "لا يوجد أعضاء" : "No members"}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={group.is_active ? "default" : "outline"}>
                          {group.is_active ? t.activeStatus : t.inactiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenMembersDialog(group)}
                            title={t.manageMembers}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenDialog(group)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(group)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingGroup ? t.editGroup : t.addGroup}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.groupCode} *</Label>
              <Input
                value={formData.group_code}
                onChange={(e) => setFormData({ ...formData, group_code: e.target.value })}
                placeholder="GRP001"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.groupName} *</Label>
              <Input
                value={formData.group_name}
                onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{t.active}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {t.manageMembers} - {selectedGroup?.group_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>{t.currentMembers}</Label>
              <Textarea
                value={getSelectedUsersText()}
                readOnly
                rows={4}
                className="bg-muted resize-none"
                placeholder={language === "ar" ? "لا يوجد أعضاء" : "No members"}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.selectUsers}</Label>
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.user_id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                    onClick={() => handleUserToggle(profile.user_id)}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(profile.user_id)}
                      onCheckedChange={() => handleUserToggle(profile.user_id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{profile.user_name}</div>
                      <div className="text-sm text-muted-foreground">{profile.email}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === "ar"
                  ? `تم اختيار ${selectedUsers.length} مستخدم`
                  : `${selectedUsers.length} users selected`}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSaveMembers}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserGroupSetup;
