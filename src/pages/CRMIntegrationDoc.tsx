import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Printer, ExternalLink, Code, Monitor, Smartphone, ArrowRight, Shield, Key, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const SUPABASE_FUNCTIONS_URL = 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1';
const APP_URL = 'https://id-preview--5b494188-68a9-41d5-980e-26f6e07be39c.lovable.app';

const CRMIntegrationDoc = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printApiKey, setPrintApiKey] = useState("");

  const handlePrint = () => {
    setPrintDialogOpen(true);
  };

  const executePrint = () => {
    setPrintDialogOpen(false);
    // Small delay to let dialog close before printing
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {isRTL ? "دليل تكامل CRM" : "CRM Integration Guide"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL 
              ? "دليل شامل لتكامل تطبيق CRM الخارجي مع نظام إدارة بما في ذلك APIs و WebView"
              : "Complete guide for integrating external CRM application with Edara system including APIs and WebView"}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          {isRTL ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isRTL ? "نظرة عامة" : "Overview"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {isRTL 
              ? "يوفر هذا الدليل تفاصيل كاملة لتكامل تطبيق CRM الخارجي مع نظام إدارة. يتضمن التكامل 3 واجهات API وشاشة WebView لإغلاق الوردية."
              : "This guide provides complete details for integrating the external CRM application with Edara system. The integration includes 3 APIs and a WebView screen for shift closing."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">{isRTL ? "التدفق الأساسي" : "Core Flow"}</h3>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>{isRTL ? "تسجيل الدخول → الحصول على Session ID" : "Login → Get Session ID"}</li>
                <li>{isRTL ? "فحص الوردية → التحقق من وجود وردية مجدولة" : "Check Shift → Verify scheduled shift exists"}</li>
                <li>{isRTL ? "تسجيل الحضور → فتح الوردية برقم أول طلب" : "Check-in → Open shift with first order number"}</li>
                <li>{isRTL ? "إغلاق الوردية → فتح WebView لشاشة الإغلاق" : "Close Shift → Open WebView for closing screen"}</li>
              </ol>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">{isRTL ? "المتطلبات" : "Requirements"}</h3>
              <ul className="space-y-2 text-sm list-disc list-inside">
                <li>{isRTL ? "حساب مستخدم فعال في نظام إدارة" : "Active user account in Edara system"}</li>
                <li>{isRTL ? "وردية مجدولة للمستخدم" : "Scheduled shift assignment for the user"}</li>
                <li>{isRTL ? "اتصال إنترنت" : "Internet connectivity"}</li>
                <li>{isRTL ? "WebView لشاشة إغلاق الوردية" : "WebView support for shift closing screen"}</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Key className="h-4 w-4" />
                {isRTL ? "مصادقة API Key" : "API Key Authentication"}
              </h3>
              <ul className="space-y-2 text-sm list-disc list-inside">
                <li>{isRTL ? "جميع الـ APIs تتطلب API Key مع صلاحية CRM" : "All APIs require an API Key with CRM permission"}</li>
                <li>{isRTL ? "Login: أرسل API Key في header الـ Authorization" : "Login: Send API Key in Authorization header"}</li>
                <li>{isRTL ? "باقي الـ APIs: أرسل API Key في x-api-key و Session في Authorization" : "Other APIs: API Key in x-api-key header, Session in Authorization"}</li>
                <li>{isRTL ? "أنشئ API Key من إعدادات النظام" : "Create API Key from System Configuration"}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API 1: CRM Login */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-600">POST</Badge>
            <CardTitle>{isRTL ? "1. تسجيل الدخول - CRM Login" : "1. CRM Login"}</CardTitle>
          </div>
          <CardDescription>
            {isRTL 
              ? "المصادقة على المستخدم والحصول على Session ID لاستخدامه في باقي الطلبات"
              : "Authenticate user and get Session ID for subsequent requests"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-1">Endpoint</h4>
            <code className="text-sm bg-muted px-3 py-1.5 rounded block">{SUPABASE_FUNCTIONS_URL}/api-crm-login</code>
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "الرؤوس والطلب" : "Headers & Request Body"}</h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`Headers:
  Authorization: ${printApiKey || '{api_key}'}         // API Key with CRM permission
  Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "user_password"
}`}</pre>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "الاستجابة الناجحة" : "Success Response"}</h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`{
  "success": true,
  "session_id": "eyJhbGciOiJI...",    // Use as Bearer token
  "refresh_token": "v1.MjE4ZjQ...",
  "expires_at": 1712345678,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_name": "John Doe",
    "avatar_url": null,
    "roles": ["admin"],
    "permissions": [
      { "parent_menu": "Reports", "menu_item": "tickets", "has_access": true }
    ]
  }
}`}</pre>
          </div>

          <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
            <p className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-yellow-600" />
              <strong>{isRTL ? "ملاحظة أمنية:" : "Security Note:"}</strong>
              {isRTL 
                ? " احفظ session_id بشكل آمن. استخدمه كـ Bearer token في جميع الطلبات اللاحقة."
                : " Store session_id securely. Use it as Bearer token in all subsequent requests."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API 2: Shift Check */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-600">POST</Badge>
            <CardTitle>{isRTL ? "2. فحص الوردية - Shift Check" : "2. Shift Check"}</CardTitle>
          </div>
          <CardDescription>
            {isRTL 
              ? "التحقق مما إذا كان المستخدم لديه وردية مجدولة في الوقت الحالي (±5 دقائق)"
              : "Check if user has a scheduled shift at current time (±5 minutes buffer)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-1">Endpoint</h4>
            <code className="text-sm bg-muted px-3 py-1.5 rounded block">{SUPABASE_FUNCTIONS_URL}/api-crm-shift-check</code>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "الرؤوس" : "Headers"}</h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`x-api-key: ${printApiKey || '{api_key}'}                // API Key with CRM permission
Authorization: Bearer {session_id}  // Session from login
Content-Type: application/json`}</pre>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "حالات الاستجابة" : "Response States"}</h4>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded">
                <Badge variant="default" className="mb-2">open</Badge>
                <p className="text-sm">{isRTL ? "المستخدم لديه وردية مفتوحة بالفعل" : "User already has an open shift session"}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <Badge variant="secondary" className="mb-2">pending</Badge>
                <p className="text-sm">{isRTL ? "المستخدم لديه وردية مجدولة ولم يتم فتحها بعد" : "User has a scheduled shift not yet opened"}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <Badge variant="outline" className="mb-2">closed</Badge>
                <p className="text-sm">{isRTL ? "الوردية تم إغلاقها بالفعل" : "Shift has already been closed"}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <Badge variant="destructive" className="mb-2">no_assignment</Badge>
                <p className="text-sm">{isRTL ? "لا توجد وردية مجدولة اليوم" : "No shift assignment found for today"}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <Badge variant="destructive" className="mb-2">outside_window</Badge>
                <p className="text-sm">{isRTL ? "لا توجد وردية في نافذة الوقت الحالية (±5 دقائق)" : "No shift in current time window (±5 minutes)"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API 3: Shift Check-in */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-600">POST</Badge>
            <CardTitle>{isRTL ? "3. تسجيل الحضور - Shift Check-in" : "3. Shift Check-in"}</CardTitle>
          </div>
          <CardDescription>
            {isRTL 
              ? "فتح الوردية وتسجيل الحضور تلقائياً مع رقم أول طلب Purple و Salla"
              : "Open shift and auto-record attendance with Purple and Salla first order numbers"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-1">Endpoint</h4>
            <code className="text-sm bg-muted px-3 py-1.5 rounded block">{SUPABASE_FUNCTIONS_URL}/api-crm-shift-checkin</code>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "الطلب" : "Request"}</h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`Headers:
  x-api-key: {api_key}                // API Key with CRM permission
  Authorization: Bearer {session_id}  // Session from login
  Content-Type: application/json

Body:
{
  "first_order_number": "PRP-12345",       // Required: Purple first order
  "salla_first_order_number": "SLA-67890"  // Optional: Salla first order
}`}</pre>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "الاستجابة الناجحة" : "Success Response"}</h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`{
  "success": true,
  "shift_session_id": "uuid",
  "shift_reference": "uuid",     // Use this as shift reference
  "shift_assignment_id": "uuid",
  "shift_name": "Morning Shift",
  "shift_start_time": "08:00:00",
  "shift_end_time": "16:00:00",
  "shift_type": "sales",
  "assignment_date": "2026-04-01",
  "first_order_number": "PRP-12345",
  "salla_first_order_number": "SLA-67890",
  "opened_at": "2026-04-01T08:00:00.000Z"
}`}</pre>
          </div>

          <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <p className="text-sm">
              <strong>{isRTL ? "أخطاء محتملة:" : "Possible Errors:"}</strong>
            </p>
            <ul className="text-sm list-disc list-inside mt-1 space-y-1">
              <li><code>409</code> - {isRTL ? "المستخدم لديه وردية مفتوحة بالفعل" : "User already has an open shift"}</li>
              <li><code>404</code> - {isRTL ? "لا توجد وردية مجدولة" : "No shift assignment found"}</li>
              <li><code>400</code> - {isRTL ? "لا توجد وردية صالحة للوقت الحالي" : "No valid shift for current time"}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* WebView: Close Shift */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5" />
            <CardTitle>{isRTL ? "4. إغلاق الوردية - WebView" : "4. Close Shift - WebView"}</CardTitle>
          </div>
          <CardDescription>
            {isRTL 
              ? "استخدام WebView لفتح شاشة إغلاق الوردية مباشرة بدون تسجيل دخول إضافي"
              : "Use WebView to open shift closing screen directly without additional login"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <h4 className="font-medium mb-2">{isRTL ? "كيفية العمل" : "How It Works"}</h4>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>
                {isRTL 
                  ? "بعد تسجيل الدخول عبر API، احفظ session_id و refresh_token"
                  : "After API login, store session_id and refresh_token"}
              </li>
              <li>
                {isRTL 
                  ? "عند الضغط على زر إغلاق الوردية، افتح WebView مع URL الشاشة"
                  : "When user clicks close shift, open WebView with the screen URL"}
              </li>
              <li>
                {isRTL 
                  ? "قبل فتح WebView، قم بتعيين الجلسة في localStorage عبر JavaScript injection"
                  : "Before opening WebView, set session in localStorage via JavaScript injection"}
              </li>
              <li>
                {isRTL 
                  ? "النظام سيتعرف على المستخدم تلقائياً ويعرض شاشة إغلاق الوردية"
                  : "System will auto-recognize the user and show shift closing screen"}
              </li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">{isRTL ? "رابط WebView" : "WebView URL"}</h4>
            <code className="text-sm bg-muted px-3 py-1.5 rounded block break-all">
              {APP_URL}/shift-session
            </code>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">
              {isRTL ? "تعيين الجلسة عبر JavaScript" : "Set Session via JavaScript"}
            </h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`// Inject this JavaScript before loading the WebView URL
// This sets the Supabase auth session so the user is auto-logged in

const sessionData = {
  access_token: "{session_id}",           // From CRM Login API
  refresh_token: "{refresh_token}",       // From CRM Login API
  expires_at: {expires_at},               // From CRM Login API
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "{user_id}",                      // From CRM Login API
    email: "{user_email}",
    aud: "authenticated",
    role: "authenticated"
  }
};

// Set in localStorage (Supabase auth storage key)
const storageKey = "sb-ysqqnkbgkrjoxrzlejxy-auth-token";
localStorage.setItem(storageKey, JSON.stringify(sessionData));

// Then navigate to: ${APP_URL}/shift-session`}</pre>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">
              {isRTL ? "مثال Android (Kotlin)" : "Android Example (Kotlin)"}
            </h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`val webView = WebView(context)
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true

// Set session before loading URL
val jsCode = """
  localStorage.setItem(
    'sb-ysqqnkbgkrjoxrzlejxy-auth-token',
    JSON.stringify($sessionJson)
  );
""".trimIndent()

webView.evaluateJavascript(jsCode) {
  webView.loadUrl("${APP_URL}/shift-session")
}`}</pre>
          </div>

          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">
              {isRTL ? "مثال iOS (Swift)" : "iOS Example (Swift)"}
            </h4>
            <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">{`import WebKit

