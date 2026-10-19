import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

export const customerOrderRange = z.object({ from: date, to: date })
  .refine(range => range.from <= range.to, "From Date must be before or equal to To Date.");