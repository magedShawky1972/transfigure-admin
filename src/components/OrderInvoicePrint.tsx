import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";

interface OrderLine {
  brand_code: string | null;
  brand_name: string | null;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  vendor_name: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  coins_number: number | null;
  cost_price: number | null;
  cost_sold: number | null;
}

interface HyberpayInfo {
  requesttimestamp: string | null;
  accountnumberlast4: string | null;
  returncode: string | null;
  credit: string | null;
  currency: string | null;
  result: string | null;
  statuscode: string | null;
  reasoncode: string | null;
  ip: string | null;
  email: string | null;
  connectorid: string | null;
  response_acquirermessage: string | null;
  riskfraudstatuscode: string | null;
  transaction_receipt: string | null;
  clearinginstitutename: string | null;
  transaction_acquirer_settlementdate: string | null;
  acquirerresponse: string | null;
  riskfrauddescription: string | null;
}

interface RiyadBankInfo {
  txn_date: string | null;
  payment_date: string | null;
  posting_date: string | null;
  card_number: string | null;
  txn_amount: string | null;
  fee: string | null;
  vat: string | null;
  net_amount: string | null;
  auth_code: string | null;
  card_type: string | null;
  txn_number: string | null;
  payment_number: string | null;
  acquirer_private_data: string | null;
  payment_reference: string | null;
}

interface OrderInvoicePrintProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  orderDate: string | null;
  paymentMethod: string | null;
  paymentBrand: string | null;
  paymentRef: string | null;
  orderLines: OrderLine[];
  hyberpayInfo: HyberpayInfo | null;
  riyadBankInfo: RiyadBankInfo | null;
  isRTL: boolean;
}

