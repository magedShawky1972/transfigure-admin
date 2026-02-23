import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Play, Printer, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";

interface ReportResult {
  brand_type_name: string;
  total_cost: number;
  transaction_count: number;
  total_qty: number;
}

interface BrandDetail {
  brand_name: string;
  total_cost: number;
  transaction_count: number;
  total_qty: number;
}

interface ProductDetail {
  product_name: string;
  total_cost: number;
  transaction_count: number;
  total_qty: number;
}

const CostByBrandType = () => {
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
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [brandDetails, setBrandDetails] = useState<Record<string, BrandDetail[]>>({});
  const [loadingBrands, setLoadingBrands] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail[]>>({});
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single();
      if (roles) { setHasAccess(true); return; }
      const { data: permission } = await supabase.from('user_permissions').select('has_access').eq('user_id', user.id).eq('menu_item', 'cost-by-brand-type').eq('parent_menu', 'Reports').single();
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
    setExpandedTypes(new Set());
    setBrandDetails({});
    setExpandedBrands(new Set());
    setProductDetails({});
    try {
      const { data, error } = await supabase.rpc('cost_by_brand_type', {
        date_from: dateFrom, date_to: dateTo,
        p_brand_type: selectedBrandType === 'all' ? null : selectedBrandType
      });
      if (error) throw error;
      setReportResults((data || []).map((row: any) => ({
        brand_type_name: row.brand_type_name, total_cost: Number(row.total_cost), transaction_count: Number(row.transaction_count), total_qty: Number(row.total_qty),
      })));
      setDateRun(new Date().toLocaleString());
      toast.success("Report generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to run report");
    } finally { setIsRunning(false); }
  };

  const toggleBrandType = async (typeName: string) => {
    const next = new Set(expandedTypes);
    if (next.has(typeName)) {
      next.delete(typeName);
      setExpandedTypes(next);
      return;
    }
    next.add(typeName);
    setExpandedTypes(next);

    if (!brandDetails[typeName]) {
      setLoadingBrands(prev => new Set(prev).add(typeName));
      try {
        const { data, error } = await supabase.rpc('cost_by_brand_type_brands', {
          date_from: dateFrom, date_to: dateTo, p_brand_type: typeName
        });
        if (error) throw error;
        setBrandDetails(prev => ({
          ...prev,
          [typeName]: (data || []).map((r: any) => ({
            brand_name: r.brand_name, total_cost: Number(r.total_cost), transaction_count: Number(r.transaction_count), total_qty: Number(r.total_qty),
          }))
        }));
      } catch (e: any) { toast.error(e.message); }
      finally { setLoadingBrands(prev => { const s = new Set(prev); s.delete(typeName); return s; }); }
    }
  };

  const toggleBrand = async (brandName: string) => {
    const next = new Set(expandedBrands);
    if (next.has(brandName)) { next.delete(brandName); setExpandedBrands(next); return; }
    next.add(brandName);
    setExpandedBrands(next);

    if (!productDetails[brandName]) {
      setLoadingProducts(prev => new Set(prev).add(brandName));
      try {
        const { data, error } = await supabase.rpc('cost_by_brand_type_products', {
          date_from: dateFrom, date_to: dateTo, p_brand_name: brandName
        });
        if (error) throw error;
        setProductDetails(prev => ({
          ...prev,
          [brandName]: (data || []).map((r: any) => ({
            product_name: r.product_name, total_cost: Number(r.total_cost), transaction_count: Number(r.transaction_count), total_qty: Number(r.total_qty),
          }))
        }));
      } catch (e: any) { toast.error(e.message); }
      finally { setLoadingProducts(prev => { const s = new Set(prev); s.delete(brandName); return s; }); }
    }
  };

  const fmtNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalCost = reportResults.reduce((s, r) => s + r.total_cost, 0);
  const totalTransactions = reportResults.reduce((s, r) => s + r.transaction_count, 0);
  const totalQty = reportResults.reduce((s, r) => s + r.total_qty, 0);

  const exportToCSV = () => {
    if (reportResults.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Brand Type", "Total Cost", "Transaction Count"];
    const rows = reportResults.map((r) => [r.brand_type_name, r.total_cost.toFixed(2), r.transaction_count]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-by-brand-type-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("costReport.title")}</h1>
          <p className="text-muted-foreground">{t("reports.costByBrandType.description")}</p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("costReport.parameters")}</CardTitle>
          <CardDescription>{t("reports.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("costReport.dateFrom")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("costReport.dateTo")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandType">{t("costReport.brandType")}</Label>
              <Select value={selectedBrandType} onValueChange={setSelectedBrandType}>
                <SelectTrigger id="brandType">
                  <SelectValue placeholder={t("costReport.selectBrandType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("costReport.allBrandTypes")}</SelectItem>
                  {brandTypes.map((type) => (
                    <SelectItem key={type.id} value={type.type_name}>{type.type_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runReport} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />
              {isRunning ? "Running..." : t("costReport.runReport")}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />{t("costReport.exportCSV")}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />{t("costReport.print")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0">
          <div className="mb-8 pb-6 border-b-2 border-border print:border-black">
            <h1 className="text-2xl font-bold mb-4 print:text-black">{t("costReport.title")}</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("costReport.reportDetails")}</p>
                <p className="font-medium print:text-black">{t("reports.costByBrandType.name")}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("costReport.generatedOn")}</p>
                <p className="font-medium print:text-black">{dateRun}</p>
              </div>
            </div>
          </div>

          <div className="mb-8 pb-6 border-b border-border print:border-gray-600">
            <h2 className="text-lg font-semibold mb-4 print:text-black">{t("costReport.selectionCriteria")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("costReport.dateFrom")}</p>
                <p className="font-medium print:text-black">{dateFrom ? format(new Date(dateFrom), "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("costReport.dateTo")}</p>
                <p className="font-medium print:text-black">{dateTo ? format(new Date(dateTo), "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("costReport.brandType")}</p>
                <p className="font-medium print:text-black">{selectedBrandType === "all" ? t("costReport.allBrandTypes") : selectedBrandType}</p>
              </div>
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
                {reportResults.map((row, index) => (
                  <>
                    {/* Brand Type Row */}
                    <tr
                      key={`type-${index}`}
                      className="border-b border-border print:border-gray-400 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleBrandType(row.brand_type_name)}
                    >
                      <td className="py-3 px-4 print:text-black">
                        <div className="flex items-center gap-2">
                          {expandedTypes.has(row.brand_type_name) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground print:hidden" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground print:hidden" />
                          )}
                          <span className="font-medium">{row.brand_type_name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 print:text-black">{fmtNum(row.total_cost)}</td>
                      <td className="text-right py-3 px-4 print:text-black">{row.total_qty.toLocaleString()}</td>
                      <td className="text-right py-3 px-4 print:text-black">{row.transaction_count}</td>
                      <td className="text-right py-3 px-4 print:text-black">
                        {fmtNum(row.transaction_count > 0 ? row.total_cost / row.transaction_count : 0)}
                      </td>
                    </tr>

                    {/* Brand drill-down */}
                    {expandedTypes.has(row.brand_type_name) && (
                      loadingBrands.has(row.brand_type_name) ? (
                        <tr key={`loading-brands-${index}`}>
                          <td colSpan={5} className="py-2 px-8">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading brands...
                            </div>
                          </td>
                        </tr>
                      ) : (
                        (brandDetails[row.brand_type_name] || []).map((brand, bIdx) => (
                          <>
                            <tr
                              key={`brand-${index}-${bIdx}`}
                              className="border-b border-border/50 hover:bg-muted/30 cursor-pointer bg-muted/10"
                              onClick={() => toggleBrand(brand.brand_name)}
                            >
                              <td className="py-2 px-4 pl-10 print:text-black">
                                <div className="flex items-center gap-2">
                                  {expandedBrands.has(brand.brand_name) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground print:hidden" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground print:hidden" />
                                  )}
                                  <span>{brand.brand_name}</span>
                                </div>
                              </td>
                              <td className="text-right py-2 px-4 print:text-black">{fmtNum(brand.total_cost)}</td>
                              <td className="text-right py-2 px-4 print:text-black">{brand.total_qty.toLocaleString()}</td>
                              <td className="text-right py-2 px-4 print:text-black">{brand.transaction_count}</td>
                              <td className="text-right py-2 px-4 print:text-black">
                                {fmtNum(brand.transaction_count > 0 ? brand.total_cost / brand.transaction_count : 0)}
                              </td>
                            </tr>

                            {/* Product drill-down */}
                            {expandedBrands.has(brand.brand_name) && (
                              loadingProducts.has(brand.brand_name) ? (
                                <tr key={`loading-products-${index}-${bIdx}`}>
                                  <td colSpan={5} className="py-2 px-12">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Loading products...
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                (productDetails[brand.brand_name] || []).map((product, pIdx) => (
                                  <tr
                                    key={`product-${index}-${bIdx}-${pIdx}`}
                                    className="border-b border-border/30 hover:bg-muted/20 bg-muted/5"
                                  >
                                    <td className="py-1.5 px-4 pl-16 text-sm text-muted-foreground print:text-black">
                                      {product.product_name}
                                    </td>
                                    <td className="text-right py-1.5 px-4 text-sm print:text-black">{fmtNum(product.total_cost)}</td>
                                    <td className="text-right py-1.5 px-4 text-sm print:text-black">{product.total_qty.toLocaleString()}</td>
                                    <td className="text-right py-1.5 px-4 text-sm print:text-black">{product.transaction_count}</td>
                                    <td className="text-right py-1.5 px-4 text-sm print:text-black">
                                      {fmtNum(product.transaction_count > 0 ? product.total_cost / product.transaction_count : 0)}
                                    </td>
                                  </tr>
                                ))
                              )
                            )}
                          </>
                        ))
                      )
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border print:border-black font-bold bg-muted/30 print:bg-gray-200">
                  <td className="py-3 px-4 print:text-black">Total</td>
                  <td className="text-right py-3 px-4 print:text-black">{fmtNum(totalCost)}</td>
                  <td className="text-right py-3 px-4 print:text-black">{totalQty.toLocaleString()}</td>
                  <td className="text-right py-3 px-4 print:text-black">{totalTransactions}</td>
                  <td className="text-right py-3 px-4 print:text-black">
                    {fmtNum(totalTransactions > 0 ? totalCost / totalTransactions : 0)}
                  </td>
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

export default CostByBrandType;
