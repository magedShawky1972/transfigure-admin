import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import UploadMissingImagesDialog from "@/components/UploadMissingImagesDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImageIcon, Upload, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatKSADateTime, getKSADateString } from "@/lib/ksaTime";

interface MissingImageShift {
  session_id: string;
  user_name: string;
  shift_name: string;
  opened_at: string | null;
  closed_at: string | null;
  status: string;
  uploaded_count: number;
  required_count: number;
  assignment_date: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
}

export default function MissingShiftImages() {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/missing-shift-images");
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<MissingImageShift[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const today = getKSADateString();
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 7);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [toDate, setToDate] = useState(getKSADateString());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<MissingImageShift | null>(null);

  const text = {
    ar: {
      title: "الورديات ذات الصور الناقصة",
      user: "الموظف",
      shift: "الوردية",
      status: "الحالة",
      images: "الصور",
      openedAt: "وقت الفتح",
      closedAt: "وقت الإغلاق",
      actions: "الإجراءات",
      uploadImages: "رفع صور",
      loading: "جاري التحميل...",
      noMissing: "لا توجد ورديات بصور ناقصة في هذا التاريخ ✅",
      refresh: "تحديث",
      closed: "مغلقة",
      open: "مفتوحة",
      notStarted: "لم تبدأ",
    },
    en: {
      title: "Shifts with Missing Images",
      user: "Employee",
      shift: "Shift",
      status: "Status",
      images: "Images",
      openedAt: "Opened At",
      closedAt: "Closed At",
      actions: "Actions",
      uploadImages: "Upload Images",
      loading: "Loading...",
      noMissing: "No shifts with missing images on this date ✅",
      refresh: "Refresh",
      closed: "Closed",
      open: "Open",
      notStarted: "Not Started",
    },
  };

  const t = text[language as keyof typeof text] || text.en;

  useEffect(() => {
    if (hasAccess) fetchShifts();
  }, [hasAccess, fromDate, toDate]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      // Get required brands count (A-class, non-Ludo)
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, brand_name, created_at")
        .eq("status", "active")
        .eq("abc_analysis", "A");

      const requiredBrands = brandsData?.filter((b) => {
        const name = b.brand_name.toLowerCase();
        return !name.includes("yalla ludo") && !name.includes("يلا لودو") && !name.includes("ludo");
      }) || [];

      const allRequiredBrandIds = requiredBrands.map((b) => b.id);

      // Get shift assignments for the date range
      const { data: assignments } = await supabase
        .from("shift_assignments")
        .select(`
          id,
          user_id,
          assignment_date,
          shifts!inner(shift_name, shift_start_time, shift_end_time)
        `)
        .gte("assignment_date", fromDate)
        .lte("assignment_date", toDate)
        .order("assignment_date", { ascending: true }) as { data: any[] | null };

      if (!assignments || assignments.length === 0) {
        setShifts([]);
        setLoading(false);
        return;
      }

      // Fetch profiles separately
      const userIds = [...new Set(assignments.map((a: any) => a.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);
      const profileMap = new Map(profilesData?.map((p) => [p.user_id, p.user_name]) || []);

      // Get all shift sessions for these assignments
      const assignmentIds = assignments.map((a: any) => a.id);
      const { data: sessions } = await supabase
        .from("shift_sessions")
        .select("id, shift_assignment_id, status, opened_at, closed_at, user_id")
        .in("shift_assignment_id", assignmentIds);

      const sessionMap = new Map(sessions?.map((s) => [s.shift_assignment_id, s]) || []);

      // Get all session IDs to fetch brand balances
      const sessionIds = sessions?.map((s) => s.id) || [];
      
      const balancesMap = new Map<string, number>();
      if (sessionIds.length > 0) {
        const { data: balances } = await supabase
          .from("shift_brand_balances")
          .select("shift_session_id, brand_id, receipt_image_path")
          .in("shift_session_id", sessionIds)
          .in("brand_id", allRequiredBrandIds);

        balances?.forEach((b) => {
          if (b.receipt_image_path) {
            balancesMap.set(
              b.shift_session_id,
              (balancesMap.get(b.shift_session_id) || 0) + 1
            );
          }
        });
      }

      // Build result - only shifts with missing images
      const result: MissingImageShift[] = [];
      for (const assignment of assignments as any[]) {
        // Calculate required count for this specific date
        const assignDate = assignment.assignment_date;
        const requiredForDate = requiredBrands.filter(
          (b) => b.created_at.split("T")[0] <= assignDate
        );
        const requiredCount = requiredForDate.length;

        const session = sessionMap.get(assignment.id);
        const uploadedCount = session ? (balancesMap.get(session.id) || 0) : 0;

        if (uploadedCount < requiredCount) {
          const shift = assignment.shifts;
          result.push({
            session_id: session?.id || "",
            user_name: profileMap.get(assignment.user_id) || "—",
            shift_name: shift?.shift_name || "—",
            opened_at: session?.opened_at || null,
            closed_at: session?.closed_at || null,
            status: session?.status || "not_started",
            uploaded_count: uploadedCount,
            required_count: requiredCount,
            assignment_date: assignment.assignment_date,
            shift_start_time: shift?.shift_start_time || null,
            shift_end_time: shift?.shift_end_time || null,
          });
        }
      }

      setShifts(result);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const noMissingText = language === "ar" 
    ? "لا توجد ورديات بصور ناقصة في هذه الفترة ✅" 
    : "No shifts with missing images in this period ✅";

  const getStatusBadge = (status: string) => {
    if (status === "closed") return <Badge className="bg-primary text-primary-foreground">{t.closed}</Badge>;
    if (status === "open") return <Badge className="bg-accent text-accent-foreground">{t.open}</Badge>;
    return <Badge variant="secondary">{t.notStarted}</Badge>;
  };

  if (accessLoading) return null;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="p-4 md:p-6 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          {t.title}
        </h1>
        <Button variant="outline" size="sm" onClick={fetchShifts}>
          <RefreshCw className="h-4 w-4 mr-1" />
          {t.refresh}
        </Button>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        <span className="text-sm font-medium">{language === "ar" ? "من" : "From"}</span>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-44 text-center"
        />
        <span className="text-sm font-medium">{language === "ar" ? "إلى" : "To"}</span>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-44 text-center"
        />
      </div>

      {/* Summary count */}
      {!loading && shifts.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {language === "ar" 
              ? `${shifts.length} وردية بصور ناقصة` 
              : `${shifts.length} shifts with missing images`}
          </Badge>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="mr-2 ml-2">{t.loading}</span>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-medium text-lg">
          {noMissingText}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 text-start font-medium">{language === "ar" ? "التاريخ" : "Date"}</th>
                <th className="p-3 text-start font-medium">{t.shift}</th>
                <th className="p-3 text-start font-medium">{t.user}</th>
                <th className="p-3 text-start font-medium">{t.status}</th>
                <th className="p-3 text-start font-medium">{t.images}</th>
                <th className="p-3 text-start font-medium">{t.openedAt}</th>
                <th className="p-3 text-start font-medium">{t.closedAt}</th>
                <th className="p-3 text-start font-medium">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3 text-sm font-medium">
                    <div>{shift.assignment_date || "—"}</div>
                    {(shift.shift_start_time || shift.shift_end_time) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {shift.shift_start_time?.slice(0, 5) || "—"} - {shift.shift_end_time?.slice(0, 5) || "—"}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-medium">{shift.shift_name}</td>
                  <td className="p-3">{shift.user_name}</td>
                  <td className="p-3">{getStatusBadge(shift.status)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="border-destructive text-destructive">
                      {shift.uploaded_count}/{shift.required_count}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {shift.opened_at ? formatKSADateTime(shift.opened_at) : "—"}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {shift.closed_at ? formatKSADateTime(shift.closed_at) : "—"}
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedShift(shift);
                        setUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {t.uploadImages}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedShift && (
        <UploadMissingImagesDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          shiftSessionId={selectedShift.session_id || null}
          userName={selectedShift.user_name}
          shiftName={selectedShift.shift_name}
          onImagesUploaded={fetchShifts}
        />
      )}
    </div>
  );
}
