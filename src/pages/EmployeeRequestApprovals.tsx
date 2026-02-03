import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Thermometer,
  Palmtree,
  Clock,
  DollarSign,
  FileText,
  Eye,
  Filter,
  AlertTriangle,
} from "lucide-react";

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
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
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
        // Fetch pending approvers for each request
        await fetchPendingApprovers(data);
      }
    } catch (error) { console.error(error); }
  };

  const fetchPendingApprovers = async (requestsList: any[]) => {
    const approverMap = new Map<string, string>();
    
    for (const req of requestsList) {
      if (['approved', 'rejected', 'cancelled'].includes(req.status)) continue;
      
      if (req.current_phase === 'manager') {
        // Find department admin at this level
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
        // Find HR manager at this level
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
        await supabase.from('employee_requests').update({ status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: user.id, rejection_reason: rejectionReason }).eq('id', selectedRequest.id);
      } else {
        if (selectedRequest.current_phase === 'manager') {
          const { data: nextAdmin } = await supabase.from('department_admins').select('admin_order').eq('department_id', selectedRequest.department_id).eq('approve_employee_request', true).gt('admin_order', selectedRequest.current_approval_level).order('admin_order').limit(1);
          if (nextAdmin && nextAdmin.length > 0) {
            await supabase.from('employee_requests').update({ current_approval_level: nextAdmin[0].admin_order, manager_approved_at: new Date().toISOString(), manager_approved_by: user.id }).eq('id', selectedRequest.id);
          } else {
            await supabase.from('employee_requests').update({ status: 'manager_approved', current_phase: 'hr', current_approval_level: 0, manager_approved_at: new Date().toISOString(), manager_approved_by: user.id }).eq('id', selectedRequest.id);
          }
        } else {
          // HR phase - check for next HR level
          const { data: nextHR } = await supabase.from('hr_managers').select('admin_order').eq('is_active', true).gt('admin_order', selectedRequest.current_approval_level).order('admin_order').limit(1);
          if (nextHR && nextHR.length > 0) {
            await supabase.from('employee_requests').update({ current_approval_level: nextHR[0].admin_order, hr_approved_at: new Date().toISOString(), hr_approved_by: user.id }).eq('id', selectedRequest.id);
          } else {
            await supabase.from('employee_requests').update({ status: 'approved', hr_approved_at: new Date().toISOString(), hr_approved_by: user.id }).eq('id', selectedRequest.id);
          }
        }
      }
      toast({ title: language === 'ar' ? 'تم' : 'Done' });
      setSelectedRequest(null); setActionType(null); setRejectionReason(''); fetchRequests();
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } finally { setProcessing(false); }
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!isHRManager && userAdminDepts.length === 0) {
    return <div className="p-6"><Card><CardContent className="py-12 text-center"><XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p>{language === 'ar' ? 'غير مصرح' : 'Not Authorized'}</p></CardContent></Card></div>;
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
                        {canAct ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setSelectedRequest(r); setActionType('approve'); }}><CheckCircle2 className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => { setSelectedRequest(r); setActionType('reject'); }}><XCircle className="h-4 w-4" /></Button>
                          </div>
                        ) : <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(r)}><Eye className="h-4 w-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => { setSelectedRequest(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'approve' ? (language === 'ar' ? 'تأكيد الاعتماد' : 'Confirm Approval') : (language === 'ar' ? 'تأكيد الرفض' : 'Confirm Rejection')}</DialogTitle></DialogHeader>
          {actionType === 'reject' && <Textarea placeholder={language === 'ar' ? 'سبب الرفض' : 'Rejection reason'} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setActionType(null); }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={handleAction} disabled={processing || (actionType === 'reject' && !rejectionReason)}>{processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{actionType === 'approve' ? (language === 'ar' ? 'اعتماد' : 'Approve') : (language === 'ar' ? 'رفض' : 'Reject')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeRequestApprovals;