export const OrderInvoicePrint = ({
  open,
  onOpenChange,
  orderNumber,
  customerName,
  customerPhone,
  orderDate,
  paymentMethod,
  paymentBrand,
  paymentRef,
  orderLines,
  hyberpayInfo,
  riyadBankInfo,
  isRTL,
}: OrderInvoicePrintProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = orderDate 
      ? format(new Date(orderDate), 'dd MMMM yyyy ( HH:mm:ss )')
      : '-';

    const totalAmount = orderLines.reduce((sum, line) => sum + (line.total || 0), 0);
    const vatAmount = 0; // Assuming no VAT based on the invoice image
    const totalWithVat = totalAmount;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${orderNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: white;
            color: #333;
            direction: ${isRTL ? 'rtl' : 'ltr'};
            padding: 20px;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
            margin-bottom: 20px;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #7c3aed, #a855f7);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #7c3aed;
          }
          .company-name-ar {
            font-size: 20px;
            color: #666;
          }
          .payment-info {
            text-align: ${isRTL ? 'left' : 'right'};
            font-size: 13px;
            color: #666;
          }
          .payment-info-row {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-bottom: 5px;
          }
          .payment-label {
            color: #888;
          }
          .payment-value {
            color: #333;
            font-weight: 500;
          }
          .company-address {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 10px;
          }
          .invoice-meta {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .meta-item {
            border-left: 1px solid #ddd;
            padding: 0 10px;
          }
          .meta-item:last-child {
            border-left: none;
          }
          .meta-label {
            font-size: 11px;
            color: #888;
            margin-bottom: 5px;
          }
          .meta-value {
            font-size: 13px;
            font-weight: 600;
            color: #333;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #7c3aed;
            margin-bottom: 10px;
            text-align: ${isRTL ? 'right' : 'left'};
          }
          .customer-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #fafafa;
            border-radius: 8px;
          }
          .customer-field {
            display: flex;
            flex-direction: column;
          }
          .customer-label {
            font-size: 11px;
            color: #888;
            margin-bottom: 5px;
          }
          .customer-value {
            font-size: 14px;
            font-weight: 500;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background: #f8f9fa;
            padding: 12px 10px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-bottom: 2px solid #eee;
          }
          .items-table td {
            padding: 12px 10px;
            text-align: center;
            font-size: 13px;
            border-bottom: 1px solid #eee;
          }
          .totals {
            width: 50%;
            margin-${isRTL ? 'right' : 'left'}: auto;
            margin-bottom: 30px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            font-size: 14px;
          }
          .total-row.final {
            background: #f8f9fa;
            font-weight: 600;
            border-radius: 8px;
          }
          .footer {
            background: #7c3aed;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            margin-top: 30px;
          }
          .footer-text {
            font-size: 14px;
            margin-bottom: 5px;
          }
          .footer-text-ar {
            font-size: 14px;
            color: #e9d5ff;
          }
          .footer-date {
            font-size: 12px;
            color: #e9d5ff;
            margin-top: 10px;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <div class="logo">PURPLE</div>
              <div>
                <div class="company-name">PURPLE CARD</div>
                <div class="company-name-ar">بيربل كارد</div>
              </div>
            </div>
            <div class="payment-info">
              <div class="payment-info-row">
                <span class="payment-label">Reference Number:</span>
                <span class="payment-value">${paymentRef || '-'}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">Payment id:</span>
                <span class="payment-value">${hyberpayInfo?.connectorid || '-'}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">Payment brand:</span>
                <span class="payment-value">${paymentBrand || '-'}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">Payment method:</span>
                <span class="payment-value">${paymentMethod || '-'}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">Card number:</span>
                <span class="payment-value">xxxx xxxx xxxx ${hyberpayInfo?.accountnumberlast4 || riyadBankInfo?.card_number?.slice(-4) || 'XXXX'}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">date:</span>
                <span class="payment-value">${hyberpayInfo?.requesttimestamp ? format(new Date(hyberpayInfo.requesttimestamp), 'dd MMMM yyyy ( HH:mm:ss )') : formattedDate}</span>
              </div>
              <div class="payment-info-row">
                <span class="payment-label">Total:</span>
                <span class="payment-value">SAR ${hyberpayInfo?.credit || totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="company-address">
            <p>Purple Card | Your Instant Digital Cards Store | بيربل كارد | المتجر الفوري الأفضل للبطاقات الرقمية</p>
            <p>الرياض، المملكة العربية السعودية - P.O Box 11759 - صندوق بريد 11759</p>
          </div>

          <!-- Invoice Meta -->
          <div class="invoice-meta">
            <div class="meta-item">
              <div class="meta-label">VAT Noالرقم الضريبي</div>
              <div class="meta-value">1111</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Invoice Noرقم الفاتورة</div>
              <div class="meta-value">${orderNumber}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Invoice Dateتاريخ الفاتورة</div>
              <div class="meta-value">${formattedDate}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Invoice Currencyعملة الفاتورة</div>
              <div class="meta-value">${hyberpayInfo?.currency || 'SAR'}</div>
            </div>
          </div>

          <!-- Customer Info -->
          <div class="section-title">Customer Infoبيانات العميل</div>
          <div class="customer-info">
            <div class="customer-field">
              <span class="customer-label">Customer Name بيانات العميل</span>
              <span class="customer-value">${customerName || '-'}</span>
            </div>
            <div class="customer-field">
              <span class="customer-label">Customer Phone بيانات الجوال</span>
              <span class="customer-value">${customerPhone || '-'}</span>
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>وصف المنتج<br/>Item description</th>
                <th>الكمية<br/>Quantity</th>
                <th>سعر الوحدة<br/>Unit price</th>
                <th>قيمة الضريبة<br/>VAT Amount</th>
                <th>إجمالي المبلغ<br/>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${orderLines.map((line, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${line.coins_number ? `${line.coins_number.toLocaleString()} كوينز - ` : ''}${line.product_name || line.brand_name || '-'}</td>
                  <td>${line.qty || 1}</td>
                  <td>${line.unit_price?.toFixed(3) || line.total?.toFixed(3) || '0.000'}</td>
                  <td>0</td>
                  <td>${line.total?.toFixed(3) || '0.000'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>Total Without VAT المجموع بدون الضريبة</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            <div class="total-row final">
              <span>Total With VAT المجموع مع الضريبة</span>
              <span>${totalWithVat.toFixed(2)}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-text">هذه الوثيقة مطبوعة من النظام ولا تحتاج الى ختم أو توقيع</div>
            <div class="footer-text-ar">This document printed from system, no need to stamp or signature</div>
            <div class="footer-date">${format(new Date(), 'dd MMMM yyyy ( HH:mm:ss )')}</div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const totalAmount = orderLines.reduce((sum, line) => sum + (line.total || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isRTL ? 'معاينة الفاتورة' : 'Invoice Preview'}</span>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Preview Content */}
        <div ref={printRef} className="bg-white p-6 rounded-lg border" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b-2 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold text-xs">
                PURPLE
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">PURPLE CARD</div>
                <div className="text-lg text-muted-foreground">بيربل كارد</div>
              </div>
            </div>
            <div className="text-sm text-right space-y-1">
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">Reference Number:</span>
                <span className="font-medium">{paymentRef || '-'}</span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">Payment brand:</span>
                <span className="font-medium">{paymentBrand || '-'}</span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">Payment method:</span>
                <span className="font-medium">{paymentMethod || '-'}</span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">Card number:</span>
                <span className="font-medium">xxxx xxxx xxxx {hyberpayInfo?.accountnumberlast4 || riyadBankInfo?.card_number?.slice(-4) || 'XXXX'}</span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">SAR {hyberpayInfo?.credit || totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-4 bg-muted/50 p-4 rounded-lg mb-4 text-center">
            <div className="border-l px-2">
              <div className="text-xs text-muted-foreground">VAT No الرقم الضريبي</div>
              <div className="font-semibold">1111</div>
            </div>
            <div className="border-l px-2">
              <div className="text-xs text-muted-foreground">Invoice No رقم الفاتورة</div>
              <div className="font-semibold">{orderNumber}</div>
            </div>
            <div className="border-l px-2">
              <div className="text-xs text-muted-foreground">Invoice Date تاريخ الفاتورة</div>
              <div className="font-semibold text-sm">{orderDate ? format(new Date(orderDate), 'dd MMM yyyy HH:mm') : '-'}</div>
            </div>
            <div className="px-2">
              <div className="text-xs text-muted-foreground">Invoice Currency عملة الفاتورة</div>
              <div className="font-semibold">{hyberpayInfo?.currency || 'SAR'}</div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="text-sm font-semibold text-purple-600 mb-2 text-right">Customer Info بيانات العميل</div>
          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg mb-4">
            <div>
              <div className="text-xs text-muted-foreground">Customer Name بيانات العميل</div>
              <div className="font-medium">{customerName || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Customer Phone بيانات الجوال</div>
              <div className="font-medium">{customerPhone || '-'}</div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-center text-xs border-b-2">#</th>
                <th className="p-3 text-center text-xs border-b-2">وصف المنتج<br/>Item description</th>
                <th className="p-3 text-center text-xs border-b-2">الكمية<br/>Quantity</th>
                <th className="p-3 text-center text-xs border-b-2">سعر الوحدة<br/>Unit price</th>
                <th className="p-3 text-center text-xs border-b-2">قيمة الضريبة<br/>VAT Amount</th>
                <th className="p-3 text-center text-xs border-b-2">إجمالي المبلغ<br/>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((line, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-3 text-center">{idx + 1}</td>
                  <td className="p-3 text-center">{line.coins_number ? `${line.coins_number.toLocaleString()} كوينز - ` : ''}{line.product_name || line.brand_name || '-'}</td>
                  <td className="p-3 text-center">{line.qty || 1}</td>
                  <td className="p-3 text-center">{line.unit_price?.toFixed(3) || line.total?.toFixed(3) || '0.000'}</td>
                  <td className="p-3 text-center">0</td>
                  <td className="p-3 text-center">{line.total?.toFixed(3) || '0.000'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="w-1/2 ml-auto mb-6">
            <div className="flex justify-between p-3">
              <span>Total Without VAT المجموع بدون الضريبة</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3 bg-muted/50 rounded-lg font-semibold">
              <span>Total With VAT المجموع مع الضريبة</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-purple-600 text-white p-5 rounded-lg text-center">
            <div className="mb-1">هذه الوثيقة مطبوعة من النظام ولا تحتاج الى ختم أو توقيع</div>
            <div className="text-purple-200 text-sm">This document printed from system, no need to stamp or signature</div>
            <div className="text-purple-200 text-xs mt-2">{format(new Date(), 'dd MMMM yyyy ( HH:mm:ss )')}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
