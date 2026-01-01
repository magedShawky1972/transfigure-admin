import { useState, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Upload, Phone, FileKey, CheckCircle, Loader2 } from "lucide-react";

interface CertificateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  type: "missing" | "expired";
}

const CertificateUploadDialog = ({
  open,
  onOpenChange,
  userId,
  onSuccess,
  type,
}: CertificateUploadDialogProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    code?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDeviceFingerprint = (): string => {
    const stored = localStorage.getItem('device_fingerprint');
    if (stored) return stored;
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    const fingerprint = btoa(JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      renderer: renderer,
      timestamp: Date.now()
    })).slice(0, 64);
    
    localStorage.setItem('device_fingerprint', fingerprint);
    return fingerprint;
  };

  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      if (/iPhone/.test(ua)) return 'iPhone';
      if (/iPad/.test(ua)) return 'iPad';
      if (/Android/.test(ua)) return 'Android Device';
      return 'Mobile Device';
    }
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux PC';
    return 'Unknown Device';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".cert")) {
      toast({
        title: language === "ar" ? "ملف غير صالح" : "Invalid File",
        description: language === "ar" 
          ? "يرجى اختيار ملف شهادة (.cert)" 
          : "Please select a certificate file (.cert)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setValidationResult(null);

    try {
      const content = await file.text();
      const deviceFingerprint = getDeviceFingerprint();
      const deviceName = getDeviceName();
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      const { data, error } = await supabase.functions.invoke("validate-user-certificate", {
        body: { 
          certificate: content, 
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: deviceName,
          device_info: deviceInfo
        },
      });

      if (error) throw error;

      setValidationResult(data);

      if (data.valid) {
        toast({
          title: language === "ar" ? "تم التحقق بنجاح" : "Verification Successful",
          description: language === "ar" 
            ? "تم التحقق من الشهادة بنجاح" 
            : "Certificate verified successfully",
        });
        
        // Store validation in session
        sessionStorage.setItem("certificate_validated", "true");
        sessionStorage.setItem("certificate_validated_at", new Date().toISOString());
        
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        toast({
          title: language === "ar" ? "فشل التحقق" : "Verification Failed",
          description: data.error || (language === "ar" ? "الشهادة غير صالحة" : "Invalid certificate"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Certificate validation error:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في التحقق من الشهادة" : "Failed to validate certificate",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={language === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {type === "missing" 
              ? (language === "ar" ? "الشهادة مطلوبة" : "Certificate Required")
              : (language === "ar" ? "الشهادة منتهية" : "Certificate Expired")}
          </DialogTitle>
          <DialogDescription>
            {type === "missing"
              ? (language === "ar" 
                  ? "يجب عليك رفع شهادة الأمان الخاصة بك للمتابعة." 
                  : "You must upload your security certificate to continue.")
              : (language === "ar"
                  ? "انتهت صلاحية شهادتك. يرجى رفع شهادة جديدة أو الاتصال بالمسؤول."
                  : "Your certificate has expired. Please upload a new one or contact administrator.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {validationResult?.valid ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <CheckCircle className="h-16 w-16 mb-4" />
              <p className="font-medium">
                {language === "ar" ? "تم التحقق بنجاح!" : "Verified Successfully!"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {language === "ar" ? "جاري التحويل..." : "Redirecting..."}
              </p>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".cert"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span>{language === "ar" ? "جاري التحقق..." : "Validating..."}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileKey className="h-8 w-8" />
                    <span>{language === "ar" ? "اختر ملف الشهادة (.cert)" : "Select Certificate File (.cert)"}</span>
                  </div>
                )}
              </Button>

              {validationResult && !validationResult.valid && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">
                    {validationResult.error}
                  </p>
                  {validationResult.code === "EXPIRED" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "ar" 
                        ? "يرجى الحصول على شهادة جديدة من المسؤول"
                        : "Please get a new certificate from your administrator"}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {language === "ar" 
                    ? "ليس لديك شهادة؟ تواصل مع المسؤول:"
                    : "Don't have a certificate? Contact administrator:"}
                </p>
                <Button variant="secondary" className="w-full" asChild>
                  <a href="tel:+966500000000">
                    <Phone className="h-4 w-4 mr-2" />
                    {language === "ar" ? "اتصل بالدعم" : "Call Support"}
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CertificateUploadDialog;
