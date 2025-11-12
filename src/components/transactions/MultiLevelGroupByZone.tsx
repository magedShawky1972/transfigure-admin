import { useDroppable } from "@dnd-kit/core";
import { X, Layers, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GroupLevel {
  columnId: string;
  label: string;
  sortDirection: 'asc' | 'desc';
}

interface MultiLevelGroupByZoneProps {
  groupLevels: GroupLevel[];
  onRemoveLevel: (index: number) => void;
  onToggleSort: (index: number) => void;
  onClearAll: () => void;
  language: string;
}

export const MultiLevelGroupByZone = ({
  groupLevels,
  onRemoveLevel,
  onToggleSort,
  onClearAll,
  language,
}: MultiLevelGroupByZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "group-by-zone",
    data: { type: 'group-zone' }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 transition-all mb-4 min-h-[72px]",
        isOver ? "border-primary bg-primary/20 scale-105" : "border-muted",
        groupLevels.length > 0 ? "bg-accent" : "bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Layers className={cn("h-5 w-5", isOver ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium whitespace-nowrap", isOver && "text-primary")}>
            {language === 'ar' ? 'تجميع حسب' : 'Group By'}
          </span>
          
          {groupLevels.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {groupLevels.map((level, index) => (
                <div key={index} className="flex items-center gap-1">
                  {index > 0 && (
                    <span className="text-xs text-muted-foreground">→</span>
                  )}
                  <Badge variant="secondary" className="gap-2">
                    <span className="text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    {level.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => onToggleSort(index)}
                    >
                      {level.sortDirection === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => onRemoveLevel(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-6 text-xs"
              >
                {language === 'ar' ? 'مسح الكل' : 'Clear All'}
              </Button>
            </div>
          ) : (
            <span className={cn(
              "text-sm",
              isOver ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              {isOver 
                ? (language === 'ar' ? 'أفلت هنا للتجميع' : 'Drop here to group')
                : (language === 'ar' ? 'اسحب عمود هنا للتجميع متعدد المستويات' : 'Drag columns here for multi-level grouping')
              }
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
