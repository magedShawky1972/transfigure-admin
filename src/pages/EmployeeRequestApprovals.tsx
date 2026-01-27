import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
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
  const [userAdminDepts, setUserAdminDepts] = useState<string[]>([]);
  const [userAdminLevel, setUserAdminLevel] = useState<Map<string, number>>(new Map());

  useEffect(() => { fetchUserPermissions(); }, []);
  useEffect(() => { if (userAdminDepts.length > 0 || isHRManager) fetchRequests(); }, [userAdminDepts, isHRManager, filterType, filterStatus]);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: hrData } = await supabase.from('hr_managers').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (hrData) setIsHRManager(true);

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
      let query = supabase.from('employee_requests').select('*').order('created_at', { ascending: false });
      if (filterStatus === 'pending') query = query.in('status', ['pending', 'manager_approved', 'hr_pending']);
      else if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterType !== 'all') query = query.eq('request_type', filterType);

      const { data } = await query;
      setRequests(data || []);
    } catch (error) { console.error(error); }
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
          await supabase.from('employee_requests').update({ status: 'approved', hr_approved_at: new Date().toISOString(), hr_approved_by: user.id }).eq('id', selectedRequest.id);
        }
      }
      toast({ title: language === 'ar' ? 'تم' : 'Done' });
      setSelectedRequest(null); setActionType(null); setRejectionReason(''); fetchRequests();
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } finally { setProcessing(false); }
  };

  const canTakeAction = (request: any) => {
    if (['approved', 'rejected', 'cancelled'].includes(request.status)) return false;
    if (request.current_phase === 'hr' && isHRManager) return true;
    if (request.current_phase === 'manager' && request.department_id) {
      const userLevel = userAdminLevel.get(request.department_id);
      return userLevel !== undefined && request.current_approval_level === userLevel;
    }
    return false;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!isHRManager && userAdminDepts.length === 0) {
    return <div className="p-6"><Card><CardContent className="py-12 text-center"><XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p>{language === 'ar' ? 'غير مصرح' : 'Not Authorized'}</p></CardContent></Card></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{language === 'ar' ? 'اعتماد الطلبات' : 'Request Approvals'}</h1>
        {isHRManager && <Badge className="bg-blue-600">{language === 'ar' ? 'مدير HR' : 'HR Manager'}</Badge>}
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
                <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'المرحلة' : 'Phase'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراء' : 'Action'}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {requests.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center">{language === 'ar' ? 'لا توجد طلبات' : 'No requests'}</TableCell></TableRow> : requests.map((r: any) => {
                  const info = REQUEST_TYPE_INFO[r.request_type] || REQUEST_TYPE_INFO.vacation;
                  const Icon = info.icon;
                  const canAct = canTakeAction(r);
                  return (
                    <TableRow key={r.id} className={canAct ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-mono text-sm">{r.request_number}</TableCell>
                      <TableCell><Badge className={info.color}><Icon className="h-3 w-3 mr-1" />{language === 'ar' ? info.labelAr : info.labelEn}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{r.current_phase} L{r.current_approval_level}</Badge></TableCell>
                      <TableCell>
                        {canAct ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="bg-green-600" onClick={() => { setSelectedRequest(r); setActionType('approve'); }}><CheckCircle2 className="h-4 w-4" /></Button>
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
