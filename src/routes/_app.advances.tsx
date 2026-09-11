import { createFileRoute } from "@tanstack/react-router";
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
import { fmtINR, monthName } from "@/lib/format";
import { Plus, Trash2, FileDown, FileSpreadsheet, IndianRupee, HandCoins, Wallet, Printer } from "lucide-react";
import { printLedgers } from "@/lib/ledger-print";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentAdvancesSection } from "@/components/agent-advances";

export const Route = createFileRoute("/_app/advances")({ component: AdvancesPage });

type Employee = { id: string; full_name: string; employee_code: string; department: string | null };
type Advance = { id: string; employee_id: string; amount: number; given_on: string; notes: string | null };
type Repayment = { id: string; advance_id: string; amount: number; repaid_on: string; notes: string | null };

function AdvancesPage() {
  return (
    <Tabs defaultValue="employees" className="space-y-6">
      <TabsList>
        <TabsTrigger value="employees">Employees</TabsTrigger>
        <TabsTrigger value="agents">Commission Agents</TabsTrigger>
      </TabsList>
      <TabsContent value="employees"><EmployeeAdvances /></TabsContent>
      <TabsContent value="agents"><AgentAdvancesSection /></TabsContent>
    </Tabs>
  );
}

function EmployeeAdvances() {

  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [givenOn, setGivenOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [filterEmp, setFilterEmp] = useState<string>("all");

  const [repayOpen, setRepayOpen] = useState<string | null>(null);
  const [repayAmt, setRepayAmt] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().slice(0, 10));
  const [repayNotes, setRepayNotes] = useState("");

  // Deposit (post-salary employee deposit) — auto-allocated FIFO across outstanding advances
  const [depositOpen, setDepositOpen] = useState(false);
  const [depEmpId, setDepEmpId] = useState("");
  const [depAmt, setDepAmt] = useState("");
  const [depDate, setDepDate] = useState(new Date().toISOString().slice(0, 10));
  const [depNotes, setDepNotes] = useState("");

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees-min-adv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, employee_code, department").eq("status", "active").order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const { data: advances = [] } = useQuery<Advance[]>({
    queryKey: ["advances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_advances").select("*").order("given_on", { ascending: false });
      if (error) throw error;
      return data as Advance[];
    },
  });

  const { data: repayments = [] } = useQuery<Repayment[]>({
    queryKey: ["advance-repayments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("advance_repayments").select("*").order("repaid_on", { ascending: true });
      if (error) throw error;
      return data as Repayment[];
    },
  });

  const empMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  // Group repayments per advance
  const repayByAdv = useMemo(() => {
    const m = new Map<string, Repayment[]>();
    repayments.forEach(r => {
      if (!m.has(r.advance_id)) m.set(r.advance_id, []);
      m.get(r.advance_id)!.push(r);
    });
    return m;
  }, [repayments]);

  const rows = useMemo(() => {
    const list = filterEmp === "all" ? advances : advances.filter(a => a.employee_id === filterEmp);
    return list.map(a => {
      const reps = repayByAdv.get(a.id) ?? [];
      const repaid = reps.reduce((s, r) => s + Number(r.amount), 0);
      const outstanding = Math.max(0, Number(a.amount) - repaid);
      return { ...a, reps, repaid, outstanding };
    });
  }, [advances, repayByAdv, filterEmp]);

  const totals = useMemo(() => {
    const advanced = rows.reduce((s, r) => s + Number(r.amount), 0);
    const repaid = rows.reduce((s, r) => s + r.repaid, 0);
    const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    return { advanced, repaid, outstanding };
  }, [rows]);

  // Employee-wise single ledger: every advance (debit) and repayment (credit) in date order
  const ledgers = useMemo(() => {
    const advById = new Map(advances.map(a => [a.id, a]));
    const byEmp = new Map<string, { date: string; type: "advance" | "repayment"; particulars: string; debit: number; credit: number }[]>();

    advances.forEach(a => {
      const list = byEmp.get(a.employee_id) ?? [];
      list.push({ date: a.given_on, type: "advance", particulars: a.notes || "Advance given", debit: Number(a.amount), credit: 0 });
      byEmp.set(a.employee_id, list);
    });
    repayments.forEach(r => {
      const a = advById.get(r.advance_id);
      if (!a) return;
      const list = byEmp.get(a.employee_id) ?? [];
      list.push({ date: r.repaid_on, type: "repayment", particulars: r.notes || "Repayment", debit: 0, credit: Number(r.amount) });
      byEmp.set(a.employee_id, list);
    });

    const out = Array.from(byEmp.entries()).map(([employee_id, entries]) => {
      entries.sort((x, y) => x.date.localeCompare(y.date) || (x.type === "advance" ? -1 : 1));
      let bal = 0;
      const withBal = entries.map(e => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
      const debit = entries.reduce((s, e) => s + e.debit, 0);
      const credit = entries.reduce((s, e) => s + e.credit, 0);
      return { employee_id, entries: withBal, debit, credit, balance: Math.max(0, debit - credit) };
    });
    out.sort((a, b) => b.balance - a.balance);
    return filterEmp === "all" ? out : out.filter(l => l.employee_id === filterEmp);
  }, [advances, repayments, filterEmp]);


  const monthCols = useMemo(() => {
    // Distinct year-month appearing in any repayment (of visible rows)
    const set = new Set<string>();
    rows.forEach(r => r.reps.forEach(rp => set.add(rp.repaid_on.slice(0, 7))));
    return Array.from(set).sort();
  }, [rows]);

  const addAdvance = async () => {
    if (!empId || !amount) { toast.error("Employee and amount required"); return; }
    const { error } = await supabase.from("employee_advances").insert({
      employee_id: empId, amount: Number(amount), given_on: givenOn, notes: notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Advance recorded");
    setAddOpen(false); setEmpId(""); setAmount(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["advances"] });
  };

  const addRepayment = async (advanceId: string) => {
    if (!repayAmt) { toast.error("Amount required"); return; }
    const { error } = await supabase.from("advance_repayments").insert({
      advance_id: advanceId, amount: Number(repayAmt), repaid_on: repayDate, notes: repayNotes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Repayment recorded");
    setRepayOpen(null); setRepayAmt(""); setRepayNotes("");
    qc.invalidateQueries({ queryKey: ["advance-repayments"] });
  };

  // Employee-wise outstanding (across all their advances), ordered by given_on ASC for FIFO allocation
  const empOutstanding = useMemo(() => {
    const m = new Map<string, { advId: string; given_on: string; outstanding: number }[]>();
    const sorted = [...advances].sort((a, b) => a.given_on.localeCompare(b.given_on));
    sorted.forEach(a => {
      const reps = repayByAdv.get(a.id) ?? [];
      const repaid = reps.reduce((s, r) => s + Number(r.amount), 0);
      const out = Math.max(0, Number(a.amount) - repaid);
      if (out <= 0) return;
      if (!m.has(a.employee_id)) m.set(a.employee_id, []);
      m.get(a.employee_id)!.push({ advId: a.id, given_on: a.given_on, outstanding: out });
    });
    return m;
  }, [advances, repayByAdv]);

  const addDeposit = async () => {
    if (!depEmpId || !depAmt) { toast.error("Employee and amount required"); return; }
    let remaining = Number(depAmt);
    if (remaining <= 0) { toast.error("Amount must be greater than 0"); return; }
    const buckets = empOutstanding.get(depEmpId) ?? [];
    const totalOut = buckets.reduce((s, b) => s + b.outstanding, 0);
    if (totalOut <= 0) { toast.error("No outstanding advance for this employee"); return; }
    if (remaining > totalOut) { toast.error(`Deposit exceeds outstanding (${fmtINR(totalOut)})`); return; }
    const inserts: { advance_id: string; amount: number; repaid_on: string; notes: string | null }[] = [];
    for (const b of buckets) {
      if (remaining <= 0) break;
      const take = Math.min(b.outstanding, remaining);
      inserts.push({ advance_id: b.advId, amount: take, repaid_on: depDate, notes: depNotes ? `Deposit: ${depNotes}` : "Deposit" });
      remaining -= take;
    }
    const { error } = await supabase.from("advance_repayments").insert(inserts);
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit recorded");
    setDepositOpen(false); setDepEmpId(""); setDepAmt(""); setDepNotes("");
    qc.invalidateQueries({ queryKey: ["advance-repayments"] });
  };

  const deleteAdvance = async (id: string) => {
    const { error } = await supabase.from("employee_advances").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["advances"] });
  };

  const deleteRepayment = async (id: string) => {
    const { error } = await supabase.from("advance_repayments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Repayment removed");
    qc.invalidateQueries({ queryKey: ["advance-repayments"] });
  };

  const printLedger = () => {
    if (!ledgers.length) { toast.error("No ledger entries to print"); return; }
    printLedgers("Employee Advance Ledger", ledgers.map(l => {
      const emp = empMap.get(l.employee_id);
      return {
        name: emp?.full_name ?? "—",
        code: emp?.employee_code ?? "",
        entries: l.entries,
        debit: l.debit,
        credit: l.credit,
        balance: l.balance,
      };
    }));
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, M = 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("PEHCHAAN — Employee Advances Report", W / 2, M + 6, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, W / 2, M + 11, { align: "center" });

    let y = M + 18;
    doc.setFillColor(31, 58, 95); doc.rect(M, y, W - 2 * M, 9, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    const headers = ["Code", "Employee", "Given On", "Advance", "Repaid", "Outstanding", "Notes"];
    const widths = [22, 60, 24, 32, 32, 34, 73];
    let x = M;
    headers.forEach((h, i) => { doc.text(h, x + 2, y + 6); x += widths[i]; });
    y += 9;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    rows.forEach((r, idx) => {
      if (y > 190) { doc.addPage(); y = M; }
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(M, y, W - 2 * M, 7, "F"); }
      const emp = empMap.get(r.employee_id);
      const vals = [
        emp?.employee_code ?? "-",
        emp?.full_name ?? "-",
        r.given_on,
        "Rs. " + Math.round(Number(r.amount)).toLocaleString("en-IN"),
        "Rs. " + Math.round(r.repaid).toLocaleString("en-IN"),
        "Rs. " + Math.round(r.outstanding).toLocaleString("en-IN"),
        r.notes ?? "",
      ];
      x = M;
      vals.forEach((v, i) => {
        doc.text(String(v).slice(0, i === 6 ? 42 : 30), x + 2, y + 5);
        x += widths[i];
      });
      y += 7;
    });

    // Totals
    if (y > 185) { doc.addPage(); y = M; }
    doc.setFillColor(31, 58, 95); doc.rect(M, y, W - 2 * M, 9, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    doc.text("TOTAL", M + 2, y + 6);
    const t = ["", "", "", "Rs. " + Math.round(totals.advanced).toLocaleString("en-IN"), "Rs. " + Math.round(totals.repaid).toLocaleString("en-IN"), "Rs. " + Math.round(totals.outstanding).toLocaleString("en-IN"), ""];
    x = M;
    t.forEach((v, i) => { doc.text(String(v), x + 2, y + 6); x += widths[i]; });

    doc.save(`Advances_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Advances", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    const baseHeaders = ["Code", "Employee", "Department", "Given On", "Advance", "Notes"];
    const monthHeaders = monthCols.map(m => `Repaid ${monthLabel(m)}`);
    const tailHeaders = ["Total Repaid", "Outstanding"];
    const headers = [...baseHeaders, ...monthHeaders, ...tailHeaders];

    ws.mergeCells(1, 1, 1, headers.length);
    const title = ws.getCell(1, 1);
    title.value = "PEHCHAAN — Employee Advances Report";
    title.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
    title.alignment = { horizontal: "center", vertical: "middle" };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, headers.length);
    const sub = ws.getCell(2, 1);
    sub.value = `Generated ${new Date().toLocaleString("en-IN")}   ·   ${rows.length} advance${rows.length === 1 ? "" : "s"}`;
    sub.font = { italic: true, color: { argb: "FFFFFFFF" } };
    sub.alignment = { horizontal: "center" };
    sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C5282" } };

    ws.getRow(3).height = 4;

    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => {
      const c = ws.getCell(4, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FF1A202C" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF2F7" } };
      c.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    headerRow.height = 26;

    const inr = '"₹"#,##0';
    rows.forEach((r, idx) => {
      const emp = empMap.get(r.employee_id);
      const monthlyRepaid = monthCols.map(m => r.reps.filter(rp => rp.repaid_on.startsWith(m)).reduce((s, rp) => s + Number(rp.amount), 0));
      const vals: any[] = [
        emp?.employee_code ?? "",
        emp?.full_name ?? "",
        emp?.department ?? "",
        r.given_on,
        Number(r.amount),
        r.notes ?? "",
        ...monthlyRepaid,
        r.repaid,
        r.outstanding,
      ];
      const rowNum = 5 + idx;
      const zebra = idx % 2 === 0 ? "FFFFFFFF" : "FFF7FAFC";
      vals.forEach((v, i) => {
        const c = ws.getCell(rowNum, i + 1);
        c.value = v;
        c.font = { size: 10 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
        c.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
        if (typeof v === "number") {
          c.numFmt = inr;
          c.alignment = { horizontal: "right" };
        }
      });
      // Highlight outstanding
      const outCell = ws.getCell(rowNum, headers.length);
      outCell.font = { bold: true, color: { argb: r.outstanding > 0 ? "FF742A2A" : "FF22543D" } };
    });

    // Totals
    const totRow = 5 + rows.length;
    ws.getCell(totRow, 1).value = "TOTAL";
    ws.mergeCells(totRow, 1, totRow, 4);
    const monthlyTotals = monthCols.map(m => rows.reduce((s, r) => s + r.reps.filter(rp => rp.repaid_on.startsWith(m)).reduce((a, rp) => a + Number(rp.amount), 0), 0));
    const totVals: any[] = [totals.advanced, "", ...monthlyTotals, totals.repaid, totals.outstanding];
    totVals.forEach((v, i) => {
      const c = ws.getCell(totRow, 5 + i);
      c.value = v;
      if (typeof v === "number") { c.numFmt = inr; c.alignment = { horizontal: "right" }; }
    });
    for (let col = 1; col <= headers.length; col++) {
      const c = ws.getCell(totRow, col);
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      c.border = { top: { style: "medium" }, bottom: { style: "medium" } };
    }

    // Column widths
    const widths = [10, 26, 18, 12, 14, 30, ...monthCols.map(() => 14), 14, 14];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Advances_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Employee Advances</h1>
          <p className="text-sm text-muted-foreground">Track money given as advance, month-wise repayments, and current outstanding.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printLedger}><Printer className="h-4 w-4 mr-1" /> Print Ledger</Button>
          <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          <Dialog open={depositOpen} onOpenChange={(o) => { setDepositOpen(o); if (o) { setDepEmpId(""); setDepAmt(""); setDepDate(new Date().toISOString().slice(0, 10)); setDepNotes(""); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-500/60 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"><Wallet className="h-4 w-4 mr-1" /> New Deposit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record employee deposit</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Use this when an employee deposits money back after receiving salary. The amount is auto-adjusted against their outstanding advances (oldest first).</p>
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={depEmpId} onValueChange={setDepEmpId}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => {
                        const out = (empOutstanding.get(e.id) ?? []).reduce((s, b) => s + b.outstanding, 0);
                        return <SelectItem key={e.id} value={e.id} disabled={out <= 0}>{e.full_name} ({e.employee_code}) — {fmtINR(out)}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {depEmpId && (
                  <div className="text-sm text-muted-foreground">Outstanding: <span className="font-semibold text-foreground">{fmtINR((empOutstanding.get(depEmpId) ?? []).reduce((s, b) => s + b.outstanding, 0))}</span></div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Amount (₹)</Label>
                    <Input type="number" min={1} value={depAmt} onChange={e => setDepAmt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deposit date</Label>
                    <Input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={depNotes} onChange={e => setDepNotes(e.target.value)} placeholder="Optional (e.g., Cash deposit post May salary)" />
                </div>
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
              <DialogHeader><DialogTitle>Record advance</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={empId} onValueChange={setEmpId}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Amount (₹)</Label>
                    <Input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Given on</Label>
                    <Input type="date" value={givenOn} onChange={e => setGivenOn(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
                </div>
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
        <StatCard label="Total advanced" value={totals.advanced} color="from-blue-500/20 to-blue-500/5" icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Total repaid" value={totals.repaid} color="from-emerald-500/20 to-emerald-500/5" icon={<HandCoins className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={totals.outstanding} color="from-rose-500/20 to-rose-500/5" icon={<IndianRupee className="h-5 w-5" />} highlight />
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Employee Ledger</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">One running account per employee — every advance adds, every repayment subtracts.</p>
          </div>
          <div className="w-64">
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
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
                const emp = empMap.get(l.employee_id);
                return (
                  <AccordionItem key={l.employee_id} value={l.employee_id}>
                    <AccordionTrigger>
                      <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                        <div className="text-left">
                          <div className="font-medium">{emp?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{emp?.employee_code}</div>
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
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Advances</CardTitle>
          <div className="w-64">
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
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
                const emp = empMap.get(r.employee_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{emp?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{emp?.employee_code}</div>
                    </TableCell>
                    <TableCell>{r.given_on}</TableCell>
                    <TableCell className="text-right font-medium">{fmtINR(r.amount)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmtINR(r.repaid)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.outstanding > 0 ? "destructive" : "secondary"}>{fmtINR(r.outstanding)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.reps.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : r.reps.map(rp => (
                          <span key={rp.id} className="inline-flex items-center gap-1 text-[11px] rounded-md border border-border/60 px-1.5 py-0.5">
                            <span className="text-muted-foreground">{monthLabel(rp.repaid_on.slice(0, 7))}:</span>
                            <span className="font-medium">{fmtINR(rp.amount)}</span>
                            <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => deleteRepayment(rp.id)} title="Remove"><Trash2 className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog open={repayOpen === r.id} onOpenChange={(o) => { setRepayOpen(o ? r.id : null); if (o) { setRepayAmt(""); setRepayDate(new Date().toISOString().slice(0, 10)); setRepayNotes(""); } }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={r.outstanding <= 0}><HandCoins className="h-4 w-4 mr-1" /> Repay</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Record repayment</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">Outstanding: <span className="font-semibold text-foreground">{fmtINR(r.outstanding)}</span></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Amount (₹)</Label>
                                  <Input type="number" min={1} max={r.outstanding} value={repayAmt} onChange={e => setRepayAmt(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Date</Label>
                                  <Input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Notes</Label>
                                <Input value={repayNotes} onChange={e => setRepayNotes(e.target.value)} placeholder="Optional" />
                              </div>
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

function StatCard({ label, value, color, icon, highlight }: { label: string; value: number; color: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-border/60 shadow-elegant`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold ${highlight ? "text-rose-600 dark:text-rose-400" : ""}`}>{fmtINR(value)}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-background/50 grid place-items-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${monthName(m).slice(0, 3)} ${String(y).slice(2)}`;
}
