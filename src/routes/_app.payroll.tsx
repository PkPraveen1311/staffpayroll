import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, FileText } from "lucide-react";
import { toast } from "sonner";
import { fmtINR, monthName } from "@/lib/format";

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

  const { data: runs = [] } = useQuery({
    queryKey: ["payroll_runs"],
    queryFn: async () => (await supabase.from("payroll_runs").select("*").order("year", { ascending: false }).order("month", { ascending: false })).data ?? [],
  });

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

      // Formula: days_worked = monthDays - absent - (half-day / 2)
      // Unmarked days count as present.
      const deductMap = new Map<string, number>();
      attendance?.forEach((a: any) => {
        const cur = deductMap.get(a.employee_id) ?? 0;
        const sub = a.status === "absent" ? 1 : a.status === "half-day" ? 0.5 : 0;
        deductMap.set(a.employee_id, cur + sub);
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
        // preserve manually-entered incentives & advances across re-runs
        const { data: prev } = await supabase.from("payslips").select("employee_id, incentive, advance").eq("payroll_run_id", runId);
        prev?.forEach((p: any) => {
          incentiveMap.set(p.employee_id, Number(p.incentive ?? 0));
          advanceMap.set(p.employee_id, Number(p.advance ?? 0));
        });
        await supabase.from("payslips").delete().eq("payroll_run_id", runId);
      }

      const slips = (employees ?? []).map((e: any) => {
        const recordedDays = dayMap.get(e.id);
        const daysWorked = recordedDays === undefined ? daysInMonth : recordedDays;
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

        // PF wage ceiling rule: if full basic > 15,000, PF stays on 15,000
        // regardless of attendance (no proration on the cap). Otherwise PF
        // wage is the prorated basic.
        const pfWage = fullBasic > 15000 ? 15000 : basic;
        // Employer PF = EPF (3.67%) + EPS (8.33%) = 12% of pfWage
        const employer_pf = e.pf_enabled ? pfWage * 0.12 : 0;
        const edli = e.pf_enabled ? pfWage * 0.005 : 0;
        const pf_admin_charges = e.pf_enabled ? pfWage * 0.005 : 0;
        const employer_esi = e.esi_enabled ? basic * 0.0325 : 0;

        // Total earnings = sum of all components (no employer carve-out)
        const gross = basic + hra + allow + medical + leaveEnc + bonus + special;

        // Employee deductions
        // PF: 12% of pfWage — fixed ₹1,800 when basic > 15k, otherwise prorated
        const pf = e.pf_enabled ? pfWage * 0.12 : 0;
        // ESI: 0.75% of basic (employee)
        const esi = e.esi_enabled ? basic * 0.0075 : 0;
        // TDS: only if explicitly enabled per employee
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

      if (slips.length) {
        const { error: ie } = await supabase.from("payslips").insert(slips);
        if (ie) throw ie;
      }
      const totalNet = slips.reduce((s, p) => s + p.net_pay, 0);
      await supabase.from("payroll_runs").update({ total_net: totalNet, status: "processed" }).eq("id", runId);
      toast.success(`Payroll generated for ${monthName(month)} ${year}`);
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
      <div>
        <h1 className="text-3xl font-bold">Payroll</h1>
        <p className="text-sm text-muted-foreground">Generate monthly payroll runs based on attendance & salary structure.</p>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>Generate payroll run</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{monthsList.map(m => <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{yearsList.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={running} className="bg-gradient-primary text-primary-foreground">
              <Play className="h-4 w-4 mr-1" /> {running ? "Processing…" : "Run payroll"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total net</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No payroll runs yet.</TableCell></TableRow>
              ) : runs.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{monthName(r.month)} {r.year}</TableCell>
                  <TableCell><Badge variant={r.status === "processed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{fmtINR(r.total_net)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/payslips"><Button size="sm" variant="ghost"><FileText className="h-4 w-4 mr-1" /> View payslips</Button></Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
