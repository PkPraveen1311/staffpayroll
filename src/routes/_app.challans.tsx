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
import { Printer } from "lucide-react";

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
        .select("*, employees(full_name, employee_code, basic_salary, pf_enabled, esi_enabled)")
        .eq("payroll_run_id", effectiveRun);
      return data ?? [];
    },
    enabled: !!effectiveRun,
  });

  const run: any = runs.find((r: any) => r.id === effectiveRun);

  // PF challan: split employer 12% into EPS (8.33% of pf_wage capped 15k) and EPF (3.67%)
  const pfRows = slips
    .filter((s: any) => s.employees?.pf_enabled && Number(s.pf) > 0)
    .map((s: any) => {
      const fullBasic = Number(s.employees?.basic_salary ?? 0);
      // recover pf_wage from employer_pf (= 12% of pfWage)
      const pfWage = Number(s.employer_pf) > 0 ? Number(s.employer_pf) / 0.12 : (fullBasic > 15000 ? 15000 : Number(s.basic));
      const eps = Math.min(pfWage, 15000) * 0.0833;
      const epf = Number(s.employer_pf) - eps;
      return {
        id: s.id,
        name: s.employees?.full_name,
        code: s.employees?.employee_code,
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
      wage: Number(s.basic),
      ee: Number(s.esi),
      er: Number(s.employer_esi),
      total: Number(s.esi) + Number(s.employer_esi),
    }));

  const sum = (arr: any[], k: string) => arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-4 no-print print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Challans</h1>
          <p className="text-sm text-muted-foreground">PF (EPFO) & ESI statutory challan summaries.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Payroll run</Label>
            <Select value={effectiveRun} onValueChange={setRunId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select run…" /></SelectTrigger>
              <SelectContent>
                {runs.map((r: any) => <SelectItem key={r.id} value={r.id}>{monthName(r.month)} {r.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <CardTitle>PF (EPFO) Challan — {run ? `${monthName(run.month)} ${run.year}` : "—"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No PF-eligible employees.</TableCell></TableRow>
              ) : pfRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.code}</div></TableCell>
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
                  <TableCell className="font-bold">TOTAL</TableCell>
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
                <TableHead className="text-right">ESI Wage (Basic)</TableHead>
                <TableHead className="text-right">EE 0.75%</TableHead>
                <TableHead className="text-right">ER 3.25%</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esiRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No ESI-eligible employees.</TableCell></TableRow>
              ) : esiRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.code}</div></TableCell>
                  <TableCell className="text-right">{fmtINR(r.wage)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.ee)}</TableCell>
                  <TableCell className="text-right">{fmtINR(r.er)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtINR(r.total)}</TableCell>
                </TableRow>
              ))}
              {esiRows.length > 0 && (
                <TableRow className="border-t-2 border-border bg-muted/40">
                  <TableCell className="font-bold">TOTAL</TableCell>
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
  );
}
