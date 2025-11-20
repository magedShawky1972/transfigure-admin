import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Eye, Trash2, FileText, Download } from "lucide-react";
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

const getFormSchema = (language: string) => z.object({
  department_id: z.string().min(1, language === 'ar' ? "القسم مطلوب" : "Department is required"),
  subject: z.string().min(3, language === 'ar' ? "الموضوع يجب أن يكون 3 أحرف على الأقل" : "Subject must be at least 3 characters"),
  description: z.string().min(10, language === 'ar' ? "الوصف يجب أن يكون 10 أحرف على الأقل" : "Description must be at least 10 characters"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  is_purchase: z.boolean().default(false),
  attachment: z.any().optional(),
});

type Department = {
  id: string;
  department_name: string;
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
  is_purchase: boolean;
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const formSchema = getFormSchema(language);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      department_id: "",
      subject: "",
      description: "",
      priority: "Medium",
      is_purchase: false,
      attachment: undefined,
    },
  });

  useEffect(() => {
    checkAdminStatus();
    fetchTickets();
    fetchDepartments();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!error && data) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
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

  const handleDelete = async () => {
    if (!ticketToDelete) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(language === 'ar' ? "غير مصرح" : "Not authenticated");

      // Soft delete: mark as deleted instead of removing from database
      const { error } = await supabase
        .from("tickets")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq("id", ticketToDelete);

      if (error) throw error;

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' ? "تم حذف التذكرة بنجاح" : "Ticket deleted successfully",
      });

      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(language === 'ar' ? "غير مصرح" : "Not authenticated");

      // Create the ticket first
      const { data: ticketData, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department_id: values.department_id,
          subject: values.subject,
          description: values.description,
          priority: values.priority,
          is_purchase: values.is_purchase,
          ticket_number: "", // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (error) throw error;

      // Handle file upload if attachment exists
      if (values.attachment && values.attachment[0] && ticketData) {
        const file = values.attachment[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        
        // Insert attachment record
        const { error: attachmentError } = await supabase
          .from('ticket_attachments')
          .insert({
            ticket_id: ticketData.id,
            user_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
          });

        if (attachmentError) throw attachmentError;
      }

      // Get department admins to notify
      const { data: admins } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", values.department_id);

      // Send notifications to all department admins
      if (admins && ticketData) {
        for (const admin of admins) {
          await supabase.functions.invoke("send-ticket-notification", {
            body: {
              type: "ticket_created",
              ticketId: ticketData.id,
              recipientUserId: admin.user_id,
              ticketNumber: ticketData.ticket_number,
              subject: values.subject,
            },
          });
        }
      }

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully",
      });

      setOpen(false);
      form.reset();
      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
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
      default: return "default";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{language === 'ar' ? 'تذاكري' : 'My Tickets'}</h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' ? 'إنشاء وتتبع تذاكر الدعم الخاصة بك' : 'Create and track your support tickets'}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
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
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_purchase"
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
                <FormField
                  control={form.control}
                  name="attachment"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'مرفق' : 'Attachment'}</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => onChange(e.target.files)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button type="submit">{language === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket'}</Button>
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
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <div className="flex gap-2 items-center text-sm text-muted-foreground">
                      <span className="font-medium">{ticket.ticket_number}</span>
                      <span>•</span>
                      <span>{ticket.departments.department_name}</span>
                      <span>•</span>
                      <span>{format(new Date(ticket.created_at), "PPp")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityColor(ticket.priority)}>
                      {language === 'ar' ? 
                        (ticket.priority === 'Low' ? 'منخفض' : 
                         ticket.priority === 'Medium' ? 'متوسط' : 
                         ticket.priority === 'High' ? 'عالي' : 'عاجل') 
                        : ticket.priority}
                    </Badge>
                    <Badge variant={getStatusColor(ticket.status)}>
                      {language === 'ar' ? 
                        (ticket.status === 'Open' ? 'مفتوح' : 
                         ticket.status === 'In Progress' ? 'قيد المعالجة' : 'مغلق') 
                        : ticket.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {ticket.description}
                </p>
                <div className="flex items-center gap-4 mb-4">
                  {ticket.is_purchase && (
                    <Badge variant="outline" className="bg-primary/10">
                      {language === 'ar' ? 'طلب شراء' : 'Purchase Request'}
                    </Badge>
                  )}
                  {ticket.ticket_attachments && ticket.ticket_attachments.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const attachment = ticket.ticket_attachments[0];
                        const { data } = await supabase.storage
                          .from('ticket-attachments')
                          .createSignedUrl(attachment.file_path, 60);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, '_blank');
                        }
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {ticket.ticket_attachments[0].file_name || (language === 'ar' ? 'مرفق' : 'Attachment')}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                  </Button>
                  {(isAdmin || (ticket.status === 'Open' && !ticket.assigned_to)) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setTicketToDelete(ticket.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'حذف' : 'Delete'}
                    </Button>
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
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'هل أنت متأكد أنك تريد حذف هذه التذكرة؟ سيتم وضع علامة حذف عليها.'
                : 'Are you sure you want to delete this ticket? It will be marked as deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tickets;
