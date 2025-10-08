import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Header
    "app.name": "Edara",
    "theme.toggle": "Toggle theme",
    "language.toggle": "Toggle language",
    
    // Sidebar Groups
    "sidebar.reports": "Report & Dashboard",
    "sidebar.entry": "Entry",
    "sidebar.setup": "Setup",
    "sidebar.admin": "Admin",
    
    // Menu Items
    "menu.dashboard": "Dashboard",
    "menu.reports": "Reports",
    "menu.transactions": "Transaction Data",
    "menu.loadData": "Load Data From Excel",
    "menu.clearData": "Clear Data",
    "menu.reportsSetup": "Reports Setup",
    "menu.apiConfig": "API Configuration",
    "menu.excelSetup": "Excel Setup",
    "menu.tableConfig": "Table Configuration",
    
    // Dashboard - Sales Analytics
    "dashboard.title": "Sales Dashboard",
    "dashboard.subtitle": "Sales Overview",
    "dashboard.totalSales": "Total Sales",
    "dashboard.totalProfit": "Total Profit",
    "dashboard.transactions": "Transactions",
    "dashboard.avgOrderValue": "Avg Order Value",
    "dashboard.salesTrend": "Sales Trend",
    "dashboard.topBrands": "Top Brands by Sales",
    "dashboard.topCategories": "Top 5 Product Categories",
    "dashboard.topProducts": "Top 10 Products",
    "dashboard.paymentMethods": "Payment Methods",
    "dashboard.paymentBrands": "Payment Brands",
    "dashboard.monthComparison": "Monthly Comparison",
    "dashboard.productSummary": "Product Sales Summary",
    "dashboard.incomeStatement": "Income Statement",
    "dashboard.recentTransactions": "Recent Transactions",
    "dashboard.date": "Date",
    "dashboard.customer": "Customer",
    "dashboard.brand": "Brand",
    "dashboard.product": "Product",
    "dashboard.category": "Category",
    "dashboard.amount": "Amount",
    "dashboard.profit": "Profit",
    "dashboard.sales": "Sales",
    "dashboard.viewAll": "View All Transactions",
    "dashboard.loading": "Loading dashboard data...",
    "dashboard.noData": "No sales data available",
    "dashboard.yesterday": "Yesterday",
    "dashboard.thisMonth": "This Month",
    "dashboard.lastMonth": "Last Month",
    "dashboard.dateRange": "Date Range",
    "dashboard.from": "From",
    "dashboard.to": "To",
    "dashboard.apply": "Apply",
    "dashboard.couponSales": "Coupon Sales",
    "dashboard.salesPlusCoupon": "Sales + Coupon",
    "dashboard.costOfSales": "Cost Of Sales",
    "dashboard.ePaymentCharges": "E-Payment Charges",
    "dashboard.netSales": "Net Sales",
    "dashboard.totalSalesWithDiscount": "Total Sales (Including Discounts)",
    "dashboard.discountCoupons": "Discount Coupons",
    "dashboard.shipping": "Shipping",
    "dashboard.taxes": "Taxes",
    "dashboard.customerPurchases": "Customer Purchases Summary",
    "dashboard.customerName": "Customer Name",
    "dashboard.totalValue": "Total Value",
    "dashboard.transactionCount": "Transaction Count",
    "dashboard.filterProduct": "Filter by Product",
    "dashboard.filterCategory": "Filter by Category",
    "dashboard.filterBrand": "Filter by Brand",
    "dashboard.filterCustomer": "Filter by Customer",
    "dashboard.allProducts": "All Products",
    "dashboard.allCategories": "All Categories",
    "dashboard.allBrands": "All Brands",
    "dashboard.allCustomers": "All Customers",
    "dashboard.quantity": "Quantity",
    "dashboard.loadingInitializing": "Initializing...",
    "dashboard.loadingTransactions": "Loading transactions...",
    "dashboard.loadingCalculatingStats": "Calculating statistics...",
    "dashboard.loadingProcessingData": "Processing data...",
    "dashboard.loadingCompleting": "Completing...",
    
    // Transactions Page
    "transactions.title": "All Transactions",
    "transactions.subtitle": "View and manage transaction data",
    "transactions.export": "Export",
    "transactions.search": "Search transactions...",
    "transactions.orderNumber": "Order Number",
    "transactions.userName": "User Name",
    "transactions.paymentMethod": "Payment Method",
    "transactions.paymentType": "Payment Type",
    "transactions.customerPhone": "Customer Phone",
    "transactions.costPrice": "Cost Price",
    "transactions.unitPrice": "Unit Price",
    "transactions.costSold": "Cost Sold",
    "transactions.qty": "Qty",
    "transactions.coinsNumber": "Coins Number",
    
    // Clear Data Page
    "clearData.title": "Clear Data",
    "clearData.subtitle": "Delete data from tables by date range",
    "clearData.selectTable": "Select Table",
    "clearData.selectTablePlaceholder": "Choose a table...",
    "clearData.fromDate": "From Date",
    "clearData.toDate": "To Date",
    "clearData.clearButton": "Clear Data",
    "clearData.confirmTitle": "Confirm Data Deletion",
    "clearData.confirmMessage": "Are you sure you want to delete all records from {table} between {fromDate} and {toDate}? This action cannot be undone.",
    "clearData.cancel": "Cancel",
    "clearData.confirm": "Confirm Delete",
    "clearData.success": "Data cleared successfully",
    "clearData.error": "Error clearing data",
    "clearData.selectTableFirst": "Please select a table first",
    "clearData.selectDates": "Please select both from and to dates",
  },
  ar: {
    // Header
    "app.name": "إدارة",
    "theme.toggle": "تبديل السمة",
    "language.toggle": "تبديل اللغة",
    
    // Sidebar Groups
    "sidebar.reports": "التقارير ولوحة التحكم",
    "sidebar.entry": "الإدخال",
    "sidebar.setup": "الإعداد",
    "sidebar.admin": "الإدارة",
    
    // Menu Items
    "menu.dashboard": "لوحة التحكم",
    "menu.reports": "التقارير",
    "menu.transactions": "بيانات المعاملات",
    "menu.loadData": "تحميل البيانات من Excel",
    "menu.clearData": "حذف البيانات",
    "menu.reportsSetup": "إعداد التقارير",
    "menu.apiConfig": "إعدادات API",
    "menu.excelSetup": "إعدادات Excel",
    "menu.tableConfig": "إعدادات الجداول",
    
    // Dashboard - Sales Analytics
    "dashboard.title": "لوحة المبيعات",
    "dashboard.subtitle": "نظرة عامة على المبيعات",
    "dashboard.totalSales": "إجمالي المبيعات",
    "dashboard.totalProfit": "إجمالي الأرباح",
    "dashboard.transactions": "المعاملات",
    "dashboard.avgOrderValue": "متوسط قيمة الطلب",
    "dashboard.salesTrend": "اتجاه المبيعات",
    "dashboard.topBrands": "أفضل العلامات التجارية",
    "dashboard.topCategories": "أفضل 5 فئات منتجات",
    "dashboard.topProducts": "أفضل 10 منتجات",
    "dashboard.paymentMethods": "طرق الدفع",
    "dashboard.paymentBrands": "علامات الدفع التجارية",
    "dashboard.monthComparison": "مقارنة شهرية",
    "dashboard.productSummary": "ملخص مبيعات المنتجات",
    "dashboard.incomeStatement": "قائمة الدخل",
    "dashboard.recentTransactions": "المعاملات الأخيرة",
    "dashboard.date": "التاريخ",
    "dashboard.customer": "العميل",
    "dashboard.brand": "العلامة التجارية",
    "dashboard.product": "المنتج",
    "dashboard.category": "الفئة",
    "dashboard.amount": "المبلغ",
    "dashboard.profit": "الربح",
    "dashboard.sales": "المبيعات",
    "dashboard.viewAll": "عرض جميع المعاملات",
    "dashboard.loading": "جاري تحميل بيانات لوحة التحكم...",
    "dashboard.noData": "لا توجد بيانات مبيعات متاحة",
    "dashboard.yesterday": "أمس",
    "dashboard.thisMonth": "هذا الشهر",
    "dashboard.lastMonth": "الشهر الماضي",
    "dashboard.dateRange": "نطاق التاريخ",
    "dashboard.from": "من",
    "dashboard.to": "إلى",
    "dashboard.apply": "تطبيق",
    "dashboard.couponSales": "مبيعات الكوبونات",
    "dashboard.salesPlusCoupon": "المبيعات + الكوبونات",
    "dashboard.costOfSales": "تكلفة المبيعات",
    "dashboard.ePaymentCharges": "رسوم الدفع الإلكتروني",
    "dashboard.netSales": "صافي المبيعات",
    "dashboard.totalSalesWithDiscount": "إجمالي المبيعات (تشمل التخفيضات)",
    "dashboard.discountCoupons": "كوبونات التخفيض",
    "dashboard.shipping": "الشحن",
    "dashboard.taxes": "الضرائب",
    "dashboard.customerPurchases": "ملخص مشتريات العملاء",
    "dashboard.customerName": "اسم العميل",
    "dashboard.totalValue": "القيمة الإجمالية",
    "dashboard.transactionCount": "عدد المعاملات",
    "dashboard.filterProduct": "تصفية حسب المنتج",
    "dashboard.filterCategory": "تصفية حسب الفئة",
    "dashboard.filterBrand": "تصفية حسب العلامة التجارية",
    "dashboard.filterCustomer": "تصفية حسب العميل",
    "dashboard.allProducts": "جميع المنتجات",
    "dashboard.allCategories": "جميع الفئات",
    "dashboard.allBrands": "جميع العلامات التجارية",
    "dashboard.allCustomers": "جميع العملاء",
    "dashboard.quantity": "الكمية",
    "dashboard.loadingInitializing": "جاري التهيئة...",
    "dashboard.loadingTransactions": "جاري تحميل المعاملات...",
    "dashboard.loadingCalculatingStats": "جاري حساب الإحصائيات...",
    "dashboard.loadingProcessingData": "جاري معالجة البيانات...",
    "dashboard.loadingCompleting": "جاري الإنهاء...",
    
    // Transactions Page
    "transactions.title": "جميع المعاملات",
    "transactions.subtitle": "عرض وإدارة بيانات المعاملات",
    "transactions.export": "تصدير",
    "transactions.search": "البحث في المعاملات...",
    "transactions.orderNumber": "رقم الطلب",
    "transactions.userName": "اسم المستخدم",
    "transactions.paymentMethod": "طريقة الدفع",
    "transactions.paymentType": "نوع الدفع",
    "transactions.customerPhone": "هاتف العميل",
    "transactions.costPrice": "سعر التكلفة",
    "transactions.unitPrice": "سعر الوحدة",
    "transactions.costSold": "التكلفة المباعة",
    "transactions.qty": "الكمية",
    "transactions.coinsNumber": "رقم العملات",
    
    // Clear Data Page
    "clearData.title": "حذف البيانات",
    "clearData.subtitle": "حذف البيانات من الجداول حسب نطاق التاريخ",
    "clearData.selectTable": "اختر الجدول",
    "clearData.selectTablePlaceholder": "اختر جدولاً...",
    "clearData.fromDate": "من تاريخ",
    "clearData.toDate": "إلى تاريخ",
    "clearData.clearButton": "حذف البيانات",
    "clearData.confirmTitle": "تأكيد حذف البيانات",
    "clearData.confirmMessage": "هل أنت متأكد من حذف جميع السجلات من {table} بين {fromDate} و {toDate}؟ لا يمكن التراجع عن هذا الإجراء.",
    "clearData.cancel": "إلغاء",
    "clearData.confirm": "تأكيد الحذف",
    "clearData.success": "تم حذف البيانات بنجاح",
    "clearData.error": "خطأ في حذف البيانات",
    "clearData.selectTableFirst": "الرجاء اختيار جدول أولاً",
    "clearData.selectDates": "الرجاء اختيار كلا التاريخين (من وإلى)",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ar");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language || "ar";
    setLanguage(savedLanguage);
    document.documentElement.setAttribute("lang", savedLanguage);
    document.documentElement.setAttribute("dir", savedLanguage === "ar" ? "rtl" : "ltr");
  }, []);

  const toggleLanguage = () => {
    const newLanguage: Language = language === "en" ? "ar" : "en";
    setLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
    document.documentElement.setAttribute("lang", newLanguage);
    document.documentElement.setAttribute("dir", newLanguage === "ar" ? "rtl" : "ltr");
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}