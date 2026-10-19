import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

export const customerOrderRange = z.object({ from: date, to: date })
  .refine(range => range.from <= range.to, "From Date must be before or equal to To Date.");

export type RegistrationSort = "asc" | "desc";

type Registrable = { id: string; creation_date: string | null; customer_name?: string | null };

export function sortByRegistrationDate<T extends Registrable>(rows: T[], direction: RegistrationSort): T[] {
  const stamp = (value: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...rows].sort((a, b) => {
    const byDate = stamp(a.creation_date) - stamp(b.creation_date);
    if (byDate !== 0) return direction === "asc" ? byDate : -byDate;
    const byName = (a.customer_name ?? "").localeCompare(b.customer_name ?? "");
    return byName !== 0 ? byName : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}