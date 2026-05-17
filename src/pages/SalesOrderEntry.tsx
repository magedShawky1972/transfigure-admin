import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, Check, RotateCcw, ChevronsUpDown, Loader2, Save, ArrowLeft } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type SOption = { value: string; label: string };
function SearchableSelect({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: SOption[]; placeholder: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className={cn("justify-between font-normal", className)}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface OrderLine {
  id: string;
  brand_id: string;
  product_id: string;
  product_name: string;
  coins_number: number;
  qty: number;
  unit_price: number;
  cost_price: number;
  total: number;
  profit: number;
}

const generateTempId = () => crypto.randomUUID();

const SalesOrderEntry = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id: orderIdParam } = useParams();
  const isEditMode = !!orderIdParam;
  const { hasAccess, isLoading: accessLoading } = usePageAccess();

  // Header state
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState<'draft' | 'confirmed'>('draft');
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentBrand, setPaymentBrand] = useState("");
  const [salesReference, setSalesReference] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [company, setCompany] = useState("");
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);

  // Lines state
  const [lines, setLines] = useState<OrderLine[]>([]);

  // Lookups
  const [brands, setBrands] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const customerSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [salesPeople, setSalesPeople] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEditMode);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    (async () => {
      await fetchLookups();
      setLoadingLookups(false);
      fetchCurrentUser();
      if (isEditMode && orderIdParam) {
        loadOrder(orderIdParam);
      }
    })();
  }, []);

  const loadOrder = async (id: string) => {
    setLoadingOrder(true);
    try {
      const [{ data: header }, { data: lineRows }] = await Promise.all([
        supabase.from("manual_sales_orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("manual_sales_order_lines").select("*").eq("order_id", id).order("line_number"),
      ]);
      if (!header) {
        toast({ title: language === 'ar' ? 'لم يتم العثور على الطلب' : 'Order not found', variant: "destructive" });
        navigate("/sales-order-entry");
        return;
      }
      setOrderId(header.id);
      setOrderNumber(header.order_number);
      setOrderStatus((header.status as 'draft' | 'confirmed') || 'draft');
      setOrderDate(header.order_date);
      setCustomerName(header.customer_name || "");
      setCustomerPhone(header.customer_phone || "");
      setPaymentMethod(header.payment_method || "");
      setSalesReference(header.sales_reference || "");
      setSalesPerson(header.sales_person || "");
      setNotes(header.notes || "");
      setCompany(header.company || "");
      setLines((lineRows || []).map((r: any) => ({
        id: r.id,
        brand_id: r.brand_id || "",
        product_id: "",
        product_name: r.product_name || "",
        coins_number: Number(r.coins_number) || 0,
        qty: Number(r.qty) || 0,
        unit_price: Number(r.unit_price) || 0,
        cost_price: Number(r.cost_price) || 0,
        total: Number(r.total) || 0,
        profit: Number(r.profit) || 0,
      })));
    } catch (e: any) {
      toast({ title: 'Error loading order', description: e.message, variant: "destructive" });
    } finally {
      setLoadingOrder(false);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setCurrentUser({ id: user.id, name: profile?.user_name || user.email });
    }
  };

  const fetchLookups = async () => {
    const [brandsRes, pmRes, prodRes, spRes, coRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name, brand_code, sales_one_coins_sar, cost_one_coins_sar").eq("status", "active").order("brand_name"),
      supabase.from("payment_methods").select("id, payment_method, payment_type").eq("is_active", true).order("payment_method"),
      supabase.from("products").select("id, product_name, product_cost, product_price, coins_number, brand_code, brand_name").eq("status", "active").order("product_name").limit(5000),
      supabase.from("profiles").select("user_id, user_name, salesman_code").eq("is_active", true).order("user_name"),
      supabase.from("companies").select("name").eq("is_active", true).order("name"),
    ]);
    setBrands(brandsRes.data || []);
    setPaymentMethods(pmRes.data || []);
    setProducts(prodRes.data || []);
    setSalesPeople(spRes.data || []);
    setCompanyOptions((coRes.data || []).map((c: any) => c.name));
  };

  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    setCustomerLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("id, customer_name, customer_phone")
        .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%`)
        .order("customer_name")
        .limit(50);
      setCustomers(data || []);
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerSearch(value);
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    customerSearchTimer.current = setTimeout(() => searchCustomers(value), 300);
  }, [searchCustomers]);

  const getFilteredProducts = (brandId: string) => {
    if (!brandId) return products;
    const brand = brands.find(b => b.id === brandId);
    return products.filter(p =>
      (brand?.brand_code && p.brand_code === brand.brand_code) ||
      (brand?.brand_name && p.brand_name === brand.brand_name)
    );
  };

  const addLine = () => {
    setLines(prev => [...prev, {
      id: generateTempId(),
      brand_id: "",
      product_id: "",
      product_name: "",
      coins_number: 0,
      qty: 1,
      unit_price: 0,
      cost_price: 0,
      total: 0,
      profit: 0,
    }]);
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof OrderLine, value: any) => {
    setLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: value };
      
      // When brand changes, reset product
      if (field === "brand_id") {
        updated.product_id = "";
        updated.product_name = "";
        updated.unit_price = 0;
        updated.cost_price = 0;
      }

      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        const brand = brands.find(b => b.id === updated.brand_id);
        console.log("[SalesOrderEntry] product selected:", value, product, brand);
        if (product) {
          const coins = Number(product.coins_number) || 0;
          const salesRate = Number(brand?.sales_one_coins_sar ?? 0) || 0;
          const costRate = Number(brand?.cost_one_coins_sar ?? 0) || 0;
          updated.product_name = product.product_name;
          updated.coins_number = coins;
          updated.unit_price = salesRate > 0 ? salesRate : (coins > 0 ? (Number(product.product_price ?? 0) || 0) / coins : 0);
          updated.cost_price = costRate > 0 ? costRate : (coins > 0 ? (Number(product.product_cost ?? 0) || 0) / coins : 0);
        }
      }

      updated.total = (updated.coins_number || 0) * updated.qty * updated.unit_price;
      updated.profit = updated.total - ((updated.coins_number || 0) * updated.qty * updated.cost_price);
      return updated;
    }));
  };

  const orderTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const orderProfit = lines.reduce((sum, l) => sum + l.profit, 0);
  const orderCost = lines.reduce((sum, l) => sum + (l.coins_number || 0) * l.qty * l.cost_price, 0);
  const orderCoins = lines.reduce((sum, l) => sum + (l.coins_number || 0), 0);

  const generateOrderNumber = () => {
    const dateStr = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `SO-${dateStr}-${random}`;
  };

  const persistDraft = async (): Promise<string | null> => {
    // Returns the id of the persisted manual_sales_orders row, or null on failure.
    const number = orderNumber || generateOrderNumber();
    const headerPayload: any = {
      order_number: number,
      order_date: orderDate,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      payment_method: paymentMethod || null,
      sales_reference: salesReference || null,
      sales_person: salesPerson || null,
      notes: notes || null,
      company: company || null,
      total_amount: orderTotal,
      total_cost: orderCost,
      total_profit: orderProfit,
      total_coins: orderCoins,
      created_by: currentUser?.id || null,
      created_by_name: currentUser?.name || null,
    };

    let savedId = orderId;
    if (orderId) {
      const { data, error } = await supabase
        .from("manual_sales_orders")
        .update(headerPayload)
        .eq("id", orderId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Order update failed (permission?)");
      savedId = data.id;
    } else {
      headerPayload.status = 'draft';
      const { data, error } = await supabase
        .from("manual_sales_orders")
        .insert(headerPayload)
        .select()
        .maybeSingle();
      if (error) throw error;
      savedId = data!.id;
      setOrderId(savedId);
      setOrderNumber(number);
    }

    // Replace lines: delete then insert
    await supabase.from("manual_sales_order_lines").delete().eq("order_id", savedId!);
    if (lines.length > 0) {
      const lineRows = lines.map((line, idx) => {
        const lineBrand = brands.find(b => b.id === line.brand_id);
        return {
          order_id: savedId,
          line_number: idx + 1,
          brand_id: line.brand_id || null,
          brand_code: lineBrand?.brand_code || null,
          brand_name: lineBrand?.brand_name || null,
          product_name: line.product_name,
          coins_number: line.coins_number || 0,
          qty: line.qty,
          unit_price: line.unit_price,
          cost_price: line.cost_price,
          total: line.total,
          total_cost: (line.coins_number || 0) * line.qty * line.cost_price,
          profit: line.profit,
        };
      });
      const { error: linesErr } = await supabase.from("manual_sales_order_lines").insert(lineRows);
      if (linesErr) throw linesErr;
    }
    return savedId;
  };

  const handleSave = async () => {
    if (orderStatus === 'confirmed') {
      toast({ title: language === 'ar' ? 'لا يمكن تعديل طلب مؤكد' : 'Cannot edit a confirmed order', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await persistDraft();
      toast({ title: language === 'ar' ? 'تم الحفظ كمسودة' : 'Saved as draft' });
      navigate("/sales-order-entry");
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast({ title: language === 'ar' ? 'خطأ في الحفظ' : 'Save failed', description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!paymentMethod) {
      toast({ title: language === 'ar' ? "يرجى اختيار طريقة الدفع" : "Please select a payment method", variant: "destructive" });
      return;
    }
    if (lines.length === 0) {
      toast({ title: language === 'ar' ? "يرجى إضافة سطر واحد على الأقل" : "Please add at least one line", variant: "destructive" });
      return;
    }
    if (lines.some(l => !l.brand_id || !l.product_name || l.qty <= 0)) {
      toast({ title: language === 'ar' ? "يرجى تعبئة جميع الأسطر بشكل صحيح (العلامة التجارية والمنتج)" : "Please fill all lines correctly (Brand and Product)", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Persist draft first to obtain a stable order number
      const savedId = await persistDraft();
      const finalNumber = orderNumber || (await supabase.from("manual_sales_orders").select("order_number").eq("id", savedId!).maybeSingle()).data?.order_number || generateOrderNumber();
      const orderDateObj = new Date(orderDate);
      const selectedPM = paymentMethods.find(pm => pm.payment_method === paymentMethod);

      const rows = lines.map(line => {
        const lineBrand = brands.find(b => b.id === line.brand_id);
        return {
          brand_name: lineBrand?.brand_name || "",
          brand_code: lineBrand?.brand_code || "",
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          product_name: line.product_name,
          coins_number: line.coins_number || 0,
          qty: line.qty,
          unit_price: line.unit_price,
          cost_price: line.cost_price,
          cost_sold: (line.coins_number || 0) * line.qty * line.cost_price,
          total: line.total,
          profit: line.profit,
          payment_method: selectedPM?.payment_type || paymentMethod,
          payment_brand: paymentMethod,
          order_number: finalNumber,
          ordernumber: finalNumber,
          user_name: currentUser?.name || "",
          sales_reference: salesReference || null,
          sales_person: salesPerson || null,
          trans_type: "manual",
          company: company || "Purple",
          created_at_date: orderDateObj.toISOString().replace("T", " ").substring(0, 19),
          is_deleted: false,
        };
      });

      const { error } = await supabase.from("purpletransaction").insert(rows);
      if (error) throw error;

      // Mark as confirmed
      await supabase
        .from("manual_sales_orders")
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq("id", savedId!)
        .select();

      toast({
        title: language === 'ar' ? "تم تأكيد الطلب بنجاح" : "Order confirmed successfully",
        description: `${language === 'ar' ? 'رقم الطلب' : 'Order Number'}: ${finalNumber}`,
      });

      navigate("/sales-order-entry");
    } catch (error: any) {
      console.error("Error confirming order:", error);
      toast({ title: language === 'ar' ? "خطأ في تأكيد الطلب" : "Error confirming order", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollback = async () => {
    if (!orderId || !orderNumber) return;
    if (!window.confirm(language === 'ar'
      ? 'هل تريد إعادة فتح هذا الطلب؟ سيتم حذف الحركات المسجلة.'
      : 'Reopen this order? Posted transactions will be removed.')) return;
    setSubmitting(true);
    try {
      const { error: delErr } = await supabase
        .from("purpletransaction")
        .delete()
        .eq("ordernumber", orderNumber)
        .eq("trans_type", "manual");
      if (delErr) throw delErr;

      const { error: updErr } = await supabase
        .from("manual_sales_orders")
        .update({ status: 'draft', confirmed_at: null })
        .eq("id", orderId)
        .select();
      if (updErr) throw updErr;

      setOrderStatus('draft');
      toast({ title: language === 'ar' ? 'تم إعادة فتح الطلب' : 'Order reopened' });
    } catch (error: any) {
      console.error("Error rolling back order:", error);
      toast({ title: language === 'ar' ? 'خطأ في إعادة الفتح' : 'Error reopening order', description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("");
    setPaymentBrand("");
    setSalesReference("");
    setSalesPerson("");
    setNotes("");
    setCompany("");
    setLines([]);
  };

  if (accessLoading || loadingOrder || loadingLookups) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasAccess) return <AccessDenied />;

  const isConfirmed = orderStatus === 'confirmed';

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/sales-order-entry")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditMode
              ? (language === 'ar' ? `تعديل أمر البيع ${orderNumber}` : `Edit Sales Order ${orderNumber}`)
              : (language === 'ar' ? 'إدخال أمر البيع' : 'Sales Order Entry')}
          </h1>
        </div>
        {isConfirmed && (
          <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {language === 'ar' ? 'مؤكد - للعرض فقط' : 'Confirmed (read-only)'}
          </span>
        )}
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'بيانات الطلب' : 'Order Header'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'التاريخ' : 'Date'}</Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر طريقة الدفع' : 'Select Payment'} /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.id} value={pm.payment_method}>{pm.payment_method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{language === 'ar' ? 'العميل' : 'Customer'}</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={customerOpen} className="w-full justify-between font-normal">
                    {customerName
                      ? `${customerName}${customerPhone ? ` - ${customerPhone}` : ''}`
                      : (language === 'ar' ? 'ابحث عن عميل...' : 'Search customer...')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={language === 'ar' ? 'اكتب حرفين على الأقل للبحث...' : 'Type at least 2 chars to search...'}
                      value={customerSearch}
                      onValueChange={handleCustomerSearch}
                    />
                    <CommandList>
                      {customerLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : customerSearch.length < 2 ? (
                        <CommandEmpty>{language === 'ar' ? 'اكتب حرفين على الأقل للبحث' : 'Type at least 2 characters to search'}</CommandEmpty>
                      ) : customers.length === 0 ? (
                        <CommandEmpty>{language === 'ar' ? 'لا يوجد عملاء' : 'No customers found'}</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {customers.map(c => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setCustomerName(c.customer_name || "");
                                setCustomerPhone(c.customer_phone || "");
                                setCustomerOpen(false);
                                setCustomerSearch("");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", customerPhone === c.customer_phone ? "opacity-100" : "opacity-0")} />
                              <span className="font-medium">{c.customer_name || '—'}</span>
                              <span className="text-muted-foreground ml-2">{c.customer_phone || ''}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الشركة' : 'Company'}</Label>
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'اختر الشركة' : 'Select Company'} /></SelectTrigger>
                <SelectContent>
                  {companyOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'مرجع البيع' : 'Sales Reference'}</Label>
              <Input value={salesReference} onChange={e => setSalesReference(e.target.value)} placeholder={language === 'ar' ? 'رقم مرجع البيع' : 'Sales reference'} />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'مندوب البيع' : 'Sales Person'}</Label>
              <SearchableSelect
                value={salesPerson}
                onChange={setSalesPerson}
                options={salesPeople.map(sp => ({ value: sp.user_name || "", label: `${sp.user_name}${sp.salesman_code ? ` (${sp.salesman_code})` : ''}` }))}
                placeholder={language === 'ar' ? 'اختر مندوب البيع' : 'Select sales person'}
                className="w-full"
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={1} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {language === 'ar' ? 'بنود الطلب' : 'Order Lines'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'إضافة سطر' : 'Add Line'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                  <TableHead className="w-28">{language === 'ar' ? 'عدد الكوينز' : 'Coins #'}</TableHead>
                  <TableHead className="w-24">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'التكلفة' : 'Cost'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'إجمالي التكلفة' : 'Total Cost'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'الربح' : 'Profit'}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      {language === 'ar' ? 'لا توجد بنود. اضغط "إضافة سطر" لبدء الإدخال.' : 'No lines. Click "Add Line" to start.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <SearchableSelect
                          value={line.brand_id}
                          onChange={v => updateLine(line.id, "brand_id", v)}
                          options={brands.map(b => ({ value: b.id, label: b.brand_name }))}
                          placeholder={language === 'ar' ? 'العلامة' : 'Brand'}
                          className="min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <SearchableSelect
                          value={line.product_id}
                          onChange={v => updateLine(line.id, "product_id", v)}
                          options={getFilteredProducts(line.brand_id).map(p => ({ value: p.id, label: p.product_name }))}
                          placeholder={language === 'ar' ? 'اختر المنتج' : 'Select Product'}
                          className="min-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.coins_number === 0 ? "" : String(line.coins_number)}
                          onChange={e => {
                            const clean = e.target.value.replace(/[^0-9.]/g, "");
                            updateLine(line.id, "coins_number", clean === "" || clean === "." ? 0 : Number(clean));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="text" inputMode="numeric" value={line.qty} onChange={e => updateLine(line.id, "qty", Number(e.target.value) || 0)} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                           value={line.unit_price === 0 ? "" : String(line.unit_price)}
                           onChange={e => {
                             const v = e.target.value.replace(/[^0-9.]/g, "");
                             const parts = v.split(".");
                             const clean = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 7)}` : v;
                             updateLine(line.id, "unit_price", clean === "" || clean === "." ? 0 : Number(clean));
                          }}
                          placeholder="0.0000000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.cost_price === 0 ? "" : String(line.cost_price)}
                           onChange={e => {
                             const v = e.target.value.replace(/[^0-9.]/g, "");
                             const parts = v.split(".");
                             const clean = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 7)}` : v;
                             updateLine(line.id, "cost_price", clean === "" || clean === "." ? 0 : Number(clean));
                           }}
                           placeholder="0.0000000"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{((line.coins_number || 0) * line.qty * line.cost_price).toFixed(2)}</TableCell>
                      <TableCell className="font-medium">{line.total.toFixed(2)}</TableCell>
                      <TableCell className={`font-medium ${line.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {line.profit.toFixed(2)}
                      </TableCell>
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

          {lines.length > 0 && (
            <div className="flex flex-wrap justify-end gap-6 mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'ar' ? 'إجمالي الكوينز:' : 'Total Coins:'}</span>
                <span className="font-bold text-foreground ml-2">{orderCoins.toFixed(2)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'ar' ? 'إجمالي التكلفة:' : 'Total Cost:'}</span>
                <span className="font-bold text-foreground ml-2">{orderCost.toFixed(2)} SAR</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
                <span className="font-bold text-foreground ml-2">{orderTotal.toFixed(2)} SAR</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'ar' ? 'الربح:' : 'Profit:'}</span>
                <span className={`font-bold ml-2 ${orderProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{orderProfit.toFixed(2)} SAR</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end flex-wrap">
        <Button variant="outline" onClick={handleReset} disabled={submitting || saving || isConfirmed}>
          <RotateCcw className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={submitting || saving || isConfirmed || lines.length === 0}>
          <Save className="h-4 w-4 mr-1" />
          {saving
            ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
            : (language === 'ar' ? 'حفظ' : 'Save')}
        </Button>
        {isConfirmed && isEditMode ? (
          <Button variant="destructive" onClick={handleRollback} disabled={submitting}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {submitting
              ? (language === 'ar' ? 'جاري إعادة الفتح...' : 'Reopening...')
              : (language === 'ar' ? 'إعادة فتح الطلب' : 'Rollback / Reopen')}
          </Button>
        ) : (
          <Button onClick={handleConfirm} disabled={submitting || saving || isConfirmed || lines.length === 0}>
            <Check className="h-4 w-4 mr-1" />
            {submitting
              ? (language === 'ar' ? 'جاري التأكيد...' : 'Confirming...')
              : (language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SalesOrderEntry;
