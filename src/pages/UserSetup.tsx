import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  mobile_number: string | null;
  is_active: boolean;
}

interface UserPermission {
  id: string;
  user_id: string;
  menu_item: string;
  has_access: boolean;
}

const MENU_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Reports" },
  { key: "transactions", label: "Transactions" },
  { key: "pivotTable", label: "Pivot Table" },
  { key: "loadData", label: "Load Data" },
  { key: "uploadLog", label: "Upload Log" },
  { key: "clearData", label: "Clear Data" },
  { key: "reportsSetup", label: "Reports Setup" },
  { key: "customerSetup", label: "Customer Setup" },
  { key: "customerTotals", label: "Customer Totals" },
  { key: "brandSetup", label: "Brand Setup" },
  { key: "productSetup", label: "Product Setup" },
  { key: "paymentMethodSetup", label: "Payment Method Setup" },
  { key: "userSetup", label: "User Setup" },
  { key: "apiConfig", label: "API Config" },
  { key: "excelSetup", label: "Excel Setup" },
  { key: "tableConfig", label: "Table Config" },
];

const UserSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  
  const [formData, setFormData] = useState({
    user_name: "",
    email: "",
    mobile_number: "",
    is_active: true,
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProfile) {
        const { error } = await supabase
          .from("profiles")
          .update({
            user_name: formData.user_name,
            email: formData.email,
            mobile_number: formData.mobile_number || null,
            is_active: formData.is_active,
          })
          .eq("id", editingProfile.id);

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: "User updated successfully",
        });
      } else {
        // For new users, use edge function to bypass rate limiting
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_name: formData.user_name,
              email: formData.email,
              mobile_number: formData.mobile_number || null,
              is_active: formData.is_active,
            }),
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Failed to create user");
        }

        toast({
          title: t("common.success"),
          description: "User created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      user_name: profile.user_name,
      email: profile.email,
      mobile_number: profile.mobile_number || "",
      is_active: profile.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: t("common.success"),
        description: "User deleted successfully",
      });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (profile: Profile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !profile.is_active })
        .eq("id", profile.id);

      if (error) throw error;
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      user_name: "",
      email: "",
      mobile_number: "",
      is_active: true,
    });
    setEditingProfile(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSecurityClick = async (profile: Profile) => {
    setSelectedUser(profile);
    setLoadingPermissions(true);
    setSecurityDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", profile.user_id);

      if (error) throw error;

      const permissionsMap: Record<string, boolean> = {};
      MENU_ITEMS.forEach(item => {
        const permission = data?.find(p => p.menu_item === item.key);
        permissionsMap[item.key] = permission?.has_access ?? false;
      });
      
      setUserPermissions(permissionsMap);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handlePermissionToggle = async (menuItem: string, hasAccess: boolean) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: selectedUser.user_id,
          menu_item: menuItem,
          has_access: hasAccess,
        }, {
          onConflict: "user_id,menu_item"
        });

      if (error) throw error;

      setUserPermissions(prev => ({
        ...prev,
        [menuItem]: hasAccess,
      }));

      toast({
        title: t("common.success"),
        description: "Permission updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">User Setup</h1>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? "Edit User" : "Add New User"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user_name">User Name</Label>
                <Input
                  id="user_name"
                  value={formData.user_name}
                  onChange={(e) =>
                    setFormData({ ...formData, user_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  disabled={!!editingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_number">Mobile Number</Label>
                <Input
                  id="mobile_number"
                  value={formData.mobile_number}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile_number: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : editingProfile ? "Update User" : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.user_name}</TableCell>
                <TableCell>{profile.email}</TableCell>
                <TableCell>{profile.mobile_number || "-"}</TableCell>
                <TableCell>
                  <Switch
                    checked={profile.is_active}
                    onCheckedChange={() => handleToggleStatus(profile)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSecurityClick(profile)}
                      title="Security"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(profile)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={securityDialogOpen} onOpenChange={setSecurityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Security Settings - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">Loading permissions...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable or disable access to menu items for this user. Disabled items will not appear in their sidebar.
              </p>
              
              <div className="space-y-3">
                {MENU_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <Label htmlFor={`perm-${item.key}`} className="cursor-pointer flex-1">
                      {item.label}
                    </Label>
                    <Switch
                      id={`perm-${item.key}`}
                      checked={userPermissions[item.key] || false}
                      onCheckedChange={(checked) => handlePermissionToggle(item.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSetup;
