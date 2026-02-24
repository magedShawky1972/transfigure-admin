import { useLanguage } from "@/contexts/LanguageContext";
import { Check, ChevronRight } from "lucide-react";

const phases = [
  { key: "creation", en: "Creation", ar: "الإنشاء" },
  { key: "sending", en: "Sending", ar: "الإرسال" },
  { key: "receiving", en: "Receiving", ar: "الاستلام" },
  { key: "coins_entry", en: "Coins Entry", ar: "إدخال العملات" },
  { key: "completed", en: "Completed", ar: "مكتمل" },
];

interface CoinsPhaseStepsProps {
  currentPhase: string;
}

const CoinsPhaseSteps = ({ currentPhase }: CoinsPhaseStepsProps) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const currentIdx = phases.findIndex(p => p.key === currentPhase);

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap py-3">
      {phases.map((phase, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={phase.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  isPast
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-muted-foreground/30 text-muted-foreground/40"
                }`}
              >
                {isPast ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-tight text-center max-w-[70px] ${
                  isPast || isCurrent ? "text-primary" : "text-muted-foreground/50"
                }`}
              >
                {isArabic ? phase.ar : phase.en}
              </span>
            </div>
            {idx < phases.length - 1 && (
              <ChevronRight
                className={`h-4 w-4 mt-[-16px] ${
                  idx < currentIdx ? "text-primary" : "text-muted-foreground/30"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CoinsPhaseSteps;
