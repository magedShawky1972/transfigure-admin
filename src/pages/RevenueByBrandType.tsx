import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, Download, Play, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportResult {
  brand_type_name: string;
  total_revenue: number;
  transaction_count: number;
  total_qty: number;
}

interface BrandDetail {
  brand_name: string;
  total_revenue: number;
  transaction_count: number;
  total_qty: number;
}

interface ProductDetail {
  product_name: string;
  total_revenue: number;
  transaction_count: number;
  total_qty: number;
}

const RevenueByBrandType = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedBrandType, setSelectedBrandType] = useState<string>("all");
  const [reportResults, setReportResults] = useState<ReportResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dateRun, setDateRun] = useState<string>("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Drill-down state
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [brandDetails, setBrandDetails] = useState<Record<string, BrandDetail[]>>({});
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail[]>>({});
  const [loadingBrands, setLoadingBrands] = useState<Record<string, boolean>>({});
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single();
      if (roles) { setHasAccess(true); return; }
      const { data: permission } = await supabase.from('user_permissions').select('has_access').eq('user_id', user.id).eq('menu_item', 'revenue-by-brand-type').eq('parent_menu', 'Reports').single();
      if (permission?.has_access) { setHasAccess(true); } else { toast.error(t('common.accessDenied') || 'Access denied'); navigate('/reports'); }
    } catch { navigate('/reports'); }
  };

  const { data: brandTypes = [] } = useQuery({
    queryKey: ["brand-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_type").select("*").eq("status", "active").order("type_name");
      if (error) throw error;
      return data;
    },
    enabled: hasAccess === true,
  });

  if (hasAccess === null) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!hasAccess) return null;

  const runReport = async () => {
    if (!dateFrom || !dateTo) { toast.error("Please select date range"); return; }
    setIsRunning(true);
    setExpandedTypes({});
    setBrandDetails({});
    setExpandedBrands({});
    setProductDetails({});
    try {
      const { data, error } = await supabase.rpc('revenue_by_brand_type', {
        date_from: dateFrom, date_to: dateTo,
        p_brand_type: selectedBrandType === 'all' ? null : selectedBrandType
      });
      if (error) throw error;
      setReportResults((data || []).map((row: any) => ({
        brand_type_name: row.brand_type_name,
        total_revenue: Number(row.total_revenue),
        transaction_count: Number(row.transaction_count),
        total_qty: Number(row.total_qty),
      })));
      setDateRun(new Date().toLocaleString());
      toast.success("Report generated successfully");
    } catch (error: any) {
      console.error("Error running report:", error);
      toast.error(error.message || "Failed to run report");
    } finally { setIsRunning(false); }
  };

  const toggleBrandType = async (typeName: string) => {
    const isExpanded = expandedTypes[typeName];
    setExpandedTypes(prev => ({ ...prev, [typeName]: !isExpanded }));
    if (!isExpanded && !brandDetails[typeName]) {
      setLoadingBrands(prev => ({ ...prev, [typeName]: true }));
      try {
        const { data, error } = await supabase.rpc('revenue_by_brand_type_brands', {
          date_from: dateFrom, date_to: dateTo, p_brand_type: typeName
        });
        if (error) throw error;
        setBrandDetails(prev => ({
          ...prev, [typeName]: (data || []).map((r: any) => ({
            brand_name: r.brand_name, total_revenue: Number(r.total_revenue),
            transaction_count: Number(r.transaction_count), total_qty: Number(r.total_qty),
          }))
        }));
      } catch (e: any) { toast.error(e.message || "Failed to load brands"); }
      finally { setLoadingBrands(prev => ({ ...prev, [typeName]: false })); }
    }
  };

  const toggleBrand = async (typeName: string, brandName: string) => {
    const key = `${typeName}::${brandName}`;
    const isExpanded = expandedBrands[key];
    setExpandedBrands(prev => ({ ...prev, [key]: !isExpanded }));
    if (!isExpanded && !productDetails[key]) {
      setLoadingProducts(prev => ({ ...prev, [key]: true }));
      try {
        const { data, error } = await supabase.rpc('revenue_by_brand_type_products', {
          date_from: dateFrom, date_to: dateTo, p_brand_name: brandName
        });
        if (error) throw error;
        setProductDetails(prev => ({
          ...prev, [key]: (data || []).map((r: any) => ({
            product_name: r.product_name, total_revenue: Number(r.total_revenue),
            transaction_count: Number(r.transaction_count), total_qty: Number(r.total_qty),
          }))
        }));
      } catch (e: any) { toast.error(e.message || "Failed to load products"); }
      finally { setLoadingProducts(prev => ({ ...prev, [key]: false })); }
    }
  };

  const exportToCSV = () => {
    if (reportResults.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Brand Type", "Total Revenue", "Quantity", "Transaction Count"];
    const rows = reportResults.map((r) => [r.brand_type_name, r.total_revenue.toFixed(2), r.total_qty, r.transaction_count]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-by-brand-type-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalRevenue = reportResults.reduce((s, r) => s + r.total_revenue, 0);
  const totalTransactions = reportResults.reduce((s, r) => s + r.transaction_count, 0);
  const totalQty = reportResults.reduce((s, r) => s + r.total_qty, 0);

  const fmtNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("revenueReport.title")}</h1>
          <p className="text-muted-foreground">{t("reports.revenueByBrandType.description")}</p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("revenueReport.parameters")}</CardTitle>
          <CardDescription>{t("reports.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("revenueReport.dateFrom")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("revenueReport.dateTo")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandType">{t("revenueReport.brandType")}</Label>
              <Select value={selectedBrandType} onValueChange={setSelectedBrandType}>
                <SelectTrigger id="brandType"><SelectValue placeholder={t("revenueReport.selectBrandType")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("revenueReport.allBrandTypes")}</SelectItem>
                  {brandTypes.map((type) => (<SelectItem key={type.id} value={type.type_name}>{type.type_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runReport} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />{isRunning ? "Running..." : t("revenueReport.runReport")}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToCSV}><Download className="mr-2 h-4 w-4" />{t("revenueReport.exportCSV")}</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t("revenueReport.print")}</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0">
          <div className="mb-8 pb-6 border-b-2 border-border print:border-black">
            <h1 className="text-2xl font-bold mb-4 print:text-black">{t("revenueReport.title")}</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.reportDetails")}</p><p className="font-medium print:text-black">{t("reports.revenueByBrandType.name")}</p></div>
              <div><p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.generatedOn")}</p><p className="font-medium print:text-black">{dateRun}</p></div>
            </div>
          </div>

          <div className="mb-8 pb-6 border-b border-border print:border-gray-600">
            <h2 className="text-lg font-semibold mb-4 print:text-black">{t("revenueReport.selectionCriteria")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.dateFrom")}</p><p className="font-medium print:text-black">{dateFrom ? format(new Date(dateFrom), "PPP") : "-"}</p></div>
              <div><p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.dateTo")}</p><p className="font-medium print:text-black">{dateTo ? format(new Date(dateTo), "PPP") : "-"}</p></div>
              <div><p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.brandType")}</p><p className="font-medium print:text-black">{selectedBrandType === "all" ? t("revenueReport.allBrandTypes") : selectedBrandType}</p></div>
            </div>
          </div>

          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border print:border-black">
                  <th className="text-left py-3 px-4 font-semibold print:text-black">Brand Type</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Quantity</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Transaction Count</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Average</th>
                </tr>
              </thead>
              <tbody>
                {reportResults.map((row, index) => {
                  const isExpanded = expandedTypes[row.brand_type_name];
                  const brands = brandDetails[row.brand_type_name] || [];
                  return (
                    <>
                      <tr key={index} className="border-b border-border print:border-gray-400 hover:bg-muted/50 cursor-pointer" onClick={() => toggleBrandType(row.brand_type_name)}>
                        <td className="py-3 px-4 print:text-black flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {row.brand_type_name}
                        </td>
                        <td className="text-right py-3 px-4 print:text-black">{fmtNum(row.total_revenue)}</td>
                        <td className="text-right py-3 px-4 print:text-black">{row.total_qty.toLocaleString()}</td>
                        <td className="text-right py-3 px-4 print:text-black">{row.transaction_count}</td>
                        <td className="text-right py-3 px-4 print:text-black">{fmtNum(row.transaction_count ? row.total_revenue / row.transaction_count : 0)}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${index}-brands`}>
                          <td colSpan={5} className="p-0">
                            {loadingBrands[row.brand_type_name] ? (
                              <div className="py-4 px-8 text-muted-foreground">Loading brands...</div>
                            ) : (
                              <table className="w-full border-collapse">
                                <tbody>
                                  {brands.map((brand, bIdx) => {
                                    const brandKey = `${row.brand_type_name}::${brand.brand_name}`;
                                    const isBrandExpanded = expandedBrands[brandKey];
                                    const products = productDetails[brandKey] || [];
                                    return (
                                      <>
                                        <tr key={bIdx} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer bg-muted/10" onClick={() => toggleBrand(row.brand_type_name, brand.brand_name)}>
                                          <td className="py-2 px-4 pl-12 print:text-black flex items-center gap-2">
                                            {isBrandExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            {brand.brand_name}
                                          </td>
                                          <td className="text-right py-2 px-4 print:text-black">{fmtNum(brand.total_revenue)}</td>
                                          <td className="text-right py-2 px-4 print:text-black">{brand.total_qty.toLocaleString()}</td>
                                          <td className="text-right py-2 px-4 print:text-black">{brand.transaction_count}</td>
                                          <td className="text-right py-2 px-4 print:text-black">{fmtNum(brand.transaction_count ? brand.total_revenue / brand.transaction_count : 0)}</td>
                                        </tr>
                                        {isBrandExpanded && (
                                          <tr key={`${bIdx}-products`}>
                                            <td colSpan={5} className="p-0">
                                              {loadingProducts[brandKey] ? (
                                                <div className="py-3 px-16 text-muted-foreground">Loading products...</div>
                                              ) : (
                                                <table className="w-full border-collapse">
                                                  <tbody>
                                                    {products.map((prod, pIdx) => (
                                                      <tr key={pIdx} className="border-b border-border/30 hover:bg-muted/20 bg-muted/5">
                                                        <td className="py-2 px-4 pl-20 print:text-black text-sm">{prod.product_name}</td>
                                                        <td className="text-right py-2 px-4 print:text-black text-sm">{fmtNum(prod.total_revenue)}</td>
                                                        <td className="text-right py-2 px-4 print:text-black text-sm">{prod.total_qty.toLocaleString()}</td>
                                                        <td className="text-right py-2 px-4 print:text-black text-sm">{prod.transaction_count}</td>
                                                        <td className="text-right py-2 px-4 print:text-black text-sm">{fmtNum(prod.transaction_count ? prod.total_revenue / prod.transaction_count : 0)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border print:border-black font-bold bg-muted/30 print:bg-gray-200">
                  <td className="py-3 px-4 print:text-black">Total</td>
                  <td className="text-right py-3 px-4 print:text-black">{fmtNum(totalRevenue)}</td>
                  <td className="text-right py-3 px-4 print:text-black">{totalQty.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 print:text-black">{totalTransactions}</td>
                  <td className="text-right py-3 px-4 print:text-black">{fmtNum(totalTransactions ? totalRevenue / totalTransactions : 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-xs text-muted-foreground print:text-gray-600 text-right mt-8 pt-4 border-t border-border print:border-gray-600">
            <p>Generated on {dateRun}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueByBrandType;
