import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_WEEK_OFFS = 4;

const pad = (n: number) => String(n).padStart(2, "0");

export type AttRow = { agent_id: string; status: string; date: string };

/**
 * Same paid-days formula as employee payroll: present + tour + allowed week-offs
 * + leave + half/2, where unused week-off credits upgrade half-days.
 * Agents with no attendance marked for the month get 0 paid days.
 */
export function computeAgentPaidDays(
  attData: AttRow[],
  daysInMonth: number,
  allowedMap?: Map<string, number>,
) {
  type Counts = { presentDates: Set<string>; weekOffDates: Set<string>; leaveDates: Set<string>; halfDates: Set<string> };
  const countsMap = new Map<string, Counts>();
  (attData ?? []).forEach((r) => {
    const c = countsMap.get(r.agent_id) ?? {
      presentDates: new Set<string>(),
      weekOffDates: new Set<string>(),
      leaveDates: new Set<string>(),
      halfDates: new Set<string>(),
    };
    if (r.status === "present" || r.status === "tour") c.presentDates.add(r.date);
    else if (r.status === "week-off") c.weekOffDates.add(r.date);
    else if (r.status === "leave") c.leaveDates.add(r.date);
    else if (r.status === "half-day") c.halfDates.add(r.date);
    countsMap.set(r.agent_id, c);
  });
  const m = new Map<string, number>();
  countsMap.forEach((c, id) => {
    const allowed = allowedMap?.get(id) ?? ALLOWED_WEEK_OFFS;
    const countedWeekOffDates = [...c.weekOffDates].sort().slice(0, allowed);
    const remainingAllowed = allowed - countedWeekOffDates.length;
    const paidFullDates = new Set<string>([...c.presentDates, ...countedWeekOffDates, ...c.leaveDates]);
    const payableHalfDays = [...c.halfDates].filter((d) => !paidFullDates.has(d)).length;
    const halfDayCredit = Math.min(remainingAllowed, payableHalfDays / 2);
    m.set(id, Math.min(daysInMonth, paidFullDates.size + payableHalfDays / 2 + halfDayCredit));
  });
  return m;
}

export async function fetchAgentAttendance(year: number, month: number) {
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  const { data, error } = await supabase
    .from("agent_attendance")
    .select("agent_id, status, date")
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;
  return (data ?? []) as AttRow[];
}

/** Per-agent allowed paid week-offs for a month (defaults to 4 when unset). */
export async function fetchAgentAllowedWeekOffs(year: number, month: number) {
  const { data, error } = await supabase
    .from("agent_allowed_week_offs")
    .select("agent_id, allowed")
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return new Map<string, number>((data ?? []).map((r: any) => [r.agent_id, Number(r.allowed)]));
}

export function fixedIncentiveFor(agent: any, days: number, daysInMonth: number) {
  if (agent?.pay_type !== "fixed") return 0;
  return Math.round((Number(agent.fixed_monthly_amount || 0) * days) / daysInMonth);
}
