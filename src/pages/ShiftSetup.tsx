import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShiftType {
  id: string;
  zone_name: string;
  type: string | null;
  is_active: boolean;
}

interface JobPosition {
  id: string;
  position_name: string;
  is_active: boolean;
}

interface Shift {
  id: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  shift_type_id: string | null;
  shift_zone_name?: string;
  shift_type?: string;
  is_active: boolean;
  color: string;
  job_positions?: string[];
  admins?: Array<{ user_id: string; admin_order: number; user_name: string }>;
}

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
}

const ShiftSetup = () => {
  const { t } = useLanguage();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shiftZoneOpen, setShiftZoneOpen] = useState(false);
  const [shiftTypeOpen, setShiftTypeOpen] = useState(false);
  const [newShiftZone, setNewShiftZone] = useState("");
  
  const [formData, setFormData] = useState({
    shift_name: "",
    shift_start_time: "",
    shift_end_time: "",
    shift_type_id: "",
    shift_type: "",
    color: "#3b82f6",
    selected_job_positions: [] as string[],
    selected_admins: [] as string[],
  });

  useEffect(() => {
    fetchShifts();
    fetchShiftTypes();
    fetchJobPositions();
    fetchProfiles();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          shift_types!shifts_shift_type_id_fkey (zone_name, type),
          shift_job_positions (
            job_position_id,
            job_positions (position_name)
          ),
          shift_admins (
            user_id,
            admin_order
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profile names for admins
      const userIds = data?.flatMap(shift => 
        shift.shift_admins?.map((admin: any) => admin.user_id) || []
      ) || [];
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]) || []);

      const shiftsWithJobPositions = data?.map(shift => ({
        ...shift,
        shift_zone_name: shift.shift_types?.zone_name,
        shift_type: shift.shift_types?.type,
        job_positions: shift.shift_job_positions?.map((sjp: any) => sjp.job_positions.position_name) || [],
        admins: shift.shift_admins?.map((admin: any) => ({
          user_id: admin.user_id,
          admin_order: admin.admin_order,
          user_name: profileMap.get(admin.user_id) || 'Unknown'
        })) || []
      })) || [];

      setShifts(shiftsWithJobPositions);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error(t("shiftSetup.errorFetchShifts"));
    }
  };

  const fetchShiftTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .eq("is_active", true)
        .order("zone_name");

      if (error) throw error;
      setShiftTypes(data || []);
    } catch (error) {
      console.error("Error fetching shift types:", error);
      toast.error(t("shiftSetup.errorFetchZones"));
    }
  };

  const fetchJobPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("is_active", true)
        .order("position_name");

      if (error) throw error;
      setJobPositions(data || []);
    } catch (error) {
      console.error("Error fetching job positions:", error);
      toast.error(t("shiftSetup.errorFetchPositions"));
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast.error(t("shiftSetup.errorFetchUsers"));
    }
  };

  const handleAddNewShiftZone = async () => {
    if (!newShiftZone.trim()) return;

    try {
      const { data, error } = await supabase
        .from("shift_types")
        .insert([{ 
          zone_name: newShiftZone.trim(),
          type: formData.shift_type || null
        }])
        .select()
        .single();

      if (error) throw error;

      setShiftTypes([...shiftTypes, data]);
      setFormData({ ...formData, shift_type_id: data.id });
      setNewShiftZone("");
      setShiftZoneOpen(false);
      toast.success(t("shiftSetup.zoneAddedSuccess"));
    } catch (error) {
      console.error("Error adding shift zone:", error);
      toast.error(t("shiftSetup.errorAddZone"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shift_name || !formData.shift_start_time || !formData.shift_end_time) {
      toast.error(t("shiftSetup.fillAllFields"));
      return;
    }

    setLoading(true);
    try {
      const shiftData = {
        shift_name: formData.shift_name,
        shift_start_time: formData.shift_start_time,
        shift_end_time: formData.shift_end_time,
        shift_type_id: formData.shift_type_id || null,
        color: formData.color,
      };

      let shiftId: string;

      // Update shift type if shift_type_id and shift_type are both provided
      if (formData.shift_type_id && formData.shift_type) {
        const { error: typeError } = await supabase
          .from("shift_types")
          .update({ type: formData.shift_type })
          .eq("id", formData.shift_type_id);

        if (typeError) {
          console.error("Error updating shift type:", typeError);
        }
      }

      if (editingId) {
        const { error } = await supabase
          .from("shifts")
          .update(shiftData)
          .eq("id", editingId);

        if (error) throw error;
        shiftId = editingId;
        toast.success(t("shiftSetup.updatedSuccess"));
      } else {
        const { data, error } = await supabase
          .from("shifts")
          .insert([shiftData])
          .select()
          .single();

        if (error) throw error;
        shiftId = data.id;
        toast.success(t("shiftSetup.addedSuccess"));
      }

      // Update job positions
      await supabase
        .from("shift_job_positions")
        .delete()
        .eq("shift_id", shiftId);

      if (formData.selected_job_positions.length > 0) {
        const jobPositionLinks = formData.selected_job_positions.map(positionId => ({
          shift_id: shiftId,
          job_position_id: positionId,
        }));

        const { error } = await supabase
          .from("shift_job_positions")
          .insert(jobPositionLinks);

        if (error) throw error;
      }

      // Update shift admins
      await supabase
        .from("shift_admins")
        .delete()
        .eq("shift_id", shiftId);

      if (formData.selected_admins.length > 0) {
        const adminLinks = formData.selected_admins.map((userId, index) => ({
          shift_id: shiftId,
          user_id: userId,
          admin_order: index + 1,
        }));

        const { error } = await supabase
          .from("shift_admins")
          .insert(adminLinks);

        if (error) throw error;
      }

      resetForm();
      fetchShifts();
    } catch (error) {
      console.error("Error saving shift:", error);
      toast.error(t("shiftSetup.errorSaveShift"));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (shift: Shift) => {
    setEditingId(shift.id);
    
    const { data: jobPositionLinks } = await supabase
      .from("shift_job_positions")
      .select("job_position_id")
      .eq("shift_id", shift.id);

    const { data: adminLinks } = await supabase
      .from("shift_admins")
      .select("user_id, admin_order")
      .eq("shift_id", shift.id)
      .order("admin_order");

    setFormData({
      shift_name: shift.shift_name,
      shift_start_time: shift.shift_start_time,
      shift_end_time: shift.shift_end_time,
      shift_type_id: shift.shift_type_id || "",
      shift_type: shift.shift_type || "",
      color: shift.color,
      selected_job_positions: jobPositionLinks?.map(link => link.job_position_id) || [],
      selected_admins: adminLinks?.map(link => link.user_id) || [],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("shiftSetup.deleteConfirm"))) return;

    try {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success(t("shiftSetup.deletedSuccess"));
      fetchShifts();
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast.error(t("shiftSetup.errorDeleteShift"));
    }
  };

  const resetForm = () => {
    setFormData({
      shift_name: "",
      shift_start_time: "",
      shift_end_time: "",
      shift_type_id: "",
      shift_type: "",
      color: "#3b82f6",
      selected_job_positions: [],
      selected_admins: [],
    });
    setEditingId(null);
  };

  const toggleJobPosition = (positionId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_job_positions: prev.selected_job_positions.includes(positionId)
        ? prev.selected_job_positions.filter(id => id !== positionId)
        : [...prev.selected_job_positions, positionId]
    }));
  };

  const toggleAdmin = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_admins: prev.selected_admins.includes(userId)
        ? prev.selected_admins.filter(id => id !== userId)
        : [...prev.selected_admins, userId]
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? t("shiftSetup.editTitle") : t("shiftSetup.addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.shiftName")} *</label>
                <Input
                  placeholder={t("shiftSetup.shiftNamePlaceholder")}
                  value={formData.shift_name}
                  onChange={(e) => setFormData({ ...formData, shift_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.shiftZone")}</label>
                <Popover open={shiftZoneOpen} onOpenChange={setShiftZoneOpen}>
                  <PopoverTrigger asChild>
                     <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={shiftZoneOpen}
                      className="w-full justify-between"
                    >
                      {formData.shift_type_id
                        ? shiftTypes.find((type) => type.id === formData.shift_type_id)?.zone_name
                        : t("shiftSetup.selectShiftZone")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder={t("shiftSetup.searchOrAddNew")}
                        value={newShiftZone}
                        onValueChange={setNewShiftZone}
                      />
                      <CommandGroup>
                        {shiftTypes
                          .filter((type) => 
                            type.zone_name.toLowerCase().includes(newShiftZone.toLowerCase())
                          )
                          .map((type) => (
                            <CommandItem
                              key={type.id}
                              value={type.zone_name}
                              onSelect={() => {
                                setFormData({ 
                                  ...formData, 
                                  shift_type_id: type.id,
                                  shift_type: type.type || ""
                                });
                                setShiftZoneOpen(false);
                                setNewShiftZone("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.shift_type_id === type.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {type.zone_name}
                            </CommandItem>
                          ))}
                        {newShiftZone && 
                          !shiftTypes.some((type) => type.zone_name.toLowerCase() === newShiftZone.toLowerCase()) && (
                          <CommandItem
                            value={newShiftZone}
                            onSelect={handleAddNewShiftZone}
                            className="bg-primary/10"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t("shiftSetup.addNewZone")} "{newShiftZone}"
                          </CommandItem>
                        )}
                      </CommandGroup>
                      {shiftTypes.length === 0 && !newShiftZone && (
                        <CommandEmpty>{t("shiftSetup.noZonesFound")}</CommandEmpty>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.shiftType")}</label>
                <Popover open={shiftTypeOpen} onOpenChange={setShiftTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={shiftTypeOpen}
                      className="w-full justify-between"
                    >
                      {formData.shift_type ? 
                        (formData.shift_type === "sales" ? t("shiftSetup.sales") : 
                         formData.shift_type === "support" ? t("shiftSetup.support") : 
                         formData.shift_type) 
                        : t("shiftSetup.selectShiftType")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, shift_type: "sales" });
                            setShiftTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.shift_type === "sales" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {t("shiftSetup.sales")}
                        </CommandItem>
                        <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, shift_type: "support" });
                            setShiftTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.shift_type === "support" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {t("shiftSetup.support")}
                        </CommandItem>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.startTime")} *</label>
                <Input
                  type="time"
                  value={formData.shift_start_time}
                  onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.endTime")} *</label>
                <Input
                  type="time"
                  value={formData.shift_end_time}
                  onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("shiftSetup.color")} *</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("shiftSetup.jobPositions")}</label>
              <div className="border rounded-md p-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {jobPositions.map((position) => (
                  <div key={position.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={position.id}
                      checked={formData.selected_job_positions.includes(position.id)}
                      onCheckedChange={() => toggleJobPosition(position.id)}
                    />
                    <label
                      htmlFor={position.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {position.position_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("shiftSetup.shiftAdmins")}</label>
              <div className="border rounded-md p-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {profiles.map((profile) => (
                  <div key={profile.user_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`admin-${profile.user_id}`}
                      checked={formData.selected_admins.includes(profile.user_id)}
                      onCheckedChange={() => toggleAdmin(profile.user_id)}
                    />
                    <label
                      htmlFor={`admin-${profile.user_id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {profile.user_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? t("shiftSetup.saving") : editingId ? t("shiftSetup.updateShift") : t("shiftSetup.addShift")}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t("shiftSetup.cancel")}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("shiftSetup.shiftsList")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("shiftSetup.color")}</TableHead>
                <TableHead>{t("shiftSetup.shiftName")}</TableHead>
                <TableHead>{t("shiftSetup.zone")}</TableHead>
                <TableHead>{t("shiftSetup.type")}</TableHead>
                <TableHead>{t("shiftSetup.startTime")}</TableHead>
                <TableHead>{t("shiftSetup.endTime")}</TableHead>
                <TableHead>{t("shiftSetup.jobPositions")}</TableHead>
                <TableHead>{t("shiftSetup.shiftAdmins")}</TableHead>
                <TableHead>{t("shiftSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded border-2 border-border"
                        style={{ backgroundColor: shift.color }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{shift.shift_name}</TableCell>
                  <TableCell>{shift.shift_zone_name || "-"}</TableCell>
                  <TableCell>
                    {shift.shift_type ? 
                      (shift.shift_type === "sales" ? t("shiftSetup.sales") : 
                       shift.shift_type === "support" ? t("shiftSetup.support") : 
                       shift.shift_type) 
                      : "-"}
                  </TableCell>
                  <TableCell>{shift.shift_start_time}</TableCell>
                  <TableCell>{shift.shift_end_time}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {shift.job_positions && shift.job_positions.length > 0 ? (
                        shift.job_positions.map((pos, idx) => (
                          <span key={idx} className="text-xs bg-primary/10 px-2 py-1 rounded">
                            {pos}
                          </span>
                          ))
                      ) : (
                        <span className="text-muted-foreground text-xs">{t("shiftSetup.noPositionsAssigned")}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {shift.admins && shift.admins.length > 0 ? (
                        shift.admins.map((admin, idx) => (
                          <span key={idx} className="text-xs bg-accent/50 px-2 py-1 rounded">
                            {admin.user_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">{t("shiftSetup.noAdminsAssigned")}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(shift)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(shift.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t("shiftSetup.noShiftsFound")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftSetup;
