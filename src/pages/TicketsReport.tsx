import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Filter, Download, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const TicketsReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [ticketStatus, setTicketStatus] = useState<string>("all");
  const [ticketPriority, setTicketPriority] = useState<string>("all");
  const [ticketDepartment, setTicketDepartment] = useState<string>("all");
  const [ticketDateFrom, setTicketDateFrom] = useState<string>("");
  const [ticketDateTo, setTicketDateTo] = useState<string>("");
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkAccess();
    fetchDepartments();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roles) {
        setHasAccess(true);
        return;
      }

      // Check specific permission
      const { data: permission } = await supabase
        .from('user_permissions')
        .select('has_access')
        .eq('user_id', user.id)
        .eq('menu_item', 'tickets')
        .eq('parent_menu', 'Reports')
        .single();

      if (permission?.has_access) {
        setHasAccess(true);
      } else {
        toast({ title: 'Access denied to this report', variant: 'destructive' });
        navigate('/reports');
      }
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/reports');
    }
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true);
    if (data) setDepartments(data);
  };

  if (hasAccess === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasAccess) {
    return null;
  }

  const runReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tickets")
        .select(`
          *,
          departments(department_name)
        `)
        .order("created_at", { ascending: false });

      if (ticketStatus !== "all") query = query.eq("status", ticketStatus);
      if (ticketPriority !== "all") query = query.eq("priority", ticketPriority);
      if (ticketDepartment !== "all") query = query.eq("department_id", ticketDepartment);
      if (ticketDateFrom) query = query.gte("created_at", ticketDateFrom);
      if (ticketDateTo) query = query.lte("created_at", ticketDateTo);

      const { data, error } = await query;

      if (error) throw error;

      setTicketsData(data || []);
      toast({
        title: "Report Generated",
        description: `Found ${data?.length || 0} tickets`,
      });
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

  const exportToCSV = () => {
    if (ticketsData.length === 0) {
      toast({
        title: "No Data",
        description: "Please run the report first",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Ticket #", "Subject", "Department", "Priority", "Status", "Created"];
    const csv = [
      headers.join(","),
      ...ticketsData.map(ticket => [
        ticket.ticket_number,
        `"${ticket.subject}"`,
        ticket.departments?.department_name || "",
        ticket.priority,
        ticket.status,
        format(new Date(ticket.created_at), "yyyy-MM-dd")
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/reports")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Tickets Report</h1>
          <p className="text-muted-foreground">
            Generate detailed tickets report with advanced filtering
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Filter tickets by status, priority, department, and date range
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={ticketStatus} onValueChange={setTicketStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={ticketPriority} onValueChange={setTicketPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={ticketDepartment} onValueChange={setTicketDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={ticketDateFrom}
                onChange={(e) => setTicketDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={ticketDateTo}
                onChange={(e) => setTicketDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={runReport}
              disabled={loading}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {loading ? "Generating..." : "Generate Report"}
            </Button>
            <Button 
              variant="outline"
              onClick={exportToCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Results</CardTitle>
          <CardDescription>
            {ticketsData.length > 0 ? `Showing ${ticketsData.length} tickets` : "Run report to see results"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No results yet</p>
              <p className="text-sm">Apply filters and generate report</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketsData.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                      <TableCell>{ticket.subject}</TableCell>
                      <TableCell>{ticket.departments?.department_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.priority === "Critical" ? "bg-destructive/20 text-destructive" :
                          ticket.priority === "High" ? "bg-orange-500/20 text-orange-700" :
                          ticket.priority === "Medium" ? "bg-yellow-500/20 text-yellow-700" :
                          "bg-green-500/20 text-green-700"
                        }`}>
                          {ticket.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.status === "Closed" ? "bg-green-500/20 text-green-700" :
                          ticket.status === "In Progress" ? "bg-blue-500/20 text-blue-700" :
                          "bg-gray-500/20 text-gray-700"
                        }`}>
                          {ticket.status}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(ticket.created_at), "MMM dd, yyyy")}</TableCell>
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

export default TicketsReport;
