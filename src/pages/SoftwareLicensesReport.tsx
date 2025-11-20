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

const SoftwareLicensesReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [licenseStatus, setLicenseStatus] = useState<string>("all");
  const [licenseCategory, setLicenseCategory] = useState<string>("all");
  const [licenseRenewalCycle, setLicenseRenewalCycle] = useState<string>("all");
  const [licenseDateFrom, setLicenseDateFrom] = useState<string>("");
  const [licenseDateTo, setLicenseDateTo] = useState<string>("");
  const [licensesData, setLicensesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkAccess();
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
        .eq('menu_item', 'software-licenses')
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

  const exportToCSV = () => {
    if (licensesData.length === 0) {
      toast({
        title: "No Data",
        description: "Please run the report first",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Software", "Category", "Vendor", "Status", "Renewal Cycle", "Cost", "Purchase Date", "Expiry Date"];
    const csv = [
      headers.join(","),
      ...licensesData.map(license => [
        `"${license.software_name}"`,
        license.category,
        `"${license.vendor_provider}"`,
        license.status,
        license.renewal_cycle,
        license.cost,
        format(new Date(license.purchase_date), "yyyy-MM-dd"),
        license.expiry_date ? format(new Date(license.expiry_date), "yyyy-MM-dd") : "N/A"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-licenses-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
          <h1 className="text-3xl font-bold mb-2">Software Licenses Report</h1>
          <p className="text-muted-foreground">
            Generate detailed software licenses report with advanced filtering
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
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
    </div>
  );
};

export default SoftwareLicensesReport;
