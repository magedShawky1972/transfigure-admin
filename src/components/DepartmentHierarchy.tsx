import { useState } from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  department_name: string;
  department_code: string;
  parent_department_id: string | null;
  is_active: boolean;
}

interface DepartmentHierarchyProps {
  departments: Department[];
  selectedId?: string | null;
  onSelect?: (departmentId: string | null) => void;
  showInactive?: boolean;
  language?: string;
}

interface DepartmentNodeProps {
  department: Department;
  children: Department[];
  allDepartments: Department[];
  level: number;
  selectedId?: string | null;
  onSelect?: (departmentId: string | null) => void;
}

const DepartmentNode = ({ 
  department, 
  children, 
  allDepartments, 
  level, 
  selectedId, 
  onSelect 
}: DepartmentNodeProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors",
          selectedId === department.id 
            ? "bg-primary text-primary-foreground" 
            : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect?.(department.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-background/20 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="font-medium truncate">{department.department_name}</span>
        <span className="text-xs opacity-70 shrink-0">({department.department_code})</span>
      </div>
      
      {hasChildren && expanded && (
        <div>
          {children.map((child) => {
            const grandChildren = allDepartments.filter(
              d => d.parent_department_id === child.id
            );
            return (
              <DepartmentNode
                key={child.id}
                department={child}
                children={grandChildren}
                allDepartments={allDepartments}
                level={level + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const DepartmentHierarchy = ({ 
  departments, 
  selectedId, 
  onSelect, 
  showInactive = false,
  language = 'en'
}: DepartmentHierarchyProps) => {
  const filteredDepartments = showInactive 
    ? departments 
    : departments.filter(d => d.is_active);

  // Get root departments (no parent)
  const rootDepartments = filteredDepartments.filter(d => !d.parent_department_id);

  if (filteredDepartments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {language === 'ar' ? 'لا توجد أقسام' : 'No departments found'}
      </p>
    );
  }

  return (
    <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
      {onSelect && (
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors mb-1",
            selectedId === null 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          )}
          onClick={() => onSelect(null)}
        >
          <span className="w-5" />
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {language === 'ar' ? 'بدون قسم رئيسي' : 'No Parent (Top Level)'}
          </span>
        </div>
      )}
      {rootDepartments.map((dept) => {
        const children = filteredDepartments.filter(
          d => d.parent_department_id === dept.id
        );
        return (
          <DepartmentNode
            key={dept.id}
            department={dept}
            children={children}
            allDepartments={filteredDepartments}
            level={0}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
};

export default DepartmentHierarchy;
