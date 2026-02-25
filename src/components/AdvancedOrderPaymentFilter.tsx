import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface FilterCondition {
  id: string;
  table: string;
  field: string;
  operator: string;
  value: string;
}

interface AdvancedOrderPaymentFilterProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onApply: () => void;
  onClear: () => void;
}

const purpletransactionFields = [
  { name: "order_number", label: "Order Number", labelAr: "رقم الطلب", type: "text" },
  { name: "user_name", label: "User Name", labelAr: "اسم المستخدم", type: "text" },
  { name: "customer_name", label: "Customer Name", labelAr: "اسم العميل", type: "text" },
  { name: "customer_phone", label: "Customer Phone", labelAr: "هاتف العميل", type: "text" },
  { name: "brand_name", label: "Brand Name", labelAr: "اسم العلامة", type: "text" },
  { name: "brand_code", label: "Brand Code", labelAr: "رمز العلامة", type: "text" },
  { name: "product_name", label: "Product Name", labelAr: "اسم المنتج", type: "text" },
  { name: "product_id", label: "Product ID", labelAr: "معرف المنتج", type: "text" },
  { name: "vendor_name", label: "Vendor Name", labelAr: "اسم المورد", type: "text" },
  { name: "coins_number", label: "Coins Number", labelAr: "عدد الكوينز", type: "number" },
  { name: "unit_price", label: "Unit Price", labelAr: "سعر الوحدة", type: "number" },
  { name: "cost_price", label: "Cost Price", labelAr: "سعر التكلفة", type: "number" },
  { name: "qty", label: "Quantity", labelAr: "الكمية", type: "number" },
  { name: "cost_sold", label: "Cost Sold", labelAr: "تكلفة البيع", type: "number" },
  { name: "total", label: "Total", labelAr: "الإجمالي", type: "number" },
  { name: "profit", label: "Profit", labelAr: "الربح", type: "number" },
  { name: "bank_fee", label: "Bank Fee", labelAr: "رسوم البنك", type: "number" },
  { name: "payment_method", label: "Payment Method", labelAr: "طريقة الدفع", type: "text" },
  { name: "payment_type", label: "Payment Type", labelAr: "نوع الدفع", type: "text" },
  { name: "payment_brand", label: "Payment Brand", labelAr: "علامة الدفع", type: "text" },
  { name: "order_status", label: "Order Status", labelAr: "حالة الطلب", type: "text" },
  { name: "trans_type", label: "Transaction Type", labelAr: "نوع المعاملة", type: "text" },
  { name: "is_deleted", label: "Is Deleted", labelAr: "محذوف", type: "boolean" },
];

const riyadbankstatementFields = [
  { name: "txn_date", label: "Txn Date", labelAr: "تاريخ المعاملة", type: "text" },
  { name: "payment_date", label: "Payment Date", labelAr: "تاريخ الدفع", type: "text" },
  { name: "posting_date", label: "Posting Date", labelAr: "تاريخ الترحيل", type: "text" },
  { name: "card_number", label: "Card Number", labelAr: "رقم البطاقة", type: "text" },
  { name: "txn_amount", label: "Txn Amount", labelAr: "مبلغ المعاملة", type: "text" },
  { name: "fee", label: "Fee", labelAr: "الرسوم", type: "text" },
  { name: "vat", label: "VAT", labelAr: "ضريبة القيمة المضافة", type: "text" },
  { name: "vat_2", label: "VAT 2", labelAr: "ضريبة 2", type: "text" },
  { name: "net_amount", label: "Net Amount", labelAr: "المبلغ الصافي", type: "text" },
  { name: "auth_code", label: "Auth Code", labelAr: "رمز التفويض", type: "text" },
  { name: "txn_type", label: "Txn Type", labelAr: "نوع المعاملة", type: "text" },
  { name: "card_type", label: "Card Type", labelAr: "نوع البطاقة", type: "text" },
  { name: "txn_number", label: "Txn Number", labelAr: "رقم المعاملة", type: "text" },
  { name: "terminal_id", label: "Terminal ID", labelAr: "معرف الطرفية", type: "text" },
  { name: "merchant_name", label: "Merchant Name", labelAr: "اسم التاجر", type: "text" },
  { name: "payment_number", label: "Payment Number", labelAr: "رقم الدفع", type: "text" },
  { name: "merchant_account", label: "Merchant Account", labelAr: "حساب التاجر", type: "text" },
  { name: "txn_certificate", label: "Txn Certificate", labelAr: "شهادة المعاملة", type: "text" },
  { name: "acquirer_private_data", label: "Acquirer Private Data", labelAr: "بيانات المستحوذ", type: "text" },
  { name: "payment_reference", label: "Payment Reference", labelAr: "مرجع الدفع", type: "text" },
  { name: "agg_fee", label: "Agg Fee", labelAr: "رسوم التجميع", type: "text" },
  { name: "agg_vat", label: "Agg VAT", labelAr: "ضريبة التجميع", type: "text" },
  { name: "rb_fee", label: "RB Fee", labelAr: "رسوم الرياض", type: "text" },
  { name: "rb_vat", label: "RB VAT", labelAr: "ضريبة الرياض", type: "text" },
];

