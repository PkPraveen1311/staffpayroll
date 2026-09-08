import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { exportToXlsx } from "@/lib/xlsx-export";
import { Plus, Trash2, FileSpreadsheet, IndianRupee, HandCoins, Wallet } from "lucide-react";

type Agent = { id: string; full_name: string; agent_code: string; department: string | null };
type Advance = { id: string; agent_id: string; amount: number; given_on: string; notes: string | null };
type Repayment = { id: string; advance_id: string; amount: number; repaid_on: string; notes: string | null };

function today() { return new Date().toISOString().slice(0, 10); }

export function AgentAdvancesSection() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [amount, setAmount] = useState("");
  const [givenOn, setGivenOn] = useState(today());
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");

  const [repayOpen, setRepayOpen] = useState<string | null>(null);
  const [repayAmt, setRepayAmt] = useState("");
  const [repayDate, setRepayDate] = useState(today());
  const [repayNotes, setRepayNotes] = useState("");

  const [depositOpen, setDepositOpen] = useState(false);
  const [depAgentId, setDepAgentId] = useState("");
  const [depAmt, setDepAmt] = useState("");
  const [depDate, setDepDate] = useState(today());
  const [depNotes, setDepNotes] = useState("");

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents-min-adv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_agents")
        .select("id, full_name, agent_code, department")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as Agent[];
    },
  });

  const { data: advances = [] } = useQuery<Advance[]>({
    queryKey: ["agent-advances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_advances").select("*").order("given_on", { ascending: false });
      if (error) throw error;
      return data as Advance[];
    },
  });

  const { data: repayments = [] } = useQuery<Repayment[]>({
    queryKey: ["agent-advance-repayments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_advance_repayments").select("*").order("repaid_on", { ascending: true });
      if (error) throw error;
      return data as Repayment[];
    },
  });

  const agentMap = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);

  const repayByAdv = useMemo(() => {
    const m = new Map<string, Repayment[]>();
    repayments.forEach(r => {
      if (!m.has(r.advance_id)) m.set(r.advance_id, []);
      m.get(r.advance_id)!.push(r);
    });
    return m;
  }, [repayments]);

  const rows = useMemo(() => {
    const list = filter === "all" ? advances : advances.filter(a => a.agent_id === filter);
    return list.map(a => {
      const reps = repayByAdv.get(a.id) ?? [];
      const repaid = reps.reduce((s, r) => s + Number(r.amount), 0);
      return { ...a, reps, repaid, outstanding: Math.max(0, Number(a.amount) - repaid) };
    });
  }, [advances, repayByAdv, filter]);

  const totals = useMemo(() => ({
    advanced: rows.reduce((s, r) => s + Number(r.amount), 0),
    repaid: rows.reduce((s, r) => s + r.repaid, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  }), [rows]);

  const ledgers = useMemo(() => {
    const advById = new Map(advances.map(a => [a.id, a]));
    const byAgent = new Map<string, { date: string; type: "advance" | "repayment"; particulars: string; debit: number; credit: number }[]>();
    advances.forEach(a => {
      const list = byAgent.get(a.agent_id) ?? [];
      list.push({ date: a.given_on, type: "advance", particulars: a.notes || "Advance given", debit: Number(a.amount), credit: 0 });
      byAgent.set(a.agent_id, list);
    });
    repayments.forEach(r => {
      const a = advById.get(r.advance_id);
      if (!a) return;
      const list = byAgent.get(a.agent_id) ?? [];
      list.push({ date: r.repaid_on, type: "repayment", particulars: r.notes || "Repayment", debit: 0, credit: Number(r.amount) });
      byAgent.set(a.agent_id, list);
    });
    const out = Array.from(byAgent.entries()).map(([agent_id, entries]) => {
      entries.sort((x, y) => x.date.localeCompare(y.date) || (x.type === "advance" ? -1 : 1));
      let bal = 0;
      const withBal = entries.map(e => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
      const debit = entries.reduce((s, e) => s + e.debit, 0);
      const credit = entries.reduce((s, e) => s + e.credit, 0);
      return { agent_id, entries: withBal, debit, credit, balance: Math.max(0, debit - credit) };
    });
    out.sort((a, b) => b.balance - a.balance);
    return filter === "all" ? out : out.filter(l => l.agent_id === filter);
  }, [advances, repayments, filter]);

  const agentOutstanding = useMemo(() => {
    const m = new Map<string, { advId: string; outstanding: number }[]>();
    [...advances].sort((a, b) => a.given_on.localeCompare(b.given_on)).forEach(a => {
      const reps = repayByAdv.get(a.id) ?? [];
      const out = Math.max(0, Number(a.amount) - reps.reduce((s, r) => s + Number(r.amount), 0));
      if (out <= 0) return;
      if (!m.has(a.agent_id)) m.set(a.agent_id, []);
      m.get(a.agent_id)!.push({ advId: a.id, outstanding: out });
    });
    return m;
  }, [advances, repayByAdv]);

  const refreshAdv = () => qc.invalidateQueries({ queryKey: ["agent-advances"] });
  const refreshRep = () => qc.invalidateQueries({ queryKey: ["agent-advance-repayments"] });

  const addAdvance = async () => {
    if (!agentId || !amount) { toast.error("Agent and amount required"); return; }
    const { error } = await supabase.from("agent_advances").insert({ agent_id: agentId, amount: Number(amount), given_on: givenOn, notes: notes || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Advance recorded");
    setAddOpen(false); setAgentId(""); setAmount(""); setNotes("");
    refreshAdv();
  };

  const addRepayment = async (advanceId: string) => {
    if (!repayAmt) { toast.error("Amount required"); return; }
    const { error } = await supabase.from("agent_advance_repayments").insert({ advance_id: advanceId, amount: Number(repayAmt), repaid_on: repayDate, notes: repayNotes || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Repayment recorded");
    setRepayOpen(null); setRepayAmt(""); setRepayNotes("");
    refreshRep();
  };

  const addDeposit = async () => {
    if (!depAgentId || !depAmt) { toast.error("Agent and amount required"); return; }
    let remaining = Number(depAmt);
    if (remaining <= 0) { toast.error("Amount must be greater than 0"); return; }
    const buckets = agentOutstanding.get(depAgentId) ?? [];
    const totalOut = buckets.reduce((s, b) => s + b.outstanding, 0);
    if (totalOut <= 0) { toast.error("No outstanding advance for this agent"); return; }
    if (remaining > totalOut) { toast.error(`Deposit exceeds outstanding (${fmtINR(totalOut)})`); return; }
    const inserts = [] as { advance_id: string; amount: number; repaid_on: string; notes: string }[];
    for (const b of buckets) {
      if (remaining <= 0) break;
      const take = Math.min(b.outstanding, remaining);
      inserts.push({ advance_id: b.advId, amount: take, repaid_on: depDate, notes: depNotes ? `Deposit: ${depNotes}` : "Deposit" });
      remaining -= take;
    }
    const { error } = await supabase.from("agent_advance_repayments").insert(inserts);
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit recorded");
    setDepositOpen(false); setDepAgentId(""); setDepAmt(""); setDepNotes("");
    refreshRep();
  };

  const deleteAdvance = async (id: string) => {
    const { error } = await supabase.from("agent_advances").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); refreshAdv(); refreshRep();
  };

  const deleteRepayment = async (id: string) => {
    const { error } = await supabase.from("agent_advance_repayments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Repayment removed"); refreshRep();
  };

  const exportExcel = () => exportToXlsx(
    `Agent_Advances_${today()}.xlsx`,
    rows.map(r => {
      const a = agentMap.get(r.agent_id);
      return {
        Code: a?.agent_code ?? "",
        Agent: a?.full_name ?? "",
        Department: a?.department ?? "",
        "Given On": r.given_on,
        Advance: Number(r.amount),
        Repaid: r.repaid,
        Outstanding: r.outstanding,
        Notes: r.notes ?? "",
      };
    }),
    "Agent Advances",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Commission Agent Advances</h2>
          <p className="text-sm text-muted-foreground">Advances given to agents. Outstanding amounts can be deducted in the Commission register.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          <Dialog open={depositOpen} onOpenChange={(o) => { setDepositOpen(o); if (o) { setDepAgentId(""); setDepAmt(""); setDepDate(today()); setDepNotes(""); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-500/60 text-emerald-600 dark:text-emerald-400"><Wallet className="h-4 w-4 mr-1" /> New Deposit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record agent deposit</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Adjusted against outstanding advances, oldest first.</p>
                <div className="space-y-1.5">
                  <Label>Agent</Label>
                  <Select value={depAgentId} onValueChange={setDepAgentId}>
                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>
                      {agents.map(a => {
                        const out = (agentOutstanding.get(a.id) ?? []).reduce((s, b) => s + b.outstanding, 0);
                        return <SelectItem key={a.id} value={a.id} disabled={out <= 0}>{a.full_name} ({a.agent_code}) — {fmtINR(out)}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" min={1} value={depAmt} onChange={e => setDepAmt(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Deposit date</Label><Input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={depNotes} onChange={e => setDepNotes(e.target.value)} placeholder="Optional" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
                <Button onClick={addDeposit} className="bg-emerald-600 hover:bg-emerald-700 text-white">Save deposit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New Advance</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record agent advance</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Agent</Label>
                  <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>
                      {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.agent_code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Given on</Label><Input type="date" value={givenOn} onChange={e => setGivenOn(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addAdvance}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniStat label="Total advanced" value={totals.advanced} color="from-blue-500/20 to-blue-500/5" icon={<IndianRupee className="h-5 w-5" />} />
        <MiniStat label="Total repaid" value={totals.repaid} color="from-emerald-500/20 to-emerald-500/5" icon={<HandCoins className="h-5 w-5" />} />
        <MiniStat label="Outstanding" value={totals.outstanding} color="from-rose-500/20 to-rose-500/5" icon={<IndianRupee className="h-5 w-5" />} highlight />
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Agent Ledger</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">One running account per agent — every advance adds, every repayment subtracts.</p>
          </div>
          <div className="w-64">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {ledgers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No ledger entries yet.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {ledgers.map(l => {
                const a = agentMap.get(l.agent_id);
                return (
                  <AccordionItem key={l.agent_id} value={l.agent_id}>
                    <AccordionTrigger>
                      <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                        <div className="text-left">
                          <div className="font-medium">{a?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{a?.agent_code}</div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">Advanced <span className="font-medium text-foreground">{fmtINR(l.debit)}</span></span>
                          <span className="text-muted-foreground">Repaid <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtINR(l.credit)}</span></span>
                          <Badge variant={l.balance > 0 ? "destructive" : "secondary"}>Balance {fmtINR(l.balance)}</Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Date</TableHead>
                            <TableHead>Particulars</TableHead>
                            <TableHead className="text-right">Advance (Dr)</TableHead>
                            <TableHead className="text-right">Repaid (Cr)</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {l.entries.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{e.date}</TableCell>
                              <TableCell className="text-sm">{e.particulars}</TableCell>
                              <TableCell className="text-right">{e.debit ? fmtINR(e.debit) : "—"}</TableCell>
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{e.credit ? fmtINR(e.credit) : "—"}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtINR(Math.max(0, e.balance))}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/40">
                            <TableCell colSpan={2} className="font-semibold">Closing balance</TableCell>
                            <TableCell className="text-right font-semibold">{fmtINR(l.debit)}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmtINR(l.credit)}</TableCell>
                            <TableCell className="text-right font-bold">{fmtINR(l.balance)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>Advances</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Given On</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead className="text-right">Repaid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Repayments</TableHead>
                <TableHead className="text-right w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No advances recorded.</TableCell></TableRow>
              ) : rows.map(r => {
                const a = agentMap.get(r.agent_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{a?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{a?.agent_code}</div>
                    </TableCell>
                    <TableCell>{r.given_on}</TableCell>
                    <TableCell className="text-right font-medium">{fmtINR(r.amount)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmtINR(r.repaid)}</TableCell>
                    <TableCell className="text-right"><Badge variant={r.outstanding > 0 ? "destructive" : "secondary"}>{fmtINR(r.outstanding)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.reps.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : r.reps.map(rp => (
                          <span key={rp.id} className="inline-flex items-center gap-1 text-[11px] rounded-md border border-border/60 px-1.5 py-0.5">
                            <span className="text-muted-foreground">{rp.repaid_on}:</span>
                            <span className="font-medium">{fmtINR(rp.amount)}</span>
                            <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => deleteRepayment(rp.id)} title="Remove"><Trash2 className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog open={repayOpen === r.id} onOpenChange={(o) => { setRepayOpen(o ? r.id : null); if (o) { setRepayAmt(""); setRepayDate(today()); setRepayNotes(""); } }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={r.outstanding <= 0}><HandCoins className="h-4 w-4 mr-1" /> Repay</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Record repayment</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">Outstanding: <span className="font-semibold text-foreground">{fmtINR(r.outstanding)}</span></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" min={1} max={r.outstanding} value={repayAmt} onChange={e => setRepayAmt(e.target.value)} /></div>
                                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} /></div>
                              </div>
                              <div className="space-y-1.5"><Label>Notes</Label><Input value={repayNotes} onChange={e => setRepayNotes(e.target.value)} placeholder="Optional" /></div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRepayOpen(null)}>Cancel</Button>
                              <Button onClick={() => addRepayment(r.id)}>Save</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete advance?</AlertDialogTitle>
                              <AlertDialogDescription>This removes the advance and all its repayments.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteAdvance(r.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, color, icon, highlight }: { label: string; value: number; color: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-border/60 shadow-elegant`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold ${highlight ? "text-rose-600 dark:text-rose-400" : ""}`}>{fmtINR(value)}</div>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
