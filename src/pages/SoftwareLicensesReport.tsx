import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Filter, Download, ArrowLeft, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import purpleCardLogo from "@/assets/purple-card-logo.png";

const SoftwareLicensesReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [licenseStatus, setLicenseStatus] = useState<string>("all");
  const [licenseCategory, setLicenseCategory] = useState<string>("all");
  const [licenseRenewalCycle, setLicenseRenewalCycle] = useState<string>("all");
  const [licenseDateFrom, setLicenseDateFrom] = useState<string>("");
  const [licenseDateTo, setLicenseDateTo] = useState<string>("");
  const [thisMonthExpiry, setThisMonthExpiry] = useState(false);
  const [licensesData, setLicensesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [currencyRates, setCurrencyRates] = useState<any[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<any>(null);

  useEffect(() => {
    checkAccess();
    fetchCurrencies();
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

  const fetchCurrencies = async () => {
    try {
      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("id, currency_code, currency_name, is_base")
        .eq("is_active", true);

      setCurrencies(currenciesData || []);
      setBaseCurrency(currenciesData?.find(c => c.is_base) || null);

      const { data: ratesData } = await supabase
        .from("currency_rates")
        .select("currency_id, rate_to_base")
        .order("effective_date", { ascending: false });

      const latestRates: any[] = [];
      const seen = new Set<string>();
      for (const rate of ratesData || []) {
        if (!seen.has(rate.currency_id)) {
          latestRates.push(rate);
          seen.add(rate.currency_id);
        }
      }
      setCurrencyRates(latestRates);
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const convertToBaseCurrency = (cost: number, currencyId: string | null): number => {
    if (!currencyId || !baseCurrency) return cost;
    if (currencyId === baseCurrency.id) return cost;
    const rate = currencyRates.find((r: any) => r.currency_id === currencyId);
    if (rate && rate.rate_to_base > 0) return cost / rate.rate_to_base;
    return cost;
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
      
      // Filter by this month expiry
      if (thisMonthExpiry) {
        const now = new Date();
        const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
        query = query.gte("expiry_date", monthStart).lte("expiry_date", monthEnd);
      }

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

    const headers = ["Software", "Category", "Vendor", "Status", "Renewal Cycle", "Cost", "Currency", "Cost (Base)", "Purchase Date", "Expiry Date"];
    const csv = [
      headers.join(","),
      ...licensesData.map(license => {
        const baseCost = convertToBaseCurrency(license.cost, license.currency_id);
        const currencyCode = currencies.find(c => c.id === license.currency_id)?.currency_code || "";
        return [
          `"${license.software_name}"`,
          license.category,
          `"${license.vendor_provider}"`,
          license.status,
          license.renewal_cycle,
          license.cost,
          currencyCode,
          baseCost.toFixed(2),
          format(new Date(license.purchase_date), "yyyy-MM-dd"),
          license.expiry_date ? format(new Date(license.expiry_date), "yyyy-MM-dd") : "N/A"
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `software-licenses-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const handlePrintReport = () => {
    if (licensesData.length === 0) {
      toast({
        title: "No Data",
        description: "Please run the report first",
        variant: "destructive",
      });
      return;
    }

    const totalCostBase = licensesData.reduce((sum, license) => {
      return sum + convertToBaseCurrency(license.cost, license.currency_id);
    }, 0);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Software Licenses Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .logo { max-width: 150px; margin-bottom: 10px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 14px; color: #666; }
          .filters { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .filters-title { font-weight: bold; margin-bottom: 10px; }
          .filters-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px; }
          .filter-item { display: flex; gap: 5px; }
          .filter-label { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #333; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-active { background-color: #d4edda; color: #155724; padding: 2px 6px; border-radius: 4px; }
          .status-expired { background-color: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 4px; }
          .status-expiring { background-color: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 4px; }
          .status-cancelled { background-color: #e2e3e5; color: #383d41; padding: 2px 6px; border-radius: 4px; }
          .summary { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center; }
          .summary-item { }
          .summary-value { font-size: 20px; font-weight: bold; }
          .summary-label { font-size: 12px; color: #666; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print {
            body { padding: 10px; }
            .filters { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            th { background-color: #333 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .status-active, .status-expired, .status-expiring, .status-cancelled { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${purpleCardLogo}" class="logo" alt="Logo" />
          <div class="title">Software Licenses Report</div>
          <div class="subtitle">Generated on ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}</div>
        </div>
        
        <div class="filters">
          <div class="filters-title">Applied Filters</div>
          <div class="filters-grid">
            <div class="filter-item"><span class="filter-label">Status:</span> ${licenseStatus === 'all' ? 'All' : licenseStatus}</div>
            <div class="filter-item"><span class="filter-label">Category:</span> ${licenseCategory === 'all' ? 'All' : licenseCategory}</div>
            <div class="filter-item"><span class="filter-label">Renewal Cycle:</span> ${licenseRenewalCycle === 'all' ? 'All' : licenseRenewalCycle}</div>
            <div class="filter-item"><span class="filter-label">Date From:</span> ${licenseDateFrom || 'N/A'}</div>
            <div class="filter-item"><span class="filter-label">Date To:</span> ${licenseDateTo || 'N/A'}</div>
            <div class="filter-item"><span class="filter-label">Expires This Month:</span> ${thisMonthExpiry ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Software</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Status</th>
              <th>Renewal Cycle</th>
              <th>Cost</th>
              <th>Cost (${baseCurrency?.currency_code || 'Base'})</th>
              <th>Purchase Date</th>
              <th>Expiry Date</th>
            </tr>
          </thead>
          <tbody>
            ${licensesData.map((license, index) => {
              const baseCost = convertToBaseCurrency(license.cost, license.currency_id);
              const currencyCode = currencies.find(c => c.id === license.currency_id)?.currency_code || "";
              const statusClass = license.status === "active" ? "status-active" :
                                  license.status === "expired" ? "status-expired" :
                                  license.status === "cancelled" ? "status-cancelled" : "status-expiring";
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${license.software_name}</td>
                  <td>${license.category}</td>
                  <td>${license.vendor_provider}</td>
                  <td><span class="${statusClass}">${license.status}</span></td>
                  <td>${license.renewal_cycle}</td>
                  <td>${license.cost.toLocaleString()} ${currencyCode}</td>
                  <td>${baseCost.toFixed(2)} ${baseCurrency?.currency_code || ''}</td>
                  <td>${format(new Date(license.purchase_date), "MMM dd, yyyy")}</td>
                  <td>${license.expiry_date ? format(new Date(license.expiry_date), "MMM dd, yyyy") : "N/A"}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${licensesData.length}</div>
              <div class="summary-label">Total Licenses</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${licensesData.filter(l => l.status === 'active').length}</div>
              <div class="summary-label">Active</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${licensesData.filter(l => l.status === 'expired' || l.status === 'expiring_soon').length}</div>
              <div class="summary-label">Expired / Expiring</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${totalCostBase.toFixed(2)} ${baseCurrency?.currency_code || ''}</div>
              <div class="summary-label">Total Cost (Base)</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated by the Software License Management System</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
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
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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

            <div className="flex items-center space-x-2 md:col-span-3">
              <Checkbox
                id="thisMonthExpiry"
                checked={thisMonthExpiry}
                onCheckedChange={(checked) => setThisMonthExpiry(checked === true)}
              />
              <Label htmlFor="thisMonthExpiry" className="cursor-pointer">
                تنتهي هذا الشهر / Expires This Month
              </Label>
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
            <Button 
              variant="outline"
              onClick={handlePrintReport}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Report
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
                    <TableHead>Cost ({baseCurrency?.currency_code || 'Base'})</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licensesData.map((license) => {
                    const baseCost = convertToBaseCurrency(license.cost, license.currency_id);
                    const currencyCode = currencies.find(c => c.id === license.currency_id)?.currency_code || "";
                    return (
                      <TableRow key={license.id}>
                        <TableCell className="font-medium">{license.software_name}</TableCell>
                        <TableCell>{license.category}</TableCell>
                        <TableCell>{license.vendor_provider}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            license.status === "active" ? "bg-green-500/20 text-green-700" :
                            license.status === "expired" ? "bg-red-500/20 text-red-700" :
                            license.status === "cancelled" ? "bg-gray-500/20 text-gray-700" :
                            "bg-yellow-500/20 text-yellow-700"
                          }`}>
                            {license.status}
                          </span>
                        </TableCell>
                        <TableCell>{license.renewal_cycle}</TableCell>
                        <TableCell>{license.cost.toLocaleString()} {currencyCode}</TableCell>
                        <TableCell>{baseCost.toFixed(2)} {baseCurrency?.currency_code}</TableCell>
                        <TableCell>{format(new Date(license.purchase_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          {license.expiry_date ? format(new Date(license.expiry_date), "MMM dd, yyyy") : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
