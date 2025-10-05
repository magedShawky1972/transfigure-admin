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
    
    // Dashboard
    "dashboard.welcome": "Welcome to",
    "dashboard.subtitle": "Your comprehensive data management solution",
    "dashboard.excelSheets": "Excel Sheets",
    "dashboard.excelSheets.desc": "Import and manage your Excel data",
    "dashboard.apiConfig": "API Configuration",
    "dashboard.apiConfig.desc": "Configure external API connections",
    "dashboard.tableGen": "Table Generator",
    "dashboard.tableGen.desc": "Create and customize database tables",
    "dashboard.reports": "Reports",
    "dashboard.reports.desc": "View and analyze your data",
    "dashboard.quickStart": "Quick Start Guide",
    "dashboard.quickStart.1": "Configure your API connections in API Configuration",
    "dashboard.quickStart.2": "Set up Excel sheet mappings in Excel Setup",
    "dashboard.quickStart.3": "Create database tables in Table Generator",
    "dashboard.quickStart.4": "Import your data in Load Data From Excel",
    "dashboard.quickStart.5": "View and analyze reports in Reports section",
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
    
    // Dashboard
    "dashboard.welcome": "مرحبا بك في",
    "dashboard.subtitle": "الحل الشامل لإدارة البيانات",
    "dashboard.excelSheets": "ملفات Excel",
    "dashboard.excelSheets.desc": "استيراد وإدارة بيانات Excel",
    "dashboard.apiConfig": "إعدادات API",
    "dashboard.apiConfig.desc": "تكوين اتصالات API الخارجية",
    "dashboard.tableGen": "منشئ الجداول",
    "dashboard.tableGen.desc": "إنشاء وتخصيص جداول قاعدة البيانات",
    "dashboard.reports": "التقارير",
    "dashboard.reports.desc": "عرض وتحليل بياناتك",
    "dashboard.quickStart": "دليل البدء السريع",
    "dashboard.quickStart.1": "قم بتكوين اتصالات API في إعدادات API",
    "dashboard.quickStart.2": "قم بإعداد تعيينات ملفات Excel في إعدادات Excel",
    "dashboard.quickStart.3": "قم بإنشاء جداول قاعدة البيانات في منشئ الجداول",
    "dashboard.quickStart.4": "قم باستيراد بياناتك في تحميل البيانات من Excel",
    "dashboard.quickStart.5": "عرض وتحليل التقارير في قسم التقارير",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language || "en";
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