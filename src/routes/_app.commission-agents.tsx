import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { exportToXlsx } from "@/lib/xlsx-export";
import { Plus, Trash2, Pencil, FileSpreadsheet, Printer, Percent } from "lucide-react";

export const Route = createFileRoute("/_app/commission-agents")({
  component: CommissionAgentsPage,
  head: () => ({
    meta: [
      { title: "Commission Agents & 194H TDS | PayPulse" },
      { name: "description", content: "Manage third-party commission agents, record commission payouts and auto-compute Section 194H TDS." },
      { property: "og:title", content: "Commission Agents & 194H TDS | PayPulse" },
      { property: "og:description", content: "Manage third-party commission agents, record commission payouts and auto-compute Section 194H TDS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Agent = {
  id: string; agent_code: string; full_name: string; pan: string | null; aadhaar: string | null;
  phone: string | null; email: string | null; address: string | null; bank_account: string | null;
  ifsc_code: string | null; bank_name: string | null; tds_enabled: boolean; status: string; notes: string | null;
  department: string | null; designation: string | null; joining_date: string | null;
  date_of_birth: string | null; wedding_anniversary: string | null;
};

type Payment = {
  id: string; agent_id: string; paid_on: string; gross_amount: number;
  tds_rate: number; tds_amount: number; net_amount: number; notes: string | null;
  month: number | null; year: number | null;
};

const RATE_194H = 2;
const RATE_NO_PAN = 20;

const emptyAgent = (): Partial<Agent> => ({
  agent_code: "", full_name: "", pan: "", aadhaar: "", phone: "", email: "", address: "",
  bank_account: "", ifsc_code: "", bank_name: "", tds_enabled: true, status: "active", notes: "",
  department: "", designation: "", joining_date: "", date_of_birth: "", wedding_anniversary: "",
});


export function tdsRateFor(agent: Pick<Agent, "tds_enabled" | "pan">) {
  if (!agent.tds_enabled) return 0;
  return agent.pan && agent.pan.trim().length >= 10 ? RATE_194H : RATE_NO_PAN;
}

function CommissionAgentsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Agent> | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAgent, setPayAgent] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["commission-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_agents").select("*").order("full_name");
      if (error) throw error;
      return data as Agent[];
    },
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["commission-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_payments").select("*").order("paid_on", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const agentMap = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);

  const totalsByAgent = useMemo(() => {
    const m = new Map<string, { gross: number; tds: number; net: number }>();
    payments.forEach(p => {
      const t = m.get(p.agent_id) ?? { gross: 0, tds: 0, net: 0 };
      t.gross += Number(p.gross_amount); t.tds += Number(p.tds_amount); t.net += Number(p.net_amount);
      m.set(p.agent_id, t);
    });
    return m;
  }, [payments]);

  const previewAgent = payAgent ? agentMap.get(payAgent) : undefined;
  const previewRate = previewAgent ? tdsRateFor(previewAgent) : 0;
  const previewGross = Number(payAmt || 0);
  const previewTds = Math.round((previewGross * previewRate) / 100);

  const saveAgent = async () => {
    if (!editing?.full_name?.trim() || !editing?.agent_code?.trim()) {
      toast.error("Agent code and name are required");
      return;
    }
    if (editing.pan && editing.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(editing.pan.trim().toUpperCase())) {
      toast.error("PAN must look like ABCDE1234F");
      return;
    }
    const payload = {
      agent_code: editing.agent_code!.trim(),
      full_name: editing.full_name!.trim(),
      pan: editing.pan?.trim().toUpperCase() || null,
      aadhaar: editing.aadhaar?.trim() || null,
      phone: editing.phone?.trim() || null,
      email: editing.email?.trim() || null,
      address: editing.address?.trim() || null,
      bank_account: editing.bank_account?.trim() || null,
      ifsc_code: editing.ifsc_code?.trim().toUpperCase() || null,
      bank_name: editing.bank_name?.trim() || null,
      tds_enabled: !!editing.tds_enabled,
      status: editing.status || "active",
      notes: editing.notes?.trim() || null,
      department: editing.department?.trim() || null,
      designation: editing.designation?.trim() || null,
      joining_date: editing.joining_date || null,
      date_of_birth: editing.date_of_birth || null,
      wedding_anniversary: editing.wedding_anniversary || null,
    };
    const { error } = editing.id
      ? await supabase.from("commission_agents").update(payload).eq("id", editing.id)
      : await supabase.from("commission_agents").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Agent updated" : "Agent added");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["commission-agents"] });
  };

  const removeAgent = async (id: string) => {
    const { error } = await supabase.from("commission_agents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Agent removed");
    qc.invalidateQueries({ queryKey: ["commission-agents"] });
    qc.invalidateQueries({ queryKey: ["commission-payments"] });
  };

  const savePayment = async () => {
    const agent = agentMap.get(payAgent);
    if (!agent) { toast.error("Select an agent"); return; }
    const gross = Number(payAmt);
    if (!gross || gross <= 0) { toast.error("Enter a valid commission amount"); return; }
    const rate = tdsRateFor(agent);
    const tds = Math.round((gross * rate) / 100);
    const { error } = await supabase.from("commission_payments").insert({
      agent_id: agent.id, paid_on: payDate, gross_amount: gross,
      tds_rate: rate, tds_amount: tds, net_amount: gross - tds, notes: payNotes.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Commission recorded");
    setPayOpen(false); setPayAmt(""); setPayNotes("");
    qc.invalidateQueries({ queryKey: ["commission-payments"] });
  };

  const removePayment = async (id: string) => {
    const { error } = await supabase.from("commission_payments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["commission-payments"] });
  };

  const exportAgents = () => exportToXlsx("Commission_Agents.xlsx", agents.map(a => ({
    Code: a.agent_code, Name: a.full_name, PAN: a.pan ?? "", Aadhaar: a.aadhaar ?? "",
    Phone: a.phone ?? "", Email: a.email ?? "", Address: a.address ?? "",
    Bank: a.bank_name ?? "", "Account No.": a.bank_account ?? "", IFSC: a.ifsc_code ?? "",
    TDS: a.tds_enabled ? "Yes" : "No", "TDS Rate %": tdsRateFor(a), Status: a.status,
  })), "Agents");

  const exportPayments = () => exportToXlsx("Commission_Payments.xlsx", payments.map(p => ({
    Date: p.paid_on, Code: agentMap.get(p.agent_id)?.agent_code ?? "", Agent: agentMap.get(p.agent_id)?.full_name ?? "",
    PAN: agentMap.get(p.agent_id)?.pan ?? "", Commission: Number(p.gross_amount),
    "TDS %": Number(p.tds_rate), "TDS (194H)": Number(p.tds_amount), "Net Paid": Number(p.net_amount), Notes: p.notes ?? "",
  })), "Payments");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Commission Agents</h1>
          <p className="text-sm text-muted-foreground">Third-party sales agents paid on commission, with Section 194H TDS ({RATE_194H}%, {RATE_NO_PAN}% without PAN).</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <Button variant="outline" onClick={exportAgents} disabled={!agents.length}><FileSpreadsheet className="h-4 w-4 mr-1" />Agents Excel</Button>
          <Button variant="outline" onClick={exportPayments} disabled={!payments.length}><FileSpreadsheet className="h-4 w-4 mr-1" />Payouts Excel</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button variant="outline" onClick={() => { setPayAgent(agents[0]?.id ?? ""); setPayOpen(true); }} disabled={!agents.length}>
            <Percent className="h-4 w-4 mr-1" />Record Commission
          </Button>
          <Button onClick={() => setEditing(emptyAgent())}><Plus className="h-4 w-4 mr-1" />New Agent</Button>
        </div>
      </div>

      <div className="print-area space-y-6">
        <Card className="bg-gradient-card border-border/60 shadow-elegant">
          <CardHeader><CardTitle>Agent Master</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>PAN / Aadhaar</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Commission (Total)</TableHead>
                  <TableHead className="text-right">TDS (Total)</TableHead>
                  <TableHead className="text-right print:hidden">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No commission agents yet.</TableCell></TableRow>
                ) : agents.map(a => {
                  const t = totalsByAgent.get(a.id) ?? { gross: 0, tds: 0, net: 0 };
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.full_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.agent_code}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div>{a.pan || <span className="text-destructive">No PAN</span>}</div>
                        <div className="text-muted-foreground">{a.aadhaar || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{a.phone || "—"}</div>
                        <div className="text-muted-foreground">{a.email || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{a.bank_name || "—"}</div>
                        <div className="text-muted-foreground font-mono">{a.bank_account || "—"} {a.ifsc_code ? `· ${a.ifsc_code}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.tds_enabled
                          ? <Badge variant="secondary">{tdsRateFor(a)}%</Badge>
                          : <Badge variant="outline">Off</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{fmtINR(t.gross)}</TableCell>
                      <TableCell className="text-right">{fmtINR(t.tds)}</TableCell>
                      <TableCell className="text-right print:hidden">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {a.full_name}?</AlertDialogTitle>
                                <AlertDialogDescription>This also removes all recorded commission payouts for this agent.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeAgent(a.id)}>Delete</AlertDialogAction>
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

        <Card className="bg-gradient-card border-border/60 shadow-elegant">
          <CardHeader><CardTitle>Commission Payouts</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">TDS %</TableHead>
                  <TableHead className="text-right">TDS (194H)</TableHead>
                  <TableHead className="text-right">Net Paid</TableHead>
                  <TableHead className="text-right print:hidden"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No commission payouts recorded.</TableCell></TableRow>
                ) : payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.paid_on).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{agentMap.get(p.agent_id)?.full_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{agentMap.get(p.agent_id)?.pan || "—"}</TableCell>
                    <TableCell className="text-right">{fmtINR(p.gross_amount)}</TableCell>
                    <TableCell className="text-right">{Number(p.tds_rate)}%</TableCell>
                    <TableCell className="text-right">{fmtINR(p.tds_amount)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtINR(p.net_amount)}</TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button size="icon" variant="ghost" onClick={() => removePayment(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Agent dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Agent" : "New Commission Agent"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Agent code *</Label>
                <Input value={editing.agent_code ?? ""} onChange={(e) => setEditing({ ...editing, agent_code: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Full name *</Label>
                <Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>PAN</Label>
                <Input placeholder="ABCDE1234F" value={editing.pan ?? ""} onChange={(e) => setEditing({ ...editing, pan: e.target.value.toUpperCase() })} maxLength={10} /></div>
              <div className="space-y-1.5"><Label>Aadhaar</Label>
                <Input value={editing.aadhaar ?? ""} onChange={(e) => setEditing({ ...editing, aadhaar: e.target.value })} maxLength={12} /></div>
              <div className="space-y-1.5"><Label>Phone</Label>
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label>
                <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label>
                <Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bank name</Label>
                <Input value={editing.bank_name ?? ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bank account</Label>
                <Input value={editing.bank_account ?? ""} onChange={(e) => setEditing({ ...editing, bank_account: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>IFSC</Label>
                <Input value={editing.ifsc_code ?? ""} onChange={(e) => setEditing({ ...editing, ifsc_code: e.target.value.toUpperCase() })} /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={editing.status ?? "active"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-border/60 p-3">
                <div>
                  <Label>Deduct TDS (Section 194H)</Label>
                  <p className="text-xs text-muted-foreground">{RATE_194H}% with PAN, {RATE_NO_PAN}% when PAN is missing (Sec. 206AA).</p>
                </div>
                <Switch checked={!!editing.tds_enabled} onCheckedChange={(v) => setEditing({ ...editing, tds_enabled: v })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label>
                <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveAgent}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Commission Payout</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Agent</Label>
              <Select value={payAgent} onValueChange={setPayAgent}>
                <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.agent_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Commission amount (₹)</Label>
              <Input type="number" min="0" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Payment date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Notes</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} /></div>
            <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">TDS rate</span><span>{previewRate}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">TDS deducted</span><span>{fmtINR(previewTds)}</span></div>
              <div className="flex justify-between font-semibold"><span>Net payable</span><span>{fmtINR(previewGross - previewTds)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={savePayment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
