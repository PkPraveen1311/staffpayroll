export const SALARY_FIELDS = [
  "basic_salary", "hra", "allowances", "medical_allowance", "leave_encashment",
  "statutory_bonus", "special_allowance", "pf_enabled", "esi_enabled", "tds_enabled",
] as const;

export type SalaryRevision = {
  id: string; employee_id: string; effective_year: number; effective_month: number; effective_date: string | null;
  basic_salary: number; hra: number; allowances: number; medical_allowance: number;
  leave_encashment: number; statutory_bonus: number; special_allowance: number;
  pf_enabled: boolean; esi_enabled: boolean; tds_enabled: boolean; notes: string | null;
};

const key = (y: number, m: number) => y * 100 + m;

export function revisionMonth(date: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1 };
}

/** Returns employees with the salary structure effective for the given month applied. */
export async function applySalaryRevisions<T extends { id: string }>(employees: T[], year: number, month: number): Promise<T[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.from("salary_revisions").select("*");
  if (error) throw error;
  return resolveSalaryRevisions(employees, (data ?? []) as SalaryRevision[], year, month);
}

/** Revisions apply to the entire effective month, including mid-month dates. */
export function resolveSalaryRevisions<T extends { id: string }>(employees: T[], revisions: SalaryRevision[], year: number, month: number): T[] {
  const target = key(year, month);
  const best = new Map<string, SalaryRevision>();
  for (const r of revisions) {
    const k = key(r.effective_year, r.effective_month);
    if (k > target) continue;
    const cur = best.get(r.employee_id);
    if (!cur || k > key(cur.effective_year, cur.effective_month)) best.set(r.employee_id, r);
  }
  return employees.map((e) => {
    const r = best.get(e.id);
    if (!r) return e;
    const patch: Record<string, unknown> = {};
    for (const f of SALARY_FIELDS) patch[f] = r[f];
    return { ...e, ...patch };
  });
}
