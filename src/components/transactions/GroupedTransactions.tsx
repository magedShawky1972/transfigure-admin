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

interface GroupedTransactionsProps {
  groupBy: string;
  transactions: Transaction[];
  visibleColumns: Record<string, boolean>;
  columnOrder: string[];
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number | null | undefined) => string;
  renderCell: (transaction: Transaction, columnId: string) => React.ReactNode;
}

export const GroupedTransactions = ({
  groupBy,
  transactions,
  visibleColumns,
  columnOrder,
  formatCurrency,
  renderCell,
}: GroupedTransactionsProps) => {
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

  // Group transactions
  const grouped = transactions.reduce((acc, transaction) => {
    const key = String(transaction[groupBy as keyof Transaction] || 'N/A');
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const visibleColumnIds = columnOrder.filter((id) => visibleColumns[id]);

  return (
    <>
      {Object.entries(grouped).map(([groupKey, groupTransactions]) => {
        const isExpanded = expandedGroups.has(groupKey);
        const groupTotal = groupTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
        const groupProfit = groupTransactions.reduce((sum, t) => sum + (t.profit || 0), 0);

        return (
          <tbody key={groupKey}>
            <TableRow className="bg-muted/50 hover:bg-muted/70">
              <TableCell colSpan={visibleColumnIds.length} className="font-semibold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroup(groupKey)}
                      className="h-6 w-6 p-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <span>{groupKey}</span>
                    <Badge variant="secondary">{groupTransactions.length}</Badge>
                    <span className="text-sm text-muted-foreground">({formatCurrency(groupTotal)})</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>Total: {formatCurrency(groupTotal)}</span>
                    <span>Profit: {formatCurrency(groupProfit)}</span>
                  </div>
                </div>
              </TableCell>
            </TableRow>
            {isExpanded &&
              groupTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  {visibleColumnIds.map((columnId) => (
                    <TableCell key={columnId}>
                      {renderCell(transaction, columnId)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </tbody>
        );
      })}
    </>
  );
};
