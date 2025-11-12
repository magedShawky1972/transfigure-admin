import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

interface DraggableColumnHeaderProps {
  id: string;
  label: string;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  isDragging?: boolean;
}

export const DraggableColumnHeader = ({
  id,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: DraggableColumnHeaderProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const SortIcon = () => {
    if (sortColumn !== id) {
      return <ArrowUpDown className="h-4 w-4 inline-block ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 inline-block ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 inline-block ml-1" />
    );
  };

  return (
    <TableHead ref={setNodeRef} style={style} className="relative">
      <div className="flex items-center gap-1">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          onClick={() => onSort(id)}
          className="flex-1 justify-start font-semibold hover:bg-accent"
        >
          {label}
          <SortIcon />
        </Button>
      </div>
    </TableHead>
  );
};
