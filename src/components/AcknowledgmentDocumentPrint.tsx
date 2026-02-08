import { useLanguage } from "@/contexts/LanguageContext";
import { getPrintLogoUrl, PRINT_LOGO_STYLES } from "@/lib/printLogo";

interface AcknowledgmentDocument {
  id: string;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  is_active: boolean;
  requires_signature: boolean;
  created_at: string;
}

interface Props {
  document: AcknowledgmentDocument;
}

export const printAcknowledgmentDocument = (
  document: AcknowledgmentDocument,
  language: string
) => {
  const logoUrl = getPrintLogoUrl();
  const title = language === "ar" && document.title_ar ? document.title_ar : document.title;
  const content = language === "ar" && document.content_ar ? document.content_ar : document.content;
  const isRtl = language === "ar";
  
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRtl ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: ${isRtl ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"};
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          color: #333;
          line-height: 1.6;
          direction: ${isRtl ? "rtl" : "ltr"};
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #333;
        }
        .logo {
          width: ${PRINT_LOGO_STYLES.width};
          height: auto;
        }
        .document-info {
          text-align: ${isRtl ? "left" : "right"};
        }
        .document-date {
          font-size: 12px;
          color: #666;
        }
        .document-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
          text-align: center;
          color: #1a1a1a;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
        }
        .document-content {
          font-size: 14px;
          text-align: ${isRtl ? "right" : "left"};
        }
        .document-content h1, .document-content h2, .document-content h3 {
          margin: 20px 0 10px 0;
          color: #1a1a1a;
        }
        .document-content p {
          margin-bottom: 15px;
        }
        .document-content ul, .document-content ol {
          margin: 10px 0 10px 20px;
          padding-${isRtl ? "right" : "left"}: 20px;
        }
        .document-content li {
          margin-bottom: 8px;
        }
        .signature-section {
          margin-top: 60px;
          padding-top: 30px;
          border-top: 1px solid #ccc;
        }
        .signature-box {
          display: flex;
          justify-content: space-between;
          gap: 50px;
        }
        .signature-field {
          flex: 1;
          text-align: center;
        }
        .signature-line {
          border-bottom: 1px solid #333;
          margin-bottom: 10px;
          height: 40px;
        }
        .signature-label {
          font-size: 12px;
          color: #666;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ccc;
          font-size: 11px;
          color: #888;
          text-align: center;
        }
        @media print {
          body {
            padding: 20px;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${logoUrl}" alt="Logo" class="logo" />
        <div class="document-info">
          <div class="document-date">
            ${isRtl ? "تاريخ الإنشاء:" : "Created:"} ${new Date(document.created_at).toLocaleDateString(isRtl ? "ar-SA" : "en-US")}
          </div>
        </div>
      </div>
      
      <div class="document-title">${title}</div>
      
      <div class="document-content">
        ${content}
      </div>
      
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-field">
            <div class="signature-line"></div>
            <div class="signature-label">${isRtl ? "اسم الموظف" : "Employee Name"}</div>
          </div>
          <div class="signature-field">
            <div class="signature-line"></div>
            <div class="signature-label">${isRtl ? "التوقيع" : "Signature"}</div>
          </div>
          <div class="signature-field">
            <div class="signature-line"></div>
            <div class="signature-label">${isRtl ? "التاريخ" : "Date"}</div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        ${isRtl ? "هذه الوثيقة تم إنشاؤها إلكترونياً" : "This document was generated electronically"}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

export default printAcknowledgmentDocument;
