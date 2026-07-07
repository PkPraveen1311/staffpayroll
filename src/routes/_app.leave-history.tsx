import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowRight } from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_app/leave-history")({ component: LeaveHistoryPage });

function statusVariant(s: string) {
  return s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";
}

function daysBetween(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function LeaveHistoryPage() {
  const today = new Date();
  const [empId, setEmpId] = useState<string>("all");
  const [from, setFrom] = useState<string>(new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10));

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name, employee_code").order("full_name")).data ?? [],
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves-report", from, to, empId],
    queryFn: async () => {
      let q = supabase
        .from("leaves")
        .select("*, employees(id, full_name, employee_code)")
        .gte("start_date", from)
        .lte("start_date", to)
        .order("start_date", { ascending: false });
      if (empId !== "all") q = q.eq("employee_id", empId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const leaveIds = useMemo(() => leaves.map((l: any) => l.id), [leaves]);
  const { data: history = [] } = useQuery({
    queryKey: ["leave-history-batch", leaveIds],
    queryFn: async () => {
      if (leaveIds.length === 0) return [];
      const { data, error } = await supabase
        .from("leave_status_history")
        .select("*")
        .in("leave_id", leaveIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: leaveIds.length > 0,
  });

  const historyByLeave = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const h of history) {
      if (!map.has(h.leave_id)) map.set(h.leave_id, []);
      map.get(h.leave_id)!.push(h);
    }
    return map;
  }, [history]);

  const grouped = useMemo(() => {
    const byEmp = new Map<string, { employee: any; items: any[]; applied: number; approved: number; rejected: number; pending: number; days: number }>();
    for (const l of leaves) {
      const key = l.employee_id;
      if (!byEmp.has(key)) {
        byEmp.set(key, { employee: l.employees, items: [], applied: 0, approved: 0, rejected: 0, pending: 0, days: 0 });
      }
      const g = byEmp.get(key)!;
      g.items.push(l);
      g.applied += 1;
      const d = daysBetween(l.start_date, l.end_date);
      if (l.status === "approved") { g.approved += 1; g.days += d; }
      else if (l.status === "rejected") g.rejected += 1;
      else g.pending += 1;
    }
    return Array.from(byEmp.values()).sort((a, b) => (a.employee?.full_name ?? "").localeCompare(b.employee?.full_name ?? ""));
  }, [leaves]);

  const totals = useMemo(() => grouped.reduce((acc, g) => ({
    applied: acc.applied + g.applied,
    approved: acc.approved + g.approved,
    rejected: acc.rejected + g.rejected,
    pending: acc.pending + g.pending,
    days: acc.days + g.days,
  }), { applied: 0, approved: 0, rejected: 0, pending: 0, days: 0 }), [grouped]);

  const exportSummary = () => {
    const rows = grouped.map(g => ({
      Employee: g.employee?.full_name ?? "",
      Code: g.employee?.employee_code ?? "",
      Applied: g.applied,
      Approved: g.approved,
      Rejected: g.rejected,
      Pending: g.pending,
      "Approved Days": g.days,
    }));
    exportToXlsx(`leave-history-summary_${from}_to_${to}.xlsx`, rows, "Summary");
  };

  const exportDetail = () => {
    const rows: any[] = [];
    for (const g of grouped) {
      for (const l of g.items) {
        const hist = historyByLeave.get(l.id) ?? [];
        rows.push({
          Employee: g.employee?.full_name ?? "",
          Code: g.employee?.employee_code ?? "",
          Type: l.leave_type,
          From: l.start_date,
          To: l.end_date,
          Days: daysBetween(l.start_date, l.end_date),
          Status: l.status,
          Reason: l.reason ?? "",
          "Audit Trail": hist.map((h: any) => `${new Date(h.created_at).toLocaleString()} ${h.from_status ?? "new"}→${h.to_status} by ${h.changed_by_email ?? "system"}`).join(" | "),
        });
      }
    }
    exportToXlsx(`leave-history-detail_${from}_to_${to}.xlsx`, rows, "Detail");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leave History</h1>
          <p className="text-sm text-muted-foreground">Employee-wise applied / approved / rejected report with full audit trail.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Employee</Label>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <Button onClick={exportSummary} variant="outline"><Download className="h-4 w-4 mr-1" /> Summary</Button>
            <Button onClick={exportDetail} className="bg-gradient-primary text-primary-foreground"><Download className="h-4 w-4 mr-1" /> Detail</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Applied" value={totals.applied} />
        <StatCard label="Approved" value={totals.approved} />
        <StatCard label="Rejected" value={totals.rejected} />
        <StatCard label="Pending" value={totals.pending} />
        <StatCard label="Approved Days" value={totals.days} />
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>Employee summary</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Applied</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Approved days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leave records in this period.</TableCell></TableRow>
              ) : grouped.map((g) => (
                <TableRow key={g.employee?.id}>
                  <TableCell>
                    <div className="font-medium">{g.employee?.full_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{g.employee?.employee_code}</div>
                  </TableCell>
                  <TableCell className="text-right">{g.applied}</TableCell>
                  <TableCell className="text-right text-primary font-semibold">{g.approved}</TableCell>
                  <TableCell className="text-right text-destructive">{g.rejected}</TableCell>
                  <TableCell className="text-right">{g.pending}</TableCell>
                  <TableCell className="text-right">{g.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <Card key={g.employee?.id} className="bg-gradient-card border-border/60 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{g.employee?.full_name} <span className="text-xs font-normal text-muted-foreground ml-2">{g.employee?.employee_code}</span></span>
              <span className="text-sm font-normal text-muted-foreground">
                {g.applied} applied · {g.approved} approved · {g.rejected} rejected · {g.pending} pending
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead className="text-right">Days</TableHead>
                  <TableHead>Status</TableHead><TableHead>Audit trail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.items.map((l: any) => {
                  const hist = historyByLeave.get(l.id) ?? [];
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="capitalize">{l.leave_type}</TableCell>
                      <TableCell className="text-sm">{l.start_date} → {l.end_date}</TableCell>
                      <TableCell className="text-right">{daysBetween(l.start_date, l.end_date)}</TableCell>
                      <TableCell><Badge variant={statusVariant(l.status)} className="capitalize">{l.status}</Badge></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {hist.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : hist.map((h: any) => (
                            <div key={h.id} className="flex items-center gap-2 text-xs">
                              {h.from_status ? (
                                <>
                                  <Badge variant={statusVariant(h.from_status)} className="capitalize text-[10px] px-1.5 py-0">{h.from_status}</Badge>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                </>
                              ) : <span className="text-muted-foreground">new</span>}
                              <Badge variant={statusVariant(h.to_status)} className="capitalize text-[10px] px-1.5 py-0">{h.to_status}</Badge>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                              {h.changed_by_email && <><span className="text-muted-foreground">·</span><span className="font-mono text-muted-foreground truncate max-w-[180px]">{h.changed_by_email}</span></>}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-gradient-card border-border/60 shadow-elegant">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold font-display">{value}</div>
      </CardContent>
    </Card>
  );
}
