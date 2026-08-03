import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtINR, monthName } from "@/lib/format";
import { Printer, FileSpreadsheet } from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_app/challans")({ component: ChallansPage });

function ChallansPage() {
  const [runId, setRunId] = useState<string>("");

  const { data: runs = [] } = useQuery({
    queryKey: ["payroll_runs"],
    queryFn: async () => (await supabase.from("payroll_runs").select("*").order("year", { ascending: false }).order("month", { ascending: false })).data ?? [],
  });
  const effectiveRun = runId || (runs[0]?.id ?? "");

  const { data: slips = [] } = useQuery({
    queryKey: ["payslips", effectiveRun],
    queryFn: async () => {
      if (!effectiveRun) return [];
      const { data } = await supabase
        .from("payslips")
        .select("*, employees(full_name, employee_code, basic_salary, pf_enabled, esi_enabled, date_of_birth, pf_number, esi_number, uan)")
        .eq("payroll_run_id", effectiveRun);
      return data ?? [];
    },
    enabled: !!effectiveRun,
  });

  const run: any = runs.find((r: any) => r.id === effectiveRun);

  const { data: tdsPayments = [] } = useQuery({
    queryKey: ["commission-payments-challan", run?.year, run?.month],
    queryFn: async () => {
      if (!run) return [];
      const start = new Date(run.year, run.month - 1, 1).toISOString().slice(0, 10);
      const end = new Date(run.year, run.month, 0).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("commission_payments")
        .select("*, commission_agents(full_name, agent_code, pan)")
        .gte("paid_on", start)
        .lte("paid_on", end)
        .order("paid_on");
      return data ?? [];
    },
    enabled: !!run,
  });

  const tdsRows = tdsPayments
    .filter((p: any) => Number(p.tds_amount) > 0)
    .map((p: any) => ({
      id: p.id,
      date: p.paid_on,
      name: p.commission_agents?.full_name ?? "—",
      code: p.commission_agents?.agent_code ?? "",
      pan: p.commission_agents?.pan ?? "",
      gross: Number(p.gross_amount),
      rate: Number(p.tds_rate),
      tds: Number(p.tds_amount),
      net: Number(p.net_amount),
    }));


  const ageOn = (dob?: string | null) => {
    if (!dob || !run) return 0;
    const d = new Date(dob);
    const ref = new Date(run.year, run.month - 1, 1);
    let a = ref.getFullYear() - d.getFullYear();
    const md = ref.getMonth() - d.getMonth();
    if (md < 0 || (md === 0 && ref.getDate() < d.getDate())) a--;
    return a;
  };

  // PF challan: age >= 58 → EPS = 0, EPF = full employer 12%
  const pfRows = slips
    .filter((s: any) => s.employees?.pf_enabled && Number(s.pf) > 0)
    .map((s: any) => {
      const fullBasic = Number(s.employees?.basic_salary ?? 0);
      const pfWage = Number(s.employer_pf) > 0 ? Number(s.employer_pf) / 0.12 : (fullBasic > 15000 ? 15000 : Number(s.basic));
      const age = ageOn(s.employees?.date_of_birth);
      const eps = age >= 58 ? 0 : Math.min(pfWage, 15000) * 0.0833;
      const epf = Number(s.employer_pf) - eps;
      return {
        id: s.id,
        name: s.employees?.full_name,
        code: s.employees?.employee_code,
        uan: s.employees?.uan ?? "",
        pf_no: s.employees?.pf_number ?? "",
        age,
        pf_wage: pfWage,
        ee: Number(s.pf),
        eps,
        epf: Math.max(0, epf),
        edli: Number(s.edli),
        admin: Number(s.pf_admin_charges),
        total: Number(s.pf) + Number(s.employer_pf) + Number(s.edli) + Number(s.pf_admin_charges),
      };
    });

  const esiRows = slips
    .filter((s: any) => s.employees?.esi_enabled && (Number(s.esi) > 0 || Number(s.employer_esi) > 0))
    .map((s: any) => ({
      id: s.id,
      name: s.employees?.full_name,
      code: s.employees?.employee_code,
      esi_no: s.employees?.esi_number ?? "",
      wage: Number(s.basic),
      ee: Number(s.esi),
      er: Number(s.employer_esi),
      total: Number(s.esi) + Number(s.employer_esi),
    }));

  const sum = (arr: any[], k: string) => arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);

  const exportPF = () => exportToXlsx(`PF_Challan_${run ? monthName(run.month) + "_" + run.year : ""}.xlsx`, pfRows.map(r => ({
    Code: r.code, Employee: r.name, UAN: r.uan, "PF No.": r.pf_no, Age: r.age,
    "PF Wage": r.pf_wage, "EE 12%": r.ee, "EPS 8.33%": r.eps, "EPF 3.67%": r.epf,
    "EDLI 0.5%": r.edli, "Admin 0.5%": r.admin, Total: r.total,
  })), "PF");

  const exportESI = () => exportToXlsx(`ESI_Challan_${run ? monthName(run.month) + "_" + run.year : ""}.xlsx`, esiRows.map(r => ({
    Code: r.code, Employee: r.name, "ESI No.": r.esi_no, "ESI Wage": r.wage,
    "EE 0.75%": r.ee, "ER 3.25%": r.er, Total: r.total,
  })), "ESI");

  const exportTDS = () => exportToXlsx(`TDS_194H_Challan_${run ? monthName(run.month) + "_" + run.year : ""}.xlsx`, tdsRows.map(r => ({
    Date: r.date, Code: r.code, Agent: r.name, PAN: r.pan || "NOT AVAILABLE",
    "Commission Paid": r.gross, "TDS %": r.rate, "TDS u/s 194H": r.tds, "Net Paid": r.net,
  })), "TDS 194H");

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-4 no-print print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Challans</h1>
          <p className="text-sm text-muted-foreground">PF (EPFO), ESI & TDS (Section 194H) statutory challan summaries.</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Payroll run</Label>
            <Select value={effectiveRun} onValueChange={setRunId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select run…" /></SelectTrigger>
              <SelectContent>
                {runs.map((r: any) => <SelectItem key={r.id} value={r.id}>{monthName(r.month)} {r.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportPF} variant="outline" disabled={!pfRows.length}><FileSpreadsheet className="h-4 w-4 mr-1" />PF Excel</Button>
          <Button onClick={exportESI} variant="outline" disabled={!esiRows.length}><FileSpreadsheet className="h-4 w-4 mr-1" />ESI Excel</Button>
          <Button onClick={exportTDS} variant="outline" disabled={!tdsRows.length}><FileSpreadsheet className="h-4 w-4 mr-1" />TDS Excel</Button>

        </div>
      </div>

      <div className="print-area space-y-6">
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <CardTitle>PF (EPFO) Challan — {run ? `${monthName(run.month)} ${run.year}` : "—"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>UAN / PF No.</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead className="text-right">PF Wage</TableHead>
                <TableHead className="text-right">EE 12%</TableHead>
                <TableHead className="text-right">EPS 8.33%</TableHead>
                <TableHead className="text-right">EPF 3.67%</TableHead>
                <TableHead className="text-right">EDLI 0.5%</TableHead>
                <TableHead className="text-right">Admin 0.5%</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pfRows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">No PF-eligible employees.</TableCell></TableRow>
              ) : pfRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.code}</div></TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{r.uan || "—"}</div>
                    <div className="text-muted-foreground">{r.pf_no || "—"}</div>
                  </TableCell>
                  <TableCell className="text-right">{r.age || "—"}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.pf_wage)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.ee)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.eps)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.epf)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.edli)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.admin)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtINR(r.total)}</TableCell>
                </TableRow>
              ))}
              {pfRows.length > 0 && (
                <TableRow className="border-t-2 border-border bg-muted/40">
                  <TableCell className="font-bold" colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "pf_wage"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "ee"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "eps"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "epf"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "edli"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(pfRows, "admin"))}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmtINR(sum(pfRows, "total"))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <CardTitle>ESI Challan — {run ? `${monthName(run.month)} ${run.year}` : "—"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>ESI No.</TableHead>
                <TableHead className="text-right">ESI Wage (Basic)</TableHead>
                <TableHead className="text-right">EE 0.75%</TableHead>
                <TableHead className="text-right">ER 3.25%</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esiRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No ESI-eligible employees.</TableCell></TableRow>
              ) : esiRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.code}</div></TableCell>
                  <TableCell className="font-mono text-xs">{r.esi_no || "—"}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.wage)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.ee)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.er)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtINR(r.total)}</TableCell>
                </TableRow>
              ))}
              {esiRows.length > 0 && (
                <TableRow className="border-t-2 border-border bg-muted/40">
                  <TableCell className="font-bold" colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(esiRows, "wage"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(esiRows, "ee"))}</TableCell>
                  <TableCell className="text-right font-bold">{fmtINR(sum(esiRows, "er"))}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmtINR(sum(esiRows, "total"))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
