import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Save, Upload, FileText, X, Coins, ArrowLeft, Eye, Image, CheckCircle2, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import CoinsOrderAttachments from "@/components/CoinsOrderAttachments";

interface Supplier { id: string; supplier_name: string; }
interface Brand { id: string; brand_name: string; }
interface Bank { id: string; bank_name: string; }
interface Currency { id: string; currency_code: string; currency_name: string; }
interface LineItem { 
  id: string; 
  brand_id: string; 
  brand_name: string; 
  supplier_id: string;
  coins: number; 
  unit_price: number; 
  total: number;
  is_confirmed: boolean;
  confirmed_by_name: string;
}
interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

// Determine if all brands in this receipt are fully delivered
const computeDeliveryStatus = (currentLines: LineItem[], controlAmounts: Record<string, number>): string => {
  const confirmedLines = currentLines.filter(l => l.is_confirmed);
  if (confirmedLines.length === 0) return "draft";
  
  // Only check brands that exist in the current receipt's lines
  const receiptBrandIds = [...new Set(currentLines.map(l => l.brand_id).filter(Boolean))];
  if (receiptBrandIds.length === 0) return "partial_delivery";
  
  for (const brandId of receiptBrandIds) {
    const control = controlAmounts[brandId] || 0;
    if (control <= 0) continue;
    const received = confirmedLines.filter(l => l.brand_id === brandId).reduce((sum, l) => sum + l.total, 0);
    if (received < control) return "partial_delivery";
  }
  return "full_delivery";
};

