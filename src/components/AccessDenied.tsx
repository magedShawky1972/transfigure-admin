import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ShieldX, RefreshCw } from "lucide-react";

interface AccessDeniedProps {
  isLoading?: boolean;
}

export const AccessDenied = ({ isLoading = false }: AccessDeniedProps) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <ShieldX className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold text-destructive">
        {language === "ar" ? "الوصول مرفوض" : "Access Denied"}
      </h1>
      <p className="text-muted-foreground text-center max-w-md">
        {language === "ar" 
          ? "ليس لديك صلاحية للوصول إلى هذه الصفحة. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ."
          : "You don't have permission to access this page. Please contact your system administrator if you believe this is an error."}
      </p>
      <Button onClick={() => navigate("/")} variant="outline">
        {language === "ar" ? "العودة للرئيسية" : "Go to Home"}
      </Button>
    </div>
  );
};
