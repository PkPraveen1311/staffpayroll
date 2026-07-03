import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Printer, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtINR, monthName } from "@/lib/format";
import { exportToXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_app/payroll")({ component: PayrollPage });

const now = new Date();
const monthsList = Array.from({ length: 12 }, (_, i) => i + 1);
const yearsList = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
const round = (n: number) => Math.round(n * 100) / 100;

function PayrollPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [running, setRunning] = useState(false);

  const { data: run } = useQuery({
    queryKey: ["payroll_run", month, year],
    queryFn: async () =>
      (await supabase.from("payroll_runs").select("*").eq("month", month).eq("year", year).maybeSingle()).data,
  });

  const { data: slips = [] } = useQuery({
    queryKey: ["payroll_register", run?.id],
    queryFn: async () => {
      if (!run?.id) return [];
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employees(full_name, employee_code, designation, department, pan, bank_account)")
        .eq("payroll_run_id", run.id);
      if (error) throw error;
      return (data ?? []).sort((a: any, b: any) =>
        String(a.employees?.employee_code ?? "").localeCompare(String(b.employees?.employee_code ?? "")),
      );
    },
    enabled: !!run?.id,
  });

  const totals = useMemo(() => {
    const sum = (k: string) => slips.reduce((s: number, p: any) => s + Number(p[k] ?? 0), 0);
    return {
      basic: sum("basic"), hra: sum("hra"), allowances: sum("allowances"),
      gross: sum("gross"), incentive: sum("incentive"), advance: sum("advance"),
      pf: sum("pf"), esi: sum("esi"), tds: sum("tds"),
      total_deductions: sum("total_deductions"), net_pay: sum("net_pay"),
    };
  }, [slips]);

  const generate = async () => {
    setRunning(true);
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const { data: employees, error: ee } = await supabase.from("employees").select("*").eq("status", "active");
      if (ee) throw ee;

      const { data: attendance, error: ae } = await supabase
        .from("attendance").select("employee_id, status, hours")
        .gte("date", monthStart).lte("date", monthEnd);
      if (ae) throw ae;

      const { data: allowedRows } = await supabase
        .from("allowed_week_offs").select("employee_id, allowed")
        .eq("year", year).eq("month", month);
      const allowedMap = new Map<string, number>(
        (allowedRows ?? []).map((r: any) => [r.employee_id, Number(r.allowed ?? 0)]),
      );

      type Counts = { present: number; weekOff: number; half: number };
      const countsMap = new Map<string, Counts>();
      attendance?.forEach((a: any) => {
        const c = countsMap.get(a.employee_id) ?? { present: 0, weekOff: 0, half: 0 };
        if (a.status === "present") c.present += 1;
        else if (a.status === "week-off") c.weekOff += 1;
        else if (a.status === "half-day") c.half += 1;
        countsMap.set(a.employee_id, c);
      });

      const { data: existing } = await supabase.from("payroll_runs").select("*").eq("month", month).eq("year", year).maybeSingle();
      let runId = existing?.id;
      const incentiveMap = new Map<string, number>();
      const advanceMap = new Map<string, number>();
      if (!runId) {
        const { data: newRun, error: re } = await supabase.from("payroll_runs").insert({ month, year, status: "draft" }).select().single();
        if (re) throw re;
        runId = newRun.id;
      } else {
        const { data: prev } = await supabase.from("payslips").select("employee_id, incentive, advance").eq("payroll_run_id", runId);
        prev?.forEach((p: any) => {
          incentiveMap.set(p.employee_id, Number(p.incentive ?? 0));
          advanceMap.set(p.employee_id, Number(p.advance ?? 0));
        });
        await supabase.from("payslips").delete().eq("payroll_run_id", runId);
      }

      const slipRows = (employees ?? []).map((e: any) => {
        const c = countsMap.get(e.id) ?? { present: 0, weekOff: 0, half: 0 };
        const allowed = allowedMap.has(e.id) ? (allowedMap.get(e.id) ?? 0) : Number.POSITIVE_INFINITY;
        const countedWeekOff = Math.min(c.weekOff, allowed);
        const remainingAllowed = allowed - countedWeekOff;
        const halfDayCredit = Math.min(remainingAllowed, c.half / 2);
        const daysWorked = Math.min(daysInMonth, c.present + countedWeekOff + c.half / 2 + halfDayCredit);
        const ratio = daysWorked / daysInMonth;
        const fullBasic = Number(e.basic_salary);
        const basic = fullBasic * ratio;
        const hra = Number(e.hra) * ratio;
        const allow = Number(e.allowances) * ratio;
        const medical = Number(e.medical_allowance ?? 0) * ratio;
        const leaveEnc = Number(e.leave_encashment ?? 0) * ratio;
        const bonus = Number(e.statutory_bonus ?? 0) * ratio;
        const special = Number(e.special_allowance ?? 0) * ratio;
        const incentive = incentiveMap.get(e.id) ?? 0;
        const advance = advanceMap.get(e.id) ?? 0;

        const pfWage = Math.min(15000, basic);
        const employer_pf = e.pf_enabled ? pfWage * 0.12 : 0;
        const edli = e.pf_enabled ? pfWage * 0.005 : 0;
        const pf_admin_charges = e.pf_enabled ? pfWage * 0.005 : 0;
        const employer_esi = e.esi_enabled ? Math.ceil(basic * 0.0325) : 0;

        const gross = basic + hra + allow + medical + leaveEnc + bonus + special;

        const pf = e.pf_enabled ? pfWage * 0.12 : 0;
        const esi = e.esi_enabled ? Math.ceil(basic * 0.0075) : 0;
        let tds = 0;
        if (e.tds_enabled) {
          const annual = (gross + incentive) * 12;
          let tax = 0;
          if (annual > 1500000) tax = (annual - 1500000) * 0.30 + 150000;
          else if (annual > 1200000) tax = (annual - 1200000) * 0.20 + 90000;
          else if (annual > 900000) tax = (annual - 900000) * 0.15 + 45000;
          else if (annual > 600000) tax = (annual - 600000) * 0.10 + 15000;
          else if (annual > 300000) tax = (annual - 300000) * 0.05;
          tds = Math.max(0, tax / 12);
        }
        const totalDed = pf + esi + tds + advance;
        const net = gross + incentive - totalDed;
        return {
          payroll_run_id: runId, employee_id: e.id,
          basic: round(basic), hra: round(hra), allowances: round(allow), gross: round(gross),
          medical_allowance: round(medical), leave_encashment: round(leaveEnc),
          statutory_bonus: round(bonus), special_allowance: round(special),
          incentive: round(incentive), advance: round(advance),
          pf: round(pf), esi: round(esi), tds: round(tds),
          employer_pf: round(employer_pf), employer_esi: round(employer_esi),
          edli: round(edli), pf_admin_charges: round(pf_admin_charges),
          total_deductions: round(totalDed), net_pay: round(net), days_worked: daysWorked,
        };
      });

      if (slipRows.length) {
        const { error: ie } = await supabase.from("payslips").insert(slipRows);
        if (ie) throw ie;
      }
      const totalNet = slipRows.reduce((s, p) => s + p.net_pay, 0);
      await supabase.from("payroll_runs").update({ total_net: totalNet, status: "processed" }).eq("id", runId);
      toast.success(`Payroll generated for ${monthName(month)} ${year}`);
      qc.invalidateQueries({ queryKey: ["payroll_run", month, year] });
      qc.invalidateQueries({ queryKey: ["payroll_register"] });
      qc.invalidateQueries({ queryKey: ["payroll_runs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; color: #000 !important; }
          .print-area { position: absolute !important; left: 0; top: 0; width: 100%; background: white !important; box-shadow: none !important; border: none !important; }
          .print-area table { font-size: 10px; border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td { border: 1px solid #999 !important; padding: 4px 6px !important; }
          .print-area thead { background: #f0f0f0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payroll Register</h1>
          <p className="text-sm text-muted-foreground">Generate, review and print month-wise payroll for all employees.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsList.map(m => <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{yearsList.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={running} className="bg-gradient-primary text-primary-foreground">
            <Play className="h-4 w-4 mr-1" /> {running ? "Processing…" : run ? "Re-run" : "Run payroll"}
          </Button>
          <Button onClick={() => window.print()} variant="outline" disabled={!slips.length}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button
            onClick={() => {
              const rows = slips.map((s: any) => ({
                Code: s.employees?.employee_code,
                Name: s.employees?.full_name,
                Designation: s.employees?.designation ?? "",
                Department: s.employees?.department ?? "",
                Days: s.days_worked,
                Basic: Number(s.basic), HRA: Number(s.hra),
                Allowances: Number(s.allowances), Medical: Number(s.medical_allowance),
                "Leave Enc": Number(s.leave_encashment), Bonus: Number(s.statutory_bonus),
                Special: Number(s.special_allowance),
                Gross: Number(s.gross), Incentive: Number(s.incentive),
                PF: Number(s.pf), ESI: Number(s.esi), TDS: Number(s.tds), Advance: Number(s.advance),
                "Employer PF": Number(s.employer_pf), "Employer ESI": Number(s.employer_esi),
                EDLI: Number(s.edli), "PF Admin": Number(s.pf_admin_charges),
                "Total Deductions": Number(s.total_deductions),
                "Net Pay": Number(s.net_pay),
                PAN: s.employees?.pan ?? "", "Bank A/C": s.employees?.bank_account ?? "",
              }));
              exportToXlsx(`Payroll_Register_${monthName(month)}_${year}.xlsx`, rows, "Register");
            }}
            variant="outline" disabled={!slips.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant print-area">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-xl">Payroll Register — {monthName(month)} {year}</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {slips.length} employee{slips.length === 1 ? "" : "s"} · Status: {run?.status ?? "not generated"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold text-gradient">PayPulse</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HR & Payroll</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!run ? (
            <div className="text-center text-muted-foreground py-12">
              No payroll run for {monthName(month)} {year}. Click <strong>Run payroll</strong> to generate.
            </div>
          ) : slips.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No payslips found for this run.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">HRA</TableHead>
                  <TableHead className="text-right">Allow.</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Incent.</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">ESI</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Adv.</TableHead>
                  <TableHead className="text-right">Total Ded.</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.employees?.employee_code}</TableCell>
                    <TableCell className="font-medium">{s.employees?.full_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.employees?.designation ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.days_worked}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.basic)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.hra)}</TableCell>
                    <TableCell className="text-right">{fmtINR(Number(s.allowances) + Number(s.medical_allowance ?? 0) + Number(s.special_allowance ?? 0) + Number(s.statutory_bonus ?? 0) + Number(s.leave_encashment ?? 0))}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.gross)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.incentive ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.pf)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.esi)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.tds)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.advance ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmtINR(s.total_deductions)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{fmtINR(s.net_pay)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.basic)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.hra)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.allowances)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.gross)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.incentive)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.pf)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.esi)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.tds)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.advance)}</TableCell>
                  <TableCell className="text-right">{fmtINR(totals.total_deductions)}</TableCell>
                  <TableCell className="text-right text-primary">{fmtINR(totals.net_pay)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
