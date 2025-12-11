import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Eye, FileText, Trash2, Mail, X, Image, Video, Link as LinkIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

type PurchaseItemRecord = {
  id: string;
  item_name: string;
  item_name_ar: string | null;
  item_code: string | null;
};

type PurchaseItem = {
  id: string;
  item_id: string | null;
  budget_value: number | null;
  qty: number | null;
  uom: string | null;
  currency_id: string | null;
  external_link: string;
};

const getFormSchema = (language: string) => z.object({
  department_id: z.string().min(1, language === 'ar' ? "القسم مطلوب" : "Department is required"),
  subject: z.string().min(3, language === 'ar' ? "الموضوع يجب أن يكون 3 أحرف على الأقل" : "Subject must be at least 3 characters"),
  description: z.string().min(10, language === 'ar' ? "الوصف يجب أن يكون 10 أحرف على الأقل" : "Description must be at least 10 characters"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  is_purchase_ticket: z.boolean().default(false),
});

type UOM = {
  id: string;
  uom_code: string;
  uom_name: string;
  uom_name_ar: string | null;
};

type Department = {
  id: string;
  department_name: string;
};

type Currency = {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar: string | null;
};

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
  is_purchase_ticket: boolean;
  approved_at: string | null;
  next_admin_order: number | null;
  department_id: string;
  external_link: string | null;
  budget_value: number | null;
  qty: number | null;
  uom: string | null;
  currency_id: string | null;
  departments: {
    department_name: string;
  };
  ticket_attachments: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
  }>;
};

