import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Filter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface FilterRule {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface AdvancedProductFilterProps {
  filters: FilterRule[];
  onFiltersChange: (filters: FilterRule[]) => void;
}

const columns = [
  { value: "product_id", label: "Product ID" },
  { value: "sku", label: "SKU" },
  { value: "product_name", label: "Product Name" },
  { value: "product_price", label: "Price" },
  { value: "product_cost", label: "Cost" },
  { value: "brand_name", label: "Brand Name" },
  { value: "brand_code", label: "Brand Code" },
  { value: "brand_type", label: "Brand Type" },
  { value: "category", label: "Category" },
  { value: "supplier", label: "Supplier" },
  { value: "stock_quantity", label: "Stock" },
  { value: "status", label: "Status" },
];

const operators = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals (=)" },
  { value: "not_equals", label: "Not Equals (≠)" },
  { value: "greater_than", label: "Greater Than (>)" },
  { value: "less_than", label: "Less Than (<)" },
  { value: "greater_equal", label: "Greater or Equal (≥)" },
  { value: "less_equal", label: "Less or Equal (≤)" },
];

export const AdvancedProductFilter = ({
  filters,
  onFiltersChange,
}: AdvancedProductFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const addFilter = () => {
    const newFilter: FilterRule = {
      id: Math.random().toString(36).substr(2, 9),
      column: "product_name",
      operator: "contains",
      value: "",
    };
    onFiltersChange([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onFiltersChange(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Advanced Filters
          {filters.length > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {filters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Advanced Filters</h4>
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filters.map((filter) => (
              <div key={filter.id} className="flex gap-2 items-center">
                <Select
                  value={filter.column}
                  onValueChange={(value) =>
                    updateFilter(filter.id, { column: value })
                  }
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.value} value={col.value}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.operator}
                  onValueChange={(value) =>
                    updateFilter(filter.id, { operator: value })
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={filter.value}
                  onChange={(e) =>
                    updateFilter(filter.id, { value: e.target.value })
                  }
                  placeholder="Value..."
                  className="flex-1"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFilter(filter.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {filters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No filters applied. Click "Add Filter" to create one.
              </p>
            )}
          </div>

          <Button onClick={addFilter} variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
