import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Filter, FolderKanban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import ProjectsTasksReport from "@/components/ProjectsTasksReport";

const Reports = () => {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<"tickets" | "licenses" | "projects">("tickets");
  
  // Tickets filters
  const [ticketStatus, setTicketStatus] = useState<string>("all");
  const [ticketPriority, setTicketPriority] = useState<string>("all");
  const [ticketDepartment, setTicketDepartment] = useState<string>("all");
  const [ticketDateFrom, setTicketDateFrom] = useState<string>("");
  const [ticketDateTo, setTicketDateTo] = useState<string>("");
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  // Software licenses filters
  const [licenseStatus, setLicenseStatus] = useState<string>("all");
  const [licenseCategory, setLicenseCategory] = useState<string>("all");
  const [licenseRenewalCycle, setLicenseRenewalCycle] = useState<string>("all");
  const [licenseDateFrom, setLicenseDateFrom] = useState<string>("");
  const [licenseDateTo, setLicenseDateTo] = useState<string>("");
  const [licensesData, setLicensesData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true);
    if (data) setDepartments(data);
  };

  const runTicketsReport = async () => {
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

  const runLicensesReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("software_licenses")
        .select("*")
        .order("purchase_date", { ascending: false });

      if (licenseStatus !== "all") query = query.eq("status", licenseStatus);
      if (licenseCategory !== "all") query = query.eq("category", licenseCategory);
      if (licenseRenewalCycle !== "all") query = query.eq("renewal_cycle", licenseRenewalCycle);
      if (licenseDateFrom) query = query.gte("purchase_date", licenseDateFrom);
      if (licenseDateTo) query = query.lte("purchase_date", licenseDateTo);

      const { data, error } = await query;

      if (error) throw error;

      setLicensesData(data || []);
      toast({
        title: "Report Generated",
        description: `Found ${data?.length || 0} licenses`,
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

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "Please run the report first",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        if (typeof value === 'object') return JSON.stringify(value);
        return `"${value}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reports</h1>
          <p className="text-muted-foreground">
            Generate detailed reports with advanced filtering
          </p>
        </div>
      </div>

      <Tabs value={activeReport} onValueChange={(v) => setActiveReport(v as any)}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="tickets">
            <FileText className="mr-2 h-4 w-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="licenses">
            <FileText className="mr-2 h-4 w-4" />
            Licenses
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="mr-2 h-4 w-4" />
            Projects & Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tickets Report Filters</CardTitle>
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
                  onClick={runTicketsReport}
                  disabled={loading}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {loading ? "Generating..." : "Generate Report"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => exportToCSV(ticketsData, "tickets-report")}
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
              <CardTitle>Tickets Report Results</CardTitle>
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
        </TabsContent>

        <TabsContent value="licenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Software Licenses Report Filters</CardTitle>
              <CardDescription>
                Filter licenses by status, category, renewal cycle, and date range
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={licenseStatus} onValueChange={setLicenseStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={licenseCategory} onValueChange={setLicenseCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Development">Development</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Renewal Cycle</Label>
                  <Select value={licenseRenewalCycle} onValueChange={setLicenseRenewalCycle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cycles</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                      <SelectItem value="One-time">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Purchase Date From</Label>
                  <Input
                    type="date"
                    value={licenseDateFrom}
                    onChange={(e) => setLicenseDateFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purchase Date To</Label>
                  <Input
                    type="date"
                    value={licenseDateTo}
                    onChange={(e) => setLicenseDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={runLicensesReport}
                  disabled={loading}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {loading ? "Generating..." : "Generate Report"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => exportToCSV(licensesData, "licenses-report")}
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
              <CardTitle>Licenses Report Results</CardTitle>
              <CardDescription>
                {licensesData.length > 0 ? `Showing ${licensesData.length} licenses` : "Run report to see results"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {licensesData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>No results yet</p>
                  <p className="text-sm">Apply filters and generate report</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Software</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Renewal Cycle</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Purchase Date</TableHead>
                        <TableHead>Expiry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {licensesData.map((license) => (
                        <TableRow key={license.id}>
                          <TableCell className="font-medium">{license.software_name}</TableCell>
                          <TableCell>{license.category}</TableCell>
                          <TableCell>{license.vendor_provider}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              license.status === "active" ? "bg-green-500/20 text-green-700" :
                              license.status === "expired" ? "bg-red-500/20 text-red-700" :
                              "bg-yellow-500/20 text-yellow-700"
                            }`}>
                              {license.status}
                            </span>
                          </TableCell>
                          <TableCell>{license.renewal_cycle}</TableCell>
                          <TableCell>${license.cost.toLocaleString()}</TableCell>
                          <TableCell>{format(new Date(license.purchase_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            {license.expiry_date ? format(new Date(license.expiry_date), "MMM dd, yyyy") : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTasksReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
