import { supabase } from "@/integrations/supabase/client";
import { monthName } from "@/lib/format";

/**
 * Mirrors the "Advance" deducted in a payroll run into the Advances ledger as
 * repayments, so outstanding balances stay in sync with salary deductions.
 * Previous auto-entries for the same month are replaced on every re-run.
 */
export async function syncSalaryAdvanceRepayments(
  month: number,
  year: number,
  deductions: { employee_id: string; advance: number }[],
) {
  const tag = `[PAYROLL:${year}-${String(month).padStart(2, "0")}]`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const repaidOn = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: advances, error: ae } = await supabase
    .from("employee_advances")
    .select("id, employee_id, amount, given_on")
    .order("given_on", { ascending: true });
  if (ae) throw ae;

  const { data: repayments, error: re } = await supabase
    .from("advance_repayments")
    .select("id, advance_id, amount, notes");
  if (re) throw re;

  // Remove this month's previously auto-generated entries
  const stale = (repayments ?? []).filter((r) => (r.notes ?? "").includes(tag));
  if (stale.length) {
    const { error } = await supabase.from("advance_repayments").delete().in("id", stale.map((r) => r.id));
    if (error) throw error;
  }

  const staleIds = new Set(stale.map((r) => r.id));
  const repaidByAdvance = new Map<string, number>();
  (repayments ?? []).forEach((r) => {
    if (staleIds.has(r.id)) return;
    repaidByAdvance.set(r.advance_id, (repaidByAdvance.get(r.advance_id) ?? 0) + Number(r.amount));
  });

  const byEmployee = new Map<string, { id: string; outstanding: number }[]>();
  (advances ?? []).forEach((a) => {
    const outstanding = Number(a.amount) - (repaidByAdvance.get(a.id) ?? 0);
    if (outstanding <= 0) return;
    const list = byEmployee.get(a.employee_id) ?? [];
    list.push({ id: a.id, outstanding });
    byEmployee.set(a.employee_id, list);
  });

  const inserts: { advance_id: string; amount: number; repaid_on: string; notes: string }[] = [];
  let skipped = 0;
  deductions.forEach((d) => {
    let remaining = Math.round(Number(d.advance) || 0);
    if (remaining <= 0) return;
    const buckets = byEmployee.get(d.employee_id) ?? [];
    for (const b of buckets) {
      if (remaining <= 0) break;
      const take = Math.min(b.outstanding, remaining);
      if (take <= 0) continue;
      b.outstanding -= take;
      remaining -= take;
      inserts.push({
        advance_id: b.id,
        amount: take,
        repaid_on: repaidOn,
        notes: `Salary deduction ${monthName(month)} ${year} ${tag}`,
      });
    }
    if (remaining > 0) skipped += remaining;
  });

  if (inserts.length) {
    const { error } = await supabase.from("advance_repayments").insert(inserts);
    if (error) throw error;
  }

  return { adjusted: inserts.reduce((s, i) => s + i.amount, 0), unmatched: skipped };
}
