import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Printer, Check } from "lucide-react";
import { fmtINR, monthName } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/payslips")({ component: PayslipsPage });

function PayslipsPage() {
  const qc = useQueryClient();
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

  const saveIncentive = async (slip: any, incentive: number) => {
    const advance = Number(slip.advance ?? 0);
    const baseDed = Number(slip.total_deductions) - Number(slip.advance ?? 0);
    const newTotalDed = baseDed + advance;
    const net = Number(slip.gross) + incentive - newTotalDed;
    const { error } = await supabase.from("payslips").update({ incentive, net_pay: Math.round(net * 100) / 100 }).eq("id", slip.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Incentive saved");
    await refreshTotals(slip.payroll_run_id);
  };

  const saveAdvance = async (slip: any, advance: number) => {
    const baseDed = Number(slip.total_deductions) - Number(slip.advance ?? 0);
    const newTotalDed = baseDed + advance;
    const net = Number(slip.gross) + Number(slip.incentive ?? 0) - newTotalDed;
    const { error } = await supabase.from("payslips").update({
      advance,
      total_deductions: Math.round(newTotalDed * 100) / 100,
      net_pay: Math.round(net * 100) / 100,
    }).eq("id", slip.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Advance saved");
    await refreshTotals(slip.payroll_run_id);
  };

  const refreshTotals = async (payrollRunId: string) => {
    const { data: all } = await supabase.from("payslips").select("net_pay").eq("payroll_run_id", payrollRunId);
    const totalNet = (all ?? []).reduce((s: number, p: any) => s + Number(p.net_pay), 0);
    await supabase.from("payroll_runs").update({ total_net: totalNet }).eq("id", payrollRunId);
    qc.invalidateQueries({ queryKey: ["payslips", effectiveRun] });
    qc.invalidateQueries({ queryKey: ["payroll_runs"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payslips</h1>
          <p className="text-sm text-muted-foreground">Browse, add monthly incentives, and print payslips.</p>
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
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right w-40">Incentive</TableHead>
                <TableHead className="text-right w-40">Advance</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net pay</TableHead><TableHead className="text-right">Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payslips. Generate a payroll run first.</TableCell></TableRow>
              ) : slips.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><div className="font-medium">{s.employees?.full_name}</div><div className="text-xs text-muted-foreground font-mono">{s.employees?.employee_code}</div></TableCell>
                  <TableCell className="text-right">{s.days_worked}</TableCell>
                  <TableCell className="text-right">{fmtINR(s.gross)}</TableCell>
                  <TableCell className="text-right"><EditableNumCell key={`inc-${s.id}-${s.incentive}`} value={s.incentive} onSave={(n) => saveIncentive(s, n)} /></TableCell>
                  <TableCell className="text-right"><EditableNumCell key={`adv-${s.id}-${s.advance}`} value={s.advance} onSave={(n) => saveAdvance(s, n)} /></TableCell>
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

function EditableNumCell({ value, onSave }: { value: number | string | null | undefined; onSave: (n: number) => void }) {
  const initial = String(value ?? 0);
  const [val, setVal] = useState<string>(initial);
  const dirty = Number(val || 0) !== Number(initial || 0);
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 w-28 text-right"
        min={0}
      />
      {dirty && (
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onSave(Number(val || 0))}>
          <Check className="h-4 w-4 text-primary" />
        </Button>
      )}
    </div>
  );
}

function SlipDialog({ slip, period }: { slip: any; period: string }) {
  const employerCost = Number(slip.gross) + Number(slip.incentive ?? 0)
    + Number(slip.employer_pf ?? 0) + Number(slip.employer_esi ?? 0)
    + Number(slip.edli ?? 0) + Number(slip.pf_admin_charges ?? 0);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" /> View</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <Row k="Medical Allowance" v={slip.medical_allowance ?? 0} />
              <Row k="Leave Encashment" v={slip.leave_encashment ?? 0} />
              <Row k="Statutory Bonus" v={slip.statutory_bonus ?? 0} />
              <Row k="Special Allowance" v={slip.special_allowance ?? 0} />
              <Row k="Other Allowances" v={slip.allowances} />
              <Row k="Incentive" v={slip.incentive ?? 0} />
              <Row k="Gross + Incentive" v={Number(slip.gross) + Number(slip.incentive ?? 0)} bold />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Employee deductions</h4>
              <Row k="PF (12% of basic)" v={slip.pf} />
              <Row k="ESI" v={slip.esi} />
              <Row k="TDS" v={slip.tds} />
              <Row k="Advance" v={slip.advance ?? 0} />
              <Row k="Total" v={slip.total_deductions} bold />

              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2">Employer contributions</h4>
              <Row k="Employer PF (12%)" v={slip.employer_pf ?? 0} />
              <Row k="EDLI (0.5%)" v={slip.edli ?? 0} />
              <Row k="PF Admin charges (0.5%)" v={slip.pf_admin_charges ?? 0} />
              <Row k="Employer ESI (3.25%)" v={slip.employer_esi ?? 0} />
              <Row k="Cost to Company" v={employerCost} bold />
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
