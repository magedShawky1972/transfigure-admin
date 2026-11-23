import { useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { breakdownTextColumns, breakdownNumberColumns, emptyBreakdownFilters, type BreakdownFilters } from '@/lib/originalOrdersSearch';

const labels = {
  orderNumber: ['Order Number', 'رقم الطلب'], product: ['Product', 'المنتج'],
  productCode: ['Product Code', 'كود المنتج'], productId: ['Product ID', 'معرّف المنتج'], sku: ['SKU', 'SKU'],
  qty: ['Qty', 'الكمية'], coins: ['Coins', 'الكوينز'], unitPrice: ['Unit Price', 'سعر الوحدة'],
  total: ['Total', 'الإجمالي'], cost: ['Cost', 'التكلفة'], totalCost: ['Total Cost', 'إجمالي التكلفة'],
};

export function OriginalOrdersSearch({ filters, onChange, includeCoins, language, matched, total }: {
  filters: BreakdownFilters; onChange: (filters: BreakdownFilters) => void;
  includeCoins: boolean; language: string; matched: number; total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const ar = language === 'ar';
  const active = filters.search || Object.values(filters.text).some(Boolean) || Object.values(filters.numbers).some(range => range?.min || range?.max);
  return (
    <div className="min-w-0 space-y-3 border-b pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" aria-label={ar ? 'بحث في جميع الأعمدة' : 'Search all columns'} placeholder={ar ? 'بحث في جميع الأعمدة' : 'Search all columns'} value={filters.search} onChange={event => onChange({ ...filters, search: event.target.value })} />
        </div>
        <Button variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Filter className="h-4 w-4 mr-2" />{ar ? 'بحث متقدم' : 'Advanced Search'}</Button>
        <Button variant="ghost" size="sm" disabled={!active} onClick={() => onChange(emptyBreakdownFilters())}><X className="h-4 w-4 mr-2" />{ar ? 'مسح' : 'Clear'}</Button>
        <span className="text-xs text-muted-foreground" role="status">{matched} / {total} {ar ? 'سطور' : 'lines'}</span>
      </div>
      {expanded && <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {breakdownTextColumns.map(key => <div key={key} className="min-w-0 space-y-1">
          <Label htmlFor={`breakdown-${key}`}>{labels[key][ar ? 1 : 0]}</Label>
          <Input id={`breakdown-${key}`} value={filters.text[key] || ''} onChange={event => onChange({ ...filters, text: { ...filters.text, [key]: event.target.value } })} />
        </div>)}
        {breakdownNumberColumns.filter(key => includeCoins || key !== 'coins').map(key => <div key={key} className="min-w-0 space-y-1">
          <Label>{labels[key][ar ? 1 : 0]}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['min', 'max'] as const).map(bound => <Input key={bound} type="number" step="any" aria-label={`${labels[key][ar ? 1 : 0]} ${bound === 'min' ? (ar ? 'من' : 'minimum') : (ar ? 'إلى' : 'maximum')}`} placeholder={bound === 'min' ? (ar ? 'من' : 'Min') : (ar ? 'إلى' : 'Max')} value={filters.numbers[key]?.[bound] || ''} onChange={event => onChange({ ...filters, numbers: { ...filters.numbers, [key]: { ...filters.numbers[key], [bound]: event.target.value } } })} />)}
          </div>
        </div>)}
      </div>}
    </div>
  );
}