const ReceivingCoins = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/receiving-coins");
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "form">("list");

  // Header state
  const [supplierId, setSupplierId] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [controlAmount, setControlAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  // Line items (brand-based)
  const [lines, setLines] = useState<LineItem[]>([]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Receiving images from coins_purchase_receiving (per brand)
  const [receivingImages, setReceivingImages] = useState<Record<string, string>>({});
  // confirmedBrands kept for receiving images only
  const [confirmedBrands, setConfirmedBrands] = useState<Record<string, { confirmed: boolean; confirmedBy: string; confirmedAt: string }>>({});
  // Per-brand control amounts from purchase order lines (brand_id → amount_in_currency)
  const [brandControlAmounts, setBrandControlAmounts] = useState<Record<string, number>>({});

  // Dropdown data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  // Track the linked purchase order to fetch receiving images
  const [linkedPurchaseOrderId, setLinkedPurchaseOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipts();
    const fromOrderId = searchParams.get("fromOrder");
    if (fromOrderId) {
      loadFromPurchaseOrder(fromOrderId);
    }
  }, []);

  useEffect(() => {
    if (view === "form") {
      fetchDropdowns();
    }
  }, [view]);

  const fetchDropdowns = async () => {
    const [suppRes, brandRes, bankRes, currRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
      supabase.from("currencies").select("id, currency_code, currency_name").order("currency_code"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (currRes.data) setCurrencies(currRes.data as Currency[]);
  };

  const loadFromPurchaseOrder = async (orderId: string) => {
    // Check if a receiving entry already exists for this purchase order
    const { data: existingHeader } = await supabase
      .from("receiving_coins_header")
      .select("id")
      .eq("purchase_order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingHeader) {
      // Load the existing receipt instead of creating a new one
      await loadReceipt(existingHeader.id);
      setView("form");
      return;
    }

    const [suppRes, brandRes, bankRes, currRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
      supabase.from("currencies").select("id, currency_code, currency_name").order("currency_code"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (currRes.data) setCurrencies(currRes.data as Currency[]);

    const { data: order } = await supabase
      .from("coins_purchase_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      if (order.supplier_id) setSupplierId(order.supplier_id);
      if (order.bank_id) setBankId(order.bank_id);
      if (order.currency_id) setCurrencyId(order.currency_id);
      if (order.exchange_rate) setExchangeRate(String(order.exchange_rate));
      setControlAmount(String(parseFloat(String(order.amount_in_currency || "0"))));
      setLinkedPurchaseOrderId(orderId);
      setView("form");

      // Load order lines as brand-based lines
      const { data: orderLines } = await supabase
        .from("coins_purchase_order_lines")
        .select("*, brands(brand_name)")
        .eq("purchase_order_id", orderId)
        .order("line_number");
      if (orderLines && orderLines.length > 0) {
        // Build per-brand control amounts
        const brandAmounts: Record<string, number> = {};
        for (const ol of orderLines) {
          if (ol.brand_id) {
            brandAmounts[ol.brand_id] = (brandAmounts[ol.brand_id] || 0) + (ol.amount_in_currency || 0);
          }
        }
        setBrandControlAmounts(brandAmounts);
        
        setLines(orderLines.map((ol: any) => ({
          id: crypto.randomUUID(),
          brand_id: ol.brand_id,
          brand_name: ol.brands?.brand_name || "",
          supplier_id: ol.supplier_id || "",
          coins: 0,
          unit_price: 0,
          total: 0,
          is_confirmed: false,
          confirmed_by_name: "",
        })));
      }

      // Load receiving images for this purchase order
      const { data: recImages } = await supabase
        .from("coins_purchase_receiving")
        .select("brand_id, receiving_image")
        .eq("purchase_order_id", orderId);
      if (recImages) {
        const imgMap: Record<string, string> = {};
        for (const r of recImages) {
          if (r.brand_id && r.receiving_image) imgMap[r.brand_id] = r.receiving_image;
        }
        setReceivingImages(imgMap);
      }
    }
  };

  const fetchReceipts = async () => {
    const { data } = await supabase
      .from("receiving_coins_header")
      .select("*, currencies(currency_code), coins_purchase_orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      // Auto-fix: check draft receipts for confirmed lines and update to partial_delivery
      const draftReceipts = data.filter((r: any) => r.status === "draft" || !r.status);
      if (draftReceipts.length > 0) {
        const draftIds = draftReceipts.map((r: any) => r.id);
        const { data: confirmedLines } = await supabase
          .from("receiving_coins_line")
          .select("header_id")
          .in("header_id", draftIds)
          .eq("is_confirmed", true);
        if (confirmedLines && confirmedLines.length > 0) {
          const headerIdsToFix = [...new Set(confirmedLines.map((l: any) => l.header_id))];
          for (const hid of headerIdsToFix) {
            await supabase.from("receiving_coins_header").update({ status: "partial_delivery" } as any).eq("id", hid);
          }
          // Update local data
          for (const r of data as any[]) {
            if (headerIdsToFix.includes(r.id)) {
              r.status = "partial_delivery";
            }
          }
        }
      }
      setReceipts(data);
    }
  };

  const addLine = () => {
    const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
    const lastBrandId = lastLine?.brand_id || "";
    const lastUnitPrice = lastLine?.unit_price || 0;
    
    // Calculate remaining for the specific brand
    const brandControl = lastBrandId ? (brandControlAmounts[lastBrandId] || 0) : 0;
    const brandUsed = lines.filter(l => l.brand_id === lastBrandId).reduce((sum, l) => sum + l.total, 0);
    const remainingAmount = brandControl > 0 ? Math.max(0, brandControl - brandUsed) : 0;
    const remainingCoins = lastUnitPrice > 0 ? Math.round(remainingAmount / lastUnitPrice) : 0;
    
    setLines([...lines, {
      id: crypto.randomUUID(),
      brand_id: lastBrandId,
      brand_name: lastLine?.brand_name || "",
      supplier_id: lastLine?.supplier_id || "",
      coins: remainingCoins,
      unit_price: lastUnitPrice,
      total: remainingCoins * lastUnitPrice,
      is_confirmed: false,
      confirmed_by_name: "",
    }]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: value };
      if (field === "brand_id") {
        const brand = brands.find(b => b.id === value);
        if (brand) {
          updated.brand_name = brand.brand_name;
        }
        // Recalculate remaining coins for the new brand
        const brandControl = brandControlAmounts[value] || 0;
        const brandUsed = lines.filter(l => l.id !== id && l.brand_id === value).reduce((sum, l) => sum + l.total, 0);
        const remainingAmount = brandControl > 0 ? Math.max(0, brandControl - brandUsed) : 0;
        const unitPrice = updated.unit_price || 0;
        if (unitPrice > 0 && brandControl > 0) {
          updated.coins = Math.round(remainingAmount / unitPrice);
          updated.total = updated.coins * unitPrice;
        }
      }
      updated.total = updated.coins * updated.unit_price;
      return updated;
    }));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const totalAmount = lines.reduce((sum, l) => sum + l.total, 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';
        const publicId = `receiving-coins/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
        });
        if (uploadError) throw uploadError;
        if (!uploadData?.url) throw new Error("Upload failed");
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          file_name: file.name,
          file_path: uploadData.url,
          file_size: file.size,
        }]);
      }
      toast.success(isArabic ? "تم رفع الملفات بنجاح" : "Files uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const generateReceiptNumber = () => {
    const now = new Date();
    return `RC-${format(now, "yyyyMMdd")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
  };

  const handleSave = async () => {
    if (!supplierId || !bankId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    if (lines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة علامة تجارية واحدة على الأقل" : "Please add at least one brand line");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const headerData = {
        receipt_number: selectedReceiptId ? undefined : generateReceiptNumber(),
        supplier_id: supplierId,
        receipt_date: receiptDate,
        brand_id: lines[0]?.brand_id || null, // keep first brand for backward compat
        control_amount: parseFloat(controlAmount) || 0,
        bank_id: bankId,
        receiver_name: receiverName,
        total_amount: totalAmount,
        created_by: user?.email || "",
        currency_id: currencyId || null,
        exchange_rate: parseFloat(exchangeRate) || null,
      };
      let headerId: string;
      if (selectedReceiptId) {
        const { receipt_number, ...updateData } = headerData;
        const { error } = await supabase.from("receiving_coins_header").update(updateData as any).eq("id", selectedReceiptId);
        if (error) throw error;
        headerId = selectedReceiptId;
        // Only delete non-confirmed lines; confirmed lines stay
        const confirmedLineIds = lines.filter(l => l.is_confirmed).map(l => l.id);
        if (confirmedLineIds.length > 0) {
          await supabase.from("receiving_coins_line").delete().eq("header_id", headerId).not("id", "in", `(${confirmedLineIds.join(",")})`);
        } else {
          await supabase.from("receiving_coins_line").delete().eq("header_id", headerId);
        }
      } else {
        const { data, error } = await supabase.from("receiving_coins_header").insert(headerData as any).select("id").single();
        if (error) throw error;
        headerId = data.id;
      }
      // Only insert non-confirmed lines (confirmed ones were preserved)
      const newLines = lines.filter(l => !l.is_confirmed);
      if (newLines.length > 0) {
        const lineInserts = newLines.map(l => ({
          header_id: headerId,
          brand_id: l.brand_id || null,
          brand_name: l.brand_name,
          supplier_id: l.supplier_id || null,
          product_id: null,
          product_name: l.brand_name,
          coins: l.coins,
          unit_price: l.unit_price,
        }));
        const { error: lineError } = await supabase.from("receiving_coins_line").insert(lineInserts as any);
        if (lineError) throw lineError;
      }
      // Update confirmed lines data (coins, unit_price etc) in case they were modified before confirmation
      const existingConfirmedLines = lines.filter(l => l.is_confirmed);
      for (const cl of existingConfirmedLines) {
        await supabase.from("receiving_coins_line").update({
          brand_id: cl.brand_id || null,
          brand_name: cl.brand_name,
          supplier_id: cl.supplier_id || null,
          coins: cl.coins,
          unit_price: cl.unit_price,
        } as any).eq("id", cl.id);
      }
      if (attachments.length > 0) {
        const attInserts = attachments.map(a => ({
          header_id: headerId,
          file_name: a.file_name,
          file_path: a.file_path,
          file_size: a.file_size,
          uploaded_by: user?.email || "",
        }));
        await supabase.from("receiving_coins_attachments").insert(attInserts as any);
      }
      toast.success(isArabic ? "تم الحفظ بنجاح" : "Saved successfully");
      resetForm();
      fetchReceipts();
      setView("list");
    } catch (error: any) {
      toast.error(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setReceiptDate(format(new Date(), "yyyy-MM-dd"));
    setControlAmount("");
    setBankId("");
    setReceiverName("");
    setCurrencyId("");
    setExchangeRate("");
    setLines([]);
    setAttachments([]);
    setSelectedReceiptId(null);
    setReceiptNumber("");
    setOrderNumber("");
    setLinkedPurchaseOrderId(null);
    setReceivingImages({});
    setConfirmedBrands({});
    setBrandControlAmounts({});
  };

  const handleConfirmLine = async (lineId: string) => {
    if (!selectedReceiptId) {
      toast.error(isArabic ? "يرجى حفظ الإيصال أولاً" : "Please save the receipt first");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user?.id).maybeSingle();
      const userName = (profile as any)?.display_name || user?.email || "";
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("receiving_coins_line")
        .update({
          is_confirmed: true,
          confirmed_by: user?.id,
          confirmed_by_name: userName,
          confirmed_at: now,
        } as any)
        .eq("id", lineId);
      if (error) throw error;
      const updatedLines = lines.map(l => l.id === lineId ? { ...l, is_confirmed: true, confirmed_by_name: userName } : l);
      setLines(updatedLines);
      // Determine if all brands are fully delivered or partial
      if (selectedReceiptId && receiptStatus !== "closed") {
        const newStatus = computeDeliveryStatus(updatedLines, brandControlAmounts);
        await supabase.from("receiving_coins_header").update({ status: newStatus } as any).eq("id", selectedReceiptId);
        setReceiptStatus(newStatus);
      }
      toast.success(isArabic ? "تم تأكيد الاستلام" : "Receiving confirmed");
    } catch (err: any) {
      toast.error(err.message || "Error confirming");
    }
  };

  const handleRollbackLine = async (lineId: string) => {
    try {
      const { error } = await supabase
        .from("receiving_coins_line")
        .update({
          is_confirmed: false,
          confirmed_by: null,
          confirmed_by_name: null,
          confirmed_at: null,
        } as any)
        .eq("id", lineId);
      if (error) throw error;
      const updatedLines = lines.map(l => l.id === lineId ? { ...l, is_confirmed: false, confirmed_by_name: "" } : l);
      setLines(updatedLines);
      // Recompute status
      if (selectedReceiptId && receiptStatus !== "closed") {
        const anyConfirmed = updatedLines.some(l => l.is_confirmed);
        const newStatus = anyConfirmed ? computeDeliveryStatus(updatedLines, brandControlAmounts) : "draft";
        await supabase.from("receiving_coins_header").update({ status: newStatus } as any).eq("id", selectedReceiptId);
        setReceiptStatus(newStatus);
      }
      toast.success(isArabic ? "تم التراجع عن التأكيد" : "Confirmation rolled back");
    } catch (err: any) {
      toast.error(err.message || "Error rolling back");
    }
  };

  const [receiptStatus, setReceiptStatus] = useState("draft");

  const handleCloseEntry = async () => {
    if (!selectedReceiptId) return;
    const controlNum = parseFloat(controlAmount) || 0;
    if (controlNum > 0 && totalAmount < controlNum) {
      toast.error(isArabic ? "لا يمكن إغلاق الإيصال - المبلغ المستلم أقل من المبلغ المتحكم" : "Cannot close - received amount is less than control amount");
      return;
    }
    try {
      const { error } = await supabase.from("receiving_coins_header").update({ status: "closed" } as any).eq("id", selectedReceiptId);
      if (error) throw error;
      setReceiptStatus("closed");
      toast.success(isArabic ? "تم إغلاق الإيصال بنجاح" : "Entry closed successfully");
      fetchReceipts();
    } catch (err: any) {
      toast.error(err.message || "Error closing entry");
    }
  };

  const openNewEntry = () => {
    resetForm();
    setReceiptStatus("draft");
    setView("form");
  };

  const loadReceipt = async (receiptId: string) => {
    const [headerRes, linesRes, attRes] = await Promise.all([
      supabase.from("receiving_coins_header").select("*").eq("id", receiptId).maybeSingle(),
      supabase.from("receiving_coins_line").select("*").eq("header_id", receiptId),
      supabase.from("receiving_coins_attachments").select("*").eq("header_id", receiptId),
    ]);
    if (headerRes.data) {
      const h = headerRes.data as any;
      setSelectedReceiptId(h.id);
      setReceiptNumber(h.receipt_number || "");
      setSupplierId(h.supplier_id || "");
      setReceiptDate(h.receipt_date || format(new Date(), "yyyy-MM-dd"));
      setControlAmount(h.control_amount?.toString() || "");
      setBankId(h.bank_id || "");
      setReceiverName(h.receiver_name || "");
      setCurrencyId(h.currency_id || "");
      setExchangeRate(h.exchange_rate?.toString() || "");
      setReceiptStatus(h.status || "draft");
      setLinkedPurchaseOrderId(h.purchase_order_id || null);

      // Fetch order number if linked
      if (h.purchase_order_id) {
        const [orderDataRes, orderLinesRes] = await Promise.all([
          supabase.from("coins_purchase_orders").select("order_number").eq("id", h.purchase_order_id).maybeSingle(),
          supabase.from("coins_purchase_order_lines").select("brand_id, amount_in_currency").eq("purchase_order_id", h.purchase_order_id),
        ]);
        setOrderNumber(orderDataRes.data?.order_number || "");
        
        // Load per-brand control amounts
        if (orderLinesRes.data) {
          const loadedBrandAmounts: Record<string, number> = {};
          for (const ol of orderLinesRes.data) {
            if (ol.brand_id) {
              loadedBrandAmounts[ol.brand_id] = (loadedBrandAmounts[ol.brand_id] || 0) + (ol.amount_in_currency || 0);
            }
          }
          setBrandControlAmounts(loadedBrandAmounts);
          (headerRes.data as any)._brandAmounts = loadedBrandAmounts;
        }
      } else {
        setOrderNumber("");
        setBrandControlAmounts({});
      }
    }
    if (linesRes.data) {
      const mappedLines = (linesRes.data as any[]).map(l => ({
        id: l.id,
        brand_id: l.brand_id || "",
        brand_name: l.brand_name || l.product_name || "",
        supplier_id: l.supplier_id || "",
        coins: l.coins || 0,
        unit_price: l.unit_price || 0,
        total: (l.coins || 0) * (l.unit_price || 0),
        is_confirmed: l.is_confirmed || false,
        confirmed_by_name: l.confirmed_by_name || "",
      }));
      setLines(mappedLines);

      // Auto-fix status based on confirmed lines and brand control amounts
      const anyConfirmed = mappedLines.some(l => l.is_confirmed);
      const currentStatus = (headerRes.data as any)?.status || "draft";
      const loadedBrandAmounts = (headerRes.data as any)?._brandAmounts || {};
      if (anyConfirmed && currentStatus !== "closed" && receiptId) {
        const newStatus = computeDeliveryStatus(mappedLines, loadedBrandAmounts);
        if (newStatus !== currentStatus) {
          await supabase.from("receiving_coins_header").update({ status: newStatus } as any).eq("id", receiptId);
          setReceiptStatus(newStatus);
        }
      }

      // Try to load receiving images and confirmation status for brands in lines
      const brandIds = (linesRes.data as any[]).filter(l => l.brand_id).map(l => l.brand_id);
      if (brandIds.length > 0 && headerRes.data) {
        const purchaseOrderId = (headerRes.data as any).purchase_order_id;
        const query = purchaseOrderId
          ? supabase.from("coins_purchase_receiving").select("brand_id, receiving_image, is_confirmed, confirmed_by_name, confirmed_at").eq("purchase_order_id", purchaseOrderId)
          : supabase.from("coins_purchase_receiving").select("brand_id, receiving_image, is_confirmed, confirmed_by_name, confirmed_at").in("brand_id", brandIds);
        const { data: recData } = await query;
        if (recData) {
          const imgMap: Record<string, string> = {};
          const confMap: Record<string, { confirmed: boolean; confirmedBy: string; confirmedAt: string }> = {};
          for (const r of recData) {
            if (r.brand_id && r.receiving_image) imgMap[r.brand_id] = r.receiving_image;
            if (r.brand_id) {
              confMap[r.brand_id] = {
                confirmed: r.is_confirmed || false,
                confirmedBy: r.confirmed_by_name || "",
                confirmedAt: r.confirmed_at || "",
              };
            }
          }
          setReceivingImages(imgMap);
          setConfirmedBrands(confMap);
        }
      }
    }
    if (attRes.data) {
      setAttachments((attRes.data as any[]).map(a => ({
        id: a.id,
        file_name: a.file_name,
        file_path: a.file_path,
        file_size: a.file_size || 0,
      })));
    }
    setView("form");
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "إيصال الاستلام" : "Receiving Entry"}</h1>
          </div>
          <Button onClick={openNewEntry}>
            <Plus className="h-4 w-4 mr-1" />
            {isArabic ? "إدخال جديد" : "New Entry"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                    <TableHead>{isArabic ? "رقم الإيصال" : "Receipt #"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                    <TableHead>{isArabic ? "سعر الصرف" : "Rate"}</TableHead>
                    <TableHead>{isArabic ? "مبلغ المعاملة" : "Transaction Amt"}</TableHead>
                    <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                    <TableHead>{isArabic ? "المستلم" : "Receiver"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {isArabic ? "لا توجد إيصالات" : "No receipts found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipts.map(r => {
                      const rate = parseFloat(r.exchange_rate) || 0;
                      const sarAmount = parseFloat(r.control_amount) || 0;
                      const txnAmount = rate > 0 ? sarAmount / rate : sarAmount;
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadReceipt(r.id)}>
                          <TableCell className="font-mono text-sm">{(r as any).coins_purchase_orders?.order_number || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                          <TableCell>{r.receipt_date}</TableCell>
                          <TableCell>{(r as any).currencies?.currency_code || "-"}</TableCell>
                          <TableCell>{rate > 0 ? rate.toFixed(4) : "-"}</TableCell>
                          <TableCell>{rate > 0 ? txnAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</TableCell>
                          <TableCell>{sarAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>{r.receiver_name || "-"}</TableCell>
                          <TableCell>
                            {r.status === "closed" && <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">{isArabic ? "مغلق" : "Closed"}</span>}
                            {r.status === "full_delivery" && <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{isArabic ? "تسليم كامل" : "Full Delivery"}</span>}
                            {r.status === "partial_delivery" && <span className="text-xs font-medium px-2 py-1 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{isArabic ? "تسليم جزئي" : "Partial Delivery"}</span>}
                            {(r.status === "draft" || !r.status) && <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">{isArabic ? "مسودة" : "Draft"}</span>}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadReceipt(r.id); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Coins className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {selectedReceiptId
                ? (isArabic ? "تعديل الإيصال" : "Edit Receipt")
                : (isArabic ? "إيصال جديد" : "New Receipt")}
            </h1>
            {selectedReceiptId && (
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {orderNumber && (
                  <span>{isArabic ? "رقم الطلب" : "Order #"}: <span className="font-mono font-medium text-foreground">{orderNumber}</span></span>
                )}
                {receiptNumber && (
                  <span>{isArabic ? "رقم الإيصال" : "Receipt #"}: <span className="font-mono font-medium text-foreground">{receiptNumber}</span></span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
           {receiptStatus === "closed" && (
            <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-md">
              <Lock className="h-4 w-4" />
              {isArabic ? "مغلق" : "Closed"}
            </span>
          )}
          {receiptStatus === "partial_delivery" && (
            <span className="flex items-center gap-1 text-sm font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 rounded-md">
              {isArabic ? "تسليم جزئي" : "Partial Delivery"}
            </span>
          )}
          {receiptStatus === "full_delivery" && (
            <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-md">
              {isArabic ? "تسليم كامل" : "Full Delivery"}
            </span>
          )}
          {receiptStatus !== "closed" && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ" : "Save")}
            </Button>
          )}
          {selectedReceiptId && receiptStatus !== "closed" && (
            <Button 
              variant="outline" 
              onClick={handleCloseEntry} 
              disabled={(() => { const c = parseFloat(controlAmount) || 0; return c <= 0 || totalAmount < c; })()}
              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {isArabic ? "إغلاق الإيصال" : "Close Entry"}
            </Button>
          )}
        </div>
      </div>

      {/* Header Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "بيانات الإيصال" : "Receipt Header"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? "المورد الرئيسي *" : "Main Supplier *"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "العملة" : "Currency"}</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select currency"} /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (<SelectItem key={c.id} value={c.id}>{c.currency_code} - {c.currency_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
              <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="0.00" step="0.0001" />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المبلغ المتحكم (بالعملة)" : "Control Amount (Currency)"}</Label>
              <Input type="number" value={controlAmount} onChange={e => setControlAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "البنك *" : "Bank *"}</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر البنك" : "Select bank"} /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "اسم المستلم" : "Receiver Name"}</Label>
              <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder={isArabic ? "أدخل اسم المستلم" : "Enter receiver name"} />
            </div>
          </div>
          {(() => {
            const controlNum = parseFloat(controlAmount) || 0;
            const remaining = controlNum - totalAmount;
            const isComplete = controlNum > 0 && totalAmount >= controlNum;
            const progressPct = controlNum > 0 ? Math.min((totalAmount / controlNum) * 100, 100) : 0;
            const currencyCode = currencies.find(c => c.id === currencyId)?.currency_code || "";
            return (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{isArabic ? "إجمالي المستلم" : "Total Received"}</span>
                    <span className={`text-xl font-bold ${isComplete ? "text-green-600" : "text-primary"}`}>
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencyCode}
                    </span>
                  </div>
                  {controlNum > 0 && (
                    <>
                      <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isComplete ? "bg-green-600" : "bg-primary"}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{isArabic ? "المبلغ المتحكم" : "Control Amount"}: {controlNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencyCode}</span>
                        <span className={remaining > 0 ? "text-orange-500 font-medium" : "text-green-600 font-medium"}>
                          {remaining > 0
                            ? `${isArabic ? "متبقي" : "Remaining"}: ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`
                            : (isArabic ? "✓ مكتمل" : "✓ Complete")}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Purchase Order Attachments */}
      {linkedPurchaseOrderId && (
        <CoinsOrderAttachments
          purchaseOrderId={linkedPurchaseOrderId}
          currentPhase="coins_entry"
        />
      )}

      {/* Attachments + Receiving Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "المرفقات" : "Attachments"}</span>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع ملفات" : "Upload Files")}
                </span>
              </Button>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Receiving Images per Brand */}
          {Object.keys(receivingImages).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Image className="h-4 w-4" />
                {isArabic ? "صور الاستلام من المورد" : "Receiving Images from Supplier"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(receivingImages).map(([brandId, imageUrl]) => {
                  const brandLine = lines.find(l => l.brand_id === brandId);
                  const brandName = brandLine?.brand_name || brandId;
                  return (
                    <div key={brandId} className="border rounded-lg p-2 space-y-1">
                      <p className="text-xs font-medium text-center">{brandName}</p>
                      <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                        <img src={imageUrl} alt={brandName} className="w-full h-32 object-contain rounded border" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uploaded Attachments */}
          {attachments.length === 0 && Object.keys(receivingImages).length === 0 ? (
            <p className="text-muted-foreground text-sm">{isArabic ? "لا توجد مرفقات" : "No attachments"}</p>
          ) : (
            attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{att.file_name}</a>
                      <span className="text-xs text-muted-foreground">({(att.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAttachment(att.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Line Items - Brand based */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "العلامات التجارية" : "Brands"}</span>
            {receiptStatus !== "closed" && (
            <Button size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة سطر جديد" : "Add New Line"}
            </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                  <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                  <TableHead>{isArabic ? "الكوينز" : "Coins"}</TableHead>
                  <TableHead>{isArabic ? "سعر الوحدة" : "Unit Price"}</TableHead>
                  <TableHead>{isArabic ? "الإجمالي" : "Total"}</TableHead>
                  {Object.keys(brandControlAmounts).length > 0 && (
                    <TableHead>{isArabic ? "المتبقي للعلامة" : "Brand Remaining"}</TableHead>
                  )}
                  {selectedReceiptId && <TableHead>{isArabic ? "تأكيد الاستلام" : "Confirm"}</TableHead>}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={selectedReceiptId ? (Object.keys(brandControlAmounts).length > 0 ? 10 : 8) : (Object.keys(brandControlAmounts).length > 0 ? 8 : 7)} className="text-center text-muted-foreground">
                      {isArabic ? "لا توجد علامات تجارية" : "No brands added"}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, idx) => {
                    const isConfirmed = line.is_confirmed;
                    const isLocked = isConfirmed || receiptStatus === "closed";
                    return (
                    <TableRow key={line.id} className={isConfirmed ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        {isLocked ? (
                          <span className="text-sm font-medium">{line.brand_name}</span>
                        ) : (
                        <Select value={line.brand_id} onValueChange={v => updateLine(line.id, "brand_id", v)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={isArabic ? "اختر العلامة" : "Select brand"} />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (<SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {isLocked ? (
                          <span className="text-sm">{suppliers.find(s => s.id === line.supplier_id)?.supplier_name || "-"}</span>
                        ) : (
                        <Select value={line.supplier_id} onValueChange={v => updateLine(line.id, "supplier_id", v)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={line.coins} onChange={e => updateLine(line.id, "coins", parseFloat(e.target.value) || 0)} className="w-[120px]" disabled={isLocked} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={line.unit_price} onChange={e => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)} className="w-[140px]" step="0.00000001" disabled={isLocked} />
                      </TableCell>
                      <TableCell className="font-semibold">{line.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      {Object.keys(brandControlAmounts).length > 0 && (
                        <TableCell>
                          {line.brand_id && brandControlAmounts[line.brand_id] ? (() => {
                            const brandControl = brandControlAmounts[line.brand_id];
                            const brandUsed = lines.filter(l => l.brand_id === line.brand_id).reduce((sum, l) => sum + l.total, 0);
                            const remaining = Math.max(0, brandControl - brandUsed);
                            return (
                              <span className={remaining <= 0 ? "text-green-600 font-semibold" : "text-orange-500 font-semibold"}>
                                {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          })() : "-"}
                        </TableCell>
                      )}
                      {selectedReceiptId && (
                        <TableCell>
                          {isConfirmed ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs">
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                <div className="flex flex-col">
                                  <span className="font-medium text-green-600">{isArabic ? "مؤكد" : "Confirmed"}</span>
                                  {line.confirmed_by_name && (
                                    <span className="text-muted-foreground">{line.confirmed_by_name}</span>
                                  )}
                                </div>
                              </div>
                              {receiptStatus !== "closed" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRollbackLine(line.id)}
                                  title={isArabic ? "تراجع" : "Rollback"}
                                  className="h-7 w-7"
                                >
                                  <Undo2 className="h-3.5 w-3.5 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfirmLine(line.id)}
                              disabled={!line.brand_id || receiptStatus === "closed"}
                              className="text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {isArabic ? "تأكيد" : "Confirm"}
                            </Button>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {!isLocked && (
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceivingCoins;
