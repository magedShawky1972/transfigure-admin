import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin, LogIn, LogOut, Clock, CheckCircle, Home, Calendar } from "lucide-react";
import { getKSADateString, getKSATimeFormatted } from "@/lib/ksaTime";

const WFHCheckIn = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading, userId } = usePageAccess("/wfh-checkin");
  const isRTL = language === 'ar';

  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [todayCheckins, setTodayCheckins] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const getCairoTime = () => new Date().toLocaleTimeString('ar-SA', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
  const [currentTime, setCurrentTime] = useState(getCairoTime());
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCairoTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchTodayCheckins();
      fetchHistory();
      fetchUserName();
      getLocation();
    }
  }, [userId]);

  const fetchUserName = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setUserName(data.user_name || "");
  };

  const fetchTodayCheckins = async () => {
    if (!userId) return;
    const today = getKSADateString();
    const { data } = await supabase
      .from("wfh_checkins")
      .select("*")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .order("checkin_time", { ascending: true });
    setTodayCheckins(data || []);
  };

  const fetchHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("wfh_checkins")
      .select("*")
      .eq("user_id", userId)
      .order("checkin_date", { ascending: false })
      .order("checkin_time", { ascending: true })
      .limit(60);
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const getLocation = () => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Check if there's an active (not checked out) session
  const activeSession = todayCheckins.find(c => c.status === 'checked_in');

  const handleCheckIn = async () => {
    if (!userId) return;
    // Don't allow new check-in if there's an active session
    if (activeSession) {
      toast({
        title: isRTL ? "يوجد جلسة نشطة" : "Active Session Exists",
        description: isRTL ? "يرجى تسجيل الانصراف أولاً قبل تسجيل حضور جديد" : "Please check out first before starting a new check-in",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("wfh_checkins").insert({
        user_id: userId,
        checkin_date: getKSADateString(),
        notes: notes.trim() || null,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        device_info: navigator.userAgent,
      });

      if (error) throw error;

      toast({
        title: isRTL ? "تم تسجيل الحضور" : "Checked In",
        description: isRTL ? "تم تسجيل حضورك من المنزل بنجاح" : "Your WFH check-in has been recorded successfully",
      });
      setNotes("");
      fetchTodayCheckins();
      fetchHistory();
    } catch (error: any) {
      toast({ title: isRTL ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (checkinId: string) => {
    setCheckoutLoading(checkinId);
    try {
      const { error } = await supabase
        .from("wfh_checkins")
        .update({ checkout_time: new Date().toISOString(), status: 'checked_out' })
        .eq("id", checkinId);

      if (error) throw error;

      toast({
        title: isRTL ? "تم تسجيل الانصراف" : "Checked Out",
        description: isRTL ? "تم تسجيل انصرافك بنجاح" : "Your check-out has been recorded",
      });
      fetchTodayCheckins();
      fetchHistory();
    } catch (error: any) {
      toast({ title: isRTL ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo'
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (accessLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Home className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {isRTL ? "تسجيل الحضور من المنزل" : "Work From Home Check-In"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isRTL ? "سجل حضورك وانصرافك أثناء العمل عن بعد" : "Record your attendance while working remotely"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Check-In Card */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {isRTL ? "تسجيل اليوم" : "Today's Check-In"}
              </CardTitle>
              <Badge variant="outline" className="text-lg font-mono">
                {currentTime}
              </Badge>
            </div>
            <CardDescription>
              {userName && <span className="font-medium text-foreground">{userName}</span>}
              {" • "}
              {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Cairo' })}
              {" • "}
              <span className="text-xs text-muted-foreground">{isRTL ? "توقيت القاهرة" : "Cairo Time"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Today's sessions list */}
            {todayCheckins.length > 0 && (
              <div className="space-y-3">
                {todayCheckins.map((checkin, idx) => (
                  <div key={checkin.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-5 w-5 ${checkin.status === 'checked_in' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="text-sm">
                        <span className="font-medium">#{idx + 1}</span>
                        {" "}
                        <span>{isRTL ? "دخول:" : "In:"} {formatTime(checkin.checkin_time)}</span>
                        {checkin.checkout_time && (
                          <span className="ml-2">{isRTL ? "خروج:" : "Out:"} {formatTime(checkin.checkout_time)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={checkin.status === 'checked_out' ? 'secondary' : 'default'} className="text-xs">
                        {checkin.status === 'checked_out'
                          ? (isRTL ? 'انصرف' : 'Out')
                          : (isRTL ? 'يعمل' : 'Active')}
                      </Badge>
                      {checkin.status === 'checked_in' && (
                        <Button
                          onClick={() => handleCheckOut(checkin.id)}
                          disabled={checkoutLoading === checkin.id}
                          variant="outline"
                          size="sm"
                        >
                          {checkoutLoading === checkin.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          <LogOut className="h-3 w-3 mr-1" />
                          {isRTL ? "انصراف" : "Out"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New check-in form - show when no active session */}
            {!activeSession && (
              <div className="space-y-4 pt-2">
                {/* Location */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {locationLoading ? (
                    <span className="text-muted-foreground">
                      {isRTL ? "جاري تحديد الموقع..." : "Getting location..."}
                    </span>
                  ) : location ? (
                    <span className="text-primary">
                      {isRTL ? "تم تحديد الموقع ✓" : "Location captured ✓"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {isRTL ? "الموقع غير متاح" : "Location unavailable"}
                    </span>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">
                    {isRTL ? "ملاحظات (اختياري)" : "Notes (optional)"}
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRTL ? "مثال: أعمل على مشروع X اليوم..." : "e.g., Working on project X today..."}
                    rows={3}
                  />
                </div>

                <Button onClick={handleCheckIn} disabled={loading} className="w-full" size="lg">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <LogIn className="mr-2 h-5 w-5" />
                  {isRTL ? "تسجيل الحضور" : "Check In"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isRTL ? "ملخص الشهر" : "Monthly Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const now = new Date();
              const thisMonth = history.filter(h => {
                const d = new Date(h.checkin_date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              });
              // Count unique dates
              const uniqueDates = new Set(thisMonth.map(h => h.checkin_date));
              return (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{uniqueDates.size}</p>
                    <p className="text-sm text-muted-foreground">{isRTL ? "أيام الحضور" : "Days Attended"}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{thisMonth.length}</p>
                    <p className="text-sm text-muted-foreground">{isRTL ? "جلسات" : "Sessions"}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">
                      {thisMonth.filter(h => h.checkout_time).length}
                    </p>
                    <p className="text-sm text-muted-foreground">{isRTL ? "مكتملة" : "Completed"}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "سجل الحضور" : "Attendance History"}</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {isRTL ? "لا يوجد سجل حضور بعد" : "No attendance records yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isRTL ? "وقت الحضور" : "Check In"}</TableHead>
                    <TableHead>{isRTL ? "وقت الانصراف" : "Check Out"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{formatDate(record.checkin_date)}</TableCell>
                      <TableCell>{formatTime(record.checkin_time)}</TableCell>
                      <TableCell>{formatTime(record.checkout_time)}</TableCell>
                      <TableCell>
                        <Badge variant={record.status === 'checked_out' ? 'secondary' : 'default'}>
                          {record.status === 'checked_out'
                            ? (isRTL ? 'انصرف' : 'Checked Out')
                            : (isRTL ? 'يعمل' : 'Working')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WFHCheckIn;