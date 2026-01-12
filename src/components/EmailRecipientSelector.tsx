import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Users, Contact, Group, Plus, Trash2, Search, X, Edit, ChevronDown } from "lucide-react";

interface CompanyUser {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
}

interface EmailContact {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  notes: string | null;
}

interface UserGroup {
  id: string;
  group_name: string;
  group_code: string;
  members: { user_id: string; email: string; user_name: string }[];
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isAdmin: boolean;
}

export const EmailRecipientSelector = ({ label, value, onChange, isAdmin }: Props) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected items
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // Contact management dialog (admin only)
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [contactForm, setContactForm] = useState({
    email: "",
    display_name: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    // Parse value string into array
    if (value) {
      setSelectedEmails(value.split(",").map(e => e.trim()).filter(Boolean));
    } else {
      setSelectedEmails([]);
    }
  }, [value]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch company users
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, user_id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (usersError) throw usersError;
      setCompanyUsers(users || []);

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("email_contacts")
        .select("*")
        .eq("is_active", true)
        .order("display_name");

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);

      // Fetch user groups with members
      const { data: groupsData, error: groupsError } = await supabase
        .from("user_groups")
        .select("id, group_name, group_code")
        .eq("is_active", true)
        .order("group_name");

      if (groupsError) throw groupsError;

      // Fetch all group members at once
      const { data: allMembers } = await supabase
        .from("user_group_members")
        .select("group_id, user_id");

      // Get all profiles for members
      const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("user_id, email, user_name")
        .in("user_id", memberUserIds);

      // Create a map for quick profile lookup
      const profileMap = new Map((memberProfiles || []).map(p => [p.user_id, p]));

      // Build groups with members
      const groupsWithMembers: UserGroup[] = (groupsData || []).map(group => {
        const groupMembers = (allMembers || [])
          .filter(m => m.group_id === group.id)
          .map(m => {
            const profile = profileMap.get(m.user_id);
            return profile ? {
              user_id: m.user_id,
              email: profile.email,
              user_name: profile.user_name,
            } : null;
          })
          .filter(Boolean) as { user_id: string; email: string; user_name: string }[];

        return { ...group, members: groupMembers };
      });
      setUserGroups(groupsWithMembers);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmail = (email: string) => {
    const newSelected = selectedEmails.includes(email)
      ? selectedEmails.filter(e => e !== email)
      : [...selectedEmails, email];
    setSelectedEmails(newSelected);
    onChange(newSelected.join(", "));
  };

  const handleSelectGroup = (group: UserGroup) => {
    const groupEmails = group.members.map(m => m.email);
    const allSelected = groupEmails.every(e => selectedEmails.includes(e));
    
    let newSelected: string[];
    if (allSelected) {
      // Deselect all group members
      newSelected = selectedEmails.filter(e => !groupEmails.includes(e));
    } else {
      // Select all group members
      newSelected = [...new Set([...selectedEmails, ...groupEmails])];
    }
    setSelectedEmails(newSelected);
    onChange(newSelected.join(", "));
  };

  const removeEmail = (email: string) => {
    const newSelected = selectedEmails.filter(e => e !== email);
    setSelectedEmails(newSelected);
    onChange(newSelected.join(", "));
  };

  // Contact management functions (admin only)
  const openAddContact = () => {
    setEditingContact(null);
    setContactForm({ email: "", display_name: "", phone: "", notes: "" });
    setIsContactDialogOpen(true);
  };

  const openEditContact = (contact: EmailContact) => {
    setEditingContact(contact);
    setContactForm({
      email: contact.email,
      display_name: contact.display_name || "",
      phone: contact.phone || "",
      notes: contact.notes || "",
    });
    setIsContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.email) {
      toast.error(isArabic ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }

    try {
      if (editingContact) {
        const { error } = await supabase
          .from("email_contacts")
          .update({
            email: contactForm.email,
            display_name: contactForm.display_name || null,
            phone: contactForm.phone || null,
            notes: contactForm.notes || null,
          })
          .eq("id", editingContact.id);

        if (error) throw error;
        toast.success(isArabic ? "تم تحديث جهة الاتصال" : "Contact updated");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("email_contacts")
          .insert({
            email: contactForm.email,
            display_name: contactForm.display_name || null,
            phone: contactForm.phone || null,
            notes: contactForm.notes || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success(isArabic ? "تم إضافة جهة الاتصال" : "Contact added");
      }

      setIsContactDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast.error(error.message || (isArabic ? "خطأ في حفظ جهة الاتصال" : "Error saving contact"));
    }
  };

  const handleDeleteContact = async (contact: EmailContact) => {
    try {
      const { error } = await supabase
        .from("email_contacts")
        .update({ is_active: false })
        .eq("id", contact.id);

      if (error) throw error;
      toast.success(isArabic ? "تم حذف جهة الاتصال" : "Contact deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error(isArabic ? "خطأ في حذف جهة الاتصال" : "Error deleting contact");
    }
  };

  // Filter functions
  const filteredUsers = companyUsers.filter(u =>
    u.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    (c.display_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = userGroups.filter(g =>
    g.group_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {/* Selected emails display */}
      <div className="flex flex-wrap gap-1 min-h-10 p-2 border rounded-md bg-background">
        {selectedEmails.map((email, index) => (
          <Badge key={index} variant="secondary" className="flex items-center gap-1">
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {/* Admin can type directly, others use selector */}
        {isAdmin ? (
          <Input
            value=""
            onChange={(e) => {
              if (e.target.value.includes(",")) {
                const newEmails = e.target.value.split(",").map(e => e.trim()).filter(Boolean);
                const updated = [...new Set([...selectedEmails, ...newEmails])];
                setSelectedEmails(updated);
                onChange(updated.join(", "));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const input = e.currentTarget.value.trim();
                if (input && !selectedEmails.includes(input)) {
                  const updated = [...selectedEmails, input];
                  setSelectedEmails(updated);
                  onChange(updated.join(", "));
                  e.currentTarget.value = "";
                }
              }
            }}
            placeholder={isArabic ? "أدخل البريد أو اضغط للاختيار" : "Type email or click to select"}
            className="flex-1 min-w-[200px] border-0 shadow-none focus-visible:ring-0 px-1"
          />
        ) : null}
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <ChevronDown className="h-4 w-4" />
              {isArabic ? "اختيار" : "Select"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="users" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {isArabic ? "المستخدمين" : "Users"}
                </TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs">
                  <Contact className="h-3 w-3 mr-1" />
                  {isArabic ? "جهات الاتصال" : "Contacts"}
                </TabsTrigger>
                <TabsTrigger value="groups" className="text-xs">
                  <Group className="h-3 w-3 mr-1" />
                  {isArabic ? "المجموعات" : "Groups"}
                </TabsTrigger>
              </TabsList>

              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={isArabic ? "بحث..." : "Search..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <TabsContent value="users" className="m-0">
                <div className="h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "جاري التحميل..." : "Loading..."}
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "لا يوجد مستخدمين" : "No users found"}
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleSelectEmail(user.email)}
                        >
                          <Checkbox
                            checked={selectedEmails.includes(user.email)}
                            onCheckedChange={() => handleSelectEmail(user.email)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{user.user_name}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="m-0">
                {isAdmin && (
                  <div className="p-2 border-b">
                    <Button size="sm" variant="outline" onClick={openAddContact} className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      {isArabic ? "إضافة جهة اتصال" : "Add Contact"}
                    </Button>
                  </div>
                )}
                <div className="h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "جاري التحميل..." : "Loading..."}
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "لا يوجد جهات اتصال" : "No contacts found"}
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted"
                        >
                          <Checkbox
                            checked={selectedEmails.includes(contact.email)}
                            onCheckedChange={() => handleSelectEmail(contact.email)}
                          />
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleSelectEmail(contact.email)}
                          >
                            <div className="font-medium text-sm truncate">
                              {contact.display_name || contact.email}
                            </div>
                            {contact.display_name && (
                              <div className="text-xs text-muted-foreground truncate">{contact.email}</div>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditContact(contact);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteContact(contact);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="groups" className="m-0">
                <div className="h-64 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "جاري التحميل..." : "Loading..."}
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {isArabic ? "لا يوجد مجموعات" : "No groups found"}
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredGroups.map((group) => {
                        const groupEmails = group.members.map(m => m.email);
                        const allSelected = groupEmails.length > 0 && groupEmails.every(e => selectedEmails.includes(e));
                        const someSelected = groupEmails.some(e => selectedEmails.includes(e));
                        
                        return (
                          <div
                            key={group.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => handleSelectGroup(group)}
                          >
                            <Checkbox
                              checked={allSelected}
                              ref={(el) => {
                                if (el) {
                                  (el as any).indeterminate = someSelected && !allSelected;
                                }
                              }}
                              onCheckedChange={() => handleSelectGroup(group)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{group.group_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {group.members.length} {isArabic ? "أعضاء" : "members"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
      </div>

      {/* Contact Management Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact
                ? (isArabic ? "تعديل جهة الاتصال" : "Edit Contact")
                : (isArabic ? "إضافة جهة اتصال" : "Add Contact")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? "البريد الإلكتروني" : "Email"} *</Label>
              <Input
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الاسم" : "Display Name"}</Label>
              <Input
                value={contactForm.display_name}
                onChange={(e) => setContactForm({ ...contactForm, display_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الهاتف" : "Phone"}</Label>
              <Input
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
              <Input
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveContact}>
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
