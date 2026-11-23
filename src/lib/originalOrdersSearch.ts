export const breakdownTextColumns = ['orderNumber', 'product', 'productCode', 'productId', 'sku'] as const;
export const breakdownNumberColumns = ['qty', 'coins', 'unitPrice', 'total', 'cost', 'totalCost'] as const;
export type BreakdownTextColumn = typeof breakdownTextColumns[number];
export type BreakdownNumberColumn = typeof breakdownNumberColumns[number];
export type BreakdownValues = Record<BreakdownTextColumn, string> & Record<BreakdownNumberColumn, number>;
export interface BreakdownFilters {
  search: string;
  text: Partial<Record<BreakdownTextColumn, string>>;
  numbers: Partial<Record<BreakdownNumberColumn, { min?: string; max?: string }>>;
}
export const emptyBreakdownFilters = (): BreakdownFilters => ({ search: '', text: {}, numbers: {} });
export function matchesBreakdown(values: BreakdownValues, filters: BreakdownFilters, includeCoins: boolean): boolean {
  const numbers = breakdownNumberColumns.filter(key => includeCoins || key !== 'coins');
  const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase();
  const search = normalize(filters.search);
  if (search && ![
    ...breakdownTextColumns.map(key => values[key]),
    ...numbers.flatMap(key => [String(values[key]), values[key].toFixed(2)]),
  ].some(value => normalize(value).includes(search))) return false;
  if (!breakdownTextColumns.every(key => normalize(values[key]).includes(normalize(filters.text[key] || '')))) return false;
  return numbers.every(key => {
    const range = filters.numbers[key];
    return (!range?.min?.trim() || values[key] >= Number(range.min)) &&
      (!range?.max?.trim() || values[key] <= Number(range.max));
  });
}