import { describe, expect, test } from "bun:test";
import { customerOrderRange } from "./customerWithoutOrders";

describe("Customers Without Orders date range", () => {
  test("allows a selected single-day range", () => {
    expect(customerOrderRange.safeParse({ from: "2026-10-19", to: "2026-10-19" }).success).toBe(true);
  });
  test("rejects an empty from date", () => {
    expect(customerOrderRange.safeParse({ from: "", to: "2026-10-19" }).success).toBe(false);
  });
  test("rejects reversed dates", () => {
    expect(customerOrderRange.safeParse({ from: "2026-10-19", to: "2026-10-01" }).success).toBe(false);
  });
});