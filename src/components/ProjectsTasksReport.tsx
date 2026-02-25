import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, subMonths, parse } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
}
interface DepartmentOption {
  id: string;
  department_name: string;
}
interface UserOption {
  user_id: string;
  user_name: string;
}

interface ReportRow {
  project_name: string;
  project_status: string;
  task_title: string;
  task_status: string;
  priority: string;
  assigned_to_name: string;
  department_name: string;
  deadline: string | null;
  created_at: string;
}

const TASK_STATUSES = ["todo", "in_progress", "done", "blocked", "review"];

const ProjectsTasksReport = () => {
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateMode, setDateMode] = useState<string>("this_month");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Achievement stats
  const [stats, setStats] = useState({ total: 0, done: 0, percentage: 0 });

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    const [projRes, deptRes, userRes] = await Promise.all([
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("departments").select("id, department_name").eq("is_active", true).order("department_name"),
      supabase.from("profiles").select("user_id, user_name").eq("is_active", true).order("user_name"),
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (userRes.data) setUsers(userRes.data);
  };

  const toggleSelection = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const getDateRange = (): { from: string; to: string } => {
    const now = new Date();
    switch (dateMode) {
      case "this_month": {
        const s = startOfMonth(now);
        const e = endOfMonth(now);
        return { from: format(s, "yyyy-MM-dd"), to: format(e, "yyyy-MM-dd") };
      }
      case "last_month": {
        const last = subMonths(now, 1);
        return { from: format(startOfMonth(last), "yyyy-MM-dd"), to: format(endOfMonth(last), "yyyy-MM-dd") };
      }
      case "select_month": {
        if (!selectedMonth) {
          return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
        }
        const d = parse(selectedMonth + "-01", "yyyy-MM-dd", new Date());
        return { from: format(startOfMonth(d), "yyyy-MM-dd"), to: format(endOfMonth(d), "yyyy-MM-dd") };
      }
      case "specific_date": {
        if (!specificDate) return { from: "", to: "" };
        const ds = format(specificDate, "yyyy-MM-dd");
        return { from: ds, to: ds };
      }
      case "date_range":
        return { from: dateFrom, to: dateTo };
      default:
        return { from: "", to: "" };
    }
  };

  const runReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, title, status, priority, deadline, created_at,
          assigned_to,
          project_id,
          department_id,
          projects(name, status),
          departments(department_name)
        `)
        .order("created_at", { ascending: false });

      if (selectedProjects.length > 0) query = query.in("project_id", selectedProjects);
      if (selectedDepartments.length > 0) query = query.in("department_id", selectedDepartments);
      if (selectedUsers.length > 0) query = query.in("assigned_to", selectedUsers);
      if (selectedStatuses.length > 0) query = query.in("status", selectedStatuses);

      const { from: df, to: dt } = getDateRange();
      if (df) query = query.gte("created_at", df);
      if (dt) query = query.lte("created_at", dt + "T23:59:59");

      const { data, error } = await query;
      if (error) throw error;

      const rows: ReportRow[] = (data || []).map((t: any) => ({
        project_name: t.projects?.name || "-",
        project_status: t.projects?.status || "-",
        task_title: t.title,
        task_status: t.status,
        priority: t.priority,
        assigned_to_name: users.find((u) => u.user_id === t.assigned_to)?.user_name || "-",
        department_name: t.departments?.department_name || "-",
        deadline: t.deadline,
        created_at: t.created_at,
      }));

      setReportData(rows);

      const total = rows.length;
      const done = rows.filter((r) => r.task_status === "done").length;
      setStats({ total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 });

      toast({ title: "Report Generated", description: `Found ${rows.length} tasks` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) {
      toast({ title: "No Data", description: "Please run the report first", variant: "destructive" });
      return;
    }
    const headers = ["Project", "Project Status", "Task", "Task Status", "Priority", "Assigned To", "Department", "Deadline", "Created"];
    const csv = [
      headers.join(","),
      ...reportData.map((r) =>
        [r.project_name, r.project_status, r.task_title, r.task_status, r.priority, r.assigned_to_name, r.department_name, r.deadline ? format(new Date(r.deadline), "yyyy-MM-dd") : "", format(new Date(r.created_at), "yyyy-MM-dd")].map((v) => `"${v}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects-tasks-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "done": return "bg-green-500/20 text-green-700";
      case "in_progress": return "bg-blue-500/20 text-blue-700";
      case "blocked": return "bg-destructive/20 text-destructive";
      case "review": return "bg-purple-500/20 text-purple-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const MultiSelectPopover = ({
    label,
    options,
    selected,
    onToggle,
    renderLabel,
  }: {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onToggle: (value: string) => void;
    renderLabel?: (value: string) => string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Select {label}...</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selected.slice(0, 3).map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {renderLabel ? renderLabel(v) : v}
                    <X className="ml-1 h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggle(v); }} />
                  </Badge>
                ))}
                {selected.length > 3 && <Badge variant="secondary" className="text-xs">+{selected.length - 3}</Badge>}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <ScrollArea className="h-60">
            <div className="p-2 space-y-1">
              {options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => onToggle(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects & Tasks Report Filters</CardTitle>
          <CardDescription>Filter by projects, departments, users, status, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MultiSelectPopover
              label="Departments"
              options={departments.map((d) => ({ value: d.id, label: d.department_name }))}
              selected={selectedDepartments}
              onToggle={(v) => toggleSelection(selectedDepartments, v, setSelectedDepartments)}
              renderLabel={(v) => departments.find((d) => d.id === v)?.department_name || v}
            />
            <MultiSelectPopover
              label="Projects"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              selected={selectedProjects}
              onToggle={(v) => toggleSelection(selectedProjects, v, setSelectedProjects)}
              renderLabel={(v) => projects.find((p) => p.id === v)?.name || v}
            />
            <MultiSelectPopover
              label="Users"
              options={users.map((u) => ({ value: u.user_id, label: u.user_name }))}
              selected={selectedUsers}
              onToggle={(v) => toggleSelection(selectedUsers, v, setSelectedUsers)}
              renderLabel={(v) => users.find((u) => u.user_id === v)?.user_name || v}
            />
            <MultiSelectPopover
              label="Task Status"
              options={TASK_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ").toUpperCase() }))}
              selected={selectedStatuses}
              onToggle={(v) => toggleSelection(selectedStatuses, v, setSelectedStatuses)}
              renderLabel={(v) => v.replace("_", " ").toUpperCase()}
            />
            <div className="space-y-2">
              <Label>Date Filter</Label>
              <Select value={dateMode} onValueChange={setDateMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="select_month">Select Month</SelectItem>
                  <SelectItem value="specific_date">Specific Date</SelectItem>
                  <SelectItem value="date_range">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateMode === "select_month" && (
              <div className="space-y-2">
                <Label>Month</Label>
                <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
            )}

            {dateMode === "specific_date" && (
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !specificDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {specificDate ? format(specificDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={specificDate} onSelect={setSpecificDate} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {dateMode === "date_range" && (
              <>
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={runReport} disabled={loading} className="gap-2">
              <Filter className="h-4 w-4" />
              {loading ? "Generating..." : "Generate Report"}
            </Button>
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Summary */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.done}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.total - stats.done}</div>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.percentage}%</div>
              <Progress value={stats.percentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Achievement</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Results</CardTitle>
          <CardDescription>
            {reportData.length > 0 ? `Showing ${reportData.length} tasks` : "Run report to see results"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No results yet</p>
              <p className="text-sm">Apply filters and generate report</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Project Status</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Task Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.project_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.project_status === "completed" ? "bg-green-500/20 text-green-700" :
                          row.project_status === "in_progress" ? "bg-blue-500/20 text-blue-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {row.project_status}
                        </span>
                      </TableCell>
                      <TableCell>{row.task_title}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${statusColor(row.task_status)}`}>
                          {row.task_status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.priority === "urgent" ? "bg-destructive/20 text-destructive" :
                          row.priority === "high" ? "bg-orange-500/20 text-orange-700" :
                          row.priority === "medium" ? "bg-yellow-500/20 text-yellow-700" :
                          "bg-green-500/20 text-green-700"
                        }`}>
                          {row.priority}
                        </span>
                      </TableCell>
                      <TableCell>{row.assigned_to_name}</TableCell>
                      <TableCell>{row.department_name}</TableCell>
                      <TableCell>{row.deadline ? format(new Date(row.deadline), "MMM dd, yyyy") : "-"}</TableCell>
                      <TableCell>{format(new Date(row.created_at), "MMM dd, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsTasksReport;
