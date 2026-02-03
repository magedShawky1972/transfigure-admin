import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  X,
  Loader2,
  Thermometer,
  Palmtree,
  Clock,
  DollarSign,
  FileText,
  Eye,
  Filter,
  AlertTriangle,
  Calendar,
  User,
  Building,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";

const REQUEST_TYPE_INFO: Record<string, { icon: any; labelAr: string; labelEn: string; color: string }> = {
  sick_leave: { icon: Thermometer, labelAr: 'إجازة مرضية', labelEn: 'Sick Leave', color: 'bg-red-100 text-red-800' },
  vacation: { icon: Palmtree, labelAr: 'طلب إجازة', labelEn: 'Vacation', color: 'bg-green-100 text-green-800' },
  delay: { icon: Clock, labelAr: 'طلب تأخير', labelEn: 'Delay Request', color: 'bg-yellow-100 text-yellow-800' },
  expense_refund: { icon: DollarSign, labelAr: 'استرداد مصروفات', labelEn: 'Expense Refund', color: 'bg-blue-100 text-blue-800' },
  experience_certificate: { icon: FileText, labelAr: 'شهادة خبرة', labelEn: 'Experience Certificate', color: 'bg-purple-100 text-purple-800' },
};

const EmployeeRequestApprovals = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [isHRManager, setIsHRManager] = useState(false);
  const [hrManagerLevel, setHrManagerLevel] = useState<number | null>(null);
  const [userAdminDepts, setUserAdminDepts] = useState<string[]>([]);
  const [userAdminLevel, setUserAdminLevel] = useState<Map<string, number>>(new Map());
  const [pendingApprovers, setPendingApprovers] = useState<Map<string, string>>(new Map());

  useEffect(() => { fetchUserPermissions(); }, []);
  useEffect(() => { if (userAdminDepts.length > 0 || isHRManager) fetchRequests(); }, [userAdminDepts, isHRManager, filterType, filterStatus]);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: hrData } = await supabase.from('hr_managers').select('id, admin_order').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (hrData) {
        setIsHRManager(true);
        setHrManagerLevel(hrData.admin_order);
      }

      const { data: adminData } = await supabase.from('department_admins').select('department_id, admin_order').eq('user_id', user.id).eq('approve_employee_request', true);
      if (adminData && adminData.length > 0) {
        setUserAdminDepts(adminData.map(a => a.department_id));
        const levelMap = new Map<string, number>();
        adminData.forEach(a => levelMap.set(a.department_id, a.admin_order));
        setUserAdminLevel(levelMap);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchRequests = async () => {
    try {
      let query = supabase.from('employee_requests').select(`
        *,
        employees:employee_id(first_name, first_name_ar, last_name, last_name_ar),
        departments:department_id(department_name, department_name_ar)
      `).order('created_at', { ascending: false });
      
      if (filterStatus === 'pending') query = query.in('status', ['pending', 'manager_approved', 'hr_pending']);
      else if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterType !== 'all') query = query.eq('request_type', filterType);

      const { data } = await query;
      if (data) {
        setRequests(data);
        await fetchPendingApprovers(data);
      }
    } catch (error) { console.error(error); }
  };

  const fetchPendingApprovers = async (requestsList: any[]) => {
    const approverMap = new Map<string, string>();
    
    for (const req of requestsList) {
      if (['approved', 'rejected', 'cancelled'].includes(req.status)) continue;
      
      if (req.current_phase === 'manager') {
        const { data: admins } = await supabase
          .from('department_admins')
          .select('user_id')
          .eq('department_id', req.department_id)
          .eq('approve_employee_request', true)
          .eq('admin_order', req.current_approval_level);
        
        if (admins && admins.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', admins[0].user_id)
            .single();
          approverMap.set(req.id, profile?.email || 'Unknown');
        } else {
          approverMap.set(req.id, language === 'ar' ? 'لا يوجد معتمد مُعيَّن' : 'No approver assigned');
        }
      } else if (req.current_phase === 'hr') {
        const { data: hrManagers } = await supabase
          .from('hr_managers')
          .select('user_id')
          .eq('is_active', true)
          .eq('admin_order', req.current_approval_level);
        
        if (hrManagers && hrManagers.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', hrManagers[0].user_id)
            .single();
          approverMap.set(req.id, profile?.email || 'HR Manager');
        } else {
          approverMap.set(req.id, language === 'ar' ? 'لا يوجد مدير HR مُعيَّن' : 'No HR Manager assigned');
        }
      }
    }
    
    setPendingApprovers(approverMap);
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (actionType === 'reject') {
        await supabase.from('employee_requests').update({ 
          status: 'rejected', 
          rejected_at: new Date().toISOString(), 
          rejected_by: user.id, 
          rejection_reason: actionComment 
        }).eq('id', selectedRequest.id);
      } else {
        const updateData: any = {};
        if (actionComment) {
          updateData.approval_comments = selectedRequest.approval_comments 
            ? `${selectedRequest.approval_comments}\n---\n${actionComment}` 
            : actionComment;
        }
        
        if (selectedRequest.current_phase === 'manager') {
          const { data: nextAdmin } = await supabase.from('department_admins').select('admin_order').eq('department_id', selectedRequest.department_id).eq('approve_employee_request', true).gt('admin_order', selectedRequest.current_approval_level).order('admin_order').limit(1);
          if (nextAdmin && nextAdmin.length > 0) {
            await supabase.from('employee_requests').update({ 
              ...updateData,
              current_approval_level: nextAdmin[0].admin_order, 
              manager_approved_at: new Date().toISOString(), 
              manager_approved_by: user.id 
            }).eq('id', selectedRequest.id);
          } else {
            await supabase.from('employee_requests').update({ 
              ...updateData,
              status: 'manager_approved', 
              current_phase: 'hr', 
              current_approval_level: 0, 
              manager_approved_at: new Date().toISOString(), 
              manager_approved_by: user.id 
            }).eq('id', selectedRequest.id);
          }
        } else {
          const { data: nextHR } = await supabase.from('hr_managers').select('admin_order').eq('is_active', true).gt('admin_order', selectedRequest.current_approval_level).order('admin_order').limit(1);
          if (nextHR && nextHR.length > 0) {
            await supabase.from('employee_requests').update({ 
              ...updateData,
              current_approval_level: nextHR[0].admin_order, 
              hr_approved_at: new Date().toISOString(), 
              hr_approved_by: user.id 
            }).eq('id', selectedRequest.id);
          } else {
            await supabase.from('employee_requests').update({ 
              ...updateData,
              status: 'approved', 
              hr_approved_at: new Date().toISOString(), 
              hr_approved_by: user.id 
            }).eq('id', selectedRequest.id);
          }
        }
      }
      toast({ title: language === 'ar' ? 'تم' : 'Done' });
      closeActionDialog();
      fetchRequests();
    } catch (error: any) { 
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); 
    } finally { 
      setProcessing(false); 
    }
  };

  const openActionDialog = (request: any, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setActionComment('');
    setActionDialogOpen(true);
  };

  const closeActionDialog = () => {
    setActionDialogOpen(false);
    setSelectedRequest(null);
    setActionType(null);
    setActionComment('');
  };

  const openViewDialog = (request: any) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const closeViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedRequest(null);
  };

  const canTakeAction = (request: any) => {
    if (['approved', 'rejected', 'cancelled'].includes(request.status)) return false;
    if (request.current_phase === 'hr' && isHRManager && hrManagerLevel === request.current_approval_level) return true;
    if (request.current_phase === 'manager' && request.department_id) {
      const userLevel = userAdminLevel.get(request.department_id);
      return userLevel !== undefined && request.current_approval_level === userLevel;
    }
    return false;
  };

  const getEmployeeName = (emp: any) => {
    if (!emp) return '-';
    if (language === 'ar') {
      return `${emp.first_name_ar || emp.first_name || ''} ${emp.last_name_ar || emp.last_name || ''}`.trim() || '-';
    }
    return `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '-';
  };

  const getDepartmentName = (dept: any) => {
    if (!dept) return '-';
    return language === 'ar' ? (dept.department_name_ar || dept.department_name) : dept.department_name;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; labelAr: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pending Manager', labelAr: 'بانتظار المدير', variant: 'secondary' },
      manager_approved: { label: 'Pending HR', labelAr: 'بانتظار HR', variant: 'default' },
      hr_pending: { label: 'Pending HR', labelAr: 'بانتظار HR', variant: 'default' },
      approved: { label: 'Approved', labelAr: 'مقبول', variant: 'default' },
      rejected: { label: 'Rejected', labelAr: 'مرفوض', variant: 'destructive' },
      cancelled: { label: 'Cancelled', labelAr: 'ملغي', variant: 'outline' },
    };
    const config = statusConfig[status] || { label: status, labelAr: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{language === 'ar' ? config.labelAr : config.label}</Badge>;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'yyyy-MM-dd');
    } catch {
      return date;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!isHRManager && userAdminDepts.length === 0) {
    return <div className="p-6"><Card><CardContent className="py-12 text-center"><X className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p>{language === 'ar' ? 'غير مصرح' : 'Not Authorized'}</p></CardContent></Card></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{language === 'ar' ? 'اعتماد الطلبات' : 'Request Approvals'}</h1>
        {isHRManager && <Badge className="bg-blue-600">{language === 'ar' ? `مدير HR (المستوى ${hrManagerLevel})` : `HR Manager (Level ${hrManagerLevel})`}</Badge>}
      </div>

      <Card>
        <CardContent className="pt-4 flex gap-4 items-center">
          <Filter className="h-4 w-4" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
              {Object.keys(REQUEST_TYPE_INFO).map(t => <SelectItem key={t} value={t}>{language === 'ar' ? REQUEST_TYPE_INFO[t].labelAr : REQUEST_TYPE_INFO[t].labelEn}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</SelectItem>
              <SelectItem value="approved">{language === 'ar' ? 'مقبول' : 'Approved'}</SelectItem>
              <SelectItem value="rejected">{language === 'ar' ? 'مرفوض' : 'Rejected'}</SelectItem>
              <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{language === 'ar' ? 'الطلبات' : 'Requests'}</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{language === 'ar' ? 'رقم' : '#'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'بانتظار' : 'Waiting For'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراء' : 'Action'}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {requests.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center">{language === 'ar' ? 'لا توجد طلبات' : 'No requests'}</TableCell></TableRow> : requests.map((r: any) => {
                  const info = REQUEST_TYPE_INFO[r.request_type] || REQUEST_TYPE_INFO.vacation;
                  const Icon = info.icon;
                  const canAct = canTakeAction(r);
                  const employeeName = getEmployeeName(r.employees);
                  const pendingApprover = pendingApprovers.get(r.id);
                  const isStuck = pendingApprover?.includes('No') || pendingApprover?.includes('لا يوجد');
                  
                  return (
                    <TableRow key={r.id} className={canAct ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                      <TableCell className="font-mono text-sm">{r.request_number}</TableCell>
                      <TableCell className="font-medium">{employeeName}</TableCell>
                      <TableCell><Badge className={info.color}><Icon className="h-3 w-3 mr-1" />{language === 'ar' ? info.labelAr : info.labelEn}</Badge></TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell>
                        {['approved', 'rejected', 'cancelled'].includes(r.status) ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {isStuck && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                            <span className={isStuck ? 'text-orange-600 font-medium' : 'text-sm'}>
                              {pendingApprover || '-'}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openViewDialog(r)} title={language === 'ar' ? 'عرض التفاصيل' : 'View Details'}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canAct && (
                            <>
                              <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => openActionDialog(r, 'approve')} title={language === 'ar' ? 'اعتماد' : 'Approve'}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => openActionDialog(r, 'reject')} title={language === 'ar' ? 'رفض' : 'Reject'}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {language === 'ar' ? 'تفاصيل الطلب' : 'Request Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.request_number}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{language === 'ar' ? 'الموظف' : 'Employee'}</Label>
                  <p className="font-medium">{getEmployeeName(selectedRequest.employees)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" />{language === 'ar' ? 'القسم' : 'Department'}</Label>
                  <p className="font-medium">{getDepartmentName(selectedRequest.departments)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{language === 'ar' ? 'نوع الطلب' : 'Request Type'}</Label>
                  <div>{(() => {
                    const info = REQUEST_TYPE_INFO[selectedRequest.request_type] || REQUEST_TYPE_INFO.vacation;
                    const TypeIcon = info.icon;
                    return <Badge className={info.color}><TypeIcon className="h-3 w-3 mr-1" />{language === 'ar' ? info.labelAr : info.labelEn}</Badge>;
                  })()}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</Label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              {(selectedRequest.start_date || selectedRequest.end_date) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
                      <p className="font-medium">{formatDate(selectedRequest.start_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
                      <p className="font-medium">{formatDate(selectedRequest.end_date)}</p>
                    </div>
                  </div>
                </>
              )}

              {selectedRequest.request_type === 'expense_refund' && selectedRequest.amount && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />{language === 'ar' ? 'المبلغ' : 'Amount'}</Label>
                    <p className="font-medium text-lg">{selectedRequest.amount?.toLocaleString()} {language === 'ar' ? 'ر.س' : 'SAR'}</p>
                  </div>
                </>
              )}

              {selectedRequest.notes && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                    <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.notes}</p>
                  </div>
                </>
              )}

              {selectedRequest.rejection_reason && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-red-600">{language === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}</Label>
                    <p className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-red-700 dark:text-red-300">{selectedRequest.rejection_reason}</p>
                  </div>
                </>
              )}

              {selectedRequest.approval_comments && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-green-600">{language === 'ar' ? 'تعليقات الاعتماد' : 'Approval Comments'}</Label>
                    <p className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md text-green-700 dark:text-green-300 whitespace-pre-wrap">{selectedRequest.approval_comments}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="text-xs text-muted-foreground">
                {language === 'ar' ? 'تاريخ الإنشاء:' : 'Created:'} {formatDate(selectedRequest.created_at)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeViewDialog}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
            {selectedRequest && canTakeAction(selectedRequest) && (
              <div className="flex gap-2">
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => { closeViewDialog(); openActionDialog(selectedRequest, 'approve'); }}>
                  <Check className="h-4 w-4 mr-1" />{language === 'ar' ? 'اعتماد' : 'Approve'}
                </Button>
                <Button variant="destructive" onClick={() => { closeViewDialog(); openActionDialog(selectedRequest, 'reject'); }}>
                  <X className="h-4 w-4 mr-1" />{language === 'ar' ? 'رفض' : 'Reject'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject with Comment) */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' ? (
                <><Check className="h-5 w-5 text-green-600" />{language === 'ar' ? 'تأكيد الاعتماد' : 'Confirm Approval'}</>
              ) : (
                <><X className="h-5 w-5 text-red-600" />{language === 'ar' ? 'تأكيد الرفض' : 'Confirm Rejection'}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.request_number} - {getEmployeeName(selectedRequest?.employees)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{actionType === 'reject' ? (language === 'ar' ? 'سبب الرفض *' : 'Rejection Reason *') : (language === 'ar' ? 'تعليق (اختياري)' : 'Comment (Optional)')}</Label>
              <Textarea 
                placeholder={actionType === 'reject' ? (language === 'ar' ? 'أدخل سبب الرفض...' : 'Enter rejection reason...') : (language === 'ar' ? 'أضف تعليقاً...' : 'Add a comment...')} 
                value={actionComment} 
                onChange={(e) => setActionComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button 
              variant={actionType === 'reject' ? 'destructive' : 'default'} 
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={handleAction} 
              disabled={processing || (actionType === 'reject' && !actionComment.trim())}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? (
                <><Check className="h-4 w-4 mr-1" />{language === 'ar' ? 'اعتماد' : 'Approve'}</>
              ) : (
                <><X className="h-4 w-4 mr-1" />{language === 'ar' ? 'رفض' : 'Reject'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeRequestApprovals;
