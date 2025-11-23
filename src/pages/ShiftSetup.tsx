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
}

const ShiftSetup = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
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
  });

  useEffect(() => {
    fetchShifts();
    fetchShiftTypes();
    fetchJobPositions();
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
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const shiftsWithJobPositions = data?.map(shift => ({
        ...shift,
        shift_zone_name: shift.shift_types?.zone_name,
        shift_type: shift.shift_types?.type,
        job_positions: shift.shift_job_positions?.map((sjp: any) => sjp.job_positions.position_name) || []
      })) || [];

      setShifts(shiftsWithJobPositions);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error("Failed to fetch shifts");
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
      toast.error("Failed to fetch shift zones");
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
      toast.error("Failed to fetch job positions");
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
      toast.success("Shift zone added successfully");
    } catch (error) {
      console.error("Error adding shift zone:", error);
      toast.error("Failed to add shift zone");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shift_name || !formData.shift_start_time || !formData.shift_end_time) {
      toast.error("Please fill in all required fields");
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

      if (editingId) {
        const { error } = await supabase
          .from("shifts")
          .update(shiftData)
          .eq("id", editingId);

        if (error) throw error;
        shiftId = editingId;
        toast.success("Shift updated successfully");
      } else {
        const { data, error } = await supabase
          .from("shifts")
          .insert([shiftData])
          .select()
          .single();

        if (error) throw error;
        shiftId = data.id;
        toast.success("Shift added successfully");
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

      resetForm();
      fetchShifts();
    } catch (error) {
      console.error("Error saving shift:", error);
      toast.error("Failed to save shift");
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

    setFormData({
      shift_name: shift.shift_name,
      shift_start_time: shift.shift_start_time,
      shift_end_time: shift.shift_end_time,
      shift_type_id: shift.shift_type_id || "",
      shift_type: shift.shift_type || "",
      color: shift.color,
      selected_job_positions: jobPositionLinks?.map(link => link.job_position_id) || [],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return;

    try {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Shift deleted successfully");
      fetchShifts();
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast.error("Failed to delete shift");
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Shift" : "Add New Shift"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Shift Name *</label>
                <Input
                  placeholder="Enter shift name"
                  value={formData.shift_name}
                  onChange={(e) => setFormData({ ...formData, shift_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Shift Zone</label>
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
                        : "Select shift zone..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search or type new shift zone..." 
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
                                setFormData({ ...formData, shift_type_id: type.id });
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
                            Add "{newShiftZone}"
                          </CommandItem>
                        )}
                      </CommandGroup>
                      {shiftTypes.length === 0 && !newShiftZone && (
                        <CommandEmpty>No shift zones found.</CommandEmpty>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Shift Type</label>
                <Popover open={shiftTypeOpen} onOpenChange={setShiftTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={shiftTypeOpen}
                      className="w-full justify-between"
                    >
                      {formData.shift_type || "Select shift type..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, shift_type: "Sales" });
                            setShiftTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.shift_type === "Sales" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Sales
                        </CommandItem>
                        <CommandItem
                          onSelect={() => {
                            setFormData({ ...formData, shift_type: "Support" });
                            setShiftTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.shift_type === "Support" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Support
                        </CommandItem>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time *</label>
                <Input
                  type="time"
                  value={formData.shift_start_time}
                  onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Time *</label>
                <Input
                  type="time"
                  value={formData.shift_end_time}
                  onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Shift Color *</label>
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
              <label className="text-sm font-medium">Job Positions</label>
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

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingId ? "Update Shift" : "Add Shift"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shifts List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Shift Name</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Job Positions</TableHead>
                <TableHead>Actions</TableHead>
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
                  <TableCell>{shift.shift_type || "-"}</TableCell>
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
                        <span className="text-muted-foreground text-xs">No positions assigned</span>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No shifts found. Add your first shift above.
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
