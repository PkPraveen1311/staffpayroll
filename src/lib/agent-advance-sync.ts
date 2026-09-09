import { supabase } from "@/integrations/supabase/client";
import { monthName } from "@/lib/format";

/**
 * Mirrors the "Advance" deducted in a commission month into the agent advances
 * ledger as repayments (FIFO). Previous auto-entries for the same month are
 * replaced on every re-save.
 */
export async function syncAgentAdvanceRepayments(
  month: number,
  year: number,
  deductions: { agent_id: string; advance: number }[],
) {
  const tag = `[COMMISSION:${year}-${String(month).padStart(2, "0")}]`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const repaidOn = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: advances, error: ae } = await supabase
    .from("agent_advances")
    .select("id, agent_id, amount, given_on")
    .order("given_on", { ascending: true });
  if (ae) throw ae;

  const { data: repayments, error: re } = await supabase
    .from("agent_advance_repayments")
    .select("id, advance_id, amount, notes");
  if (re) throw re;

  const stale = (repayments ?? []).filter((r) => (r.notes ?? "").includes(tag));
  if (stale.length) {
    const { error } = await supabase
      .from("agent_advance_repayments")
      .delete()
      .in("id", stale.map((r) => r.id));
    if (error) throw error;
  }

  const staleIds = new Set(stale.map((r) => r.id));
  const repaidByAdvance = new Map<string, number>();
  (repayments ?? []).forEach((r) => {
    if (staleIds.has(r.id)) return;
    repaidByAdvance.set(r.advance_id, (repaidByAdvance.get(r.advance_id) ?? 0) + Number(r.amount));
  });

  const byAgent = new Map<string, { id: string; outstanding: number }[]>();
  (advances ?? []).forEach((a) => {
    const outstanding = Number(a.amount) - (repaidByAdvance.get(a.id) ?? 0);
    if (outstanding <= 0) return;
    const list = byAgent.get(a.agent_id) ?? [];
    list.push({ id: a.id, outstanding });
    byAgent.set(a.agent_id, list);
  });

  const inserts: { advance_id: string; amount: number; repaid_on: string; notes: string }[] = [];
  let skipped = 0;
  deductions.forEach((d) => {
    let remaining = Math.round(Number(d.advance) || 0);
    if (remaining <= 0) return;
    const buckets = byAgent.get(d.agent_id) ?? [];
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
        notes: `Commission deduction ${monthName(month)} ${year} ${tag}`,
      });
    }
    if (remaining > 0) skipped += remaining;
  });

  if (inserts.length) {
    const { error } = await supabase.from("agent_advance_repayments").insert(inserts);
    if (error) throw error;
  }

  return { adjusted: inserts.reduce((s, i) => s + i.amount, 0), unmatched: skipped };
}
