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
    "menu.reportsSetup": "Reports Setup",
    "menu.apiConfig": "API Configuration",
    "menu.excelSetup": "Excel Setup",
    "menu.tableConfig": "Table Configuration",
    
    // Dashboard - Sales Analytics
    "dashboard.title": "Sales Dashboard",
    "dashboard.subtitle": "September Sales Overview",
    "dashboard.totalSales": "Total Sales",
    "dashboard.totalProfit": "Total Profit",
    "dashboard.transactions": "Transactions",
    "dashboard.avgOrderValue": "Avg Order Value",
    "dashboard.salesTrend": "Sales Trend",
    "dashboard.topBrands": "Top Brands by Sales",
    "dashboard.paymentMethods": "Payment Methods",
    "dashboard.recentTransactions": "Recent Transactions",
    "dashboard.date": "Date",
    "dashboard.customer": "Customer",
    "dashboard.brand": "Brand",
    "dashboard.product": "Product",
    "dashboard.amount": "Amount",
    "dashboard.profit": "Profit",
    "dashboard.viewAll": "View All Transactions",
    "dashboard.loading": "Loading dashboard data...",
    "dashboard.noData": "No sales data available",
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
    "menu.reportsSetup": "إعداد التقارير",
    "menu.apiConfig": "إعدادات API",
    "menu.excelSetup": "إعدادات Excel",
    "menu.tableConfig": "إعدادات الجداول",
    
    // Dashboard - Sales Analytics
    "dashboard.title": "لوحة المبيعات",
    "dashboard.subtitle": "نظرة عامة على مبيعات سبتمبر",
    "dashboard.totalSales": "إجمالي المبيعات",
    "dashboard.totalProfit": "إجمالي الأرباح",
    "dashboard.transactions": "المعاملات",
    "dashboard.avgOrderValue": "متوسط قيمة الطلب",
    "dashboard.salesTrend": "اتجاه المبيعات",
    "dashboard.topBrands": "أفضل العلامات التجارية",
    "dashboard.paymentMethods": "طرق الدفع",
    "dashboard.recentTransactions": "المعاملات الأخيرة",
    "dashboard.date": "التاريخ",
    "dashboard.customer": "العميل",
    "dashboard.brand": "العلامة التجارية",
    "dashboard.product": "المنتج",
    "dashboard.amount": "المبلغ",
    "dashboard.profit": "الربح",
    "dashboard.viewAll": "عرض جميع المعاملات",
    "dashboard.loading": "جاري تحميل بيانات لوحة التحكم...",
    "dashboard.noData": "لا توجد بيانات مبيعات متاحة",
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