const hyberpaystatementFields = [
  { name: "shortid", label: "Short ID", labelAr: "المعرف القصير", type: "text" },
  { name: "uniqueid", label: "Unique ID", labelAr: "المعرف الفريد", type: "text" },
  { name: "paymenttype", label: "Payment Type", labelAr: "نوع الدفع", type: "text" },
  { name: "paymentmethod", label: "Payment Method", labelAr: "طريقة الدفع", type: "text" },
  { name: "mode", label: "Mode", labelAr: "الوضع", type: "text" },
  { name: "transactionid", label: "Transaction ID", labelAr: "معرف المعاملة", type: "text" },
  { name: "channelname", label: "Channel Name", labelAr: "اسم القناة", type: "text" },
  { name: "customercountry", label: "Customer Country", labelAr: "بلد العميل", type: "text" },
  { name: "accountcountry", label: "Account Country", labelAr: "بلد الحساب", type: "text" },
  { name: "accountnumberlast4", label: "Account Last 4", labelAr: "آخر 4 أرقام", type: "text" },
  { name: "returncode", label: "Return Code", labelAr: "رمز الإرجاع", type: "text" },
  { name: "accountholder", label: "Account Holder", labelAr: "صاحب الحساب", type: "text" },
  { name: "customername", label: "Customer Name", labelAr: "اسم العميل", type: "text" },
  { name: "brand", label: "Brand", labelAr: "العلامة", type: "text" },
  { name: "debit", label: "Debit", labelAr: "مدين", type: "text" },
  { name: "credit", label: "Credit", labelAr: "دائن", type: "text" },
  { name: "currency", label: "Currency", labelAr: "العملة", type: "text" },
  { name: "usage", label: "Usage", labelAr: "الاستخدام", type: "text" },
  { name: "result", label: "Result", labelAr: "النتيجة", type: "text" },
  { name: "statuscode", label: "Status Code", labelAr: "رمز الحالة", type: "text" },
  { name: "reasoncode", label: "Reason Code", labelAr: "رمز السبب", type: "text" },
  { name: "bin", label: "BIN", labelAr: "رقم التعريف", type: "text" },
  { name: "shopperid", label: "Shopper ID", labelAr: "معرف المتسوق", type: "text" },
  { name: "bankcode", label: "Bank Code", labelAr: "رمز البنك", type: "text" },
  { name: "ip", label: "IP", labelAr: "عنوان IP", type: "text" },
  { name: "email", label: "Email", labelAr: "البريد الإلكتروني", type: "text" },
  { name: "mobile", label: "Mobile", labelAr: "الجوال", type: "text" },
  { name: "invoiceid", label: "Invoice ID", labelAr: "معرف الفاتورة", type: "text" },
  { name: "channelid", label: "Channel ID", labelAr: "معرف القناة", type: "text" },
  { name: "riskscore", label: "Risk Score", labelAr: "درجة المخاطر", type: "text" },
  { name: "action", label: "Action", labelAr: "الإجراء", type: "text" },
  { name: "riskfraudstatuscode", label: "Risk Fraud Status", labelAr: "حالة مخاطر الاحتيال", type: "text" },
  { name: "riskfrauddescription", label: "Risk Fraud Description", labelAr: "وصف مخاطر الاحتيال", type: "text" },
  { name: "connectorid", label: "Connector ID", labelAr: "معرف الموصل", type: "text" },
  { name: "acquirerresponse", label: "Acquirer Response", labelAr: "استجابة المستحوذ", type: "text" },
  { name: "reconciliationid", label: "Reconciliation ID", labelAr: "معرف التسوية", type: "text" },
  { name: "transaction_receipt", label: "Transaction Receipt", labelAr: "إيصال المعاملة", type: "text" },
  { name: "clearinginstitutename", label: "Clearing Institute", labelAr: "مؤسسة المقاصة", type: "text" },
  { name: "response_acquirercode", label: "Acquirer Code", labelAr: "رمز المستحوذ", type: "text" },
  { name: "response_acquirermessage", label: "Acquirer Message", labelAr: "رسالة المستحوذ", type: "text" },
  { name: "transaction_authorizationcode", label: "Authorization Code", labelAr: "رمز التفويض", type: "text" },
  { name: "transaction_acquirer_settlementdate", label: "Settlement Date", labelAr: "تاريخ التسوية", type: "text" },
];

