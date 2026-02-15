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
import { Plus, Trash2, Save, Upload, FileText, X, Coins } from "lucide-react";
import { format } from "date-fns";

interface Supplier { id: string; supplier_name: string; }
interface Brand { id: string; brand_name: string; }
interface Bank { id: string; bank_name: string; }
interface Product { id: string; product_name: string; coins_number: number; product_price: number; }
interface LineItem { 
  id: string; 
  product_id: string; 
  product_name: string; 
  coins: number; 
  unit_price: number; 
  total: number; 
}
interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

const ReceivingCoins = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/receiving-coins");

  // Header state
  const [supplierId, setSupplierId] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [brandId, setBrandId] = useState("");
  const [controlAmount, setControlAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [receiverName, setReceiverName] = useState("");

  // Line items
  const [lines, setLines] = useState<LineItem[]>([]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Dropdown data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [saving, setSaving] = useState(false);

  // Saved receipts list
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    fetchDropdowns();
    fetchReceipts();
  }, []);

  useEffect(() => {
    if (brandId) {
      fetchProducts();
    } else {
      setProducts([]);
    }
  }, [brandId]);

  const fetchDropdowns = async () => {
    const [suppRes, brandRes, bankRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("brands").select("id, brand_name").eq("status", "active").order("brand_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bankRes.data) setBanks(bankRes.data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, product_name, coins_number, product_price")
      .eq("allow_purchase", true)
      .order("product_name");
    if (data) setProducts(data.map(d => ({ ...d, product_price: parseFloat(String(d.product_price)) || 0 })) as Product[]);
  };

  const fetchReceipts = async () => {
    const { data } = await supabase
      .from("receiving_coins_header")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setReceipts(data);
  };

  const addLine = () => {
    setLines([...lines, {
      id: crypto.randomUUID(),
      product_id: "",
      product_name: "",
      coins: 0,
      unit_price: 0,
      total: 0,
    }]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: value };
      
      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.product_name = product.product_name;
          updated.coins = product.coins_number || 0;
          updated.unit_price = product.product_price || 0;
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
    if (!supplierId || !brandId || !bankId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    if (lines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة منتج واحد على الأقل" : "Please add at least one product line");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const headerData = {
        receipt_number: selectedReceiptId ? undefined : generateReceiptNumber(),
        supplier_id: supplierId,
        receipt_date: receiptDate,
        brand_id: brandId,
        control_amount: parseFloat(controlAmount) || 0,
        bank_id: bankId,
        receiver_name: receiverName,
        total_amount: totalAmount,
        created_by: user?.email || "",
      };

      let headerId: string;

      if (selectedReceiptId) {
        const { receipt_number, ...updateData } = headerData;
        const { error } = await supabase
          .from("receiving_coins_header")
          .update(updateData as any)
          .eq("id", selectedReceiptId);
        if (error) throw error;
        headerId = selectedReceiptId;

        // Delete old lines
        await supabase.from("receiving_coins_line").delete().eq("header_id", headerId);
      } else {
        const { data, error } = await supabase
          .from("receiving_coins_header")
          .insert(headerData as any)
          .select("id")
          .single();
        if (error) throw error;
        headerId = data.id;
      }

      // Insert lines
      const lineInserts = lines.map(l => ({
        header_id: headerId,
        product_id: l.product_id || null,
        product_name: l.product_name,
        coins: l.coins,
        unit_price: l.unit_price,
      }));

      const { error: lineError } = await supabase
        .from("receiving_coins_line")
        .insert(lineInserts as any);
      if (lineError) throw lineError;

      // Insert attachments
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
    } catch (error: any) {
      toast.error(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setReceiptDate(format(new Date(), "yyyy-MM-dd"));
    setBrandId("");
    setControlAmount("");
    setBankId("");
    setReceiverName("");
    setLines([]);
    setAttachments([]);
    setSelectedReceiptId(null);
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
      setSupplierId(h.supplier_id || "");
      setReceiptDate(h.receipt_date || format(new Date(), "yyyy-MM-dd"));
      setBrandId(h.brand_id || "");
      setControlAmount(h.control_amount?.toString() || "");
      setBankId(h.bank_id || "");
      setReceiverName(h.receiver_name || "");
    }

    if (linesRes.data) {
      setLines((linesRes.data as any[]).map(l => ({
        id: l.id,
        product_id: l.product_id || "",
        product_name: l.product_name || "",
        coins: l.coins || 0,
        unit_price: l.unit_price || 0,
        total: (l.coins || 0) * (l.unit_price || 0),
      })));
    }

    if (attRes.data) {
      setAttachments((attRes.data as any[]).map(a => ({
        id: a.id,
        file_name: a.file_name,
        file_path: a.file_path,
        file_size: a.file_size || 0,
      })));
    }
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "استلام العملات" : "Receiving Coins"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetForm}>
            {isArabic ? "جديد" : "New"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ" : "Save")}
          </Button>
        </div>
      </div>

      {/* Header Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "بيانات الإيصال" : "Receipt Header"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Supplier */}
            <div className="space-y-2">
              <Label>{isArabic ? "المورد *" : "Supplier *"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>{isArabic ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <Label>{isArabic ? "العلامة التجارية *" : "Brand *"}</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العلامة" : "Select brand"} /></SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Control Amount */}
            <div className="space-y-2">
              <Label>{isArabic ? "المبلغ المتحكم" : "Control Amount"}</Label>
              <Input 
                type="number" 
                value={controlAmount} 
                onChange={e => setControlAmount(e.target.value)} 
                placeholder="0.00"
              />
            </div>

            {/* Bank */}
            <div className="space-y-2">
              <Label>{isArabic ? "البنك *" : "Bank *"}</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر البنك" : "Select bank"} /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Receiver Name */}
            <div className="space-y-2">
              <Label>{isArabic ? "اسم المستلم" : "Receiver Name"}</Label>
              <Input 
                value={receiverName} 
                onChange={e => setReceiverName(e.target.value)} 
                placeholder={isArabic ? "أدخل اسم المستلم" : "Enter receiver name"}
              />
            </div>
          </div>

          {/* Total Display */}
          <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
            <span className="font-semibold">{isArabic ? "إجمالي المبلغ" : "Total Amount"}</span>
            <span className="text-xl font-bold text-primary">{totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "المرفقات" : "Attachments"}</span>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع ملفات" : "Upload Files")}
                </span>
              </Button>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{isArabic ? "لا توجد مرفقات" : "No attachments"}</p>
          ) : (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {att.file_name}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      ({(att.file_size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAttachment(att.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "المنتجات" : "Products"}</span>
            <Button size="sm" onClick={addLine} disabled={!brandId}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة منتج" : "Add Product"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!brandId ? (
            <p className="text-muted-foreground text-sm">{isArabic ? "اختر العلامة التجارية أولاً" : "Select a brand first"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isArabic ? "المنتج" : "Product"}</TableHead>
                    <TableHead>{isArabic ? "العملات" : "Coins"}</TableHead>
                    <TableHead>{isArabic ? "سعر الوحدة" : "Unit Price"}</TableHead>
                    <TableHead>{isArabic ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {isArabic ? "لا توجد منتجات" : "No products added"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, idx) => (
                      <TableRow key={line.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Select value={line.product_id} onValueChange={v => updateLine(line.id, "product_id", v)}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder={isArabic ? "اختر المنتج" : "Select product"} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={line.coins} 
                            onChange={e => updateLine(line.id, "coins", parseFloat(e.target.value) || 0)}
                            className="w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={line.unit_price} 
                            onChange={e => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)}
                            className="w-[120px]"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{line.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Previous Receipts */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "الإيصالات السابقة" : "Previous Receipts"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "رقم الإيصال" : "Receipt #"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ" : "Amount"}</TableHead>
                  <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                    <TableCell>{r.receipt_date}</TableCell>
                    <TableCell>{parseFloat(r.total_amount).toFixed(2)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => loadReceipt(r.id)}>
                        {isArabic ? "تحميل" : "Load"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceivingCoins;
