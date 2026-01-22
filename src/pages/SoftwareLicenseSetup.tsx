import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown, FileText, Calendar, Download, History, RotateCcw, Save, X, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "ERP", label: "ERP", labelAr: "نظام تخطيط موارد المؤسسة" },
  { value: "Dev Tools", label: "Dev Tools", labelAr: "أدوات التطوير" },
  { value: "Cloud Services", label: "Cloud Services", labelAr: "الخدمات السحابية" },
  { value: "Security", label: "Security", labelAr: "الأمان" },
  { value: "Productivity", label: "Productivity", labelAr: "الإنتاجية" },
  { value: "Design", label: "Design", labelAr: "التصميم" },
  { value: "Communication", label: "Communication", labelAr: "التواصل" },
  { value: "Analytics", label: "Analytics", labelAr: "التحليلات" },
  { value: "Domain", label: "Domain", labelAr: "النطاق" },
  { value: "Email", label: "Email", labelAr: "البريد الإلكتروني" },
  { value: "Other", label: "Other", labelAr: "أخرى" }
];

const RENEWAL_CYCLES = [
  { value: "monthly", label: "Monthly", labelAr: "شهرياً" },
  { value: "yearly", label: "Yearly", labelAr: "سنوياً" },
  { value: "one-time", label: "One-time", labelAr: "لمرة واحدة" }
];

const PAYMENT_METHODS = [
  { value: "visa", label: "Visa", labelAr: "فيزا" },
  { value: "master", label: "Master", labelAr: "ماستر" },
  { value: "safi", label: "Safi", labelAr: "صافي" },
  { value: "cash", label: "Cash", labelAr: "نقدي" }
];

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar: string | null;
  is_base: boolean;
}

interface CurrencyRate {
  currency_id: string;
  rate_to_base: number;
}

interface Department {
  id: string;
  department_name: string;
  department_code: string;
}

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface User {
  id: string;
  user_name: string;
  email: string;
}

interface SoftwareLicense {
  id: string;
  software_name: string;
  version: string | null;
  license_key: string | null;
  vendor_provider: string;
  category: string;
  purchase_date: string;
  expiry_date: string | null;
  renewal_cycle: string;
  cost: number;
  status: string;
  assigned_to: string | null;
  assigned_department: string | null;
  currency_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
}

interface LicenseInvoice {
  id: string;
  license_id: string;
  invoice_date: string;
  file_path: string;
  file_name: string | null;
  notes: string | null;
  created_at: string;
  extracted_cost: number | null;
  cost_currency: string | null;
  cost_sar: number | null;
  ai_extraction_status: string | null;
  ai_extraction_error: string | null;
}

