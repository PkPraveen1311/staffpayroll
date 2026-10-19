import { describe, expect, test } from "bun:test";
import { resolveSalaryRevisions, revisionMonth } from "./salary-revisions";

const employee = { id: "employee", basic_salary: 15000, pf_enabled: false };
const revision = {
  id: "revision", employee_id: "employee", effective_date: "2027-04-19", effective_year: 2027, effective_month: 4,
  basic_salary: 20000, hra: 0, allowances: 0, medical_allowance: 0, leave_encashment: 0,
  statutory_bonus: 0, special_allowance: 0, pf_enabled: true, esi_enabled: false, tds_enabled: false, notes: null,
};

describe("dated salary increments", () => {
  test("mid-month increment applies to the whole effective month", () => {
    expect(revisionMonth("2027-04-19")).toEqual({ year: 2027, month: 4 });
    expect(resolveSalaryRevisions([employee], [revision], 2027, 4)[0]?.basic_salary).toBe(20000);
  });
  test("earlier months retain the original salary and contribution settings", () => {
    expect(resolveSalaryRevisions([employee], [revision], 2027, 3)[0]).toEqual(employee);
  });
  test("annual increments retain prior years and select the latest effective revision", () => {
    const next = { ...revision, id: "next", effective_date: "2028-04-07", effective_year: 2028, basic_salary: 25000 };
    expect(resolveSalaryRevisions([employee], [next, revision], 2028, 3)[0]?.basic_salary).toBe(20000);
    expect(resolveSalaryRevisions([employee], [next, revision], 2028, 4)[0]?.basic_salary).toBe(25000);
  });
  test("invalid exit and effective dates cannot be saved", () => {
    expect(revisionMonth("2027-02-30")).toBeNull();
    expect(revisionMonth("2028-02-29")).toEqual({ year: 2028, month: 2 });
  });
});