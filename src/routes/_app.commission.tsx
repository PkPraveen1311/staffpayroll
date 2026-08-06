import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { exportToXlsx } from "@/lib/xlsx-export";
import { FileSpreadsheet, Printer, Save } from "lucide-react";

export const Route = createFileRoute("/_app/commission")({
  component: CommissionPage,
  head: () => ({
    meta: [
      { title: "Monthly Commission Register | PayPulse" },
      { name: "description", content: "Enter monthly commission for third-party agents with automatic Section 194H TDS and net payable." },
      { property: "og:title", content: "Monthly Commission Register | PayPulse" },
      { property: "og:description", content: "Enter monthly commission for third-party agents with automatic Section 194H TDS and net payable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const RATE_194H = 2;
const RATE_NO_PAN = 20;

type Agent = {
  id: string; agent_code: string; full_name: string; pan: string | null;
  bank_account: string | null; ifsc_code: string | null; bank_name: string | null;
  tds_enabled: boolean; status: string;
};

type Payment = {
  id: string; agent_id: string; paid_on: string; gross_amount: number;
  tds_rate: number; tds_amount: number; net_amount: number; notes: string | null;
  month: number | null; year: number | null;
};

function rateFor(a: Agent) {
  if (!a.tds_enabled) return 0;
  return a.pan && a.pan.trim().length >= 10 ? RATE_194H : RATE_NO_PAN;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function CommissionPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: agentsData } = useQuery<Agent[]>({
    queryKey: ["commission-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_agents")
        .select("id, agent_code, full_name, pan, bank_account, ifsc_code, bank_name, tds_enabled, status")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });

  const { data: rows = [] } = useQuery<Payment[]>({
    queryKey: ["commission-month", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_payments")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const existing = useMemo(() => new Map(rows.map(r => [r.agent_id, r])), [rows]);

  useEffect(() => {
    const next: Record<string, string> = {};
    agents.forEach(a => {
      const r = existing.get(a.id);
      next[a.id] = r ? String(Number(r.gross_amount)) : "";
    });
    setAmounts(next);
  }, [agents, existing]);

  const computed = useMemo(() => agents.map(a => {
    const gross = Number(amounts[a.id] || 0);
    const rate = rateFor(a);
    const tds = Math.round((gross * rate) / 100);
    return { agent: a, gross, rate, tds, net: gross - tds };
  }), [agents, amounts]);

  const totals = computed.reduce((t, r) => ({ gross: t.gross + r.gross, tds: t.tds + r.tds, net: t.net + r.net }), { gross: 0, tds: 0, net: 0 });

  const daysInMonth = new Date(year, month, 0).getDate();
  const paidOn = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of computed) {
        const row = existing.get(r.agent.id);
        if (r.gross > 0) {
          const payload = {
            agent_id: r.agent.id, paid_on: row?.paid_on ?? paidOn, month, year,
            gross_amount: r.gross, tds_rate: r.rate, tds_amount: r.tds, net_amount: r.net,
          };
          const { error } = row
            ? await supabase.from("commission_payments").update(payload).eq("id", row.id)
            : await supabase.from("commission_payments").insert(payload);
          if (error) throw error;
        } else if (row) {
          const { error } = await supabase.from("commission_payments").delete().eq("id", row.id);
          if (error) throw error;
        }
      }
      toast.success(`Commission saved for ${MONTHS[month - 1]} ${year}`);
      qc.invalidateQueries({ queryKey: ["commission-month", year, month] });
      qc.invalidateQueries({ queryKey: ["commission-payments"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save commission");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => exportToXlsx(
    `Commission_${MONTHS[month - 1]}_${year}.xlsx`,
    computed.map((r, i) => ({
      "#": i + 1,
      Code: r.agent.agent_code,
      Agent: r.agent.full_name,
      PAN: r.agent.pan ?? "",
      Bank: r.agent.bank_name ?? "",
      "Account No.": r.agent.bank_account ?? "",
      IFSC: r.agent.ifsc_code ?? "",
      Commission: r.gross,
      "TDS %": r.rate,
      "TDS (194H)": r.tds,
      "Net Payable": r.net,
    })),
    `${MONTHS[month - 1]} ${year}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Monthly Commission</h1>
          <p className="text-sm text-muted-foreground">Enter commission month-wise for third-party agents — TDS u/s 194H is computed automatically.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!agents.length}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button onClick={saveAll} disabled={saving || !agents.length}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save Month"}</Button>
        </div>
      </div>

      <div className="print-area">
        <Card className="bg-gradient-card border-border/60 shadow-elegant">
          <CardHeader>
            <CardTitle>Commission Register — {MONTHS[month - 1]} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">TDS %</TableHead>
                  <TableHead className="text-right">TDS (194H)</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No active commission agents. Add them in the Commission Agents tab.</TableCell></TableRow>
                ) : computed.map((r, i) => (
                  <TableRow key={r.agent.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.agent.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.agent.agent_code}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.agent.pan || <span className="text-destructive">No PAN</span>}</TableCell>
                    <TableCell className="text-xs">
                      <div>{r.agent.bank_name || "—"}</div>
                      <div className="text-muted-foreground font-mono">{r.agent.bank_account || "—"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" min="0"
                        className="h-8 w-32 ml-auto text-right print:hidden"
                        value={amounts[r.agent.id] ?? ""}
                        onChange={(e) => setAmounts({ ...amounts, [r.agent.id]: e.target.value })}
                      />
                      <span className="hidden print:inline">{fmtINR(r.gross)}</span>
                    </TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">{r.rate}%</Badge></TableCell>
                    <TableCell className="text-right">{fmtINR(r.tds)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtINR(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {computed.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Total Commission</div>
                  <div className="text-xl font-bold">{fmtINR(totals.gross)}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Total TDS (194H)</div>
                  <div className="text-xl font-bold">{fmtINR(totals.tds)}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Total Net Payable</div>
                  <div className="text-xl font-bold">{fmtINR(totals.net)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