const SoftwareLicenseSetup = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [filteredLicenses, setFilteredLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [renewalCycleFilter, setRenewalCycleFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<keyof SoftwareLicense | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(PAYMENT_METHODS.map(pm => pm.value));
  const [openPaymentCombo, setOpenPaymentCombo] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  
  // Invoice upload state
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [licenseInvoices, setLicenseInvoices] = useState<LicenseInvoice[]>([]);
  
  // Invoice editing state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoiceData, setEditingInvoiceData] = useState<{
    extracted_cost: string;
    cost_currency: string;
    cost_sar: string;
  }>({ extracted_cost: "", cost_currency: "", cost_sar: "" });

  const [formData, setFormData] = useState({
    software_name: "",
    version: "",
    license_key: "",
    vendor_provider: "",
    vendor_portal_url: "",
    category: "",
    purchase_date: "",
    expiry_date: "",
    renewal_cycle: "yearly",
    notification_days: [7, 30],
    cost: "",
    payment_method: "",
    assigned_to: "",
    assigned_department: "",
    cost_center_id: "",
    project_id: "",
    invoice_file_path: "",
    notes: "",
    status: "active",
    currency_id: "",
    domain_name: "",
    mails: "",
  });

  useEffect(() => {
    fetchLicenses();
    fetchDepartments();
    fetchCostCenters();
    fetchProjects();
    fetchUsers();
    fetchCurrencies();
    fetchCurrencyRates();
  }, []);

  useEffect(() => {
    filterAndSortLicenses();
  }, [licenses, searchQuery, statusFilter, categoryFilter, renewalCycleFilter, sortColumn, sortDirection]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name, department_code")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, cost_center_code, cost_center_name, cost_center_name_ar")
        .eq("is_active", true)
        .order("cost_center_code");

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error: any) {
      console.error("Error fetching cost centers:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("id, currency_code, currency_name, currency_name_ar, is_base")
        .eq("is_active", true)
        .order("is_base", { ascending: false });

      if (error) throw error;
      setCurrencies(data || []);
      
      // Set default currency to base currency if available
      const baseCurrency = data?.find(c => c.is_base);
      if (baseCurrency && !formData.currency_id) {
        setFormData(prev => ({ ...prev, currency_id: baseCurrency.id }));
      }
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchCurrencyRates = async () => {
    try {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("currency_id, rate_to_base")
        .order("effective_date", { ascending: false });

      if (error) throw error;

      // Get latest rate for each currency
      const latestRates: CurrencyRate[] = [];
      const seen = new Set<string>();
      for (const rate of data || []) {
        if (!seen.has(rate.currency_id)) {
          latestRates.push(rate);
          seen.add(rate.currency_id);
        }
      }
      setCurrencyRates(latestRates);
    } catch (error: any) {
      console.error("Error fetching currency rates:", error);
    }
  };

  const fetchLicenseInvoices = async (licenseId: string) => {
    try {
      const { data, error } = await supabase
        .from("software_license_invoices")
        .select("*")
        .eq("license_id", licenseId)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setLicenseInvoices((data || []) as LicenseInvoice[]);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
    }
  };

  const getBaseCurrency = () => currencies.find(c => c.is_base);

  const convertToBaseCurrency = (cost: number, currencyId: string | null): number => {
    const baseCurrency = getBaseCurrency();
    if (!currencyId || !baseCurrency) return cost;
    if (currencyId === baseCurrency.id) return cost;

    const rate = currencyRates.find(r => r.currency_id === currencyId);
    if (rate && rate.rate_to_base > 0) {
      return cost / rate.rate_to_base;
    }
    return cost;
  };

  // Get unique categories from licenses for filter
  const uniqueCategories = Array.from(new Set(licenses.map(l => l.category).filter(Boolean)));

  const filterAndSortLicenses = () => {
    let filtered = [...licenses];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (license) =>
          license.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.vendor_provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((license) => license.status === statusFilter);
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((license) => license.category === categoryFilter);
    }

    // Apply renewal cycle filter
    if (renewalCycleFilter !== "all") {
      filtered = filtered.filter((license) => license.renewal_cycle === renewalCycleFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    setFilteredLicenses(filtered);
  };

  const handleSort = (column: keyof SoftwareLicense) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with ascending direction
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: keyof SoftwareLicense) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!invoiceDate) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى تحديد تاريخ الفاتورة أولاً" : "Please select invoice date first",
        variant: "destructive",
      });
      return;
    }

    if (!editingLicenseId) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يجب حفظ الترخيص أولاً قبل رفع الفواتير" : "Please save the license first before uploading invoices",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const publicId = `license-invoices/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { 
          imageBase64: base64, 
          folder: "Edara_Images",
          publicId 
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error("Failed to get URL from Cloudinary");

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save invoice to database
      const { data: insertedInvoice, error: insertError } = await supabase
        .from("software_license_invoices")
        .insert({
          license_id: editingLicenseId,
          invoice_date: invoiceDate,
          file_path: uploadData.url,
          file_name: file.name,
          created_by: user?.id,
          ai_extraction_status: "pending"
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh invoices list immediately
      await fetchLicenseInvoices(editingLicenseId);

      // Reset file input
      e.target.value = '';

      toast({
        title: language === "ar" ? "تم الرفع بنجاح" : "Upload successful",
        description: language === "ar" ? "تم رفع الفاتورة بنجاح، جاري استخراج التكلفة..." : "Invoice uploaded successfully, extracting cost...",
      });

      // Prepare image data for AI extraction
      let imageDataForAI = base64;
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // For PDFs, we need to convert first page to image
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          
          // Load PDF from base64
          const pdfData = base64.split(',')[1];
          const binaryData = atob(pdfData);
          const uint8Array = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
          }
          
          const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
          const page = await pdf.getPage(1);
          
          // Render at a good resolution for text extraction
          const scale = 2;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            imageDataForAI = canvas.toDataURL('image/png');
          }
        } catch (pdfError) {
          console.error("Failed to convert PDF to image:", pdfError);
          // Continue with original base64, AI will fail but we'll handle it
        }
      }

      // Call AI to extract cost from invoice (async, don't block)
      if (insertedInvoice) {
        supabase.functions.invoke("extract-invoice-cost", {
          body: { 
            invoiceId: insertedInvoice.id,
            imageData: imageDataForAI,
            fileName: file.name
          },
        }).then(async () => {
          // Refresh invoices to show extracted cost
          if (editingLicenseId) {
            await fetchLicenseInvoices(editingLicenseId);
          }
          toast({
            title: language === "ar" ? "تم استخراج التكلفة" : "Cost extracted",
            description: language === "ar" ? "تم استخراج تكلفة الفاتورة بنجاح" : "Invoice cost extracted successfully",
          });
        }).catch((err) => {
          console.error("Failed to extract invoice cost:", err);
          toast({
            title: language === "ar" ? "تحذير" : "Warning",
            description: language === "ar" ? "فشل في استخراج التكلفة تلقائياً" : "Failed to auto-extract cost",
            variant: "destructive",
          });
        });
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRereadInvoice = async (invoice: LicenseInvoice) => {
    try {
      // Update status to processing
      await supabase
        .from("software_license_invoices")
        .update({ ai_extraction_status: "processing", ai_extraction_error: null })
        .eq("id", invoice.id);
      
      // Refresh to show processing status
      if (editingLicenseId) {
        await fetchLicenseInvoices(editingLicenseId);
      }

      toast({
        title: language === "ar" ? "جاري القراءة" : "Reading...",
        description: language === "ar" ? "جاري استخراج التكلفة من الفاتورة" : "Extracting cost from invoice...",
      });

      // Fetch the file from Cloudinary URL
      const response = await fetch(invoice.file_path);
      const blob = await response.blob();
      
      // Convert blob to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      let imageDataForAI = base64;
      const isPdf = invoice.file_name?.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // For PDFs, we need to convert first page to image
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          
          // Load PDF from base64
          const pdfData = base64.split(',')[1];
          const binaryData = atob(pdfData);
          const uint8Array = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
          }
          
          const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
          const page = await pdf.getPage(1);
          
          // Render at a good resolution for text extraction
          const scale = 2;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            imageDataForAI = canvas.toDataURL('image/png');
          }
        } catch (pdfError) {
          console.error("Failed to convert PDF to image:", pdfError);
        }
      }

      // Call AI to extract cost
      const { error: invokeError } = await supabase.functions.invoke("extract-invoice-cost", {
        body: { 
          invoiceId: invoice.id,
          imageData: imageDataForAI,
          fileName: invoice.file_name || "invoice"
        },
      });

      if (invokeError) throw invokeError;

      // Refresh invoices to show extracted cost
      if (editingLicenseId) {
        await fetchLicenseInvoices(editingLicenseId);
      }
      
      toast({
        title: language === "ar" ? "تم استخراج التكلفة" : "Cost extracted",
        description: language === "ar" ? "تم استخراج تكلفة الفاتورة بنجاح" : "Invoice cost extracted successfully",
      });
    } catch (error: any) {
      console.error("Failed to re-read invoice:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في استخراج التكلفة" : "Failed to extract cost",
        variant: "destructive",
      });
      // Refresh to show current status
      if (editingLicenseId) {
        await fetchLicenseInvoices(editingLicenseId);
      }
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة؟" : "Are you sure you want to delete this invoice?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("software_license_invoices")
        .delete()
        .eq("id", invoiceId);

      if (error) throw error;

      // Refresh invoices list
      if (editingLicenseId) {
        await fetchLicenseInvoices(editingLicenseId);
      }

      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف الفاتورة بنجاح" : "Invoice deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartEditInvoice = (invoice: LicenseInvoice) => {
    setEditingInvoiceId(invoice.id);
    setEditingInvoiceData({
      extracted_cost: invoice.extracted_cost?.toString() || "",
      cost_currency: invoice.cost_currency || "",
      cost_sar: invoice.cost_sar?.toString() || "",
    });
  };

  const handleCancelEditInvoice = () => {
    setEditingInvoiceId(null);
    setEditingInvoiceData({ extracted_cost: "", cost_currency: "", cost_sar: "" });
  };

  const handleRecalculateSar = () => {
    const cost = parseFloat(editingInvoiceData.extracted_cost);
    const currencyCode = editingInvoiceData.cost_currency;
    
    if (isNaN(cost) || !currencyCode) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى إدخال التكلفة والعملة أولاً" : "Please enter cost and currency first",
        variant: "destructive",
      });
      return;
    }

    const baseCurrency = currencies.find(c => c.is_base);
    
    // If currency is SAR (base currency), just use the cost directly
    if (baseCurrency && currencyCode === baseCurrency.currency_code) {
      setEditingInvoiceData(prev => ({
        ...prev,
        cost_sar: cost.toFixed(2)
      }));
      toast({
        title: language === "ar" ? "تم الحساب" : "Calculated",
        description: language === "ar" ? "تم تحديث التكلفة بالريال السعودي" : "SAR cost updated",
      });
      return;
    }

    // Find the currency by code to get its ID
    const selectedCurrency = currencies.find(c => c.currency_code === currencyCode);
    if (!selectedCurrency) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "العملة غير موجودة في النظام" : "Currency not found in system",
        variant: "destructive",
      });
      return;
    }

    // Get the rate for this currency
    const rate = currencyRates.find(r => r.currency_id === selectedCurrency.id);
    
    if (!rate || rate.rate_to_base <= 0) {
      // Default fallback: use 1 USD = 3.75 SAR if no rate found
      if (currencyCode === "USD") {
        const sarValue = cost * 3.75;
        setEditingInvoiceData(prev => ({
          ...prev,
          cost_sar: sarValue.toFixed(2)
        }));
        toast({
          title: language === "ar" ? "تم الحساب" : "Calculated",
          description: language === "ar" ? "تم استخدام سعر افتراضي (1 USD = 3.75 SAR)" : "Used default rate (1 USD = 3.75 SAR)",
        });
        return;
      }
      
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "لم يتم العثور على سعر صرف لهذه العملة" : "No exchange rate found for this currency",
        variant: "destructive",
      });
      return;
    }

    // rate_to_base means how many units of this currency = 1 base currency
    // So to convert to base: cost / rate_to_base
    const sarValue = cost / rate.rate_to_base;
    setEditingInvoiceData(prev => ({
      ...prev,
      cost_sar: sarValue.toFixed(2)
    }));

    toast({
      title: language === "ar" ? "تم الحساب" : "Calculated",
      description: language === "ar" ? "تم تحديث التكلفة بالريال السعودي" : "SAR cost updated based on current rate",
    });
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    try {
      const updateData: {
        extracted_cost: number | null;
        cost_currency: string | null;
        cost_sar: number | null;
        ai_extraction_status: string;
      } = {
        extracted_cost: editingInvoiceData.extracted_cost ? parseFloat(editingInvoiceData.extracted_cost) : null,
        cost_currency: editingInvoiceData.cost_currency || null,
        cost_sar: editingInvoiceData.cost_sar ? parseFloat(editingInvoiceData.cost_sar) : null,
        ai_extraction_status: "completed",
      };

      const { error } = await supabase
        .from("software_license_invoices")
        .update(updateData)
        .eq("id", invoiceId);

      if (error) throw error;

      // Refresh invoices list
      if (editingLicenseId) {
        await fetchLicenseInvoices(editingLicenseId);
      }

      setEditingInvoiceId(null);
      setEditingInvoiceData({ extracted_cost: "", cost_currency: "", cost_sar: "" });

      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم تحديث بيانات الفاتورة بنجاح" : "Invoice data updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const licenseData = {
        software_name: formData.software_name,
        version: formData.version || null,
        license_key: formData.license_key || null,
        vendor_provider: formData.vendor_provider,
        vendor_portal_url: formData.vendor_portal_url || null,
        category: formData.category,
        purchase_date: formData.purchase_date,
        expiry_date: formData.expiry_date || null,
        renewal_cycle: formData.renewal_cycle,
        notification_days: formData.notification_days,
        cost: parseFloat(formData.cost) || 0,
        payment_method: formData.payment_method || null,
        assigned_to: formData.assigned_to || null,
        assigned_department: formData.assigned_department || null,
        cost_center_id: formData.cost_center_id || null,
        project_id: formData.project_id || null,
        invoice_file_path: formData.invoice_file_path || null,
        notes: formData.notes || null,
        status: formData.status,
        currency_id: formData.currency_id || null,
        domain_name: formData.domain_name || null,
        mails: formData.mails || null,
        updated_by: user.id,
      };

      if (editingLicenseId) {
        const { error } = await supabase
          .from("software_licenses")
          .update(licenseData)
          .eq("id", editingLicenseId);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم التحديث" : "Updated",
          description: language === "ar" ? "تم تحديث الترخيص بنجاح" : "License updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("software_licenses")
          .insert([{ ...licenseData, created_by: user.id }]);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم الحفظ" : "Saved",
          description: language === "ar" ? "تم إضافة الترخيص بنجاح" : "License added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchLicenses();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (licenseId: string) => {
    try {
      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .eq("id", licenseId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          software_name: data.software_name || "",
          version: data.version || "",
          license_key: data.license_key || "",
          vendor_provider: data.vendor_provider || "",
          vendor_portal_url: data.vendor_portal_url || "",
          category: data.category || "",
          purchase_date: data.purchase_date || "",
          expiry_date: data.expiry_date || "",
          renewal_cycle: data.renewal_cycle || "yearly",
          notification_days: data.notification_days || [7, 30],
          cost: data.cost?.toString() || "",
          payment_method: data.payment_method || "",
          assigned_to: data.assigned_to || "",
          assigned_department: data.assigned_department || "",
          cost_center_id: data.cost_center_id || "",
          project_id: data.project_id || "",
          invoice_file_path: data.invoice_file_path || "",
          notes: data.notes || "",
          status: data.status || "active",
          currency_id: data.currency_id || "",
          domain_name: data.domain_name || "",
          mails: data.mails || "",
        });
        setEditingLicenseId(licenseId);
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        
        // Fetch invoices for this license
        await fetchLicenseInvoices(licenseId);
        
        setIsDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (licenseId: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الترخيص؟" : "Are you sure you want to delete this license?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("software_licenses")
        .delete()
        .eq("id", licenseId);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف الترخيص بنجاح" : "License deleted successfully",
      });

      fetchLicenses();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    resetForm();
    setEditingLicenseId(null);
    setLicenseInvoices([]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      software_name: "",
      version: "",
      license_key: "",
      vendor_provider: "",
      vendor_portal_url: "",
      category: "",
      purchase_date: "",
      expiry_date: "",
      renewal_cycle: "yearly",
      notification_days: [7, 30],
      cost: "",
      payment_method: "",
      assigned_to: "",
      assigned_department: "",
      cost_center_id: "",
      project_id: "",
      invoice_file_path: "",
      notes: "",
      status: "active",
      currency_id: currencies.find(c => c.is_base)?.id || "",
      domain_name: "",
      mails: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: "bg-green-500",
      expired: "bg-red-500",
      expiring_soon: "bg-orange-500",
      cancelled: "bg-gray-500",
      canceled: "bg-gray-500",
    };

    const statusLabels: Record<string, { en: string; ar: string }> = {
      active: { en: "Active", ar: "نشط" },
      expired: { en: "Expired", ar: "منتهي" },
      expiring_soon: { en: "Expiring Soon", ar: "ينتهي قريباً" },
      cancelled: { en: "Cancelled", ar: "ملغي" },
      canceled: { en: "Cancelled", ar: "ملغي" },
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-500"}>
        {language === "ar" ? statusLabels[status]?.ar || status : statusLabels[status]?.en || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {language === "ar" ? "إدخال الترخيص" : "License Entry"}
        </h1>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة ترخيص جديد" : "Add New License"}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الحالات" : "All Statuses"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
              <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
              <SelectItem value="expiring_soon">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</SelectItem>
              <SelectItem value="cancelled">{language === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{language === "ar" ? "الفئة" : "Category"}</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الفئات" : "All Categories"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              {uniqueCategories.length > 0 ? (
                uniqueCategories.map((cat) => {
                  const catObj = CATEGORIES.find(c => c.value === cat);
                  return (
                    <SelectItem key={cat} value={cat}>
                      {catObj ? (language === "ar" ? catObj.labelAr : catObj.label) : cat}
                    </SelectItem>
                  );
                })
              ) : (
                CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {language === "ar" ? cat.labelAr : cat.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{language === "ar" ? "دورة التجديد" : "Renewal Cycle"}</Label>
          <Select value={renewalCycleFilter} onValueChange={setRenewalCycleFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الدورات" : "All Cycles"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              {RENEWAL_CYCLES.map((cycle) => (
                <SelectItem key={cycle.value} value={cycle.value}>
                  {language === "ar" ? cycle.labelAr : cycle.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("software_name")}
                  >
                    {language === "ar" ? "اسم البرنامج" : "Software Name"}
                    {getSortIcon("software_name")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("vendor_provider")}
                  >
                    {language === "ar" ? "المورد" : "Vendor"}
                    {getSortIcon("vendor_provider")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("category")}
                  >
                    {language === "ar" ? "الفئة" : "Category"}
                    {getSortIcon("category")}
                  </TableHead>
                  <TableHead>
                    {language === "ar" ? "اسم النطاق" : "Domain Name"}
                  </TableHead>
                  <TableHead>
                    {language === "ar" ? "البريد الإلكتروني" : "Mails"}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("purchase_date")}
                  >
                    {language === "ar" ? "تاريخ الشراء" : "Purchase Date"}
                    {getSortIcon("purchase_date")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("expiry_date")}
                  >
                    {language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}
                    {getSortIcon("expiry_date")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("renewal_cycle")}
                  >
                    {language === "ar" ? "دورة التجديد" : "Renewal Cycle"}
                    {getSortIcon("renewal_cycle")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("cost")}
                  >
                    {language === "ar" ? "التكلفة" : "Cost"}
                    {getSortIcon("cost")}
                  </TableHead>
                  <TableHead>
                    {language === "ar" ? "العملة" : "Currency"}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("project_id")}
                  >
                    {language === "ar" ? "المشروع" : "Project"}
                    {getSortIcon("project_id")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    {language === "ar" ? "الحالة" : "Status"}
                    {getSortIcon("status")}
                  </TableHead>
                  <TableHead className="text-center">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredLicenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center">
                      {language === "ar" ? "لا توجد تراخيص" : "No licenses found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLicenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">{license.software_name}</TableCell>
                      <TableCell>{license.vendor_provider}</TableCell>
                      <TableCell>
                        {CATEGORIES.find(c => c.value === license.category)?.[language === "ar" ? "labelAr" : "label"] || license.category}
                      </TableCell>
                      <TableCell>{(license as any).domain_name || '-'}</TableCell>
                      <TableCell>{(license as any).mails || '-'}</TableCell>
                      <TableCell>{format(new Date(license.purchase_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        {license.expiry_date ? format(new Date(license.expiry_date), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell>
                        {RENEWAL_CYCLES.find(rc => rc.value === license.renewal_cycle)?.[language === "ar" ? "labelAr" : "label"]}
                      </TableCell>
                      <TableCell>
                        {currencies.find(c => c.id === license.currency_id)?.currency_code || ''}{license.cost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {currencies.find(c => c.id === license.currency_id)?.currency_code || '-'}
                      </TableCell>
                      <TableCell>
                        {projects.find(p => p.id === license.project_id)?.name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(license.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(license.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(license.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLicenseId
                ? language === "ar" ? "تعديل الترخيص" : "Edit License"
                : language === "ar" ? "إضافة ترخيص جديد" : "Add New License"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "معلومات أساسية" : "Basic Information"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="software_name">{language === "ar" ? "اسم البرنامج" : "Software Name"} *</Label>
                    <Input
                      id="software_name"
                      value={formData.software_name}
                      onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version">{language === "ar" ? "الإصدار" : "Version"}</Label>
                    <Input
                      id="version"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license_key">{language === "ar" ? "مفتاح الترخيص / معرف الاشتراك" : "License Key / Subscription ID"}</Label>
                  <Input
                    id="license_key"
                    value={formData.license_key}
                    onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor_provider">{language === "ar" ? "المورد / المزود" : "Vendor / Provider"} *</Label>
                    <Input
                      id="vendor_provider"
                      value={formData.vendor_provider}
                      onChange={(e) => setFormData({ ...formData, vendor_provider: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor_portal_url">{language === "ar" ? "رابط بوابة المورد" : "Vendor Portal URL"}</Label>
                    <Input
                      id="vendor_portal_url"
                      type="url"
                      value={formData.vendor_portal_url}
                      onChange={(e) => setFormData({ ...formData, vendor_portal_url: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{language === "ar" ? "الفئة" : "Category"} *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر الفئة" : "Select category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {language === "ar" ? cat.labelAr : cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain_name">{language === "ar" ? "اسم النطاق" : "Domain Name"}</Label>
                    <Input
                      id="domain_name"
                      value={formData.domain_name}
                      onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                      placeholder={language === "ar" ? "مثال: example.com" : "e.g., example.com"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mails">{language === "ar" ? "البريد الإلكتروني" : "Mails"}</Label>
                    <Input
                      id="mails"
                      value={formData.mails}
                      onChange={(e) => setFormData({ ...formData, mails: e.target.value })}
                      placeholder={language === "ar" ? "البريد الإلكتروني المرتبط" : "Associated email addresses"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">{language === "ar" ? "الحالة" : "Status"}</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
                      <SelectItem value="expiring_soon">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</SelectItem>
                      <SelectItem value="cancelled">{language === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "معلومات الترخيص" : "License Information"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_date">{language === "ar" ? "تاريخ الشراء" : "Purchase Date"} *</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry_date">{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="renewal_cycle">{language === "ar" ? "دورة التجديد" : "Renewal Cycle"} *</Label>
                    <Select value={formData.renewal_cycle} onValueChange={(value) => setFormData({ ...formData, renewal_cycle: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RENEWAL_CYCLES.map((cycle) => (
                          <SelectItem key={cycle.value} value={cycle.value}>
                            {language === "ar" ? cycle.labelAr : cycle.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency_id">{language === "ar" ? "العملة" : "Currency"} *</Label>
                    <Select value={formData.currency_id} onValueChange={(value) => setFormData({ ...formData, currency_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select currency"} />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.currency_code} - {language === "ar" ? (currency.currency_name_ar || currency.currency_name) : currency.currency_name}
                            {currency.is_base && ` (${language === "ar" ? "أساسية" : "Base"})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost">{language === "ar" ? "التكلفة" : "Cost"} *</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "المبلغ بالعملة الأساسية" : "Base Currency Amount"}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={
                          formData.cost && formData.currency_id
                            ? convertToBaseCurrency(parseFloat(formData.cost) || 0, formData.currency_id).toFixed(2)
                            : ""
                        }
                        readOnly
                        disabled
                        className="bg-muted"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {getBaseCurrency()?.currency_code || ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                    <Popover open={openPaymentCombo} onOpenChange={setOpenPaymentCombo}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPaymentCombo}
                          className="w-full justify-between"
                        >
                          {formData.payment_method
                            ? PAYMENT_METHODS.find((pm) => pm.value === formData.payment_method)?.[language === "ar" ? "labelAr" : "label"] || formData.payment_method
                            : language === "ar" ? "اختر طريقة الدفع" : "Select payment method"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-background z-50">
                        <Command>
                          <CommandInput 
                            placeholder={language === "ar" ? "ابحث عن طريقة الدفع..." : "Search payment method..."} 
                            value={newPaymentMethod}
                            onValueChange={setNewPaymentMethod}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  if (newPaymentMethod.trim()) {
                                    setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                                    setFormData({ ...formData, payment_method: newPaymentMethod.trim() });
                                    setNewPaymentMethod("");
                                    setOpenPaymentCombo(false);
                                  }
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {language === "ar" ? `إضافة "${newPaymentMethod}"` : `Add "${newPaymentMethod}"`}
                              </Button>
                            </CommandEmpty>
                            <CommandGroup>
                              {PAYMENT_METHODS.map((pm) => (
                                <CommandItem
                                  key={pm.value}
                                  value={pm.value}
                                  onSelect={(currentValue) => {
                                    setFormData({ ...formData, payment_method: currentValue });
                                    setOpenPaymentCombo(false);
                                    setNewPaymentMethod("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.payment_method === pm.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {language === "ar" ? pm.labelAr : pm.label}
                                </CommandItem>
                              ))}
                              {paymentMethods
                                .filter(pm => !PAYMENT_METHODS.some(p => p.value === pm))
                                .map((pm) => (
                                  <CommandItem
                                    key={pm}
                                    value={pm}
                                    onSelect={(currentValue) => {
                                      setFormData({ ...formData, payment_method: currentValue });
                                      setOpenPaymentCombo(false);
                                      setNewPaymentMethod("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.payment_method === pm ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {pm}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_department">{language === "ar" ? "القسم المعين" : "Assigned Department"}</Label>
                    <Select 
                      value={formData.assigned_department} 
                      onValueChange={(value) => setFormData({ ...formData, assigned_department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.department_name}>
                            {dept.department_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">{language === "ar" ? "معين إلى" : "Assigned To"}</Label>
                    <Select 
                      value={formData.assigned_to || "none"} 
                      onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر المستخدم" : "Select user"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="none">
                          {language === "ar" ? "-- بدون --" : "-- None --"}
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.user_name}>
                            {user.user_name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_center_id">{language === "ar" ? "مركز التكلفة" : "Cost Center"}</Label>
                    <Select 
                      value={formData.cost_center_id} 
                      onValueChange={(value) => setFormData({ ...formData, cost_center_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر مركز التكلفة" : "Select cost center"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {costCenters.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.cost_center_code} - {language === "ar" ? (cc.cost_center_name_ar || cc.cost_center_name) : cc.cost_center_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_id">{language === "ar" ? "المشروع" : "Project"}</Label>
                    <Select 
                      value={formData.project_id} 
                      onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر المشروع" : "Select project"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  {language === "ar" ? "معلومات إضافية والفواتير" : "Additional Information & Invoices"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Invoice Upload Section */}
                {editingLicenseId && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-base font-semibold">
                      {language === "ar" ? "رفع فاتورة جديدة" : "Upload New Invoice"}
                    </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoice_date" className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {language === "ar" ? "تاريخ الفاتورة" : "Invoice Date"} *
                        </Label>
                        <Input
                          id="invoice_date"
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="invoice_upload">
                          {language === "ar" ? "ملف الفاتورة" : "Invoice File"}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="invoice_upload"
                            type="file"
                            onChange={handleFileUpload}
                            disabled={uploading || !invoiceDate}
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                          {uploading && <span className="text-sm">{language === "ar" ? "جاري الرفع..." : "Uploading..."}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!editingLicenseId && (
                  <div className="p-4 border rounded-lg bg-muted/30 text-center text-muted-foreground">
                    {language === "ar" 
                      ? "يجب حفظ الترخيص أولاً قبل رفع الفواتير"
                      : "Please save the license first before uploading invoices"}
                  </div>
                )}

                {/* Invoice History */}
                {licenseInvoices.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {language === "ar" ? "سجل الفواتير" : "Invoice History"} ({licenseInvoices.length})
                    </Label>
                    
                    {/* Total Cost Summary */}
                    {(() => {
                      const totalCostSar = licenseInvoices.reduce((sum, inv) => sum + (inv.cost_sar || 0), 0);
                      const invoicesWithCost = licenseInvoices.filter(inv => inv.extracted_cost !== null);
                      const totalOriginalCosts: Record<string, number> = {};
                      invoicesWithCost.forEach(inv => {
                        if (inv.extracted_cost && inv.cost_currency) {
                          totalOriginalCosts[inv.cost_currency] = (totalOriginalCosts[inv.cost_currency] || 0) + inv.extracted_cost;
                        }
                      });
                      
                      return invoicesWithCost.length > 0 ? (
                        <div className="p-4 border rounded-lg bg-primary/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {language === "ar" ? "إجمالي تكلفة الفواتير" : "Total Invoice Costs"}
                            </span>
                            <span className="text-lg font-bold text-primary">
                              {totalCostSar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                            </span>
                          </div>
                          {Object.entries(totalOriginalCosts).length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {language === "ar" ? "التفاصيل:" : "Details:"}{" "}
                              {Object.entries(totalOriginalCosts).map(([currency, amount], idx) => (
                                <span key={currency}>
                                  {idx > 0 && " + "}
                                  {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                            <TableHead>{language === "ar" ? "اسم الملف" : "File Name"}</TableHead>
                            <TableHead>{language === "ar" ? "التكلفة" : "Cost"}</TableHead>
                            <TableHead>{language === "ar" ? "التكلفة (ر.س)" : "Cost (SAR)"}</TableHead>
                            <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                            <TableHead className="text-center">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {licenseInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">
                                {format(new Date(invoice.invoice_date), "yyyy-MM-dd")}
                              </TableCell>
                              <TableCell>{invoice.file_name || "-"}</TableCell>
                              <TableCell>
                                {editingInvoiceId === invoice.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editingInvoiceData.extracted_cost}
                                      onChange={(e) => setEditingInvoiceData({
                                        ...editingInvoiceData,
                                        extracted_cost: e.target.value
                                      })}
                                      className="w-24 h-8"
                                      placeholder="0.00"
                                    />
                                    <Select
                                      value={editingInvoiceData.cost_currency}
                                      onValueChange={(value) => setEditingInvoiceData({
                                        ...editingInvoiceData,
                                        cost_currency: value
                                      })}
                                    >
                                      <SelectTrigger className="w-24 h-8">
                                        <SelectValue placeholder={language === "ar" ? "عملة" : "Currency"} />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background z-50">
                                        {currencies.map((curr) => (
                                          <SelectItem key={curr.id} value={curr.currency_code}>
                                            {curr.currency_code}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  invoice.extracted_cost !== null ? (
                                    <span className="font-medium">
                                      {invoice.extracted_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.cost_currency || ""}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )
                                )}
                              </TableCell>
                              <TableCell>
                                {editingInvoiceId === invoice.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editingInvoiceData.cost_sar}
                                      onChange={(e) => setEditingInvoiceData({
                                        ...editingInvoiceData,
                                        cost_sar: e.target.value
                                      })}
                                      className="w-24 h-8"
                                      placeholder="0.00"
                                    />
                                    <span className="text-sm text-muted-foreground">SAR</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleRecalculateSar}
                                      title={language === "ar" ? "إعادة حساب بسعر الصرف الحالي" : "Recalculate with current rate"}
                                      className="h-8 px-2"
                                    >
                                      <Calculator className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  invoice.cost_sar !== null ? (
                                    <span className="font-medium text-primary">
                                      {invoice.cost_sar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )
                                )}
                              </TableCell>
                              <TableCell>
                                {invoice.ai_extraction_status === "completed" && (
                                  <Badge variant="default" className="bg-green-500">
                                    {language === "ar" ? "مكتمل" : "Completed"}
                                  </Badge>
                                )}
                                {invoice.ai_extraction_status === "processing" && (
                                  <Badge variant="secondary">
                                    {language === "ar" ? "جاري المعالجة" : "Processing"}
                                  </Badge>
                                )}
                                {invoice.ai_extraction_status === "pending" && (
                                  <Badge variant="outline">
                                    {language === "ar" ? "في الانتظار" : "Pending"}
                                  </Badge>
                                )}
                                {invoice.ai_extraction_status === "error" && (
                                  <Badge variant="destructive" title={invoice.ai_extraction_error || ""}>
                                    {language === "ar" ? "فشل" : "Failed"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2">
                                  {editingInvoiceId === invoice.id ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSaveInvoice(invoice.id)}
                                        title={language === "ar" ? "حفظ" : "Save"}
                                        className="text-green-600 hover:text-green-700"
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEditInvoice}
                                        title={language === "ar" ? "إلغاء" : "Cancel"}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStartEditInvoice(invoice)}
                                        title={language === "ar" ? "تعديل" : "Edit"}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      {(invoice.ai_extraction_status === "pending" || invoice.ai_extraction_status === "error") && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRereadInvoice(invoice)}
                                          title={language === "ar" ? "إعادة القراءة بالذكاء الاصطناعي" : "Re-read with AI"}
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(invoice.file_path, '_blank')}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteInvoice(invoice.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? language === "ar" ? "جاري الحفظ..." : "Saving..."
                  : language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SoftwareLicenseSetup;