const Tickets = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [uomList, setUomList] = useState<UOM[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [newUomName, setNewUomName] = useState("");
  const [addingUom, setAddingUom] = useState(false);
  
  // Multi-file states
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  
  // Multi external links (for non-purchase tickets)
  const [externalLinks, setExternalLinks] = useState<string[]>(['']);
  
  // Multi purchase items
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([
    { id: crypto.randomUUID(), item_id: null, budget_value: null, qty: null, uom: null, currency_id: null, external_link: '' }
  ]);
  
  // Purchase items list (for combo box)
  const [purchaseItemsList, setPurchaseItemsList] = useState<PurchaseItemRecord[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const formSchema = getFormSchema(language);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      department_id: "",
      subject: "",
      description: "",
      priority: "Medium",
      is_purchase_ticket: false,
    },
  });

  const isPurchaseTicket = form.watch("is_purchase_ticket");

  useEffect(() => {
    fetchTickets();
    fetchDepartments();
    fetchUomList();
    fetchCurrencies();
    fetchPurchaseItemsList();
  }, []);

  const fetchPurchaseItemsList = async () => {
    try {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("id, item_name, item_name_ar, item_code")
        .eq("is_active", true)
        .order("item_name");

      if (error) throw error;
      setPurchaseItemsList(data || []);
    } catch (error: any) {
      console.error("Error fetching purchase items:", error);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItemName.trim()) return;
    
    setAddingItem(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("purchase_items")
        .insert({
          item_name: newItemName.trim(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setPurchaseItemsList(prev => [...prev, data]);
      setNewItemName("");
      toast({
        title: language === 'ar' ? 'تم الإضافة' : 'Added',
        description: language === 'ar' ? 'تم إضافة العنصر بنجاح' : 'Item added successfully',
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingItem(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("id, currency_code, currency_name, currency_name_ar")
        .eq("is_active", true)
        .order("currency_code");

      if (error) throw error;
      setCurrencies(data || []);
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchUomList = async () => {
    try {
      const { data, error } = await supabase
        .from("uom")
        .select("*")
        .eq("is_active", true)
        .order("uom_name");

      if (error) throw error;
      setUomList(data || []);
    } catch (error: any) {
      console.error("Error fetching UOM list:", error);
    }
  };

  const handleAddNewUom = async () => {
    if (!newUomName.trim()) return;
    
    setAddingUom(true);
    try {
      const uomCode = newUomName.toUpperCase().replace(/\s+/g, '_').substring(0, 10);
      const { data, error } = await supabase
        .from("uom")
        .insert({
          uom_code: uomCode,
          uom_name: newUomName,
          uom_name_ar: newUomName,
        })
        .select()
        .single();

      if (error) throw error;

      setUomList(prev => [...prev, data]);
      setNewUomName("");
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إضافة وحدة القياس' : 'UOM added successfully',
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingUom(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل تحميل الأقسام" : "Failed to load departments",
        variant: "destructive",
      });
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          departments (
            department_name
          ),
          ticket_attachments (
            id,
            file_name,
            file_path,
            file_size
          )
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as unknown as Ticket[]) || []);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Handle video selection
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedVideos(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  // Handle external links for non-purchase tickets
  const addExternalLink = () => {
    setExternalLinks(prev => [...prev, '']);
  };

  const removeExternalLink = (index: number) => {
    setExternalLinks(prev => prev.filter((_, i) => i !== index));
  };

  const updateExternalLink = (index: number, value: string) => {
    setExternalLinks(prev => prev.map((link, i) => i === index ? value : link));
  };

  // Handle purchase items
  const addPurchaseItem = () => {
    setPurchaseItems(prev => [...prev, { 
      id: crypto.randomUUID(), 
      item_id: null,
      budget_value: null, 
      qty: null, 
      uom: null, 
      currency_id: null, 
      external_link: '' 
    }]);
  };

  const removePurchaseItem = (id: string) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updatePurchaseItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const resetForm = () => {
    form.reset();
    setSelectedImages([]);
    setSelectedVideos([]);
    setExternalLinks(['']);
    setPurchaseItems([{ id: crypto.randomUUID(), item_id: null, budget_value: null, qty: null, uom: null, currency_id: null, external_link: '' }]);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;
    
    // Validate purchase items if purchase ticket
    if (values.is_purchase_ticket) {
      const invalidItems = purchaseItems.filter(item => 
        !item.item_id || item.budget_value === null || item.qty === null || !item.uom || !item.currency_id
      );
      if (invalidItems.length > 0) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى ملء جميع حقول عناصر الشراء المطلوبة' : 'Please fill all required purchase item fields',
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(language === 'ar' ? "غير مصرح" : "Not authenticated");

      // Prepare external links
      const validExternalLinks = values.is_purchase_ticket 
        ? purchaseItems.map(item => item.external_link).filter(link => link.trim())
        : externalLinks.filter(link => link.trim());
      
      // Use first item for main ticket fields, store all links as JSON
      const firstPurchaseItem = purchaseItems[0];
      
      const { data: ticketData, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department_id: values.department_id,
          subject: values.subject,
          description: values.description,
          priority: values.priority,
          is_purchase_ticket: values.is_purchase_ticket,
          external_link: validExternalLinks.length > 0 ? validExternalLinks.join('\n') : null,
          budget_value: values.is_purchase_ticket ? firstPurchaseItem.budget_value : null,
          qty: values.is_purchase_ticket ? firstPurchaseItem.qty : null,
          uom: values.is_purchase_ticket ? firstPurchaseItem.uom : null,
          currency_id: values.is_purchase_ticket ? firstPurchaseItem.currency_id : null,
          item_id: values.is_purchase_ticket ? firstPurchaseItem.item_id : null,
          ticket_number: "",
        })
        .select()
        .single();

      if (error) throw error;

      // Upload images to Cloudinary
      for (const file of selectedImages) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const publicId = `tickets/${ticketData.id}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { 
            imageBase64: base64, 
            folder: "Edara_Images",
            publicId 
          },
        });

        if (!uploadError && uploadData?.url) {
          await supabase
            .from('ticket_attachments')
            .insert({
              ticket_id: ticketData.id,
              user_id: user.id,
              file_name: file.name,
              file_path: uploadData.url,
              file_size: file.size,
              mime_type: file.type,
            });
        }
      }

      // Upload videos to Cloudinary
      for (const file of selectedVideos) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const publicId = `tickets/${ticketData.id}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { 
            imageBase64: base64, 
            folder: "Edara_Videos",
            publicId 
          },
        });

        if (!uploadError && uploadData?.url) {
          await supabase
            .from('ticket_attachments')
            .insert({
              ticket_id: ticketData.id,
              user_id: user.id,
              file_name: file.name,
              file_path: uploadData.url,
              file_size: file.size,
              mime_type: file.type,
            });
        }
      }

      // Send notification
      const { data: firstLevelAdmins } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", values.department_id)
        .eq("admin_order", 1)
        .eq("is_purchase_admin", false);

      if (firstLevelAdmins && firstLevelAdmins.length > 0 && ticketData) {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticketData.id,
            adminOrder: 1,
            isPurchasePhase: false,
          },
        });
      }

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully",
      });

      setOpen(false);
      resetForm();
      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "destructive";
      case "High": return "destructive";
      case "Medium": return "default";
      case "Low": return "secondary";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open": return "default";
      case "In Progress": return "default";
      case "Closed": return "secondary";
      case "Rejected": return "destructive";
      default: return "default";
    }
  };

  const getApprovalBadge = (ticket: any) => {
    if (ticket.status === "Rejected") {
      return (
        <Badge variant="destructive">
          {language === 'ar' ? 'مرفوض' : 'Rejected'}
        </Badge>
      );
    }
    if (ticket.approved_at) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          {language === 'ar' ? 'تمت الموافقة' : 'Approved'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {language === 'ar' ? 'في انتظار الموافقة' : 'Pending Approval'}
      </Badge>
    );
  };

  const handleDeleteClick = (ticketId: string) => {
    setTicketToDelete(ticketId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ticketToDelete) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .delete()
        .eq("id", ticketToDelete);

      if (error) throw error;

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' ? "تم حذف التذكرة بنجاح" : "Ticket deleted successfully",
      });

      setDeleteDialogOpen(false);
      setTicketToDelete(null);
      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResendNotification = async (ticket: Ticket) => {
    try {
      const { data: adminData, error: adminError } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id);

      if (adminError) throw adminError;

      const adminUserIds = adminData?.map(admin => admin.user_id) || [];

      if (adminUserIds.length === 0) {
        throw new Error(language === 'ar' ? 'لم يتم العثور على مسؤولين للقسم' : 'No admins found for this department');
      }

      const { error: notificationError } = await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_created",
          ticketId: ticket.id,
          recipientUserIds: adminUserIds,
        },
      });

      if (notificationError) throw notificationError;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إرسال الإشعار بنجاح' : 'Notification resent successfully',
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{language === 'ar' ? 'تذاكري' : 'My Tickets'}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {language === 'ar' ? 'إنشاء وتتبع تذاكر الدعم الخاصة بك' : 'Create and track your support tickets'}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إنشاء تذكرة جديدة' : 'Create New Ticket'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'القسم' : 'Department'}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.department_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الأولوية' : 'Priority'}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                          <SelectItem value="Medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                          <SelectItem value="High">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
                          <SelectItem value="Urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الموضوع' : 'Subject'}</FormLabel>
                      <FormControl>
                        <Input placeholder={language === 'ar' ? 'وصف موجز للمشكلة' : 'Brief description of the issue'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'الوصف' : 'Description'}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={language === 'ar' ? 'قدم معلومات تفصيلية عن مشكلتك' : 'Provide detailed information about your issue'}
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_purchase_ticket"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          {language === 'ar' ? 'طلب شراء' : 'Purchase Request'}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                {/* Purchase Items Section */}
                {isPurchaseTicket && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{language === 'ar' ? 'عناصر الشراء' : 'Purchase Items'}</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addPurchaseItem}>
                        <Plus className="h-4 w-4 mr-1" />
                        {language === 'ar' ? 'إضافة عنصر' : 'Add Item'}
                      </Button>
                    </div>
                    
                    {purchaseItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            {language === 'ar' ? `عنصر ${index + 1}` : `Item ${index + 1}`}
                          </span>
                          {purchaseItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePurchaseItem(item.id)}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Item Selection */}
                        <div className="mb-3">
                          <label className="text-sm font-medium">{language === 'ar' ? 'العنصر' : 'Item'} *</label>
                          <Select 
                            value={item.item_id || ""} 
                            onValueChange={(v) => updatePurchaseItem(item.id, 'item_id', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر العنصر' : 'Select Item'} />
                            </SelectTrigger>
                            <SelectContent>
                              {purchaseItemsList.map((pItem) => (
                                <SelectItem key={pItem.id} value={pItem.id}>
                                  {language === 'ar' && pItem.item_name_ar ? pItem.item_name_ar : pItem.item_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Add New Item inline */}
                          <div className="flex gap-2 items-center mt-2">
                            <Input
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder={language === 'ar' ? 'اسم عنصر جديد' : 'New item name'}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddNewItem}
                              disabled={addingItem || !newItemName.trim()}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              {addingItem ? '...' : (language === 'ar' ? 'إضافة' : 'Add')}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium">{language === 'ar' ? 'قيمة الميزانية' : 'Budget Value'} *</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={language === 'ar' ? 'القيمة' : 'Value'}
                              value={item.budget_value ?? ''}
                              onChange={(e) => updatePurchaseItem(item.id, 'budget_value', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">{language === 'ar' ? 'العملة' : 'Currency'} *</label>
                            <Select 
                              value={item.currency_id || ""} 
                              onValueChange={(v) => updatePurchaseItem(item.id, 'currency_id', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={language === 'ar' ? 'اختر' : 'Select'} />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((currency) => (
                                  <SelectItem key={currency.id} value={currency.id}>
                                    {currency.currency_code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">{language === 'ar' ? 'الكمية' : 'Quantity'} *</label>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              placeholder={language === 'ar' ? 'الكمية' : 'Qty'}
                              value={item.qty ?? ''}
                              onChange={(e) => updatePurchaseItem(item.id, 'qty', e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">{language === 'ar' ? 'وحدة القياس' : 'UOM'} *</label>
                            <Select 
                              value={item.uom || ""} 
                              onValueChange={(v) => updatePurchaseItem(item.id, 'uom', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={language === 'ar' ? 'اختر' : 'Select'} />
                              </SelectTrigger>
                              <SelectContent>
                                {uomList.map((uom) => (
                                  <SelectItem key={uom.id} value={uom.uom_code}>
                                    {language === 'ar' && uom.uom_name_ar ? uom.uom_name_ar : uom.uom_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">{language === 'ar' ? 'رابط خارجي' : 'External Link'}</label>
                          <Input
                            placeholder="https://..."
                            value={item.external_link}
                            onChange={(e) => updatePurchaseItem(item.id, 'external_link', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Add new UOM section */}
                    <div className="flex gap-2 items-end pt-2 border-t">
                      <div className="flex-1">
                        <label className="text-sm font-medium">{language === 'ar' ? 'إضافة وحدة قياس جديدة' : 'Add New UOM'}</label>
                        <Input
                          value={newUomName}
                          onChange={(e) => setNewUomName(e.target.value)}
                          placeholder={language === 'ar' ? 'اسم الوحدة' : 'UOM name'}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddNewUom}
                        disabled={addingUom || !newUomName.trim()}
                      >
                        {addingUom ? '...' : (language === 'ar' ? 'إضافة' : 'Add')}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* External Links Section (for non-purchase tickets) */}
                {!isPurchaseTicket && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <FormLabel>{language === 'ar' ? 'روابط خارجية' : 'External Links'}</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={addExternalLink}>
                        <LinkIcon className="h-4 w-4 mr-1" />
                        {language === 'ar' ? 'إضافة رابط' : 'Add Link'}
                      </Button>
                    </div>
                    {externalLinks.map((link, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="https://..."
                          value={link}
                          onChange={(e) => updateExternalLink(index, e.target.value)}
                        />
                        {externalLinks.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeExternalLink(index)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Images Upload */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <FormLabel>{language === 'ar' ? 'الصور' : 'Images'}</FormLabel>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <Image className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إضافة صور' : 'Add Images'}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {selectedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedImages.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="w-20 h-20 border rounded-lg overflow-hidden">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Videos Upload */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <FormLabel>{language === 'ar' ? 'الفيديوهات' : 'Videos'}</FormLabel>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        className="hidden"
                        onChange={handleVideoSelect}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <Video className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'إضافة فيديو' : 'Add Videos'}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {selectedVideos.length > 0 && (
                    <div className="space-y-2">
                      {selectedVideos.map((file, index) => (
                        <div key={index} className="flex items-center justify-between border rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <Video className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeVideo(index)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto">
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">{language === 'ar' ? 'جاري تحميل التذاكر...' : 'Loading tickets...'}</div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {language === 'ar' ? 'لم يتم العثور على تذاكر. أنشئ تذكرتك الأولى للبدء.' : 'No tickets found. Create your first ticket to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-base sm:text-lg leading-tight">{ticket.subject}</CardTitle>
                    <div className="flex flex-wrap gap-1 sm:gap-2 items-center text-xs sm:text-sm text-muted-foreground">
                      <span className="font-medium">{ticket.ticket_number}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{ticket.departments.department_name}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="w-full sm:w-auto">{format(new Date(ticket.created_at), "PPp")}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Badge variant={getPriorityColor(ticket.priority)} className="text-xs">
                      {language === 'ar' ? 
                        (ticket.priority === 'Low' ? 'منخفض' : 
                         ticket.priority === 'Medium' ? 'متوسط' : 
                         ticket.priority === 'High' ? 'عالي' : 'عاجل') 
                        : ticket.priority}
                    </Badge>
                    <Badge variant={getStatusColor(ticket.status)} className="text-xs">
                      {language === 'ar' ? 
                        (ticket.status === 'Open' ? 'مفتوح' : 
                         ticket.status === 'In Progress' ? 'قيد المعالجة' : 
                         ticket.status === 'Rejected' ? 'مرفوض' : 'مغلق') 
                        : ticket.status}
                    </Badge>
                    {getApprovalBadge(ticket)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                  {ticket.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                  {ticket.is_purchase_ticket && (
                    <Badge variant="outline" className="bg-primary/10 text-xs">
                      {language === 'ar' ? 'طلب شراء' : 'Purchase Request'}
                    </Badge>
                  )}
                  {ticket.ticket_attachments && ticket.ticket_attachments.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs sm:text-sm px-2 sm:px-3"
                      onClick={async () => {
                        const attachment = ticket.ticket_attachments[0];
                        // If it's a Cloudinary URL, open directly
                        if (attachment.file_path.startsWith('http')) {
                          window.open(attachment.file_path, '_blank');
                        } else {
                          // Fallback for old Supabase storage files
                          const { data } = await supabase.storage
                            .from('ticket-attachments')
                            .createSignedUrl(attachment.file_path, 60);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        }
                      }}
                    >
                      <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="truncate max-w-[120px] sm:max-w-none">
                        {ticket.ticket_attachments.length} {language === 'ar' ? 'مرفقات' : 'attachments'}
                      </span>
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs sm:text-sm flex-1 sm:flex-none"
                    onClick={() => navigate(`/tickets/${ticket.id}`, { state: { from: '/tickets' } })}
                  >
                    <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {language === 'ar' ? 'عرض' : 'View'}
                  </Button>
                  {!ticket.approved_at && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs sm:text-sm flex-1 sm:flex-none"
                        onClick={() => handleResendNotification(ticket)}
                      >
                        <Mail className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">{language === 'ar' ? 'إعادة إرسال' : 'Resend'}</span>
                        <span className="sm:hidden">{language === 'ar' ? 'إرسال' : 'Send'}</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs sm:text-sm"
                        onClick={() => handleDeleteClick(ticket.id)}
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'حذف' : 'Delete'}</span>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف التذكرة نهائياً من النظام.'
                : 'This action cannot be undone. This will permanently delete the ticket from the system.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tickets;
