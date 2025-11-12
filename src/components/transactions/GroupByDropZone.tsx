import { useDroppable } from "@dnd-kit/core";
import { X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GroupByDropZoneProps {
  groupBy: string | null;
  columnLabel: string | null;
  onClearGroup: () => void;
  language: string;
}

export const GroupByDropZone = ({
  groupBy,
  columnLabel,
  onClearGroup,
  language,
}: GroupByDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "group-by-zone",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 transition-all mb-4 min-h-[72px]",
        isOver ? "border-primary bg-primary/20 scale-105" : "border-muted",
        groupBy ? "bg-accent" : "bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className={cn("h-5 w-5", isOver ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium", isOver && "text-primary")}>
            {language === 'ar' ? 'تجميع حسب' : 'Group By'}
          </span>
        </div>
        {groupBy && columnLabel && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-2">
              {columnLabel}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={onClearGroup}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}
        {!groupBy && (
          <span className={cn(
            "text-sm",
            isOver ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {isOver 
              ? (language === 'ar' ? 'أفلت هنا للتجميع' : 'Drop here to group')
              : (language === 'ar' ? 'اسحب عمود هنا للتجميع' : 'Drag a column here to group')
            }
          </span>
        )}
      </div>
    </div>
  );
};
