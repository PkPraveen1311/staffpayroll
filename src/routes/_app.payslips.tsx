import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Printer } from "lucide-react";
import { fmtINR, monthName } from "@/lib/format";

export const Route = createFileRoute("/_app/payslips")({ component: PayslipsPage });

function PayslipsPage() {
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
      const { data, error } = await supabase.from("payslips").select("*, employees(full_name, employee_code, designation, department, pan, bank_account)").eq("payroll_run_id", effectiveRun);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!effectiveRun,
  });

  const run: any = runs.find((r: any) => r.id === effectiveRun);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payslips</h1>
          <p className="text-sm text-muted-foreground">Browse and print payslips for any payroll run.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payroll run</Label>
          <Select value={effectiveRun} onValueChange={setRunId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select run…" /></SelectTrigger>
            <SelectContent>
              {runs.map((r: any) => <SelectItem key={r.id} value={r.id}>{monthName(r.month)} {r.year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>{run ? `${monthName(run.month)} ${run.year}` : "No run selected"}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead><TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net pay</TableHead><TableHead className="text-right">Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payslips. Generate a payroll run first.</TableCell></TableRow>
              ) : slips.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><div className="font-medium">{s.employees?.full_name}</div><div className="text-xs text-muted-foreground font-mono">{s.employees?.employee_code}</div></TableCell>
                  <TableCell className="text-right">{s.days_worked}</TableCell>
                  <TableCell className="text-right">{fmtINR(s.gross)}</TableCell>
                  <TableCell className="text-right">{fmtINR(s.total_deductions)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmtINR(s.net_pay)}</TableCell>
                  <TableCell className="text-right">
                    <SlipDialog slip={s} period={run ? `${monthName(run.month)} ${run.year}` : ""} />
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

function SlipDialog({ slip, period }: { slip: any; period: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" /> View</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Payslip — {period}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="font-display text-xl font-bold text-gradient">PayPulse</div>
              <div className="text-xs text-muted-foreground">Salary slip · {period}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">{slip.employees?.full_name}</div>
              <div className="text-xs text-muted-foreground">{slip.employees?.designation || "—"} · {slip.employees?.department || "—"}</div>
              <div className="text-xs font-mono">{slip.employees?.employee_code}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Earnings</h4>
              <Row k="Basic" v={slip.basic} />
              <Row k="HRA" v={slip.hra} />
              <Row k="Allowances" v={slip.allowances} />
              <Row k="Gross" v={slip.gross} bold />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Deductions</h4>
              <Row k="PF" v={slip.pf} />
              <Row k="ESI" v={slip.esi} />
              <Row k="TDS" v={slip.tds} />
              <Row k="Total" v={slip.total_deductions} bold />
            </div>
          </div>

          <div className="rounded-lg bg-gradient-primary p-4 flex items-center justify-between text-primary-foreground">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Net pay</div>
              <div className="text-2xl font-bold font-display">{fmtINR(slip.net_pay)}</div>
            </div>
            <div className="text-right text-xs opacity-90">
              <div>Days worked: {slip.days_worked}</div>
              <div>PAN: {slip.employees?.pan || "—"}</div>
              <div>A/C: {slip.employees?.bank_account || "—"}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-1" /> Print</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold border-t border-border/60 mt-1 pt-2" : ""}`}>
      <span className="text-muted-foreground">{k}</span><span>{fmtINR(v)}</span>
    </div>
  );
}
