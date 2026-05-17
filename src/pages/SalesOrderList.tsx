import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, AlertCircle, ChevronsUpDown, ArrowUp, ArrowDown, Copy, RefreshCw } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";


const SalesOrderList = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [supplierMappingsMap, setSupplierMappingsMap] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }[]>([]);
  const [brandPopoverIdx, setBrandPopoverIdx] = useState<number | null>(null);
  const [productPopoverIdx, setProductPopoverIdx] = useState<number | null>(null);
  const [vendorPopoverIdx, setVendorPopoverIdx] = useState<number | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showBrandErrorsOnly, setShowBrandErrorsOnly] = useState(false);
  const [showProductErrorsOnly, setShowProductErrorsOnly] = useState(false);
  const [showUnitPriceZero, setShowUnitPriceZero] = useState(false);
  const [showUnitCostZero, setShowUnitCostZero] = useState(false);
  const [salesRefFilter, setSalesRefFilter] = useState("");

  const parseNumeric = (v: any): number => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).replace(/[,\s\u00A0\u200F\u200E]/g, "");
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) || 0 : 0;
  };

  const recomputeRow = (row: any, brand: any | null, product: any | null): any => {
    const coins = parseNumeric(row.source_coins_number) || parseNumeric(row.coins_number) || parseNumeric(product?.coins_number) || 0;
    const salesRate = Number(brand?.sales_one_coins_sar ?? 0) || 0;
    const costRate = Number(brand?.cost_one_coins_sar ?? 0) || 0;
    const srcUnit = Number(row.source_unit_price) || 0;
    const srcCost = Number(row.source_cost_price) || 0;
    const unit = srcUnit > 0 ? srcUnit : (salesRate > 0 ? salesRate : (coins > 0 ? (Number(product?.product_price ?? 0) || 0) / coins : 0));
    const cost = srcCost > 0 ? srcCost : (costRate > 0 ? costRate : (coins > 0 ? (Number(product?.product_cost ?? 0) || 0) / coins : 0));
    const qty = Number(row.qty) || 0;
    const issues: string[] = [];
    if (!brand) issues.push("Brand not found");
    if (!product) issues.push("Product not found");
    if (qty <= 0) issues.push("Qty must be > 0");
    return {
      ...row,
      brand_id: brand?.id || null,
      brand_code: brand?.brand_code || "",
      brand_name: brand?.brand_name || row.brand_name || "",
      product_id: product?.id || null,
      product_name: product?.product_name || row.product_name || "",
      coins_number: coins,
      unit_price: unit,
      cost_price: cost,
      total: qty * unit,
      total_cost: qty * cost,
      profit: (qty * unit) - (qty * cost),
      issues,
    };
  };

  const findProductForBrand = (brand: any, productName: string) => {
    const bk = String(brand?.brand_code || brand?.brand_name || "").trim().toLowerCase();
    const nk = String(productName || "").trim().toLowerCase();
    return productsList.find(p => {
      const pbk = String(p.brand_code || p.brand_name || "").trim().toLowerCase();
      const pnk = String(p.product_name || "").trim().toLowerCase();
      return pbk === bk && pnk === nk;
    }) || null;
  };

  const handleChangeRowBrand = async (rowIdx: number, newBrandId: string) => {
    const newBrand = brandsList.find(b => b.id === newBrandId) || null;
    let sourceName = "";
    setPreviewRows(prev => {
      if (!prev) return prev;
      const targetRow = prev[rowIdx];
      sourceName = String(targetRow.source_brand_name || targetRow.brand_name || "").trim();
      const sourceKey = sourceName.toLowerCase();
      return prev.map(r => {
        const rowSource = String(r.source_brand_name || r.brand_name || "").trim().toLowerCase();
        if (rowSource !== sourceKey) return r;
        const product = newBrand ? findProductForBrand(newBrand, r.product_name) : null;
        return recomputeRow(r, newBrand, product);
      });
    });
    setBrandPopoverIdx(null);

    // Persist mapping so future imports auto-resolve
    if (sourceName && newBrand) {
      try {
        await supabase.from("sales_order_brand_mappings").upsert({
          source_brand_name: sourceName,
          purple_brand_id: newBrand.id,
          purple_brand_code: newBrand.brand_code,
          purple_brand_name: newBrand.brand_name,
        }, { onConflict: "source_brand_name" });
      } catch (e) {
        // ignore — mapping is a convenience, not required
      }
    }
  };

  const handleChangeRowProduct = async (rowIdx: number, newProductId: string) => {
    const newProduct = productsList.find(p => p.id === newProductId) || null;
    let sourceProductName = "";
    let sourceBrandName = "";
    setPreviewRows(prev => {
      if (!prev) return prev;
      const targetRow = prev[rowIdx];
      sourceProductName = String(targetRow.source_product_name || targetRow.product_name || "").trim();
      sourceBrandName = String(targetRow.source_brand_name || targetRow.brand_name || "").trim();
      const oldProductKey = sourceProductName.toLowerCase();
      const oldBrandKey = sourceBrandName.toLowerCase();
      return prev.map(r => {
        const rowSrcBrand = String(r.source_brand_name || r.brand_name || "").trim().toLowerCase();
        const rowSrcProd = String(r.source_product_name || r.product_name || "").trim().toLowerCase();
        if (rowSrcBrand !== oldBrandKey || rowSrcProd !== oldProductKey) return r;
        const brand = brandsList.find(b => b.id === r.brand_id) || null;
        return recomputeRow({ ...r, product_name: newProduct?.product_name || r.product_name }, brand, newProduct);
      });
    });
    setProductPopoverIdx(null);

    // Persist product mapping so future imports auto-resolve
    if (sourceProductName && newProduct) {
      try {
        await supabase.from("sales_order_product_mappings").upsert({
          source_brand_name: sourceBrandName,
          source_product_name: sourceProductName,
          purple_product_id: newProduct.id,
          purple_product_name: newProduct.product_name,
        }, { onConflict: "source_brand_name,source_product_name" });
      } catch (e) {
        // ignore — mapping is a convenience, not required
      }
    }
  };

  const toggleSort = (key: string, additive: boolean) => {
    setSortConfig(prev => {
      const existing = prev.find(s => s.key === key);
      if (!additive) {
        if (existing && prev.length === 1) {
          return existing.dir === 'asc' ? [{ key, dir: 'desc' }] : [];
        }
        return [{ key, dir: 'asc' }];
      }
      if (existing) {
        if (existing.dir === 'asc') return prev.map(s => s.key === key ? { ...s, dir: 'desc' } : s);
        return prev.filter(s => s.key !== key);
      }
      return [...prev, { key, dir: 'asc' }];
    });
  };

  const sortedPreview = (() => {
    if (!previewRows) return null;
    if (sortConfig.length === 0) return previewRows.map((r, i) => ({ ...r, __idx: i }));
    const arr = previewRows.map((r, i) => ({ ...r, __idx: i }));
    arr.sort((a, b) => {
      for (const { key, dir } of sortConfig) {
        const av = key === 'issuesKey' ? (a.issues?.length || 0) : a[key];
        const bv = key === 'issuesKey' ? (b.issues?.length || 0) : b[key];
        const an = typeof av === 'number' ? av : (av == null ? '' : String(av).toLowerCase());
        const bn = typeof bv === 'number' ? bv : (bv == null ? '' : String(bv).toLowerCase());
        if (an < bn) return dir === 'asc' ? -1 : 1;
        if (an > bn) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return arr;
  })();

  const COLUMNS = [
    "order_date","customer_name",
    "sales_reference","sales_person","company","vendor","notes",
    "brand_code","brand_name","product_id","product_name",
    "coins_number","qty","unit_price","cost_price","group_key"
  ];

  const EXPORT_COLUMNS = [
    ...COLUMNS,
    "status"
  ];

  const downloadXlsx = (rows: any[], filename: string, headers: string[] = COLUMNS) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesOrders");
    XLSX.writeFile(wb, filename);
  };

  const handleExportTemplate = () => {
    const sample = [{
      order_date: "2026-01-01",
      customer_name: "Sample Customer",
      sales_reference: "REF-1",
      sales_person: "John",
      company: "Asus",
      vendor: "Sample Vendor",
      notes: "",
      brand_code: "HC",
      brand_name: "Hawa Chat",
      product_id: "",
      product_name: "1 Coin",
      coins_number: 1,
      qty: 1,
      unit_price: 0,
      cost_price: 0,
      group_key: "G1",
    }];
    downloadXlsx(sample, "sales_orders_template.xlsx");
  };

  const handleExportData = async () => {
    const { data: ords, error: e1 } = await supabase.from("manual_sales_orders").select("*").order("order_date", { ascending: false }).limit(5000);
    if (e1) { toast({ title: "Export failed", description: e1.message, variant: "destructive" }); return; }
    const orderIds = (ords || []).map((o: any) => o.id);
    const { data: lines, error: e2 } = await supabase.from("manual_sales_order_lines").select("*").in("order_id", orderIds);
    if (e2) { toast({ title: "Export failed", description: e2.message, variant: "destructive" }); return; }
    const linesByOrder = new Map<string, any[]>();
    (lines || []).forEach((l: any) => {
      const arr = linesByOrder.get(l.order_id) || [];
      arr.push(l); linesByOrder.set(l.order_id, arr);
    });
    const rows: any[] = [];
    (ords || []).forEach((o: any) => {
      const oLines = linesByOrder.get(o.id) || [];
      if (oLines.length === 0) {
        rows.push({ order_number: o.order_number, order_date: o.order_date, customer_name: o.customer_name, sales_reference: o.sales_reference, sales_person: o.sales_person, company: o.company, notes: o.notes, status: o.status });
      } else {
        oLines.forEach((l: any) => rows.push({
          order_number: o.order_number, order_date: o.order_date,
          customer_name: o.customer_name,
          sales_reference: o.sales_reference,
          sales_person: o.sales_person, company: o.company, notes: o.notes, status: o.status,
          brand_code: l.brand_code, brand_name: l.brand_name, product_id: l.product_id, product_name: l.product_name,
          coins_number: Number(l.coins_number), qty: Number(l.qty),
          unit_price: Number(l.unit_price), cost_price: Number(l.cost_price),
        }));
      }
    });
    downloadXlsx(rows, `sales_orders_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`, EXPORT_COLUMNS);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (raw.length === 0) throw new Error("Empty file");

      // Lookups
      const [{ data: brandsData }, { data: productsData }, { data: mappingsData }, { data: productMappingsData }] = await Promise.all([
        supabase.from("brands").select("id, brand_code, brand_name, sales_one_coins_sar, cost_one_coins_sar"),
        supabase.from("products").select("id, product_name, product_price, product_cost, coins_number, brand_code, brand_name").eq("status", "active").limit(5000),
        supabase.from("sales_order_brand_mappings").select("source_brand_name, purple_brand_id"),
        supabase.from("sales_order_product_mappings").select("source_brand_name, source_product_name, purple_product_id"),
      ]);
      setBrandsList(brandsData || []);
      setProductsList(productsData || []);
      const brandById = new Map<string, any>();
      const brandByName = new Map<string, any>();
      const brandByCode = new Map<string, any>();
      (brandsData || []).forEach((b: any) => {
        brandById.set(b.id, b);
        if (b.brand_name) brandByName.set(String(b.brand_name).trim().toLowerCase(), b);
        if (b.brand_code) brandByCode.set(String(b.brand_code).trim().toLowerCase(), b);
      });
      const mappingBySource = new Map<string, any>();
      (mappingsData || []).forEach((m: any) => {
        const b = brandById.get(m.purple_brand_id);
        if (b) mappingBySource.set(String(m.source_brand_name).trim().toLowerCase(), b);
      });
      const productById = new Map<string, any>();
      const productsByBrandAndName = new Map<string, any>();
      (productsData || []).forEach((p: any) => {
        productById.set(p.id, p);
        const bk = String(p.brand_code || p.brand_name || "").trim().toLowerCase();
        const nk = String(p.product_name || "").trim().toLowerCase();
        if (nk) productsByBrandAndName.set(`${bk}::${nk}`, p);
      });
      const productMappingByKey = new Map<string, any>();
      (productMappingsData || []).forEach((m: any) => {
        const p = productById.get(m.purple_product_id);
        if (p) productMappingByKey.set(`${String(m.source_brand_name).trim().toLowerCase()}::${String(m.source_product_name).trim().toLowerCase()}`, p);
      });

      const resolved = raw.map((r: any, idx: number) => {
        const brandNameRaw = String(r.brand_name || "").trim();
        const brand = mappingBySource.get(brandNameRaw.toLowerCase())
          || brandByName.get(brandNameRaw.toLowerCase())
          || brandByCode.get(String(r.brand_code || "").trim().toLowerCase());
        const productNameRaw = String(r.product_name || "").trim();
        const bk = String(brand?.brand_code || brand?.brand_name || brandNameRaw).trim().toLowerCase();
        const product = productMappingByKey.get(`${brandNameRaw.toLowerCase()}::${productNameRaw.toLowerCase()}`)
          || productsByBrandAndName.get(`${bk}::${productNameRaw.toLowerCase()}`);
        const coins = parseNumeric(r.coins_number) || parseNumeric(product?.coins_number) || 0;
        const salesRate = Number(brand?.sales_one_coins_sar ?? 0) || 0;
        const costRate = Number(brand?.cost_one_coins_sar ?? 0) || 0;
        const srcUnit = Number(r.unit_price ?? r.unit ?? r.price) || 0;
        const srcCost = Number(r.cost_price ?? r.cost ?? r.unit_cost) || 0;
        const unit = srcUnit > 0 ? srcUnit : (salesRate > 0 ? salesRate : (coins > 0 ? (Number(product?.product_price ?? 0) || 0) / coins : 0));
        const cost = srcCost > 0 ? srcCost : (costRate > 0 ? costRate : (coins > 0 ? (Number(product?.product_cost ?? 0) || 0) / coins : 0));
        const qty = Number(r.qty) || 0;
        const orderDate = r.order_date ? (typeof r.order_date === "number"
          ? XLSX.SSF.format("yyyy-mm-dd", r.order_date)
          : String(r.order_date).substring(0, 10)) : format(new Date(), "yyyy-MM-dd");
        const issues: string[] = [];
        if (!brand) issues.push("Brand not found");
        if (!product) issues.push("Product not found");
        if (qty <= 0) issues.push("Qty must be > 0");
        return {
          row: idx + 2,
          group_key: String(r.group_key || "").trim() || `__row_${idx + 2}`,
          source_brand_name: brandNameRaw,
          source_product_name: productNameRaw,
          source_coins_number: coins,
          source_unit_price: srcUnit,
          source_cost_price: srcCost,
          order_date: orderDate,
          customer_name: r.customer_name || "",
          sales_reference: r.sales_reference || "",
          sales_person: r.sales_person || "",
          company: r.company || "",
          vendor: r.vendor || r.Vendor || r.supplier || r.Supplier || "",
          notes: r.notes || "",
          brand_id: brand?.id || null,
          brand_code: brand?.brand_code || "",
          brand_name: brand?.brand_name || brandNameRaw,
          product_id: product?.id || null,
          product_name: product?.product_name || productNameRaw,
          coins_number: coins,
          qty,
          unit_price: unit,
          cost_price: cost,
          total: qty * unit,
          total_cost: qty * cost,
          profit: (qty * unit) - (qty * cost),
          issues,
        };
      });

      setSortConfig([]);
      setShowErrorsOnly(false);
      setShowBrandErrorsOnly(false);
      setShowProductErrorsOnly(false);
      setPreviewRows(resolved);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [refreshingPreview, setRefreshingPreview] = useState(false);

  const handleRefreshPreview = async () => {
    if (!previewRows) return;
    setRefreshingPreview(true);
    try {
      const [{ data: brandsData }, { data: productsData }, { data: mappingsData }, { data: productMappingsData }] = await Promise.all([
        supabase.from("brands").select("id, brand_code, brand_name, sales_one_coins_sar, cost_one_coins_sar"),
        supabase.from("products").select("id, product_name, product_price, product_cost, coins_number, brand_code, brand_name").eq("status", "active").limit(5000),
        supabase.from("sales_order_brand_mappings").select("source_brand_name, purple_brand_id"),
        supabase.from("sales_order_product_mappings").select("source_brand_name, source_product_name, purple_product_id"),
      ]);
      setBrandsList(brandsData || []);
      setProductsList(productsData || []);
      const brandById = new Map<string, any>();
      const brandByName = new Map<string, any>();
      const brandByCode = new Map<string, any>();
      (brandsData || []).forEach((b: any) => {
        brandById.set(b.id, b);
        if (b.brand_name) brandByName.set(String(b.brand_name).trim().toLowerCase(), b);
        if (b.brand_code) brandByCode.set(String(b.brand_code).trim().toLowerCase(), b);
      });
      const mappingBySource = new Map<string, any>();
      (mappingsData || []).forEach((m: any) => {
        const b = brandById.get(m.purple_brand_id);
        if (b) mappingBySource.set(String(m.source_brand_name).trim().toLowerCase(), b);
      });
      const productById = new Map<string, any>();
      const productsByBrandAndName = new Map<string, any>();
      (productsData || []).forEach((p: any) => {
        productById.set(p.id, p);
        const bk = String(p.brand_code || p.brand_name || "").trim().toLowerCase();
        const nk = String(p.product_name || "").trim().toLowerCase();
        if (nk) productsByBrandAndName.set(`${bk}::${nk}`, p);
      });
      const productMappingByKey = new Map<string, any>();
      (productMappingsData || []).forEach((m: any) => {
        const p = productById.get(m.purple_product_id);
        if (p) productMappingByKey.set(`${String(m.source_brand_name).trim().toLowerCase()}::${String(m.source_product_name).trim().toLowerCase()}`, p);
      });

      const reResolved = previewRows.map((r: any) => {
        const brandNameRaw = String(r.source_brand_name || "").trim();
        const brand = mappingBySource.get(brandNameRaw.toLowerCase())
          || brandByName.get(brandNameRaw.toLowerCase())
          || brandByCode.get(String(r.brand_code || "").trim().toLowerCase());
        const productNameRaw = String(r.source_product_name || "").trim();
        const bk = String(brand?.brand_code || brand?.brand_name || brandNameRaw).trim().toLowerCase();
        const product = productMappingByKey.get(`${brandNameRaw.toLowerCase()}::${productNameRaw.toLowerCase()}`)
          || productsByBrandAndName.get(`${bk}::${productNameRaw.toLowerCase()}`);
        const coins = parseNumeric(r.source_coins_number) || parseNumeric(r.coins_number) || parseNumeric(product?.coins_number) || 0;
        const salesRate = Number(brand?.sales_one_coins_sar ?? 0) || 0;
        const costRate = Number(brand?.cost_one_coins_sar ?? 0) || 0;
        const srcUnit = Number(r.source_unit_price) || 0;
        const srcCost = Number(r.source_cost_price) || 0;
        const unit = srcUnit > 0 ? srcUnit : (salesRate > 0 ? salesRate : (coins > 0 ? (Number(product?.product_price ?? 0) || 0) / coins : 0));
        const cost = srcCost > 0 ? srcCost : (costRate > 0 ? costRate : (coins > 0 ? (Number(product?.product_cost ?? 0) || 0) / coins : 0));
        const qty = Number(r.qty) || 0;
        const issues: string[] = [];
        if (!brand) issues.push("Brand not found");
        if (!product) issues.push("Product not found");
        if (qty <= 0) issues.push("Qty must be > 0");
        return {
          ...r,
          brand_id: brand?.id || null,
          brand_code: brand?.brand_code || "",
          brand_name: brand?.brand_name || brandNameRaw,
          product_id: product?.id || null,
          product_name: product?.product_name || productNameRaw,
          coins_number: coins,
          unit_price: unit,
          cost_price: cost,
          total: qty * unit,
          total_cost: qty * cost,
          profit: (qty * unit) - (qty * cost),
          issues,
        };
      });
      setPreviewRows(reResolved);
      toast({ title: language === 'ar' ? 'تم التحديث' : 'Refreshed', description: language === 'ar' ? 'تم تحديث البيانات والتعيينات' : 'Data and mappings refreshed' });
    } catch (err: any) {
      toast({ title: language === 'ar' ? 'خطأ في التحديث' : 'Refresh failed', description: err.message, variant: "destructive" });
    } finally {
      setRefreshingPreview(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewRows) return;
    const valid = previewRows.filter(r => r.issues.length === 0);
    if (valid.length === 0) {
      toast({ title: "Nothing to import", description: "All rows have issues. Fix them and re-upload.", variant: "destructive" });
      return;
    }
    setCommitting(true);
    try {
      // Group by group_key (from excel) — rows without one are their own order
      const groups = new Map<string, any[]>();
      valid.forEach(r => {
        const key = r.group_key || `__row_${r.row}`;
        const arr = groups.get(key) || [];
        arr.push(r); groups.set(key, arr);
      });

      // Generate unique order numbers
      const dateStr = format(new Date(), "yyyyMMdd");
      const { data: todays } = await supabase
        .from("manual_sales_orders")
        .select("order_number")
        .like("order_number", `SO-${dateStr}-%`);
      let maxSeq = 0;
      (todays || []).forEach((o: any) => {
        const m = String(o.order_number).match(/SO-\d{8}-(\d+)/);
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
      });

      let created = 0, skipped = 0;
      for (const [, grp] of groups) {
        const head = grp[0];
        maxSeq++;
        const orderNum = `SO-${dateStr}-${String(maxSeq).padStart(4, '0')}`;

        const totalAmount = grp.reduce((s, l) => s + l.total, 0);
        const totalCost = grp.reduce((s, l) => s + l.total_cost, 0);
        const totalCoins = grp.reduce((s, l) => s + (l.coins_number * l.qty), 0);

        const { data: ins, error: insErr } = await supabase.from("manual_sales_orders").insert({
          order_number: orderNum,
          order_date: head.order_date,
          customer_name: head.customer_name || null,
          sales_reference: head.sales_reference || null,
          sales_person: head.sales_person || null,
          company: head.company || null,
          notes: head.notes || null,
          status: "draft",
          total_amount: totalAmount,
          total_cost: totalCost,
          total_profit: totalAmount - totalCost,
          total_coins: totalCoins,
        }).select().single();
        if (insErr || !ins) { skipped++; continue; }

        const lineRows = grp.map((l, idx) => ({
          order_id: ins.id,
          line_number: idx + 1,
          brand_id: l.brand_id,
          brand_code: l.brand_code,
          brand_name: l.brand_name,
          vendor: l.vendor || null,
          product_id: l.product_id,
          product_name: l.product_name,
          coins_number: l.coins_number,
          qty: l.qty,
          unit_price: l.unit_price,
          cost_price: l.cost_price,
          total: l.total,
          total_cost: l.total_cost,
          profit: l.profit,
        }));
        await supabase.from("manual_sales_order_lines").insert(lineRows);
        created++;
      }

      toast({ title: language === 'ar' ? 'تم الاستيراد' : 'Import complete', description: `Created: ${created}, Skipped: ${skipped}` });
      setPreviewRows(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setCommitting(false);
    }
  };


  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manual_sales_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("suppliers").select("supplier_name").eq("status", "active");
      setSuppliersSet(new Set((data || []).map((s: any) => String(s.supplier_name || "").trim().toLowerCase()).filter(Boolean)));
    })();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("manual_sales_orders").delete().eq("id", deleteId).select();
    if (error) {
      toast({ title: language === 'ar' ? 'خطأ في الحذف' : 'Delete failed', description: error.message, variant: "destructive" });
    } else {
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
      setOrders(prev => prev.filter(o => o.id !== deleteId));
      setSelectedIds(prev => prev.filter(id => id !== deleteId));
    }
    setDeleteId(null);
  };

  const deletableSelectedIds = selectedIds.filter(id => {
    const o = orders.find(x => x.id === id);
    return o && o.status !== 'confirmed';
  });

  const handleBulkDelete = async () => {
    if (deletableSelectedIds.length === 0) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("manual_sales_orders").delete().in("id", deletableSelectedIds).select();
    setBulkDeleting(false);
    if (error) {
      toast({ title: language === 'ar' ? 'خطأ في الحذف' : 'Delete failed', description: error.message, variant: "destructive" });
    } else {
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted', description: `${deletableSelectedIds.length}` });
      const set = new Set(deletableSelectedIds);
      setOrders(prev => prev.filter(o => !set.has(o.id)));
      setSelectedIds([]);
    }
    setBulkDeleteOpen(false);
  };

  const toggleSelectAll = () => {
    const eligibleIds = orders.filter(o => o.status !== 'confirmed').map(o => o.id);
    if (eligibleIds.every(id => selectedIds.includes(id)) && eligibleIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (accessLoading) return null;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {language === 'ar' ? 'أوامر البيع' : 'Sales Orders'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
          {deletableSelectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              {language === 'ar' ? `حذف (${deletableSelectedIds.length})` : `Delete (${deletableSelectedIds.length})`}
            </Button>
          )}
          <Button variant="outline" onClick={handleExportTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'قالب Excel' : 'Template'}
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {language === 'ar' ? 'استيراد' : 'Import'}
          </Button>
          <Button onClick={() => navigate("/sales-order-entry/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'إضافة جديد' : 'Add New'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'القائمة' : 'List'} ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {(() => {
                        const eligibleIds = orders.filter(o => o.status !== 'confirmed').map(o => o.id);
                        const allChecked = eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.includes(id));
                        return (
                          <Checkbox
                            checked={allChecked}
                            onCheckedChange={toggleSelectAll}
                            disabled={eligibleIds.length === 0}
                            aria-label="Select all"
                          />
                        );
                      })()}
                    </TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order #'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'العميل' : 'Customer'}</TableHead>
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الكوينز' : 'Coins'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الربح' : 'Profit'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="w-32">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        {language === 'ar' ? 'لا توجد طلبات' : 'No orders yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o, idx) => (
                      <TableRow key={o.id} data-state={selectedIds.includes(o.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(o.id)}
                            onCheckedChange={() => toggleSelectOne(o.id)}
                            disabled={o.status === 'confirmed'}
                            aria-label={`Select ${o.order_number}`}
                          />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                        <TableCell>{o.order_date ? format(new Date(o.order_date), "yyyy-MM-dd") : ''}</TableCell>
                        <TableCell>{o.customer_name || '—'}{o.customer_phone ? ` (${o.customer_phone})` : ''}</TableCell>
                        <TableCell>{o.payment_method || '—'}</TableCell>
                        <TableCell className="text-right font-medium">{Number(o.total_coins || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{Number(o.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className={`text-right font-medium ${Number(o.total_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Number(o.total_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status === 'confirmed' ? 'default' : 'secondary'}>
                            {o.status === 'confirmed'
                              ? (language === 'ar' ? 'مؤكد' : 'Confirmed')
                              : (language === 'ar' ? 'مسودة' : 'Draft')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/sales-order-entry/${o.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {o.status !== 'confirmed' && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(o.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewRows} onOpenChange={(o) => !o && !committing && setPreviewRows(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'معاينة الاستيراد' : 'Import Preview'}
              {previewRows && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  {previewRows.length} rows · {previewRows.filter(r => r.issues.length === 0).length} ready · {previewRows.filter(r => r.issues.length > 0).length} with issues
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewRows && (() => {
            const ready = previewRows.filter(r => r.issues.length === 0);
            const totalSales = ready.reduce((s, r) => s + (Number(r.total) || 0), 0);
            const totalCost = ready.reduce((s, r) => s + (Number(r.cost_price) || 0) * (Number(r.qty) || 0), 0);
            const margin = totalSales - totalCost;
            const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Rows Ready</div>
                  <div className="text-base font-semibold">{ready.length.toLocaleString()}</div>
                </div>
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Total Sales</div>
                  <div className="text-base font-semibold text-primary">{fmt(totalSales)}</div>
                </div>
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Total Cost</div>
                  <div className="text-base font-semibold text-destructive">{fmt(totalCost)}</div>
                </div>
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Margin</div>
                  <div className={cn("text-base font-semibold", margin >= 0 ? "text-emerald-600" : "text-destructive")}>{fmt(margin)}</div>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-4 py-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                id="showErrorsOnly"
                checked={showErrorsOnly}
                onCheckedChange={(c) => setShowErrorsOnly(c === true)}
              />
              <label htmlFor="showErrorsOnly" className="text-sm cursor-pointer">
                {language === 'ar' ? 'إظهار الأخطاء فقط' : 'Show Errors Only'}
              </label>
              {showErrorsOnly && previewRows && (
                <span className="text-xs text-muted-foreground ml-1">
                  {(sortedPreview || []).filter((r: any) => r.issues.length > 0).length} rows
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showBrandErrorsOnly"
                checked={showBrandErrorsOnly}
                onCheckedChange={(c) => setShowBrandErrorsOnly(c === true)}
              />
              <label htmlFor="showBrandErrorsOnly" className="text-sm cursor-pointer">
                {language === 'ar' ? 'أخطاء الماركة فقط' : 'Brand Error Only'}
              </label>
              {showBrandErrorsOnly && previewRows && (
                <span className="text-xs text-muted-foreground ml-1">
                  {(sortedPreview || []).filter((r: any) => r.issues.some((i: string) => i.includes('Brand not found'))).length} rows
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showProductErrorsOnly"
                checked={showProductErrorsOnly}
                onCheckedChange={(c) => setShowProductErrorsOnly(c === true)}
              />
              <label htmlFor="showProductErrorsOnly" className="text-sm cursor-pointer">
                {language === 'ar' ? 'أخطاء المنتج فقط' : 'Product Error Only'}
              </label>
              {showProductErrorsOnly && previewRows && (
                <span className="text-xs text-muted-foreground ml-1">
                  {(sortedPreview || []).filter((r: any) => r.issues.some((i: string) => i.includes('Product not found'))).length} rows
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showUnitPriceZero"
                checked={showUnitPriceZero}
                onCheckedChange={(c) => setShowUnitPriceZero(c === true)}
              />
              <label htmlFor="showUnitPriceZero" className="text-sm cursor-pointer">
                {language === 'ar' ? 'سعر الوحدة صفر فقط' : 'Unit Price Zero'}
              </label>
              {showUnitPriceZero && previewRows && (
                <span className="text-xs text-muted-foreground ml-1">
                  {(sortedPreview || []).filter((r: any) => !Number(r.unit_price)).length} rows
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showUnitCostZero"
                checked={showUnitCostZero}
                onCheckedChange={(c) => setShowUnitCostZero(c === true)}
              />
              <label htmlFor="showUnitCostZero" className="text-sm cursor-pointer">
                {language === 'ar' ? 'تكلفة الوحدة صفر فقط' : 'Unit Cost Zero'}
              </label>
              {showUnitCostZero && previewRows && (
                <span className="text-xs text-muted-foreground ml-1">
                  {(sortedPreview || []).filter((r: any) => !Number(r.cost_price)).length} rows
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={salesRefFilter}
                onChange={(e) => setSalesRefFilter(e.target.value)}
                placeholder={language === 'ar' ? 'بحث برقم المرجع' : 'Filter sales ref'}
                className="h-8 w-44 text-xs"
              />
              {salesRefFilter && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSalesRefFilter("")}>
                  ✕
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1"
              disabled={refreshingPreview}
              onClick={handleRefreshPreview}
            >
              {refreshingPreview ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
          <div className="flex-1 overflow-auto border rounded">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {[
                    { key: 'sales_reference', label: 'Sales Ref' },
                    { key: 'group_key', label: 'Group' },
                    { key: 'order_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'source_brand_name', label: 'Source (Excel)' },
                    { key: 'vendor', label: 'Vendor' },
                    { key: 'brand_code', label: 'Brand Code' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'product_id', label: 'Product ID' },
                    { key: 'product_name', label: 'Product' },
                    { key: 'coins_number', label: 'Coins', align: 'right' },
                    { key: 'qty', label: 'Qty', align: 'right' },
                    { key: 'unit_price', label: 'Unit', align: 'right' },
                    { key: 'cost_price', label: 'Cost', align: 'right' },
                    { key: 'total', label: 'Total', align: 'right' },
                    { key: 'total_cost', label: 'Total Cost', align: 'right' },
                    { key: 'issuesKey', label: 'Status' },
                  ].map(col => {
                    const sortKey = col.key === 'issuesKey' ? 'issuesKey' : col.key;
                    const cfgIdx = sortConfig.findIndex(s => s.key === sortKey);
                    const cfg = cfgIdx >= 0 ? sortConfig[cfgIdx] : null;
                    return (
                      <TableHead
                        key={col.key}
                        className={cn('cursor-pointer select-none', col.align === 'right' ? 'text-right' : '')}
                        onClick={(e) => toggleSort(sortKey, e.shiftKey)}
                        title="Click to sort, Shift+Click to add"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {cfg && (cfg.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                          {cfg && sortConfig.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">{cfgIdx + 1}</span>
                          )}
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sortedPreview || []).filter((r: any) => {
                  const refQuery = salesRefFilter.trim().toLowerCase();
                  if (refQuery && !String(r.sales_reference || "").toLowerCase().includes(refQuery)) return false;
                  const hasAnyIssue = r.issues.length > 0;
                  const hasBrandError = r.issues.some((i: string) => i.includes('Brand not found'));
                  const hasProductError = r.issues.some((i: string) => i.includes('Product not found'));
                  const unitPriceZero = !Number(r.unit_price);
                  const unitCostZero = !Number(r.cost_price);
                  const anyFilter = showErrorsOnly || showBrandErrorsOnly || showProductErrorsOnly || showUnitPriceZero || showUnitCostZero;
                  if (!anyFilter) return true;
                  if (showErrorsOnly && hasAnyIssue) return true;
                  if (showBrandErrorsOnly && hasBrandError) return true;
                  if (showProductErrorsOnly && hasProductError) return true;
                  if (showUnitPriceZero && unitPriceZero) return true;
                  if (showUnitCostZero && unitCostZero) return true;
                  return false;
                }).map((r: any) => {
                  const origIdx = r.__idx;
                  return (
                    <TableRow key={origIdx} className={r.issues.length > 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                      <TableCell className="text-xs font-medium">{r.sales_reference || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{r.group_key?.startsWith('__row_') ? <span className="text-muted-foreground">—</span> : r.group_key}</TableCell>
                      <TableCell className="text-xs">{r.order_date}</TableCell>
                      <TableCell className="text-xs">{r.customer_name}</TableCell>
                      <TableCell className="text-xs">{r.source_brand_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className={`text-xs ${r.vendor && !suppliersSet.has(String(r.vendor).trim().toLowerCase()) ? 'text-destructive font-medium' : ''}`}>{r.vendor || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs font-mono">{r.brand_code || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell className="text-xs">
                        <Popover open={brandPopoverIdx === origIdx} onOpenChange={(o) => setBrandPopoverIdx(o ? origIdx : null)}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs font-normal justify-between min-w-[140px]">
                              <span className="truncate">
                                {r.brand_name || <span className="text-muted-foreground">Select brand</span>}
                              </span>
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[260px]" align="start">
                            <Command>
                              <CommandInput placeholder="Search brand..." />
                              <CommandList>
                                <CommandEmpty>No brand found.</CommandEmpty>
                                <CommandGroup>
                                  {brandsList.map(b => (
                                    <CommandItem
                                      key={b.id}
                                      value={`${b.brand_name} ${b.brand_code}`}
                                      onSelect={() => handleChangeRowBrand(origIdx, b.id)}
                                    >
                                      <span className="font-medium">{b.brand_name}</span>
                                      {b.brand_code && <span className="ml-2 text-xs text-muted-foreground">({b.brand_code})</span>}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground" title={r.product_id || ''}>{r.product_id ? String(r.product_id).slice(0, 8) + '…' : <span className="text-destructive">—</span>}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Popover open={productPopoverIdx === origIdx} onOpenChange={(o) => setProductPopoverIdx(o ? origIdx : null)}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs font-normal justify-between min-w-[140px]">
                                <span className="truncate">
                                  {r.product_name || <span className="text-muted-foreground">Select product</span>}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[320px]" align="start">
                              <Command>
                                <CommandInput placeholder="Search product..." />
                                <CommandList>
                                  <CommandEmpty>No product found.</CommandEmpty>
                                  <CommandGroup>
                                    {productsList
                                      .filter(p => {
                                        const bk = String(r.brand_code || r.brand_name || "").trim().toLowerCase();
                                        const pbk = String(p.brand_code || p.brand_name || "").trim().toLowerCase();
                                        return !bk || pbk === bk;
                                      })
                                      .map(p => (
                                        <CommandItem
                                          key={p.id}
                                          value={`${p.product_name} ${p.coins_number}`}
                                          onSelect={() => handleChangeRowProduct(origIdx, p.id)}
                                        >
                                          <span className="font-medium">{p.product_name}</span>
                                          {p.coins_number != null && <span className="ml-2 text-xs text-muted-foreground">({p.coins_number} coins)</span>}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {r.product_name && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Copy product name"
                              onClick={() => {
                                navigator.clipboard.writeText(r.product_name);
                                toast({ title: language === 'ar' ? 'تم النسخ' : 'Copied', description: r.product_name });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">{Number(r.coins_number).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs">{r.qty}</TableCell>
                      <TableCell className="text-right text-xs">{Number(r.unit_price).toFixed(7)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(r.cost_price).toFixed(7)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{Number(r.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{Number(r.total_cost ?? (Number(r.cost_price) || 0) * (Number(r.qty) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {r.issues.length === 0 ? (
                          <Badge variant="secondary" className="text-xs">OK</Badge>
                        ) : (
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />{r.issues.join('; ')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={committing} onClick={() => setPreviewRows(null)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button disabled={committing || !previewRows?.some(r => r.issues.length === 0)} onClick={handleCommitImport}>
              {committing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {language === 'ar' ? 'تأكيد الاستيراد' : 'Confirm Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.' : 'Are you sure you want to delete this draft order? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{language === 'ar' ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && !bulkDeleting && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'ar' ? 'حذف متعدد' : 'Delete Selected'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `سيتم حذف ${deletableSelectedIds.length} طلب (المسودات فقط). لا يمكن التراجع.`
                : `${deletableSelectedIds.length} draft order(s) will be deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesOrderList;
