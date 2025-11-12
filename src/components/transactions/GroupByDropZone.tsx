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
        "border-2 border-dashed rounded-lg p-4 transition-all mb-4",
        isOver ? "border-primary bg-primary/10" : "border-muted",
        groupBy ? "bg-accent" : "bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">
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
          <span className="text-sm text-muted-foreground">
            {language === 'ar' 
              ? 'اسحب عمود هنا للتجميع' 
              : 'Drag a column here to group'}
          </span>
        )}
      </div>
    </div>
  );
};
