import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, differenceInDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Thermometer,
  Palmtree,
  CheckCircle2,
  XCircle,
  HourglassIcon,
  Upload,
  Paperclip,
  Users,
  MessageSquare,
} from "lucide-react";

type RequestType = 'sick_leave' | 'vacation' | 'delay' | 'expense_refund' | 'experience_certificate' | 'other';

const REQUEST_TYPE_INFO: Record<RequestType, { icon: any; labelAr: string; labelEn: string; color: string }> = {
  sick_leave: { icon: Thermometer, labelAr: 'إجازة مرضية', labelEn: 'Sick Leave', color: 'bg-red-100 text-red-800' },
  vacation: { icon: Palmtree, labelAr: 'طلب إجازة', labelEn: 'Vacation', color: 'bg-green-100 text-green-800' },
  delay: { icon: Clock, labelAr: 'طلب تأخير', labelEn: 'Delay Request', color: 'bg-yellow-100 text-yellow-800' },
  expense_refund: { icon: DollarSign, labelAr: 'استرداد مصروفات', labelEn: 'Expense Refund', color: 'bg-blue-100 text-blue-800' },
  experience_certificate: { icon: FileText, labelAr: 'شهادة خبرة', labelEn: 'Experience Certificate', color: 'bg-purple-100 text-purple-800' },
  other: { icon: MessageSquare, labelAr: 'طلب آخر', labelEn: 'Other Request', color: 'bg-teal-100 text-teal-800' },
};

