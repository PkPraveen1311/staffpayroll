import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Printer, MessageCircle, Mail, FileSpreadsheet } from "lucide-react";
import { fmtINR, monthName } from "@/lib/format";
import { toast } from "sonner";
import { computeAgentPaidDays, fetchAgentAttendance, fetchAgentAllowedWeekOffs, fixedIncentiveFor } from "@/lib/agent-paid-days";
import { generateCommissionSlipPdf, type CommissionSlip } from "@/lib/commission-slip-pdf";
import { exportToXlsx } from "@/lib/xlsx-export";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function CommissionSlipsSection() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i), [now]);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

  const { data: agents = [] } = useQuery({
    queryKey: ["commission-agents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_agents")
        .select("id, agent_code, full_name, pan, phone, email, bank_account, ifsc_code, bank_name, tds_enabled, pay_type, fixed_monthly_amount, status")
        .order("agent_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["commission-payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_payments")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: att = [] } = useQuery({
    queryKey: ["agent-attendance-month", year, month],
    queryFn: () => fetchAgentAttendance(year, month),
  });

  const { data: allowedWO } = useQuery({
    queryKey: ["agent-allowed-week-offs", year, month],
    queryFn: () => fetchAgentAllowedWeekOffs(year, month),
  });

  const paidDays = useMemo(
    () => computeAgentPaidDays(att, daysInMonth, allowedWO),
    [att, daysInMonth, allowedWO],
  );
  const agentById = useMemo(() => new Map(agents.map((a: any) => [a.id, a])), [agents]);
  const period = `${monthName(month)} ${year}`;

  const monthSlips: CommissionSlip[] = useMemo(() => {
    return payments
      .filter((p: any) => p.month === month && p.year === year)
      .map((p: any) => {
        const agent = agentById.get(p.agent_id);
        const days = paidDays.get(p.agent_id) ?? 0;
        const fixed = fixedIncentiveFor(agent, days, daysInMonth);
        const gross = Number(p.gross_amount ?? 0);
        return {
          agent,
          period,
          fixed: Math.min(fixed, gross),
          commission: Math.max(0, gross - fixed),
          gross,
          tdsRate: Number(p.tds_rate ?? 0),
          tds: Number(p.tds_amount ?? 0),
          net: Number(p.net_amount ?? 0),
          days,
          daysInMonth,
          dueDate: p.due_date,
          paidDate: p.paid_on,
        } as CommissionSlip;
      })
      .filter((s) => !!s.agent);
  }, [payments, month, year, agentById, paidDays, daysInMonth, period]);

  const totals = monthSlips.reduce(
    (t, s) => ({ gross: t.gross + s.gross, tds: t.tds + s.tds, net: t.net + s.net }),
    { gross: 0, tds: 0, net: 0 },
  );

  // ---- Ledger ----
  const [ledgerAgent, setLedgerAgent] = useState<string>("");
  const effectiveAgent = ledgerAgent || (agents[0] as any)?.id || "";
  const ledgerRows = useMemo(() => {
    const rows = payments
      .filter((p: any) => p.agent_id === effectiveAgent)
      .slice()
      .sort((a: any, b: any) => (a.year - b.year) || (a.month - b.month));
    let running = 0;
    return rows.map((p: any) => {
      running += Number(p.net_amount ?? 0);
      return { ...p, running };
    });
  }, [payments, effectiveAgent]);
  const ledgerTotals = ledgerRows.reduce(
    (t: any, r: any) => ({
      gross: t.gross + Number(r.gross_amount ?? 0),
      tds: t.tds + Number(r.tds_amount ?? 0),
      net: t.net + Number(r.net_amount ?? 0),
    }),
    { gross: 0, tds: 0, net: 0 },
  );
  const ledgerAgentObj: any = agentById.get(effectiveAgent);

  const exportLedger = () => {
    if (!ledgerRows.length) { toast.error("Nothing to export"); return; }
    exportToXlsx(
      `Commission_Ledger_${ledgerAgentObj?.agent_code ?? "AGENT"}.xlsx`,
      ledgerRows.map((r: any) => ({
        Month: `${monthName(r.month)} ${r.year}`,
        "Due Date": r.due_date ?? "",
        "Paid Date": r.paid_on ?? "",
        Gross: Number(r.gross_amount ?? 0),
        "TDS %": Number(r.tds_rate ?? 0),
        "TDS (194H)": Number(r.tds_amount ?? 0),
        Net: Number(r.net_amount ?? 0),
        "Running Net": r.running,
      })),
      "Ledger",
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commission Slips & Ledger</h1>
        <p className="text-sm text-muted-foreground">Print or send monthly slips to agents and review their full payment ledger.</p>
      </div>

      <Tabs defaultValue="slips">
        <TabsList className="no-print">
          <TabsTrigger value="slips">Monthly Slips</TabsTrigger>
          <TabsTrigger value="ledger">Agent Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="slips" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 no-print">
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </div>

          <Card className="bg-gradient-card border-border/60 shadow-elegant">
            <CardHeader><CardTitle>Commission Slips — {period}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Fixed Incentive</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">TDS (194H)</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right no-print">Slip</TableHead>
                    <TableHead className="text-right no-print">Send</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthSlips.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No commission saved for this month. Save it in the Commission tab first.</TableCell></TableRow>
                  ) : monthSlips.map((s) => (
                    <TableRow key={s.agent.id}>
                      <TableCell>
                        <div className="font-medium">{s.agent.full_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.agent.agent_code}</div>
                      </TableCell>
                      <TableCell className="text-right">{s.agent.pay_type === "fixed" ? `${s.days}/${daysInMonth}` : "—"}</TableCell>
                      <TableCell className="text-right">{fmtINR(s.fixed)}</TableCell>
                      <TableCell className="text-right">{fmtINR(s.commission)}</TableCell>
                      <TableCell className="text-right">{fmtINR(s.gross)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmtINR(s.tds)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmtINR(s.net)}</TableCell>
                      <TableCell className="text-right no-print"><SlipDialog slip={s} /></TableCell>
                      <TableCell className="text-right no-print"><SendActions slip={s} /></TableCell>
                    </TableRow>
                  ))}
                  {monthSlips.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">{fmtINR(totals.gross)}</TableCell>
                      <TableCell className="text-right">{fmtINR(totals.tds)}</TableCell>
                      <TableCell className="text-right text-primary">{fmtINR(totals.net)}</TableCell>
                      <TableCell colSpan={2} className="no-print" />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 no-print">
            <div className="space-y-1.5">
              <Label className="text-xs">Agent</Label>
              <Select value={effectiveAgent} onValueChange={setLedgerAgent}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.agent_code} — {a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportLedger}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </div>

          <Card className="bg-gradient-card border-border/60 shadow-elegant">
            <CardHeader>
              <CardTitle>
                Ledger — {ledgerAgentObj ? `${ledgerAgentObj.full_name} (${ledgerAgentObj.agent_code})` : "No agent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">TDS %</TableHead>
                    <TableHead className="text-right">TDS (194H)</TableHead>
                    <TableHead className="text-right">Net Paid</TableHead>
                    <TableHead className="text-right">Cumulative Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No commission records for this agent yet.</TableCell></TableRow>
                  ) : ledgerRows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{monthName(r.month)} {r.year}</TableCell>
                      <TableCell>{r.due_date ?? "—"}</TableCell>
                      <TableCell>{r.paid_on ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtINR(r.gross_amount)}</TableCell>
                      <TableCell className="text-right">{Number(r.tds_rate ?? 0)}%</TableCell>
                      <TableCell className="text-right text-destructive">{fmtINR(r.tds_amount)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmtINR(r.net_amount)}</TableCell>
                      <TableCell className="text-right">{fmtINR(r.running)}</TableCell>
                    </TableRow>
                  ))}
                  {ledgerRows.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">{fmtINR(ledgerTotals.gross)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{fmtINR(ledgerTotals.tds)}</TableCell>
                      <TableCell className="text-right text-primary">{fmtINR(ledgerTotals.net)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SlipDialog({ slip }: { slip: CommissionSlip }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" /> View</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Commission Slip — {slip.period}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm print-area">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="font-display text-xl font-bold text-gradient">PEHCHAAN</div>
              <div className="text-xs text-muted-foreground">Commission / Incentive slip · {slip.period}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">{slip.agent.full_name}</div>
              <div className="text-xs font-mono">{slip.agent.agent_code}</div>
              <div className="text-xs text-muted-foreground">PAN: {slip.agent.pan || "—"}</div>
            </div>
          </div>
          <div>
            <Row k="Fixed Incentive (attendance based)" v={slip.fixed} />
            <Row k="Commission on sales" v={slip.commission} />
            <Row k="Gross payable" v={slip.gross} bold />
            <Row k={`TDS u/s 194H @ ${slip.tdsRate}%`} v={-slip.tds} />
          </div>
          <div className="rounded-lg bg-gradient-primary p-4 flex items-center justify-between text-primary-foreground">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Net payable</div>
              <div className="text-2xl font-bold font-display">{fmtINR(slip.net)}</div>
            </div>
            <div className="text-right text-xs opacity-90">
              <div>Paid days: {slip.agent.pay_type === "fixed" ? `${slip.days}/${slip.daysInMonth}` : "—"}</div>
              <div>Due: {slip.dueDate ?? "—"}</div>
              <div>Paid: {slip.paidDate ?? "—"}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2 no-print">
          <Button
            className="bg-gradient-primary text-primary-foreground"
            onClick={() => generateCommissionSlipPdf(slip).catch((e) => toast.error(e?.message ?? "Failed to generate PDF"))}
          >
            <Printer className="h-4 w-4 mr-1" /> Download PDF
          </Button>
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

function buildSlipText(s: CommissionSlip) {
  return [
    `*PEHCHAAN — Commission Slip*`,
    s.period,
    ``,
    `Agent: ${s.agent.full_name}`,
    `Code: ${s.agent.agent_code}`,
    s.agent.pay_type === "fixed" ? `Paid days: ${s.days}/${s.daysInMonth}` : ``,
    ``,
    `Fixed Incentive: ${fmtINR(s.fixed)}`,
    `Commission: ${fmtINR(s.commission)}`,
    `Gross: ${fmtINR(s.gross)}`,
    `TDS 194H @ ${s.tdsRate}%: ${fmtINR(s.tds)}`,
    ``,
    `*Net Payable: ${fmtINR(s.net)}*`,
  ].filter(Boolean).join("\n");
}

function SendActions({ slip }: { slip: CommissionSlip }) {
  const text = buildSlipText(slip);
  const phone = String(slip.agent.phone ?? "").replace(/\D/g, "");
  const email = slip.agent.email ?? "";

  const sendWhatsApp = () => {
    if (!phone) { toast.error("Agent phone number missing"); return; }
    const num = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };
  const sendEmail = () => {
    if (!email) { toast.error("Agent email missing"); return; }
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Commission Slip — ${slip.period}`)}&body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" title="Send via WhatsApp" onClick={sendWhatsApp}>
        <MessageCircle className="h-4 w-4 text-green-500" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" title="Send via Email" onClick={sendEmail}>
        <Mail className="h-4 w-4 text-blue-400" />
      </Button>
    </div>
  );
}
