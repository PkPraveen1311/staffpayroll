import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar, Check, X, Clock, Plane, CalendarDays, Search, Eraser } from "lucide-react";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

type StatusKey = "present" | "absent" | "half-day" | "leave" | "week-off";

const STATUS_META: Record<StatusKey, { label: string; short: string; hours: number; icon: any; cls: string; badge: "default" | "destructive" | "secondary" | "outline" }> = {
  present:    { label: "Present",  short: "P", hours: 8, icon: Check,        cls: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30", badge: "default" },
  absent:     { label: "Absent",   short: "A", hours: 0, icon: X,            cls: "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border-rose-500/30",           badge: "destructive" },
  "half-day": { label: "Half-day", short: "H", hours: 4, icon: Clock,        cls: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/30",       badge: "secondary" },
  leave:      { label: "Leave",    short: "L", hours: 0, icon: Plane,        cls: "bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border-sky-500/30",               badge: "secondary" },
  "week-off": { label: "Week-off", short: "W", hours: 8, icon: CalendarDays, cls: "bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border-violet-500/30",   badge: "secondary" },
};

const STATUS_ORDER: StatusKey[] = ["present", "absent", "half-day", "leave", "week-off"];

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, department")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("date", date);
      if (error) throw error;
      return data;
    },
  });

  const recMap = useMemo(() => new Map(records.map((r: any) => [r.employee_id, r])), [records]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    employees.forEach((e: any) => e.department && s.add(e.department));
    return Array.from(s).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e: any) => {
      if (dept !== "all" && (e.department || "") !== dept) return false;
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        (e.employee_code || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
      );
    });
  }, [employees, search, dept]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, "half-day": 0, leave: 0, "week-off": 0, unmarked: 0 };
    employees.forEach((e: any) => {
      const r: any = recMap.get(e.id);
      if (!r) c.unmarked++;
      else if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [employees, recMap]);

  const setStatus = async (employee_id: string, status: StatusKey) => {
    const existing: any = recMap.get(employee_id);
    const hours = STATUS_META[status].hours;
    if (existing && existing.status === status) {
      // toggle off: delete
      const { error } = await supabase.from("attendance").delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = existing
        ? await supabase.from("attendance").update({ status, hours }).eq("id", existing.id)
        : await supabase.from("attendance").insert({ employee_id, date, status, hours });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["attendance", date] });
  };

  const bulkMark = async (status: StatusKey, onlyUnmarked = false) => {
    const targets = filtered.filter((e: any) => (onlyUnmarked ? !recMap.has(e.id) : true));
    if (!targets.length) return toast.info("Nothing to update");
    const hours = STATUS_META[status].hours;
    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    targets.forEach((e: any) => {
      const ex: any = recMap.get(e.id);
      if (ex) toUpdate.push(ex.id);
      else toInsert.push({ employee_id: e.id, date, status, hours });
    });
    if (toInsert.length) {
      const { error } = await supabase.from("attendance").insert(toInsert);
      if (error) return toast.error(error.message);
    }
    if (!onlyUnmarked && toUpdate.length) {
      const { error } = await supabase.from("attendance").update({ status, hours }).in("id", toUpdate);
      if (error) return toast.error(error.message);
    }
    toast.success(`Marked ${targets.length} as ${STATUS_META[status].label}`);
    qc.invalidateQueries({ queryKey: ["attendance", date] });
  };

  const clearDay = async () => {
    const ids = records.filter((r: any) => filtered.some((e: any) => e.id === r.employee_id)).map((r: any) => r.id);
    if (!ids.length) return toast.info("Nothing to clear");
    const { error } = await supabase.from("attendance").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Cleared attendance");
    qc.invalidateQueries({ queryKey: ["attendance", date] });
  };

  const today = new Date().toISOString().slice(0, 10);
  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Tap a status to mark — tap again to clear.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="Previous day">‹</Button>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="Next day">›</Button>
          <Button variant="outline" onClick={() => setDate(today)}><Calendar className="h-4 w-4 mr-1" /> Today</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          return (
            <Card key={s} className={cn("border bg-gradient-card shadow-elegant", m.cls.replace(/hover:[^\s]+/g, ""))}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-80">{m.label}</div>
                  <div className="text-2xl font-bold leading-none mt-1">{counts[s]}</div>
                </div>
                <Icon className="h-5 w-5 opacity-80" />
              </CardContent>
            </Card>
          );
        })}
        <Card className="border bg-gradient-card shadow-elegant border-border/60">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Unmarked</div>
              <div className="text-2xl font-bold leading-none mt-1">{counts.unmarked}</div>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Filters + bulk actions */}
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            {departments.length > 0 && (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkMark("present", true)}>
              <Check className="h-4 w-4 mr-1" /> Fill unmarked: Present
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkMark("present")}>All Present</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMark("week-off")}>All Week-off</Button>
            <Button size="sm" variant="ghost" onClick={clearDay}>
              <Eraser className="h-4 w-4 mr-1" /> Clear day
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead>Mark</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {employees.length === 0 ? "Add employees first." : "No employees match your filter."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e: any) => {
                const rec: any = recMap.get(e.id);
                const cur = rec?.status as StatusKey | undefined;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.employee_code}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{e.department || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {STATUS_ORDER.map((s) => {
                          const m = STATUS_META[s];
                          const active = cur === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setStatus(e.id, s)}
                              title={m.label}
                              className={cn(
                                "h-8 w-8 rounded-md border text-xs font-bold transition-all",
                                active
                                  ? m.cls + " ring-2 ring-offset-0 ring-current scale-105"
                                  : "border-border/60 text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {m.short}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {cur ? (
                        <Badge variant={STATUS_META[cur].badge}>{rec?.hours ?? 0}h</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