let webView = WKWebView()

let jsCode = """
localStorage.setItem(
  'sb-ysqqnkbgkrjoxrzlejxy-auth-token',
  JSON.stringify(\(sessionJson))
);
"""

webView.evaluateJavaScript(jsCode) { _, _ in
  let url = URL(string: "${APP_URL}/shift-session")!
  webView.load(URLRequest(url: url))
}`}</pre>
          </div>

          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <p className="text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              <strong>{isRTL ? "ملاحظة:" : "Note:"}</strong>
              {isRTL 
                ? " تأكد من تفعيل DOM Storage في WebView لكي تعمل localStorage. الشاشة ستعرض تلقائياً وردية المستخدم المفتوحة مع إمكانية رفع صور الإغلاق وإدخال أرقام الإغلاق."
                : " Ensure DOM Storage is enabled in WebView for localStorage to work. The screen will automatically show the user's open shift with options to upload closing images and enter closing numbers."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Integration Flow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            {isRTL ? "تدفق التكامل الكامل" : "Complete Integration Flow"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <Badge className="bg-blue-600 shrink-0">Step 1</Badge>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-sm">POST /api-crm-login</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "تسجيل الدخول → الحصول على session_id" : "Login → Get session_id"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <Badge className="bg-blue-600 shrink-0">Step 2</Badge>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-sm">POST /api-crm-shift-check</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "فحص الوردية → التحقق من has_shift و shift_status" : "Check shift → Verify has_shift and shift_status"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <Badge className="bg-green-600 shrink-0">Step 3</Badge>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-sm">POST /api-crm-shift-checkin</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "فتح الوردية → الحصول على shift_reference" : "Open shift → Get shift_reference"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <Badge className="bg-purple-600 shrink-0">Step 4</Badge>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium text-sm">WebView → /shift-session</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "فتح شاشة إغلاق الوردية مع تعيين الجلسة" : "Open shift closing screen with session set"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isRTL ? "معالجة الأخطاء" : "Error Handling"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{isRTL ? "الرمز" : "Code"}</th>
                  <th className="text-left p-2">{isRTL ? "الحالة" : "Status"}</th>
                  <th className="text-left p-2">{isRTL ? "الوصف" : "Description"}</th>
                  <th className="text-left p-2">{isRTL ? "الإجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2"><code>401</code></td>
                  <td className="p-2">Unauthorized</td>
                  <td className="p-2">{isRTL ? "جلسة منتهية أو بيانات خاطئة" : "Expired session or invalid credentials"}</td>
                  <td className="p-2">{isRTL ? "أعد تسجيل الدخول" : "Re-login"}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2"><code>400</code></td>
                  <td className="p-2">Bad Request</td>
                  <td className="p-2">{isRTL ? "بيانات ناقصة أو غير صحيحة" : "Missing or invalid data"}</td>
                  <td className="p-2">{isRTL ? "تحقق من الحقول المطلوبة" : "Check required fields"}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2"><code>404</code></td>
                  <td className="p-2">Not Found</td>
                  <td className="p-2">{isRTL ? "لا توجد وردية مجدولة" : "No shift assignment"}</td>
                  <td className="p-2">{isRTL ? "تأكد من جدول الورديات" : "Verify shift schedule"}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2"><code>409</code></td>
                  <td className="p-2">Conflict</td>
                  <td className="p-2">{isRTL ? "وردية مفتوحة بالفعل" : "Shift already open"}</td>
                  <td className="p-2">{isRTL ? "استخدم WebView للإغلاق أولاً" : "Use WebView to close first"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {isRTL ? "إدارة الجلسة" : "Session Management"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-muted rounded">
            <h4 className="font-medium text-sm mb-1">{isRTL ? "مدة الجلسة" : "Session Duration"}</h4>
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? "الجلسة صالحة لمدة ساعة واحدة. استخدم refresh_token لتجديد الجلسة قبل انتهائها."
                : "Session is valid for 1 hour. Use refresh_token to renew before expiry."}
            </p>
          </div>
          <div className="p-3 bg-muted rounded">
            <h4 className="font-medium text-sm mb-1">{isRTL ? "تجديد الجلسة" : "Token Refresh"}</h4>
            <pre className="text-sm mt-2 overflow-x-auto">{`// Check if session is about to expire
if (Date.now() / 1000 > expires_at - 300) {
  // Refresh 5 minutes before expiry
  // Re-login using api-crm-login
}`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CRMIntegrationDoc;
