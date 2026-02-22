import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Plus, Trash2, Check, RotateCcw, ChevronsUpDown, Loader2 } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OrderLine {
  id: string;
  brand_id: string;
  product_name: string;
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
  const { hasAccess, isLoading: accessLoading } = usePageAccess();

  // Header state
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentBrand, setPaymentBrand] = useState("");
  const [notes, setNotes] = useState("");

  // Lines state
  const [lines, setLines] = useState<OrderLine[]>([]);

  // Lookups
  const [brands, setBrands] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const customerSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchLookups();
    fetchCurrentUser();
  }, []);

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
    const [brandsRes, pmRes, prodRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name, brand_code").eq("status", "active").order("brand_name"),
      supabase.from("payment_methods").select("id, payment_method, payment_type").eq("is_active", true).order("payment_method"),
      supabase.from("products").select("id, product_name, cost_price, selling_price, brand_id").eq("status", "active").order("product_name").limit(1000),
    ]);
    setBrands(brandsRes.data || []);
    setPaymentMethods(pmRes.data || []);
    setProducts(prodRes.data || []);
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
    return brandId ? products.filter(p => p.brand_id === brandId) : products;
  };

  const addLine = () => {
    setLines(prev => [...prev, {
      id: generateTempId(),
      brand_id: "",
      product_name: "",
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
        updated.product_name = "";
        updated.unit_price = 0;
        updated.cost_price = 0;
      }

      if (field === "product_name") {
        const product = products.find(p => p.product_name === value);
        if (product) {
          updated.unit_price = product.selling_price || 0;
          updated.cost_price = product.cost_price || 0;
        }
      }

      updated.total = updated.qty * updated.unit_price;
      updated.profit = updated.total - (updated.qty * updated.cost_price);
      return updated;
    }));
  };

  const orderTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const orderProfit = lines.reduce((sum, l) => sum + l.profit, 0);

  const generateOrderNumber = () => {
    const dateStr = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `SO-${dateStr}-${random}`;
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
      const orderNumber = generateOrderNumber();
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
        qty: line.qty,
        unit_price: line.unit_price,
        cost_price: line.cost_price,
        cost_sold: line.qty * line.cost_price,
        total: line.total,
        profit: line.profit,
        payment_method: selectedPM?.payment_type || paymentMethod,
        payment_brand: paymentMethod,
        order_number: orderNumber,
        ordernumber: orderNumber,
        user_name: currentUser?.name || "",
        trans_type: "manual",
        company: "SupPurple",
        created_at_date: orderDateObj.toISOString().replace("T", " ").substring(0, 19),
        is_deleted: false,
      };
      });

      const { error } = await supabase.from("purpletransaction").insert(rows);

      if (error) throw error;

      toast({
        title: language === 'ar' ? "تم تأكيد الطلب بنجاح" : "Order confirmed successfully",
        description: `${language === 'ar' ? 'رقم الطلب' : 'Order Number'}: ${orderNumber}`,
      });

      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("");
      setPaymentMethod("");
      setPaymentBrand("");
      setNotes("");
      setLines([]);
    } catch (error: any) {
      console.error("Error confirming order:", error);
      toast({ title: language === 'ar' ? "خطأ في تأكيد الطلب" : "Error confirming order", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("");
    setPaymentBrand("");
    setNotes("");
    setLines([]);
  };

  if (accessLoading) return null;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-foreground">
        {language === 'ar' ? 'إدخال أمر البيع' : 'Sales Order Entry'}
      </h1>

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
                  <TableHead className="w-24">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'التكلفة' : 'Cost'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                  <TableHead className="w-32">{language === 'ar' ? 'الربح' : 'Profit'}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {language === 'ar' ? 'لا توجد بنود. اضغط "إضافة سطر" لبدء الإدخال.' : 'No lines. Click "Add Line" to start.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Select value={line.brand_id} onValueChange={v => updateLine(line.id, "brand_id", v)}>
                          <SelectTrigger className="min-w-[150px]">
                            <SelectValue placeholder={language === 'ar' ? 'العلامة' : 'Brand'} />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={line.product_name} onValueChange={v => updateLine(line.id, "product_name", v)}>
                          <SelectTrigger className="min-w-[200px]">
                            <SelectValue placeholder={language === 'ar' ? 'اختر المنتج' : 'Select Product'} />
                          </SelectTrigger>
                          <SelectContent>
                            {getFilteredProducts(line.brand_id).map(p => (
                              <SelectItem key={p.id} value={p.product_name}>{p.product_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={line.qty} onChange={e => updateLine(line.id, "qty", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(line.id, "unit_price", Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={line.cost_price} onChange={e => updateLine(line.id, "cost_price", Number(e.target.value))} />
                      </TableCell>
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
            <div className="flex justify-end gap-6 mt-4 p-4 bg-muted/50 rounded-lg">
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
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleReset} disabled={submitting}>
          <RotateCcw className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
        </Button>
        <Button onClick={handleConfirm} disabled={submitting || lines.length === 0}>
          <Check className="h-4 w-4 mr-1" />
          {submitting
            ? (language === 'ar' ? 'جاري التأكيد...' : 'Confirming...')
            : (language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order')}
        </Button>
      </div>
    </div>
  );
};

export default SalesOrderEntry;
