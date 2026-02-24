import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type PhaseViewFilter = "pending" | "sent" | "all";

interface CoinsPhaseFilterBarProps {
  viewFilter: PhaseViewFilter;
  onViewFilterChange: (value: PhaseViewFilter) => void;
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  /** Label for the "pending" option */
  pendingLabel?: { ar: string; en: string };
  /** Label for the "sent" option — what "sent to next phase" means */
  sentLabel?: { ar: string; en: string };
}

const CoinsPhaseFilterBar = ({
  viewFilter,
  onViewFilterChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  pendingLabel = { ar: "المعلقة فقط", en: "Pending Only" },
  sentLabel = { ar: "المرسلة فقط", en: "Sent Only" },
}: CoinsPhaseFilterBarProps) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <Select value={viewFilter} onValueChange={(v) => onViewFilterChange(v as PhaseViewFilter)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">{isArabic ? pendingLabel.ar : pendingLabel.en}</SelectItem>
          <SelectItem value="sent">{isArabic ? sentLabel.ar : sentLabel.en}</SelectItem>
          <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
        </SelectContent>
      </Select>

      {/* From Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            {fromDate ? format(fromDate, "yyyy-MM-dd") : (isArabic ? "من تاريخ" : "From")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={fromDate} onSelect={onFromDateChange} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {/* To Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            {toDate ? format(toDate, "yyyy-MM-dd") : (isArabic ? "إلى تاريخ" : "To")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={toDate} onSelect={onToDateChange} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {/* Clear dates */}
      {(fromDate || toDate) && (
        <Button variant="ghost" size="icon" onClick={() => { onFromDateChange(undefined); onToDateChange(undefined); }}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default CoinsPhaseFilterBar;
