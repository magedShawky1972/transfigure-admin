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

describe("Customers Without Orders registration date sort", () => {
  const rows = [
    { id: "3", creation_date: "2026-10-18T10:00:00Z", customer_name: "Zara" },
    { id: "1", creation_date: "2026-04-01T10:00:00Z", customer_name: "Amir" },
    { id: "2", creation_date: "2026-09-30T23:30:00Z", customer_name: "Dina" },
  ];
  test("ascending puts the oldest registration first", () => {
    assert.deepEqual(sortByRegistrationDate(rows, "asc").map(row => row.id), ["1", "2", "3"]);
  });
  test("descending puts the newest registration first", () => {
    assert.deepEqual(sortByRegistrationDate(rows, "desc").map(row => row.id), ["3", "2", "1"]);
  });
  test("identical registration moments fall back to customer name", () => {
    const sameMoment = [
      { id: "b", creation_date: "2026-10-18T10:00:00Z", customer_name: "Nour" },
      { id: "a", creation_date: "2026-10-18T10:00:00Z", customer_name: "Ali" },
    ];
    assert.deepEqual(sortByRegistrationDate(sameMoment, "asc").map(row => row.customer_name), ["Ali", "Nour"]);
  });
  test("a missing registration date stays at the end when newest first", () => {
    const withMissing = [
      { id: "x", creation_date: null, customer_name: "Ghost" },
      { id: "y", creation_date: "2026-01-01T00:00:00Z", customer_name: "Real" },
    ];
    assert.deepEqual(sortByRegistrationDate(withMissing, "desc").map(row => row.id), ["y", "x"]);
  });
  test("sorting does not reorder the loaded rows", () => {
    sortByRegistrationDate(rows, "desc");
    assert.deepEqual(rows.map(row => row.id), ["3", "1", "2"]);
  });
});