const textOperators = [
  { value: "eq", label: "Equals", labelAr: "يساوي" },
  { value: "neq", label: "Not Equals", labelAr: "لا يساوي" },
  { value: "ilike", label: "Contains", labelAr: "يحتوي" },
  { value: "starts", label: "Starts With", labelAr: "يبدأ بـ" },
  { value: "ends", label: "Ends With", labelAr: "ينتهي بـ" },
  { value: "is_null", label: "Is Empty", labelAr: "فارغ" },
  { value: "not_null", label: "Is Not Empty", labelAr: "غير فارغ" },
];

const numberOperators = [
  { value: "eq", label: "Equals", labelAr: "يساوي" },
  { value: "neq", label: "Not Equals", labelAr: "لا يساوي" },
  { value: "gt", label: "Greater Than", labelAr: "أكبر من" },
  { value: "gte", label: "Greater or Equal", labelAr: "أكبر أو يساوي" },
  { value: "lt", label: "Less Than", labelAr: "أقل من" },
  { value: "lte", label: "Less or Equal", labelAr: "أقل أو يساوي" },
  { value: "is_null", label: "Is Empty", labelAr: "فارغ" },
  { value: "not_null", label: "Is Not Empty", labelAr: "غير فارغ" },
];

const booleanOperators = [
  { value: "is_true", label: "Is True", labelAr: "صحيح" },
  { value: "is_false", label: "Is False", labelAr: "خاطئ" },
];

