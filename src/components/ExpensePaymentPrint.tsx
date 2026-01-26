import { useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface ExpensePaymentPrintProps {
  request: {
    request_number: string;
    request_date: string;
    description: string;
    amount: number;
    payment_method: string | null;
    paid_at: string | null;
    notes: string | null;
  };
  paymentDetails: {
    entryNumber: string;
    sourceType: string;
    sourceName: string;
    paymentDate: string;
    treasuryAmount?: number;
    treasuryCurrencyCode?: string;
  };
  language: string;
}

export const ExpensePaymentPrint = ({ request, paymentDetails, language }: ExpensePaymentPrintProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${language === "ar" ? "rtl" : "ltr"}">
      <head>
        <title>${language === "ar" ? "سند صرف" : "Payment Voucher"} - ${paymentDetails.entryNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            direction: ${language === "ar" ? "rtl" : "ltr"};
          }
          .voucher { 
            max-width: 800px; 
            margin: 0 auto; 
            border: 2px solid #333; 
            padding: 30px;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 20px;
          }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px dashed #ccc;
          }
          .row label { font-weight: bold; color: #333; }
          .row span { color: #000; }
          .amount-box { 
            background: #f5f5f5; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0;
            border: 2px solid #333;
          }
          .amount-box .label { font-size: 14px; color: #666; }
          .amount-box .value { font-size: 28px; font-weight: bold; color: #000; }
          .signature-section { 
            display: flex; 
            justify-content: space-between; 
            margin-top: 60px;
            padding-top: 20px;
          }
          .signature-box { 
            text-align: center; 
            width: 30%;
          }
          .signature-line { 
            border-top: 1px solid #333; 
            margin-top: 60px; 
            padding-top: 10px;
          }
          @media print {
            body { padding: 0; }
            .voucher { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" />
        {language === "ar" ? "طباعة" : "Print"}
      </Button>
      
      <div style={{ display: "none" }}>
        <div ref={printRef}>
          <div className="voucher" style={{ position: "relative", overflow: "hidden" }}>
            {/* PAID Ribbon */}
            <div style={{
              position: "absolute",
              top: "30px",
              right: "-40px",
              width: "180px",
              textAlign: "center",
              transform: "rotate(45deg)",
              backgroundColor: "#22c55e",
              color: "white",
              padding: "8px 0",
              fontWeight: "bold",
              fontSize: "14px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              letterSpacing: "1px",
              zIndex: 10
            }}>
              {language === "ar" ? "مدفوع" : "PAID"}
            </div>
            
            <div className="header">
              <h1>{language === "ar" ? "سند صرف" : "Payment Voucher"}</h1>
              <p>{language === "ar" ? "رقم السند" : "Voucher No"}: {paymentDetails.entryNumber}</p>
              <p>{language === "ar" ? "التاريخ" : "Date"}: {format(new Date(paymentDetails.paymentDate), "yyyy-MM-dd")}</p>
            </div>
            
            <div className="row">
              <label>{language === "ar" ? "رقم الطلب:" : "Request No:"}</label>
              <span>{request.request_number}</span>
            </div>
            
            <div className="row">
              <label>{language === "ar" ? "تاريخ الطلب:" : "Request Date:"}</label>
              <span>{format(new Date(request.request_date), "yyyy-MM-dd")}</span>
            </div>
            
            <div className="row">
              <label>{language === "ar" ? "البيان:" : "Description:"}</label>
              <span>{request.description}</span>
            </div>
            
            <div className="row">
              <label>{language === "ar" ? "مصدر الصرف:" : "Payment Source:"}</label>
              <span>{paymentDetails.sourceType}: {paymentDetails.sourceName}</span>
            </div>
            
            <div className="amount-box">
              <div className="label">
                {language === "ar" ? "المبلغ" : "Amount"}
                {paymentDetails.treasuryCurrencyCode && ` (${paymentDetails.treasuryCurrencyCode})`}
              </div>
              <div className="value">
                {paymentDetails.treasuryAmount !== undefined 
                  ? paymentDetails.treasuryAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : request.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </div>
            </div>
            
            {request.notes && (
              <div className="row">
                <label>{language === "ar" ? "ملاحظات:" : "Notes:"}</label>
                <span>{request.notes}</span>
              </div>
            )}
            
            <div className="signature-section">
              <div className="signature-box">
                <div className="signature-line">
                  {language === "ar" ? "المستلم" : "Received By"}
                </div>
              </div>
              <div className="signature-box">
                <div className="signature-line">
                  {language === "ar" ? "أمين الصندوق" : "Cashier"}
                </div>
              </div>
              <div className="signature-box">
                <div className="signature-line">
                  {language === "ar" ? "المدير" : "Manager"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
