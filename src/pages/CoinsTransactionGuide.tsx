import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, ArrowLeft, CheckCircle, Send, Package, Coins, FileText, Settings, Mail, Bell, Plus, Upload, Image, Lock, Filter, Calendar } from "lucide-react";
import { getPrintLogoUrl, PRINT_LOGO_STYLES } from "@/lib/printLogo";

// Mock UI Screenshot Components
const MockScreenshot = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-2 border-border rounded-lg overflow-hidden my-4 print:border print:border-gray-300">
    <div className="bg-muted/80 px-3 py-1.5 border-b flex items-center justify-between text-xs">
      <span className="font-semibold text-muted-foreground">📸 {title}</span>
      <span className="text-muted-foreground/60">شاشة النظام</span>
    </div>
    <div className="bg-card p-3 text-sm" dir="rtl">{children}</div>
  </div>
);

const MockButton = ({ children, variant = "primary" }: { children: React.ReactNode; variant?: string }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
    variant === "primary" ? "bg-primary text-primary-foreground" : 
    variant === "outline" ? "border border-border text-foreground" :
    variant === "success" ? "bg-green-600 text-white" :
    variant === "muted" ? "bg-muted text-muted-foreground" : ""
  }`}>{children}</span>
);

const MockBadge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>{children}</span>
);

const MockTableRow = ({ cells, highlighted }: { cells: string[]; highlighted?: boolean }) => (
  <tr className={highlighted ? "bg-primary/5" : ""}>
    {cells.map((cell, i) => (
      <td key={i} className="border border-border/50 px-2 py-1.5 text-xs">{cell}</td>
    ))}
  </tr>
);

const CoinsTransactionGuide = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-transaction-guide");

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`p-4 md:p-8 ${isArabic ? "rtl" : "ltr"}`} dir="rtl">
      {/* Print button - hidden in print */}
      <div className="print:hidden flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">دليل المستخدم - معاملات العملات</h1>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة الدليل
        </Button>
      </div>

      {/* Printable content */}
      <div className="space-y-8 max-w-4xl mx-auto print:max-w-none" id="coins-guide-print">
        
        {/* Cover / Header */}
        <div className="text-center space-y-4 pb-6 border-b-2 border-primary print:break-after-page">
          <img src={getPrintLogoUrl()} alt="Logo" style={PRINT_LOGO_STYLES} className="mx-auto" />
          <h1 className="text-3xl font-bold text-primary">دليل المستخدم</h1>
          <h2 className="text-2xl font-semibold text-foreground">نظام معاملات العملات (Coins Transaction)</h2>
          <p className="text-muted-foreground text-lg">دليل تدريبي شامل لجميع مراحل سير العمل</p>
          <div className="flex items-center justify-center gap-2 pt-4">
            {["الإنشاء", "التوجيه", "الاستلام", "إدخال العملات", "مكتمل"].map((phase, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                <span className="text-sm font-medium">{phase}</span>
                {idx < 4 && <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>

        {/* Table of Contents */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              فهرس المحتويات
            </h2>
            <ol className="space-y-2 text-base list-decimal list-inside">
              <li className="font-medium">نظرة عامة على النظام</li>
              <li className="font-medium">إعداد سير العمل (Workflow Setup)</li>
              <li className="font-medium">المرحلة الأولى: إنشاء طلب الشراء (Creation)</li>
              <li className="font-medium">المرحلة الثانية: التوجيه والإرسال (Sending)</li>
              <li className="font-medium">المرحلة الثالثة: الاستلام (Receiving)</li>
              <li className="font-medium">المرحلة الرابعة: إدخال العملات (Coins Entry)</li>
              <li className="font-medium">المرحلة الخامسة: مكتمل (Completed)</li>
              <li className="font-medium">الإشعارات والبريد الإلكتروني</li>
              <li className="font-medium">إدخال الاستلام (Receiving Entry)</li>
              <li className="font-medium">التقارير والمتابعة</li>
            </ol>
          </CardContent>
        </Card>

        {/* Section 1: Overview */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">1</span>
              نظرة عامة على النظام
            </h2>
            <p className="text-base leading-relaxed">
              نظام معاملات العملات هو نظام متكامل لإدارة عمليات شراء العملات الرقمية (Coins) من الموردين. 
              يعتمد النظام على <strong>خمس مراحل متتالية</strong> يمر بها كل طلب شراء، مع تعيين مسؤولين لكل مرحلة حسب العلامة التجارية.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">المراحل الخمس:</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { icon: <FileText className="h-5 w-5" />, title: "الإنشاء", desc: "إنشاء طلب الشراء وتحديد المبالغ والعلامات التجارية" },
                  { icon: <Send className="h-5 w-5" />, title: "التوجيه", desc: "إرسال التحويل البنكي للمورد وتأكيد الإرسال" },
                  { icon: <Package className="h-5 w-5" />, title: "الاستلام", desc: "تأكيد استلام العملات ورفع صور الإثبات" },
                  { icon: <Coins className="h-5 w-5" />, title: "إدخال العملات", desc: "تسجيل العملات المستلمة في النظام" },
                  { icon: <CheckCircle className="h-5 w-5" />, title: "مكتمل", desc: "إتمام العملية بالكامل" },
                ].map((phase, idx) => (
                  <div key={idx} className="bg-background rounded-lg p-3 border text-center space-y-1">
                    <div className="text-primary mx-auto flex justify-center">{phase.icon}</div>
                    <h4 className="font-bold text-sm">{phase.title}</h4>
                    <p className="text-xs text-muted-foreground">{phase.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot: Sidebar menu */}
            <MockScreenshot title="القائمة الجانبية - قسم معاملات العملات">
              <div className="bg-muted/30 rounded-lg p-2 max-w-[250px] space-y-1">
                <div className="text-primary font-bold text-xs mb-2">معاملات العملات</div>
                {["إنشاء طلب شراء", "توجيه التحويلات", "استلام من المورد", "استلام العملات", "إعداد سير العمل", "متابعة شراء العملات", "إعداد الموردين", "دليل المستخدم"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50">
                    <span className="text-primary">●</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </MockScreenshot>
          </CardContent>
        </Card>

        {/* Section 2: Workflow Setup */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">2</span>
              <Settings className="h-5 w-5" />
              إعداد سير العمل (Workflow Setup)
            </h2>
            <p className="text-base leading-relaxed">
              قبل البدء باستخدام النظام، يجب إعداد <strong>المسؤولين عن كل مرحلة</strong> لكل علامة تجارية. 
              يتم ذلك من صفحة <strong>"إعداد سير عمل العملات"</strong>.
            </p>
            
            {/* Screenshot: Workflow Setup */}
            <MockScreenshot title="صفحة إعداد سير العمل">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary">⚙️ إعداد سير عمل العملات</h3>
                  <MockButton variant="primary"><Plus className="h-3 w-3" /> إضافة تعيين</MockButton>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border/50 px-2 py-1.5 text-xs text-right">العلامة التجارية</th>
                      <th className="border border-border/50 px-2 py-1.5 text-xs text-right">المرحلة</th>
                      <th className="border border-border/50 px-2 py-1.5 text-xs text-right">المسؤول</th>
                      <th className="border border-border/50 px-2 py-1.5 text-xs text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    <MockTableRow cells={["iTunes", "الإنشاء", "أحمد محمد", "🗑️"]} />
                    <MockTableRow cells={["iTunes", "التوجيه", "سارة علي", "🗑️"]} highlighted />
                    <MockTableRow cells={["iTunes", "الاستلام", "محمد خالد", "🗑️"]} />
                    <MockTableRow cells={["كل العلامات التجارية", "إدخال العملات", "فهد سعود", "🗑️"]} highlighted />
                  </tbody>
                </table>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">خطوات الإعداد:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li><strong>الدخول إلى صفحة الإعداد:</strong> من القائمة الجانبية، اختر <strong>"إعداد سير عمل العملات"</strong></li>
                <li><strong>اختيار العلامة التجارية:</strong> اختر العلامة التجارية التي تريد تعيين المسؤولين لها</li>
                <li><strong>تعيين المسؤولين:</strong> لكل مرحلة (إنشاء - توجيه - استلام - إدخال العملات)، قم بتعيين المستخدم المسؤول</li>
                <li><strong>تعيين جماعي:</strong> يمكنك اختيار <strong>"كل العلامات التجارية"</strong> لتعيين مستخدم واحد لجميع العلامات في مرحلة محددة</li>
              </ol>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                ⚠️ <strong>ملاحظة مهمة:</strong> يجب إعداد المسؤولين قبل البدء بإنشاء طلبات الشراء، حيث يعتمد النظام عليهم لإرسال الإشعارات التلقائية.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Creation Phase */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">3</span>
              <FileText className="h-5 w-5" />
              المرحلة الأولى: إنشاء طلب الشراء (Creation)
            </h2>
            <p className="text-base leading-relaxed">
              تبدأ العملية بإنشاء طلب شراء جديد من صفحة <strong>"إنشاء طلب عملات"</strong>. يتم فيها تحديد جميع تفاصيل الطلب.
            </p>
            
            {/* Screenshot: Creation main grid */}
            <MockScreenshot title="صفحة إنشاء طلب شراء العملات - قائمة الطلبات">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary">💰 إنشاء طلب شراء عملات</h3>
                  <MockButton><Plus className="h-3 w-3" /> طلب جديد</MockButton>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <MockButton variant="outline"><Filter className="h-3 w-3" /> المعلقة (الإنشاء)</MockButton>
                  <MockButton variant="muted"><Calendar className="h-3 w-3" /> من تاريخ</MockButton>
                  <MockButton variant="muted"><Calendar className="h-3 w-3" /> إلى تاريخ</MockButton>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      {["رقم الطلب", "التاريخ", "العملة", "المبلغ بالعملة", "المبلغ (SAR)", "المرحلة", "أنشئ بواسطة"].map(h => (
                        <th key={h} className="border border-border/50 px-2 py-1.5 text-xs text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <MockTableRow cells={["PO-2026-001", "2026/02/20", "USD", "5,000.00", "18,750.00", "الإنشاء", "أحمد محمد"]} />
                    <MockTableRow cells={["PO-2026-002", "2026/02/22", "USD", "3,200.00", "12,000.00", "الإنشاء", "أحمد محمد"]} highlighted />
                    <MockTableRow cells={["PO-2026-003", "2026/02/24", "EUR", "2,800.00", "11,200.00", "التوجيه 🔒", "سارة علي"]} />
                  </tbody>
                </table>
              </div>
            </MockScreenshot>

            {/* Screenshot: Creation form */}
            <MockScreenshot title="نموذج إنشاء طلب جديد - بيانات الرأس والأسطر">
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">المورد الرئيسي</label>
                    <div className="border rounded px-2 py-1 text-xs bg-background">شركة التحويلات الدولية</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">البنك</label>
                    <div className="border rounded px-2 py-1 text-xs bg-background">البنك الأهلي</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">العملة</label>
                    <div className="border rounded px-2 py-1 text-xs bg-background">USD - دولار أمريكي</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">سعر الصرف</label>
                    <div className="border rounded px-2 py-1 text-xs bg-background">3.75</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">رسوم التحويل البنكي</label>
                    <div className="border rounded px-2 py-1 text-xs bg-background">50.00</div>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs">أسطر الطلب</span>
                    <MockButton variant="outline"><Plus className="h-3 w-3" /> إضافة سطر</MockButton>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        {["#", "العلامة التجارية", "المورد", "المبلغ بالعملة", "المبلغ (SAR)"].map(h => (
                          <th key={h} className="border border-border/50 px-2 py-1 text-[10px] text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <MockTableRow cells={["1", "iTunes", "مورد iTunes", "2,000.00", "7,500.00"]} />
                      <MockTableRow cells={["2", "PUBG", "مورد الألعاب", "1,500.00", "5,625.00"]} highlighted />
                      <MockTableRow cells={["3", "PlayStation", "مورد PlayStation", "1,500.00", "5,625.00"]} />
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">صورة التحويل البنكي: </span>
                    <MockBadge color="bg-green-100 text-green-800">✅ تم الرفع</MockBadge>
                  </div>
                </div>
                <div className="flex gap-2 justify-end border-t pt-3">
                  <MockButton variant="outline">حفظ</MockButton>
                  <MockButton variant="success"><Send className="h-3 w-3" /> إرسال للتوجيه</MockButton>
                </div>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">خطوات إنشاء طلب جديد:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li><strong>الضغط على "طلب جديد":</strong> يظهر نموذج إنشاء الطلب</li>
                <li><strong>تعبئة بيانات الرأس:</strong>
                  <ul className="mr-6 mt-1 space-y-1 list-disc list-inside text-sm">
                    <li><strong>المورد الرئيسي:</strong> اختر المورد الذي سيتم التحويل له</li>
                    <li><strong>البنك:</strong> اختر البنك الذي سيتم التحويل منه</li>
                    <li><strong>العملة:</strong> اختر عملة التحويل (مثلاً USD)</li>
                    <li><strong>سعر الصرف:</strong> أدخل سعر الصرف يدوياً</li>
                    <li><strong>رسوم التحويل البنكي:</strong> أدخل رسوم التحويل إن وجدت</li>
                  </ul>
                </li>
                <li><strong>إضافة أسطر الطلب:</strong>
                  <ul className="mr-6 mt-1 space-y-1 list-disc list-inside text-sm">
                    <li>اختر <strong>العلامة التجارية</strong> لكل سطر</li>
                    <li>اختر <strong>المورد</strong> الخاص بالسطر (قد يختلف عن المورد الرئيسي)</li>
                    <li>أدخل <strong>المبلغ بالعملة</strong> - يتم حساب المبلغ بالريال تلقائياً</li>
                  </ul>
                </li>
                <li><strong>رفع صورة التحويل البنكي:</strong> ارفق صورة إيصال التحويل</li>
                <li><strong>حفظ الطلب:</strong> اضغط "حفظ" لحفظ الطلب بحالة "معلق"</li>
                <li><strong>إرسال للمرحلة التالية:</strong> اضغط "إرسال للتوجيه" لنقل الطلب لمرحلة التوجيه</li>
              </ol>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                💡 <strong>ملاحظات:</strong>
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                <li>يمكن حذف الطلبات المعلقة فقط (التي لم تنتقل لمرحلة التوجيه بعد)</li>
                <li>بعد الإرسال، يظهر الطلب بوضع "للقراءة فقط" مع أيقونة القفل 🔒</li>
                <li>يتم إرسال إشعار تلقائي للمسؤول عن مرحلة التوجيه</li>
              </ul>
            </div>

            {/* Screenshot: Filter bar */}
            <MockScreenshot title="شريط الفلترة - متوفر في جميع المراحل">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                  <span className="bg-primary text-primary-foreground px-3 py-1.5 font-medium">المعلقة (الإنشاء)</span>
                  <span className="px-3 py-1.5 text-muted-foreground">المرسلة فقط</span>
                  <span className="px-3 py-1.5 text-muted-foreground">الكل</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="border rounded px-2 py-1">📅 من تاريخ</span>
                  <span className="border rounded px-2 py-1">📅 إلى تاريخ</span>
                </div>
              </div>
            </MockScreenshot>
          </CardContent>
        </Card>

        {/* Section 4: Sending Phase */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">4</span>
              <Send className="h-5 w-5" />
              المرحلة الثانية: التوجيه والإرسال (Sending)
            </h2>
            <p className="text-base leading-relaxed">
              في هذه المرحلة، يقوم المسؤول بمراجعة الطلب وتأكيد إرسال التحويل البنكي للمورد.
            </p>
            
            {/* Screenshot: Sending details */}
            <MockScreenshot title="صفحة التوجيه - تفاصيل الطلب">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary">📤 توجيه التحويلات</h3>
                  <MockBadge color="bg-amber-100 text-amber-800">مرحلة التوجيه</MockBadge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">رقم الطلب: </span><strong>PO-2026-001</strong></div>
                  <div><span className="text-muted-foreground">المورد: </span><strong>شركة التحويلات الدولية</strong></div>
                  <div><span className="text-muted-foreground">البنك: </span><strong>البنك الأهلي</strong></div>
                  <div><span className="text-muted-foreground">المبلغ: </span><strong>5,000.00 USD</strong></div>
                </div>
                <div className="border-t pt-2">
                  <span className="text-xs font-semibold">تفاصيل العلامات التجارية والمبالغ:</span>
                  <table className="w-full border-collapse mt-2">
                    <thead>
                      <tr className="bg-muted/50">
                        {["العلامة التجارية", "المورد", "المبلغ بالعملة", "المبلغ (SAR)"].map(h => (
                          <th key={h} className="border border-border/50 px-2 py-1 text-[10px] text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <MockTableRow cells={["iTunes", "مورد iTunes", "2,000.00", "7,500.00"]} />
                      <MockTableRow cells={["PUBG", "مورد الألعاب", "1,500.00", "5,625.00"]} highlighted />
                      <MockTableRow cells={["PlayStation", "مورد PlayStation", "1,500.00", "5,625.00"]} />
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2">
                  <div className="text-xs"><span className="text-muted-foreground">رسوم التحويل البنكي: </span><strong>50.00 SAR</strong></div>
                  <div className="flex items-center gap-2 text-xs">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <span>صورة التحويل البنكي: </span>
                    <MockButton variant="outline">📥 تحميل الصورة</MockButton>
                  </div>
                </div>
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 border-2 border-primary rounded flex items-center justify-center">
                      <CheckCircle className="h-3 w-3 text-primary" />
                    </div>
                    <span className="font-medium">أؤكد أنني أرسلت التحويل للمورد ✅</span>
                  </div>
                  <div className="flex justify-end">
                    <MockButton variant="success"><Send className="h-3 w-3" /> تأكيد وإرسال للاستلام</MockButton>
                  </div>
                </div>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">خطوات التوجيه:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li><strong>فتح الطلب:</strong> من قائمة الطلبات المعلقة، اضغط على الطلب لعرض تفاصيله</li>
                <li><strong>مراجعة التفاصيل:</strong> راجع تفاصيل الطلب والمبالغ والعلامات التجارية</li>
                <li><strong>تحميل صورة التحويل:</strong> اضغط <strong>"تحميل الصورة"</strong> لتحميل صورة إيصال التحويل البنكي</li>
                <li><strong>إرسال للمورد:</strong> أرسل الصورة للمورد عبر تطبيق المورد المعتمد</li>
                <li><strong>تأكيد الإرسال:</strong> ضع علامة ✅ على <strong>"أؤكد أنني أرسلت التحويل للمورد"</strong></li>
                <li><strong>إرسال للاستلام:</strong> اضغط <strong>"تأكيد وإرسال للاستلام"</strong></li>
              </ol>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                ✅ <strong>بعد التأكيد:</strong> ينتقل الطلب تلقائياً لمرحلة الاستلام ويتم إرسال إشعار وبريد إلكتروني للمسؤول عن مرحلة الاستلام.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Receiving Phase */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">5</span>
              <Package className="h-5 w-5" />
              المرحلة الثالثة: الاستلام (Receiving)
            </h2>
            <p className="text-base leading-relaxed">
              يقوم المسؤول عن الاستلام بتأكيد استلام العملات من المورد ورفع صور الإثبات لكل علامة تجارية.
            </p>
            
            {/* Screenshot: Receiving phase with brand images */}
            <MockScreenshot title="صفحة الاستلام - رفع صور الإثبات لكل علامة تجارية">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary">📦 استلام من المورد</h3>
                  <MockBadge color="bg-blue-100 text-blue-800">مرحلة الاستلام</MockBadge>
                </div>
                <div className="text-xs text-muted-foreground">طلب رقم: PO-2026-001 | المورد: شركة التحويلات الدولية</div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Brand with uploaded image */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">iTunes</span>
                      <MockBadge color="bg-green-100 text-green-800">✅ تم الاستلام</MockBadge>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 rounded h-16 flex items-center justify-center">
                      <span className="text-green-600 text-xs">🖼️ صورة الاستلام</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">2,000.00 USD</span>
                  </div>
                  {/* Brand with upload button */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">PUBG</span>
                      <MockBadge color="bg-amber-100 text-amber-800">⏳ بانتظار</MockBadge>
                    </div>
                    <div className="border-2 border-dashed rounded h-16 flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="h-4 w-4 text-muted-foreground mx-auto" />
                        <span className="text-[10px] text-muted-foreground">ارفع الصورة</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">1,500.00 USD</span>
                  </div>
                  {/* Brand with upload button */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">PlayStation</span>
                      <MockBadge color="bg-amber-100 text-amber-800">⏳ بانتظار</MockBadge>
                    </div>
                    <div className="border-2 border-dashed rounded h-16 flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="h-4 w-4 text-muted-foreground mx-auto" />
                        <span className="text-[10px] text-muted-foreground">ارفع الصورة</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">1,500.00 USD</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <MockButton variant="success"><Package className="h-3 w-3" /> تأكيد الاستلام والانتقال لإدخال العملات</MockButton>
                </div>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">خطوات الاستلام:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li><strong>فتح الطلب:</strong> من قائمة الطلبات المعلقة في مرحلة الاستلام</li>
                <li><strong>رفع صور الاستلام:</strong> لكل علامة تجارية، ارفع صورة تثبت استلام العملات
                  <ul className="mr-6 mt-1 space-y-1 list-disc list-inside text-sm">
                    <li>يظهر لكل علامة تجارية مربع رفع صورة منفصل</li>
                    <li>بعد الرفع، يظهر حالة <strong>"تم الاستلام"</strong> بجانب العلامة التجارية</li>
                    <li>يمكن حذف الصورة وإعادة رفعها</li>
                  </ul>
                </li>
                <li><strong>إضافة ملاحظات:</strong> يمكن إضافة ملاحظات لكل علامة تجارية</li>
                <li><strong>تأكيد الاستلام:</strong> بعد رفع صور جميع العلامات التجارية، اضغط <strong>"تأكيد الاستلام والانتقال لإدخال العملات"</strong></li>
              </ol>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                ⚠️ <strong>مهم:</strong> عند الانتقال لمرحلة إدخال العملات، يتم تلقائياً إنشاء سجل "إدخال استلام" (Receiving Entry) يحتوي على العملات المتوقعة لكل علامة تجارية محسوبة بناءً على المبلغ وقيمة العملة الواحدة.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Coins Entry Phase */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">6</span>
              <Coins className="h-5 w-5" />
              المرحلة الرابعة: إدخال العملات (Coins Entry)
            </h2>
            <p className="text-base leading-relaxed">
              يتم في هذه المرحلة تسجيل العملات المستلمة فعلياً في النظام من خلال صفحة <strong>"إدخال الاستلام"</strong>.
            </p>
            
            {/* Screenshot: Receiving Entry */}
            <MockScreenshot title="صفحة إدخال الاستلام - تسجيل العملات المستلمة">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-primary">🪙 إدخال الاستلام</h3>
                  <div className="flex gap-2">
                    <MockBadge color="bg-amber-100 text-amber-800">تسليم جزئي</MockBadge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-muted-foreground">العملة: </span><strong>USD</strong></div>
                  <div><span className="text-muted-foreground">سعر الصرف: </span><strong>3.75</strong></div>
                  <div><span className="text-muted-foreground">المورد: </span><strong>شركة التحويلات</strong></div>
                  <div><span className="text-muted-foreground">طلب الشراء: </span><strong>PO-2026-001</strong></div>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      {["#", "العلامة التجارية", "المورد", "العملات", "سعر الوحدة", "الإجمالي", "المتبقي", "الحالة"].map(h => (
                        <th key={h} className="border border-border/50 px-2 py-1 text-[10px] text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-green-50/50 dark:bg-green-950/20">
                      {["1", "iTunes", "مورد iTunes", "200", "10.00", "2,000.00", "0.00", ""].map((cell, i) => (
                        <td key={i} className="border border-border/50 px-2 py-1.5 text-xs">
                          {i === 7 ? <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-green-600" /> <MockBadge color="bg-green-100 text-green-800">مؤكد ✅</MockBadge></span> : cell}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      {["2", "PUBG", "مورد الألعاب", "150", "10.00", "1,500.00", "0.00", ""].map((cell, i) => (
                        <td key={i} className="border border-border/50 px-2 py-1.5 text-xs">
                          {i === 7 ? <MockButton variant="outline">تأكيد ✅</MockButton> : cell}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-muted/30">
                      {["3", "PlayStation", "مورد PlayStation", "100", "10.00", "1,000.00", "500.00", ""].map((cell, i) => (
                        <td key={i} className="border border-border/50 px-2 py-1.5 text-xs">
                          {i === 7 ? <MockButton variant="outline">تأكيد ✅</MockButton> : cell}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                <div className="flex items-center justify-between pt-2 border-t">
                  <MockButton variant="outline"><Plus className="h-3 w-3" /> إضافة سطر جديد</MockButton>
                  <MockButton variant="muted"><Lock className="h-3 w-3" /> إغلاق السجل (متاح عند اكتمال التسليم)</MockButton>
                </div>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">خطوات إدخال العملات:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li><strong>فتح سجل الاستلام:</strong> من صفحة "إدخال الاستلام"، افتح السجل المُنشأ تلقائياً</li>
                <li><strong>مراجعة الأسطر:</strong> يظهر لكل علامة تجارية:
                  <ul className="mr-6 mt-1 space-y-1 list-disc list-inside text-sm">
                    <li><strong>عدد العملات المتوقع:</strong> محسوب تلقائياً</li>
                    <li><strong>سعر الوحدة:</strong> سعر العملة الواحدة</li>
                    <li><strong>الإجمالي:</strong> العدد × السعر</li>
                    <li><strong>المبلغ المتبقي للعلامة:</strong> يُظهر المبلغ المتبقي من مبلغ التحكم</li>
                  </ul>
                </li>
                <li><strong>تعديل الكميات:</strong> يمكن تعديل عدد العملات وسعر الوحدة يدوياً</li>
                <li><strong>إضافة أسطر جديدة:</strong> يمكن إضافة أسطر إضافية لنفس العلامة التجارية أو علامات أخرى</li>
                <li><strong>تأكيد كل سطر:</strong> اضغط ✅ لتأكيد كل سطر على حدة - السطر المؤكد يصبح للقراءة فقط</li>
                <li><strong>حالة التسليم:</strong>
                  <ul className="mr-6 mt-1 space-y-1 list-disc list-inside text-sm">
                    <li><strong>مسودة:</strong> لم يتم تأكيد أي سطر</li>
                    <li><strong>تسليم جزئي:</strong> بعض الأسطر مؤكدة ولكن المبلغ لم يكتمل</li>
                    <li><strong>تسليم كامل:</strong> تم تأكيد جميع المبالغ المطلوبة</li>
                  </ul>
                </li>
                <li><strong>إغلاق السجل:</strong> عند اكتمال التسليم، اضغط <strong>"إغلاق السجل"</strong> لتحويل الحالة إلى "مغلق"</li>
              </ol>
            </div>

            {/* Screenshot: Status badges */}
            <MockScreenshot title="حالات سجل الاستلام">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { status: "مسودة", color: "bg-muted text-muted-foreground", desc: "لم يتم تأكيد أي سطر بعد" },
                  { status: "تسليم جزئي", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", desc: "بعض الأسطر تم تأكيدها" },
                  { status: "تسليم كامل", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", desc: "جميع المبالغ المطلوبة مكتملة" },
                  { status: "مغلق", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", desc: "تم الإغلاق النهائي - للقراءة فقط" },
                ].map((s, i) => (
                  <div key={i} className="border rounded-lg p-3 text-center space-y-2">
                    <MockBadge color={s.color}>{s.status}</MockBadge>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
            </MockScreenshot>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                💡 <strong>التراجع:</strong> يمكن التراجع عن تأكيد سطر (إلغاء التأكيد) طالما لم يتم إغلاق السجل. كما يمكن إرجاع الطلب من مرحلة إدخال العملات إلى مرحلة الاستلام مع حذف جميع سجلات الاستلام المُنشأة تلقائياً.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Completed */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">7</span>
              <CheckCircle className="h-5 w-5" />
              المرحلة الخامسة: مكتمل (Completed)
            </h2>
            <p className="text-base leading-relaxed">
              بعد إغلاق سجل إدخال العملات وتأكيد جميع المبالغ، ينتقل الطلب تلقائياً إلى حالة <strong>"مكتمل"</strong>. 
              في هذه الحالة، يكون الطلب للقراءة فقط ولا يمكن إجراء أي تعديلات عليه.
            </p>

            <MockScreenshot title="طلب مكتمل - للقراءة فقط">
              <div className="space-y-2 opacity-75">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-sm">PO-2026-001</span>
                  </div>
                  <MockBadge color="bg-green-100 text-green-800">✅ مكتمل</MockBadge>
                </div>
                <div className="text-xs text-muted-foreground">جميع البيانات للقراءة فقط - لا يمكن التعديل</div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {["الإنشاء ✅", "التوجيه ✅", "الاستلام ✅", "إدخال العملات ✅", "مكتمل ✅"].map((p, i) => (
                    <div key={i} className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-center py-1 rounded text-[10px] font-medium">{p}</div>
                  ))}
                </div>
              </div>
            </MockScreenshot>
          </CardContent>
        </Card>

        {/* Section 8: Notifications */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">8</span>
              <Mail className="h-5 w-5" />
              الإشعارات والبريد الإلكتروني
            </h2>
            <p className="text-base leading-relaxed">
              يقوم النظام بإرسال إشعارات تلقائية في كل مرحلة انتقالية لضمان سرعة الاستجابة.
            </p>
            
            {/* Screenshot: Email notification */}
            <MockScreenshot title="مثال على البريد الإلكتروني المُرسل تلقائياً">
              <div className="border rounded-lg p-4 space-y-3 max-w-md mx-auto bg-background">
                <div className="text-center border-b pb-3">
                  <div className="text-primary font-bold text-sm">نظام إدارة معاملات العملات</div>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="font-bold">مهمة جديدة في مرحلة التوجيه</p>
                  <p>مرحباً <strong>سارة علي</strong>،</p>
                  <p>لديك مهمة جديدة تتطلب اتخاذ إجراء:</p>
                  <div className="bg-muted/50 rounded p-2 space-y-1">
                    <div><span className="text-muted-foreground">رقم الطلب: </span><strong>PO-2026-001</strong></div>
                    <div><span className="text-muted-foreground">المرحلة: </span><strong>التوجيه</strong></div>
                    <div><span className="text-muted-foreground">العلامات التجارية: </span><strong>iTunes, PUBG, PlayStation</strong></div>
                    <div><span className="text-muted-foreground">المبلغ: </span><strong>5,000.00 USD</strong></div>
                  </div>
                  <div className="text-center pt-2">
                    <MockButton variant="primary">الذهاب للطلب</MockButton>
                  </div>
                </div>
              </div>
            </MockScreenshot>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-2 text-right font-semibold">الحدث</th>
                    <th className="border p-2 text-right font-semibold">نوع الإشعار</th>
                    <th className="border p-2 text-right font-semibold">المستلم</th>
                    <th className="border p-2 text-right font-semibold">المحتوى</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">إنشاء الطلب → التوجيه</td>
                    <td className="border p-2">
                      <div className="flex items-center gap-1"><Bell className="h-3 w-3" /> إشعار داخلي + <Mail className="h-3 w-3" /> بريد</div>
                    </td>
                    <td className="border p-2">مسؤول مرحلة التوجيه</td>
                    <td className="border p-2">مهمة جديدة في مرحلة التوجيه مع أسماء العلامات التجارية</td>
                  </tr>
                  <tr className="bg-muted/30">
                    <td className="border p-2">التوجيه → الاستلام</td>
                    <td className="border p-2">
                      <div className="flex items-center gap-1"><Bell className="h-3 w-3" /> إشعار داخلي + <Mail className="h-3 w-3" /> بريد</div>
                    </td>
                    <td className="border p-2">مسؤول مرحلة الاستلام</td>
                    <td className="border p-2">مهمة جديدة في مرحلة الاستلام</td>
                  </tr>
                  <tr>
                    <td className="border p-2">الاستلام → إدخال العملات</td>
                    <td className="border p-2">
                      <div className="flex items-center gap-1"><Bell className="h-3 w-3" /> إشعار داخلي + <Mail className="h-3 w-3" /> بريد</div>
                    </td>
                    <td className="border p-2">مسؤول مرحلة إدخال العملات</td>
                    <td className="border p-2">مهمة جديدة في مرحلة إدخال العملات</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Screenshot: Internal notification bell */}
            <MockScreenshot title="الإشعارات الداخلية - أيقونة الجرس">
              <div className="flex items-center gap-3 max-w-xs">
                <div className="relative">
                  <Bell className="h-5 w-5 text-foreground" />
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">3</span>
                </div>
                <div className="border rounded-lg p-2 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs bg-primary/5 rounded p-1.5">
                    <Coins className="h-3 w-3 text-primary" />
                    <span>مهمة جديدة: التوجيه - PO-2026-001</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs rounded p-1.5">
                    <Coins className="h-3 w-3 text-primary" />
                    <span>مهمة جديدة: الاستلام - PO-2026-002</span>
                  </div>
                </div>
              </div>
            </MockScreenshot>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">تفاصيل البريد الإلكتروني:</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li>يتم إرسال البريد الإلكتروني <strong>باللغة العربية</strong></li>
                <li>يحتوي على: رقم الطلب، أسماء العلامات التجارية، اسم المرحلة</li>
                <li>يتضمن رابط مباشر للطلب في النظام</li>
                <li>يتم الإرسال عبر بروتوكول SMTP المُعد في إعدادات البريد</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Section 9: Receiving Entry */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">9</span>
              إدخال الاستلام (Receiving Entry)
            </h2>
            <p className="text-base leading-relaxed">
              صفحة <strong>"إدخال الاستلام"</strong> هي المكان الذي يتم فيه تسجيل العملات المستلمة فعلياً. 
              يتم إنشاء السجلات تلقائياً عند انتقال الطلب لمرحلة إدخال العملات.
            </p>
            
            {/* Screenshot: Receiving Entry main grid */}
            <MockScreenshot title="صفحة إدخال الاستلام - القائمة الرئيسية">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary">🪙 إدخال الاستلام</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      {["رقم طلب الشراء", "العملة", "سعر الصرف", "مبلغ المعاملة", "المبلغ (SAR)", "الحالة"].map(h => (
                        <th key={h} className="border border-border/50 px-2 py-1.5 text-[10px] text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <MockTableRow cells={["PO-2026-001", "USD", "3.75", "5,000.00", "18,750.00", "تسليم جزئي 🟡"]} />
                    <MockTableRow cells={["PO-2026-002", "USD", "3.75", "3,200.00", "12,000.00", "مسودة ⚪"]} highlighted />
                    <MockTableRow cells={["PO-2026-003", "EUR", "4.00", "2,800.00", "11,200.00", "تسليم كامل 🟢"]} />
                    <MockTableRow cells={["PO-2026-004", "USD", "3.76", "4,000.00", "15,040.00", "مغلق 🔵"]} />
                  </tbody>
                </table>
              </div>
            </MockScreenshot>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-primary">حقول الرأس:</h3>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><strong>العملة:</strong> عملة التحويل</li>
                <li><strong>سعر الصرف:</strong> سعر الصرف المُستخدم</li>
                <li><strong>المورد الرئيسي:</strong> المورد الأساسي</li>
                <li><strong>رقم طلب الشراء:</strong> رقم الطلب الأصلي</li>
                <li><strong>مبلغ المعاملة:</strong> إجمالي المبلغ بالريال ÷ سعر الصرف</li>
              </ul>
            </div>

            {/* Screenshot: Attachments section */}
            <MockScreenshot title="قسم المرفقات - صور الاستلام حسب العلامة التجارية">
              <div className="space-y-2">
                <h4 className="font-bold text-xs">📎 المرفقات</h4>
                <div className="grid grid-cols-3 gap-3">
                  {["iTunes", "PUBG", "PlayStation"].map((brand, i) => (
                    <div key={i} className="border rounded p-2 text-center space-y-1">
                      <span className="text-[10px] font-bold">{brand}</span>
                      <div className="bg-muted/30 rounded h-12 flex items-center justify-center">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">صورة الاستلام</span>
                    </div>
                  ))}
                </div>
              </div>
            </MockScreenshot>
          </CardContent>
        </Card>

        {/* Section 10: Reports */}
        <Card className="print:break-before-page">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm">10</span>
              التقارير والمتابعة
            </h2>
            <p className="text-base leading-relaxed">
              يوفر النظام عدة أدوات لمتابعة حالة الطلبات:
            </p>
            
            {/* Screenshot: Purchase Follow-up */}
            <MockScreenshot title="صفحة متابعة طلبات العملات">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-primary">📊 متابعة شراء العملات</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      {["رقم الطلب", "التاريخ", "العلامة التجارية", "المبلغ", "المرحلة الحالية", "المسؤول"].map(h => (
                        <th key={h} className="border border-border/50 px-2 py-1.5 text-[10px] text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <MockTableRow cells={["PO-2026-001", "2026/02/20", "iTunes, PUBG", "5,000 USD", "إدخال العملات 🪙", "فهد سعود"]} />
                    <MockTableRow cells={["PO-2026-002", "2026/02/22", "PlayStation", "3,200 USD", "الاستلام 📦", "محمد خالد"]} highlighted />
                    <MockTableRow cells={["PO-2026-003", "2026/02/24", "iTunes", "2,800 EUR", "التوجيه 📤", "سارة علي"]} />
                    <MockTableRow cells={["PO-2026-004", "2026/02/10", "PUBG, PSN", "4,000 USD", "مكتمل ✅", "-"]} />
                  </tbody>
                </table>
              </div>
            </MockScreenshot>

            <div className="space-y-3">
              <div className="border rounded-lg p-3 space-y-1">
                <h4 className="font-semibold">📊 متابعة طلبات العملات</h4>
                <p className="text-sm text-muted-foreground">
                  عرض جميع الطلبات مع حالة كل طلب والمرحلة الحالية وإمكانية الفلترة حسب التاريخ والحالة
                </p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <h4 className="font-semibold">📊 تقرير دفتر العملات</h4>
                <p className="text-sm text-muted-foreground">
                  عرض رصيد العملات لكل علامة تجارية مع تفاصيل حركات الاستلام والصرف
                </p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <h4 className="font-semibold">📊 تقرير مقارنة العملات</h4>
                <p className="text-sm text-muted-foreground">
                  مقارنة العملات الفعلية المصروفة في المعاملات مع القيم المتوقعة من إعداد المنتجات
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t text-sm text-muted-foreground print:mt-8">
          <p>تم إعداد هذا الدليل التدريبي لنظام إدارة معاملات العملات</p>
          <p className="mt-1">© {new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { direction: rtl; }
          .print\\:hidden { display: none !important; }
          .print\\:break-before-page { page-break-before: always; }
          .print\\:break-after-page { page-break-after: always; }
          .print\\:max-w-none { max-width: none; }
          .print\\:mt-8 { margin-top: 2rem; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
};

export default CoinsTransactionGuide;