export function AdvancedOrderPaymentFilter({
  filters,
  onFiltersChange,
  onApply,
  onClear,
}: AdvancedOrderPaymentFilterProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("purpletransaction");

  const getFieldsForTable = (table: string) => {
    switch (table) {
      case "purpletransaction":
        return purpletransactionFields;
      case "riyadbankstatement":
        return riyadbankstatementFields;
      case "hyberpaystatement":
        return hyberpaystatementFields;
      default:
        return [];
    }
  };

  const getFieldType = (table: string, fieldName: string) => {
    const fields = getFieldsForTable(table);
    return fields.find(f => f.name === fieldName)?.type || "text";
  };

  const getOperatorsForField = (table: string, fieldName: string) => {
    const type = getFieldType(table, fieldName);
    switch (type) {
      case "number":
        return numberOperators;
      case "boolean":
        return booleanOperators;
      default:
        return textOperators;
    }
  };

  const addFilter = (table: string) => {
    const fields = getFieldsForTable(table);
    if (fields.length === 0) return;
    
    const newFilter: FilterCondition = {
      id: crypto.randomUUID(),
      table,
      field: fields[0].name,
      operator: "eq",
      value: "",
    };
    onFiltersChange([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    onFiltersChange(
      filters.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  };

  const getFieldLabel = (table: string, fieldName: string) => {
    const fields = getFieldsForTable(table);
    const field = fields.find(f => f.name === fieldName);
    return field ? (isRTL ? field.labelAr : field.label) : fieldName;
  };

  const handleApply = () => {
    onApply();
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
  };

  const activeFiltersCount = filters.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          {isRTL ? "فلتر متقدم" : "Advanced Filter"}
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {isRTL ? "فلتر متقدم" : "Advanced Filter"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="purpletransaction">
              {isRTL ? "المعاملات" : "Transactions"}
              {filters.filter(f => f.table === "purpletransaction").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.filter(f => f.table === "purpletransaction").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="riyadbankstatement">
              {isRTL ? "بنك الرياض" : "Riyad Bank"}
              {filters.filter(f => f.table === "riyadbankstatement").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.filter(f => f.table === "riyadbankstatement").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="hyberpaystatement">
              {isRTL ? "هايبرباي" : "Hyberpay"}
              {filters.filter(f => f.table === "hyberpaystatement").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.filter(f => f.table === "hyberpaystatement").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {["purpletransaction", "riyadbankstatement", "hyberpaystatement"].map(table => (
            <TabsContent key={table} value={table} className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {filters
                    .filter(f => f.table === table)
                    .map(filter => {
                      const fields = getFieldsForTable(table);
                      const operators = getOperatorsForField(table, filter.field);
                      const fieldType = getFieldType(table, filter.field);
                      const needsValue = !["is_null", "not_null", "is_true", "is_false"].includes(filter.operator);

                      return (
                        <div
                          key={filter.id}
                          className="flex items-end gap-2 p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-[150px]">
                            <Label className="text-xs text-muted-foreground">
                              {isRTL ? "الحقل" : "Field"}
                            </Label>
                            <Select
                              value={filter.field}
                              onValueChange={value => updateFilter(filter.id, { field: value, operator: "eq", value: "" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fields.map(f => (
                                  <SelectItem key={f.name} value={f.name}>
                                    {isRTL ? f.labelAr : f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex-1 min-w-[140px]">
                            <Label className="text-xs text-muted-foreground">
                              {isRTL ? "الشرط" : "Operator"}
                            </Label>
                            <Select
                              value={filter.operator}
                              onValueChange={value => updateFilter(filter.id, { operator: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {operators.map(op => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {isRTL ? op.labelAr : op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {needsValue && (
                            <div className="flex-1 min-w-[150px]">
                              <Label className="text-xs text-muted-foreground">
                                {isRTL ? "القيمة" : "Value"}
                              </Label>
                              <Input
                                type={fieldType === "number" ? "number" : "text"}
                                value={filter.value}
                                onChange={e => updateFilter(filter.id, { value: e.target.value })}
                                placeholder={isRTL ? "أدخل القيمة" : "Enter value"}
                              />
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFilter(filter.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}

                  {filters.filter(f => f.table === table).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      {isRTL ? "لا توجد فلاتر. انقر على زر الإضافة أدناه." : "No filters. Click add button below."}
                    </p>
                  )}
                </div>
              </ScrollArea>

              <Button
                variant="outline"
                onClick={() => addFilter(table)}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة فلتر" : "Add Filter"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="gap-2">
            <X className="h-4 w-4" />
            {isRTL ? "مسح الكل" : "Clear All"}
          </Button>
          <Button onClick={handleApply} className="gap-2">
            <Filter className="h-4 w-4" />
            {isRTL ? "تطبيق الفلتر" : "Apply Filter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
