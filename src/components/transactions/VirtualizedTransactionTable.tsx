import { useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  brand_code?: string;
  product_name: string;
  product_id?: string;
  sku?: string;
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
  is_deleted: boolean;
  sendodoo?: boolean;
}

interface VirtualizedTransactionTableProps {
  transactions: Transaction[];
  visibleColumnIds: string[];
  renderCell: (transaction: Transaction, columnId: string) => React.ReactNode;
  columnLabels?: Record<string, string>;
}

const DEFAULT_WIDTH = 160;
const MIN_WIDTH = 60;
const STORAGE_KEY = "transactions_virtualized_col_widths";

export const VirtualizedTransactionTable = ({
  transactions,
  visibleColumnIds,
  renderCell,
  columnLabels = {},
}: VirtualizedTransactionTableProps) => {
  const { t, language } = useLanguage();
  const parentRef = useRef<HTMLDivElement>(null);

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {
      /* ignore */
    }
  }, [widths]);

  const getWidth = (id: string) => widths[id] ?? DEFAULT_WIDTH;

  const resizingRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      id: columnId,
      startX: e.clientX,
      startWidth: getWidth(columnId),
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(MIN_WIDTH, resizingRef.current.startWidth + delta);
      setWidths((prev) => ({ ...prev, [resizingRef.current!.id]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [widths]);

  const totalWidth = visibleColumnIds.reduce((sum, id) => sum + getWidth(id), 0);

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 15,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const getColumnLabel = (columnId: string): string => {
    if (columnLabels[columnId]) return columnLabels[columnId];
    
    const labels: Record<string, string> = {
      created_at_date: language === 'ar' ? 'التاريخ' : 'Date',
      created_at: language === 'ar' ? 'تاريخ ووقت الإنشاء' : 'Created At',
      customer_name: language === 'ar' ? 'العميل' : 'Customer',
      customer_phone: language === 'ar' ? 'الهاتف' : 'Phone',
      brand_name: language === 'ar' ? 'الماركة' : 'Brand',
      product_name: language === 'ar' ? 'المنتج' : 'Product',
      order_number: language === 'ar' ? 'رقم الطلب' : 'Order #',
      user_name: language === 'ar' ? 'المستخدم' : 'User',
      vendor_name: language === 'ar' ? 'المورد' : 'Vendor',
      order_status: language === 'ar' ? 'الحالة' : 'Status',
      total: language === 'ar' ? 'الإجمالي' : 'Total',
      profit: language === 'ar' ? 'الربح' : 'Profit',
      payment_method: language === 'ar' ? 'طريقة الدفع' : 'Payment Method',
      payment_type: language === 'ar' ? 'نوع الدفع' : 'Payment Type',
      payment_brand: language === 'ar' ? 'ماركة الدفع' : 'Payment Brand',
      qty: language === 'ar' ? 'الكمية' : 'Qty',
      cost_price: language === 'ar' ? 'سعر التكلفة' : 'Cost Price',
      unit_price: language === 'ar' ? 'سعر الوحدة' : 'Unit Price',
      cost_sold: language === 'ar' ? 'تكلفة البيع' : 'Cost Sold',
      coins_number: language === 'ar' ? 'عدد الكوينز' : 'Coins',
      is_deleted: language === 'ar' ? 'محذوف' : 'Deleted',
      sendodoo: language === 'ar' ? 'مرسل لـ Odoo' : 'Sent to Odoo',
      odoo_sync: language === 'ar' ? 'إرسال لـ Odoo' : 'Sync to Odoo',
    };
    return labels[columnId] || columnId;
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ width: `${totalWidth}px`, minWidth: "100%" }}>
          {/* Fixed Header */}
          <div className="flex bg-muted/50 border-b font-medium text-sm">
            {visibleColumnIds.map((columnId) => (
              <div
                key={columnId}
                className="relative px-3 py-3 truncate"
                style={{ width: `${getWidth(columnId)}px`, flexShrink: 0 }}
              >
                {getColumnLabel(columnId)}
                <div
                  onMouseDown={(e) => handleMouseDown(e, columnId)}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60"
                  title={language === 'ar' ? 'سحب لتغيير العرض' : 'Drag to resize'}
                />
              </div>
            ))}
          </div>

          {/* Virtualized Body */}
          <div
            ref={parentRef}
            className="max-h-[550px] overflow-auto"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualRows.map((virtualRow) => {
                const transaction = transactions[virtualRow.index];
                return (
                  <div
                    key={transaction.id}
                    className={cn(
                      "absolute top-0 left-0 w-full flex border-b hover:bg-muted/50 transition-colors",
                      transaction.is_deleted && "bg-destructive/10 line-through opacity-60",
                      virtualRow.index % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {visibleColumnIds.map((columnId) => (
                      <div
                        key={columnId}
                        className="px-3 py-2 text-sm flex items-center truncate"
                        style={{ width: `${getWidth(columnId)}px`, flexShrink: 0 }}
                      >
                        {renderCell(transaction, columnId)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
