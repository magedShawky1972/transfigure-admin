import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { customerOrderRange, sortByRegistrationDate } from "./customerWithoutOrders";

describe("Customers Without Orders date range", () => {
  test("allows a selected single-day range", () => {
    assert.equal(customerOrderRange.safeParse({ from: "2026-10-19", to: "2026-10-19" }).success, true);
  });
  test("rejects an empty from date", () => {
    assert.equal(customerOrderRange.safeParse({ from: "", to: "2026-10-19" }).success, false);
  });
  test("rejects reversed dates", () => {
    assert.equal(customerOrderRange.safeParse({ from: "2026-10-19", to: "2026-10-01" }).success, false);
  });
});