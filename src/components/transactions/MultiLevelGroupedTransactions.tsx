import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  product_name: string;
  total: number;
  profit: number;
  payment_method: string;
  payment_type: string;
  payment_brand: string;
  order_number: string;
  user_name: string;
  cost_price: number;
  unit_price: number;
  cost_sold: number;
  qty: number;
  coins_number: number;
  vendor_name: string;
  order_status: string;
}

interface GroupLevel {
  columnId: string;
  label: string;
  sortDirection: 'asc' | 'desc';
}

interface MultiLevelGroupedTransactionsProps {
  groupLevels: GroupLevel[];
  transactions: Transaction[];
  visibleColumns: Record<string, boolean>;
  columnOrder: string[];
  formatCurrency: (amount: number) => string;
  renderCell: (transaction: Transaction, columnId: string) => React.ReactNode;
}

export const MultiLevelGroupedTransactions = ({
  groupLevels,
  transactions,
  visibleColumns,
  columnOrder,
  formatCurrency,
  renderCell,
}: MultiLevelGroupedTransactionsProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const visibleColumnIds = columnOrder.filter((id) => visibleColumns[id]);

  const groupTransactions = (
    items: Transaction[],
    levels: GroupLevel[],
    parentKey: string = '',
    depth: number = 0
  ): React.ReactNode[] => {
    if (levels.length === 0) {
      // Render leaf transactions
      return items.map((transaction) => (
        <TableRow key={transaction.id} className="bg-background">
          {visibleColumnIds.map((columnId) => (
            <TableCell key={columnId} style={{ paddingLeft: `${depth * 2}rem` }}>
              {renderCell(transaction, columnId)}
            </TableCell>
          ))}
        </TableRow>
      ));
    }

    const [currentLevel, ...remainingLevels] = levels;
    const grouped: Record<string, Transaction[]> = {};

    items.forEach((transaction) => {
      const key = String(transaction[currentLevel.columnId as keyof Transaction] || 'N/A');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(transaction);
    });

    // Sort groups
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (currentLevel.sortDirection === 'asc') {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });

    return sortedKeys.flatMap((groupKey) => {
      const groupItems = grouped[groupKey];
      const fullKey = parentKey ? `${parentKey}-${groupKey}` : groupKey;
      const isExpanded = expandedGroups.has(fullKey);
      const groupTotal = groupItems.reduce((sum, t) => sum + (t.total || 0), 0);
      const groupProfit = groupItems.reduce((sum, t) => sum + (t.profit || 0), 0);

      const indentLevel = depth;
      const bgColor = depth % 2 === 0 ? 'bg-muted/50' : 'bg-muted/30';

      const result: React.ReactNode[] = [
        <TableRow key={fullKey} className={`${bgColor} hover:bg-muted/70 font-semibold`}>
          <TableCell 
            colSpan={visibleColumnIds.length} 
            style={{ paddingLeft: `${indentLevel * 2}rem` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(fullKey)}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <Badge variant="outline" className="text-xs">
                  L{depth + 1}
                </Badge>
                <span className="text-sm">{currentLevel.label}:</span>
                <span className="font-bold">{groupKey}</span>
                <Badge variant="secondary">{groupItems.length}</Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <span>Total: {formatCurrency(groupTotal)}</span>
                <span>Profit: {formatCurrency(groupProfit)}</span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ];

      if (isExpanded) {
        result.push(
          ...groupTransactions(
            groupItems,
            remainingLevels,
            fullKey,
            depth + 1
          )
        );
      }

      return result;
    });
  };

  return <tbody>{groupTransactions(transactions, groupLevels)}</tbody>;
};