const STATUS_INFO: Record<string, { labelAr: string; labelEn: string; color: string; icon: any }> = {
  pending: { labelAr: 'قيد الانتظار', labelEn: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: HourglassIcon },
  manager_approved: { labelAr: 'موافقة المدير', labelEn: 'Manager Approved', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  hr_pending: { labelAr: 'قيد HR', labelEn: 'HR Pending', color: 'bg-orange-100 text-orange-800', icon: HourglassIcon },
  approved: { labelAr: 'مقبول', labelEn: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  rejected: { labelAr: 'مرفوض', labelEn: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { labelAr: 'ملغي', labelEn: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

const EmployeeSelfRequests = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [vacationBalances, setVacationBalances] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RequestType>('vacation');
  
  // New state for subordinate selection
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentUserPositionLevel, setCurrentUserPositionLevel] = useState<number | null>(null);

  const [vacationCodeId, setVacationCodeId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [delayDate, setDelayDate] = useState<Date | undefined>();
  const [delayMinutes, setDelayMinutes] = useState('');
  const [actualArrival, setActualArrival] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrencyId, setExpenseCurrencyId] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentFileName, setAttachmentFileName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: empData } = await supabase
        .from('employees')
        .select('id, department_id, job_position_id')
        .eq('user_id', user.id)
        .single();

      if (empData) {
        setEmployee(empData);

        // Get current user's position level
        let userPositionLevel: number | null = null;
        if (empData.job_position_id) {
          const { data: posData } = await supabase
            .from('job_positions')
            .select('position_level')
            .eq('id', empData.job_position_id)
            .single();
          userPositionLevel = posData?.position_level ?? null;
          setCurrentUserPositionLevel(userPositionLevel);
        }

        // Fetch subordinates (same department OR child departments, higher position_level = lower rank)
        if (empData.department_id) {
          // First, get all child department IDs recursively
          const getAllChildDepartments = async (deptId: string): Promise<string[]> => {
            const { data: children } = await supabase
              .from('departments')
              .select('id')
              .eq('parent_department_id', deptId)
              .eq('is_active', true);
            
            let allIds: string[] = [];
            if (children && children.length > 0) {
              for (const child of children) {
                allIds.push(child.id);
                const grandChildren = await getAllChildDepartments(child.id);
                allIds = [...allIds, ...grandChildren];
              }
            }
            return allIds;
          };

          const childDeptIds = await getAllChildDepartments(empData.department_id);
          const allDeptIds = [empData.department_id, ...childDeptIds];

          // Fetch employees from current department and all child departments
          const { data: deptEmployees } = await supabase
            .from('employees')
            .select(`
              id, 
              first_name, 
              first_name_ar, 
              last_name, 
              last_name_ar,
              job_position_id,
              job_positions!employees_job_position_id_fkey(position_level)
            `)
            .in('department_id', allDeptIds)
            .neq('id', empData.id);

          // Filter to only those with higher position_level (lower rank) or no level
          const subs = (deptEmployees || []).filter((emp: any) => {
            const empLevel = emp.job_positions?.position_level;
            // If current user has no level, they can't select anyone
            if (userPositionLevel === null) return false;
            // If target has no level, they're considered subordinate
            if (empLevel === null || empLevel === undefined) return true;
            // Higher number = lower rank = subordinate
            return empLevel > userPositionLevel;
          });

          setSubordinates(subs);
        }

        const { data: reqData } = await supabase
          .from('employee_requests')
          .select('*')
          .eq('employee_id', empData.id)
          .order('created_at', { ascending: false });

        setRequests(reqData || []);

        const { data: balanceData } = await supabase
          .from('employee_vacation_types')
          .select('id, vacation_code_id, balance, used_days, vacation_codes(name_en, name_ar)')
          .eq('employee_id', empData.id);

        setVacationBalances(balanceData || []);
      }

      const { data: currData } = await supabase
        .from('currencies')
        .select('id, currency_code, currency_name')
        .eq('is_active', true);

      setCurrencies(currData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setVacationCodeId('');
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setDelayDate(undefined);
    setDelayMinutes('');
    setActualArrival('');
    setExpenseAmount('');
    setExpenseCurrencyId('');
    setExpenseDescription('');
    setAttachmentUrl('');
    setAttachmentFileName('');
    setSelectedEmployeeId(''); // Reset to self
  };

  // Fetch vacation balances for selected employee
  const fetchVacationBalances = async (employeeId: string) => {
    const { data: balanceData } = await supabase
      .from('employee_vacation_types')
      .select('id, vacation_code_id, balance, used_days, vacation_codes(name_en, name_ar)')
      .eq('employee_id', employeeId);
    setVacationBalances(balanceData || []);
    setVacationCodeId(''); // Reset vacation code when employee changes
  };

  // When selectedEmployeeId changes, fetch that employee's balances
  useEffect(() => {
    if (dialogOpen) {
      const targetId = selectedEmployeeId || employee?.id;
      if (targetId) {
        fetchVacationBalances(targetId);
      }
    }
  }, [selectedEmployeeId, dialogOpen, employee?.id]);

  const calculateTotalDays = () => {
    if (startDate && endDate) {
      return differenceInDays(endDate, startDate) + 1;
    }
    return 0;
  };

  const getAvailableBalance = () => {
    if (!vacationCodeId) return 0;
    const balance = vacationBalances.find((b: any) => b.vacation_code_id === vacationCodeId);
    if (balance) {
      return balance.balance - balance.used_days;
    }
    return 0;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `employee-requests/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setAttachmentUrl(publicUrl);
      setAttachmentFileName(file.name);

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم رفع المرفق بنجاح' : 'Attachment uploaded successfully',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const requiresAttachment = (type: RequestType): boolean => {
    return type === 'sick_leave' || type === 'expense_refund';
  };

  const handleSubmit = async () => {
    if (!employee) return;

    // Validate mandatory attachment for sick_leave and expense_refund
    if (requiresAttachment(selectedType) && !attachmentUrl) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'المرفق إلزامي لهذا النوع من الطلبات' : 'Attachment is mandatory for this request type',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Determine target employee - use selected subordinate or self
      const targetEmployeeId = selectedEmployeeId || employee.id;
      const isOnBehalf = selectedEmployeeId && selectedEmployeeId !== employee.id;
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const requestData: any = {
        employee_id: targetEmployeeId,
        request_type: selectedType,
        department_id: employee.department_id,
        reason,
        // "Other" requests go directly to HR Manager
        ...(selectedType === 'other' ? { status: 'hr_pending' } : {}),
      };
      
      // Only set submitted_by_id if submitting on behalf of someone else
      if (isOnBehalf) {
        requestData.submitted_by_id = employee.id;
      }

      // Check if the submitter (or the employee on whose behalf) is a department manager
      // If so, skip manager approval levels where the submitter would approve their own request
      if (selectedType !== 'other' && user) {
        const { data: deptAdmins } = await supabase
          .from('department_admins')
          .select('user_id, admin_order')
          .eq('department_id', employee.department_id)
          .eq('approve_employee_request', true)
          .order('admin_order');

        if (deptAdmins && deptAdmins.length > 0) {
          // Find the first manager level that is NOT the submitter
          const submitterUserId = user.id;
          const nextNonSelfAdmin = deptAdmins.find(a => a.user_id !== submitterUserId);
          
          if (nextNonSelfAdmin) {
            // Skip to the next non-self manager level
            requestData.current_approval_level = nextNonSelfAdmin.admin_order;
            requestData.current_phase = 'manager';
          } else {
            // All manager levels are the submitter themselves - skip to HR
            const { data: firstHR } = await supabase
              .from('hr_managers')
              .select('admin_order')
              .eq('is_active', true)
              .order('admin_order')
              .limit(1);

            requestData.current_phase = 'hr';
            requestData.status = 'manager_approved';
            requestData.manager_approved_at = new Date().toISOString();
            requestData.manager_approved_by = submitterUserId;
            requestData.current_approval_level = firstHR?.[0]?.admin_order ?? 0;
          }
        }
      }

      if (selectedType === 'sick_leave' || selectedType === 'vacation') {
        requestData.vacation_code_id = vacationCodeId || null;
        requestData.start_date = startDate ? format(startDate, 'yyyy-MM-dd') : null;
        requestData.end_date = endDate ? format(endDate, 'yyyy-MM-dd') : null;
        requestData.total_days = calculateTotalDays();
      }

      if (selectedType === 'sick_leave' || selectedType === 'other') {
        requestData.attachment_url = attachmentUrl || null;
      }

      if (selectedType === 'delay') {
        requestData.delay_date = delayDate ? format(delayDate, 'yyyy-MM-dd') : null;
        requestData.delay_minutes = parseInt(delayMinutes);
        requestData.actual_arrival_time = actualArrival || null;
      }

      if (selectedType === 'expense_refund') {
        requestData.expense_amount = parseFloat(expenseAmount);
        requestData.expense_currency_id = expenseCurrencyId;
        requestData.expense_description = expenseDescription;
        requestData.expense_receipt_url = attachmentUrl;
      }

      const { error } = await supabase.from('employee_requests').insert(requestData);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إرسال الطلب بنجاح' : 'Request submitted successfully',
      });

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{language === 'ar' ? 'طلبات الموظف' : 'Employee Requests'}</h1>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'طلب جديد' : 'New Request'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(Object.keys(REQUEST_TYPE_INFO) as RequestType[]).map((type) => {
          const info = REQUEST_TYPE_INFO[type];
          const Icon = info.icon;
          return (
            <Card key={type} className="cursor-pointer hover:shadow-md" onClick={() => { setSelectedType(type); resetForm(); setDialogOpen(true); }}>
              <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                <Icon className="h-8 w-8 mb-2 text-primary" />
                <span className="text-sm font-medium">{language === 'ar' ? info.labelAr : info.labelEn}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {vacationBalances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{language === 'ar' ? 'أرصدة الإجازات' : 'Vacation Balances'}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {vacationBalances.map((balance: any) => (
                <div key={balance.id} className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? balance.vacation_codes?.name_ar || balance.vacation_codes?.name_en : balance.vacation_codes?.name_en}</p>
                  <p className="text-xl font-bold text-primary">{balance.balance - balance.used_days}<span className="text-sm font-normal text-muted-foreground ml-1">/ {balance.balance}</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">{language === 'ar' ? 'سجل الطلبات' : 'Request History'}</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Request #'}</TableHead>
                  <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{language === 'ar' ? 'لا توجد طلبات' : 'No requests found'}</TableCell></TableRow>
                ) : requests.map((request: any) => {
                  const typeInfo = REQUEST_TYPE_INFO[request.request_type as RequestType];
                  const statusInfo = STATUS_INFO[request.status] || STATUS_INFO.pending;
                  const TypeIcon = typeInfo?.icon || FileText;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">{request.request_number}</TableCell>
                      <TableCell><Badge className={typeInfo?.color || ''}><TypeIcon className="h-3 w-3 mr-1" />{language === 'ar' ? typeInfo?.labelAr : typeInfo?.labelEn}</Badge></TableCell>
                      <TableCell><Badge className={statusInfo.color}><StatusIcon className="h-3 w-3 mr-1" />{language === 'ar' ? statusInfo.labelAr : statusInfo.labelEn}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(request.created_at), 'yyyy-MM-dd')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? REQUEST_TYPE_INFO[selectedType].labelAr : REQUEST_TYPE_INFO[selectedType].labelEn}</DialogTitle>
          </DialogHeader>
          
          {/* Removed Tabs component - now shows only the selected type form */}
          <div className="space-y-4 py-4">
            {/* Employee selector for managers - only show if user has subordinates */}
            {subordinates.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {language === 'ar' ? 'تقديم الطلب باسم' : 'Submit request for'}
                </Label>
                <Select value={selectedEmployeeId || 'self'} onValueChange={(val) => setSelectedEmployeeId(val === 'self' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'نفسي' : 'Myself'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">
                      {language === 'ar' ? 'نفسي' : 'Myself'}
                    </SelectItem>
                    {subordinates.map((sub: any) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {language === 'ar' 
                          ? `${sub.first_name_ar || sub.first_name} ${sub.last_name_ar || sub.last_name}`
                          : `${sub.first_name} ${sub.last_name}`
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(selectedType === 'sick_leave' || selectedType === 'vacation') && (
              <>
                <Select value={vacationCodeId} onValueChange={setVacationCodeId}>
                  <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'نوع الإجازة' : 'Leave Type'} /></SelectTrigger>
                  <SelectContent>
                    {vacationBalances.map((b: any) => (
                      <SelectItem key={b.vacation_code_id} value={b.vacation_code_id}>
                        {language === 'ar' ? b.vacation_codes?.name_ar || b.vacation_codes?.name_en : b.vacation_codes?.name_en} ({b.balance - b.used_days} {language === 'ar' ? 'متاح' : 'avail'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vacationCodeId && (
                  <div className={`p-2 rounded text-sm ${calculateTotalDays() > getAvailableBalance() ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {language === 'ar' ? 'المتاح:' : 'Available:'} {getAvailableBalance()} | {language === 'ar' ? 'المطلوب:' : 'Requested:'} {calculateTotalDays()}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, 'yyyy-MM-dd') : (language === 'ar' ? 'من' : 'From')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} /></PopoverContent></Popover>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, 'yyyy-MM-dd') : (language === 'ar' ? 'إلى' : 'To')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent></Popover>
                </div>
              </>
            )}

            {/* Sick Leave Attachment - Mandatory */}
            {selectedType === 'sick_leave' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {language === 'ar' ? 'المرفق (إلزامي)' : 'Attachment (Required)'}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {language === 'ar' ? 'رفع مرفق' : 'Upload Attachment'}
                  </Button>
                  {attachmentFileName && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Paperclip className="h-4 w-4" />
                      <span className="truncate max-w-[150px]">{attachmentFileName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedType === 'delay' && (
              <>
                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{delayDate ? format(delayDate, 'yyyy-MM-dd') : (language === 'ar' ? 'تاريخ التأخير' : 'Delay Date')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={delayDate} onSelect={setDelayDate} /></PopoverContent></Popover>
                <Input type="number" placeholder={language === 'ar' ? 'الدقائق' : 'Minutes'} value={delayMinutes} onChange={(e) => setDelayMinutes(e.target.value)} />
                <Input type="time" value={actualArrival} onChange={(e) => setActualArrival(e.target.value)} />
              </>
            )}

            {selectedType === 'expense_refund' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" step="0.01" placeholder={language === 'ar' ? 'المبلغ' : 'Amount'} value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                  <Select value={expenseCurrencyId} onValueChange={setExpenseCurrencyId}>
                    <SelectTrigger><SelectValue placeholder={language === 'ar' ? 'العملة' : 'Currency'} /></SelectTrigger>
                    <SelectContent>{currencies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Textarea placeholder={language === 'ar' ? 'وصف المصروفات' : 'Expense Description'} value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />
                
                {/* Expense Refund Attachment - Mandatory */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {language === 'ar' ? 'إيصال المصروفات (إلزامي)' : 'Expense Receipt (Required)'}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,.pdf"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {language === 'ar' ? 'رفع الإيصال' : 'Upload Receipt'}
                    </Button>
                    {attachmentFileName && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <Paperclip className="h-4 w-4" />
                        <span className="truncate max-w-[150px]">{attachmentFileName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {selectedType === 'other' && (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'مرفق (اختياري)' : 'Attachment (Optional)'}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {language === 'ar' ? 'رفع مرفق' : 'Upload Attachment'}
                  </Button>
                  {attachmentFileName && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Paperclip className="h-4 w-4" />
                      <span className="truncate max-w-[150px]">{attachmentFileName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <Textarea placeholder={language === 'ar' ? 'السبب' : 'Reason'} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{language === 'ar' ? 'إرسال' : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeSelfRequests;
