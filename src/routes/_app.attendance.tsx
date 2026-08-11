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
import { Calendar, Check, X, Clock, Plane, CalendarDays, Search, Eraser, ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

type StatusKey = "present" | "absent" | "half-day" | "leave" | "week-off" | "tour";

const STATUS_META: Record<StatusKey, { label: string; short: string; hours: number; icon: any; cls: string; badge: "default" | "destructive" | "secondary" | "outline" }> = {
  present:    { label: "Present",  short: "P", hours: 8, icon: Check,        cls: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30", badge: "default" },
  absent:     { label: "Absent",   short: "A", hours: 0, icon: X,            cls: "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border-rose-500/30",           badge: "destructive" },
  "half-day": { label: "Half-day", short: "H", hours: 4, icon: Clock,        cls: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/30",       badge: "secondary" },
  leave:      { label: "Leave",    short: "L", hours: 0, icon: Plane,        cls: "bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border-sky-500/30",               badge: "secondary" },
  "week-off": { label: "Week-off", short: "W", hours: 8, icon: CalendarDays, cls: "bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border-violet-500/30",   badge: "secondary" },
  tour:       { label: "Tour",     short: "T", hours: 8, icon: Briefcase,    cls: "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border-cyan-500/30",           badge: "default" },
};

const STATUS_ORDER: StatusKey[] = ["present", "absent", "half-day", "leave", "week-off", "tour"];

type RosterConfig = {
  kind: "employee" | "agent";
  table: "attendance" | "agent_attendance";
  fk: "employee_id" | "agent_id";
  peopleTable: "employees" | "commission_agents";
  codeField: "employee_code" | "agent_code";
  peopleKey: string;
  recordsKey: string;
  label: string;
  labelPlural: string;
  emptyMsg: string;
};

const EMPLOYEE_CFG: RosterConfig = {
  kind: "employee", table: "attendance", fk: "employee_id", peopleTable: "employees",
  codeField: "employee_code", peopleKey: "employees-min", recordsKey: "attendance",
  label: "Employee", labelPlural: "Employees", emptyMsg: "Add employees first.",
};

const AGENT_CFG: RosterConfig = {
  kind: "agent", table: "agent_attendance", fk: "agent_id", peopleTable: "commission_agents",
  codeField: "agent_code", peopleKey: "agents-min", recordsKey: "agent-attendance",
  label: "Agent", labelPlural: "Commission Agents", emptyMsg: "Add commission agents first.",
};

function usePeople(cfg: RosterConfig) {
  return useQuery({
    queryKey: [cfg.peopleKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.peopleTable)
        .select(`id, full_name, ${cfg.codeField}, department`)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark daily attendance or review a full month — for employees and commission agents.</p>
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="agents">Commission Agents</TabsTrigger>
        </TabsList>
        <TabsContent value="employees">
          <AttendanceSection cfg={EMPLOYEE_CFG} />
        </TabsContent>
        <TabsContent value="agents">
          <AttendanceSection cfg={AGENT_CFG} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttendanceSection({ cfg }: { cfg: RosterConfig }) {
  const { data: people = [] } = usePeople(cfg);
  return (
    <Tabs defaultValue="daily" className="space-y-6">
      <TabsList>
        <TabsTrigger value="daily">Daily</TabsTrigger>
        <TabsTrigger value="monthly">Monthly (per {cfg.label.toLowerCase()})</TabsTrigger>
      </TabsList>
      <TabsContent value="daily" className="space-y-6">
        <DailyRoster cfg={cfg} people={people} />
      </TabsContent>
      <TabsContent value="monthly">
        <MonthlyView cfg={cfg} people={people} />
      </TabsContent>
    </Tabs>
  );
}

function DailyRoster({ cfg, people }: { cfg: RosterConfig; people: any[] }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");

  const { data: records = [] } = useQuery({
    queryKey: [cfg.recordsKey, date],
    queryFn: async () => {
      const { data, error } = await supabase.from(cfg.table).select("*").eq("date", date);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const recMap = useMemo(() => new Map(records.map((r: any) => [r[cfg.fk], r])), [records, cfg.fk]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    people.forEach((e: any) => e.department && s.add(e.department));
    return Array.from(s).sort();
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((e: any) => {
      if (dept !== "all" && (e.department || "") !== dept) return false;
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        (e[cfg.codeField] || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
      );
    });
  }, [people, search, dept, cfg.codeField]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, "half-day": 0, leave: 0, "week-off": 0, tour: 0, unmarked: 0 };
    people.forEach((e: any) => {
      const r: any = recMap.get(e.id);
      if (!r) c.unmarked++;
      else if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [people, recMap]);

  const setStatus = async (personId: string, status: StatusKey) => {
    const existing: any = recMap.get(personId);
    const hours = STATUS_META[status].hours;
    if (existing && existing.status === status) {
      const { error } = await supabase.from(cfg.table).delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = existing
        ? await supabase.from(cfg.table).update({ status, hours }).eq("id", existing.id)
        : await supabase.from(cfg.table).insert({ [cfg.fk]: personId, date, status, hours } as any);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: [cfg.recordsKey, date] });
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
      else toInsert.push({ [cfg.fk]: e.id, date, status, hours });
    });
    if (toInsert.length) {
      const { error } = await supabase.from(cfg.table).insert(toInsert as any);
      if (error) return toast.error(error.message);
    }
    if (!onlyUnmarked && toUpdate.length) {
      const { error } = await supabase.from(cfg.table).update({ status, hours }).in("id", toUpdate);
      if (error) return toast.error(error.message);
    }
    toast.success(`Marked ${targets.length} as ${STATUS_META[status].label}`);
    qc.invalidateQueries({ queryKey: [cfg.recordsKey, date] });
  };

  const clearDay = async () => {
    const ids = records.filter((r: any) => filtered.some((e: any) => e.id === r[cfg.fk])).map((r: any) => r.id);
    if (!ids.length) return toast.info("Nothing to clear");
    const { error } = await supabase.from(cfg.table).delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Cleared attendance");
    qc.invalidateQueries({ queryKey: [cfg.recordsKey, date] });
  };

  const today = new Date().toISOString().slice(0, 10);
  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-2 flex-wrap justify-end">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="Previous day">‹</Button>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="Next day">›</Button>
        <Button variant="outline" onClick={() => setDate(today)}><Calendar className="h-4 w-4 mr-1" /> Today</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
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
              <TableHead>{cfg.label}</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead>Mark</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {people.length === 0 ? cfg.emptyMsg : "No records match your filter."}
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
                      <div className="text-xs text-muted-foreground font-mono">{e[cfg.codeField]}</div>
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

function MonthlyView({ cfg, people }: { cfg: RosterConfig; people: any[] }) {
  const qc = useQueryClient();
  const now = new Date();
  const [personId, setPersonId] = useState<string>("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const selected = personId || people[0]?.id || "";
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: monthRecs = [] } = useQuery({
    queryKey: [`${cfg.recordsKey}-month`, selected, year, month],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table)
        .select("*")
        .eq(cfg.fk as any, selected)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const byDate = useMemo(() => new Map(monthRecs.map((r: any) => [r.date, r])), [monthRecs]);

  const totals = useMemo(() => {
    const t: Record<string, number> = { present: 0, absent: 0, "half-day": 0, leave: 0, "week-off": 0, tour: 0, unmarked: 0, hours: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const r: any = byDate.get(key);
      if (!r) t.unmarked++;
      else {
        if (t[r.status] !== undefined) t[r.status]++;
        t.hours += Number(r.hours || 0);
      }
    }
    return t;
  }, [byDate, daysInMonth, year, month]);

  const setDay = async (day: number, status: StatusKey) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing: any = byDate.get(dateStr);
    const hours = STATUS_META[status].hours;
    if (existing && existing.status === status) {
      const { error } = await supabase.from(cfg.table).delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = existing
        ? await supabase.from(cfg.table).update({ status, hours }).eq("id", existing.id)
        : await supabase.from(cfg.table).insert({ [cfg.fk]: selected, date: dateStr, status, hours } as any);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: [`${cfg.recordsKey}-month`, selected, year, month] });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">{cfg.label}</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[14rem]"
                value={selected}
                onChange={(e) => setPersonId(e.target.value)}
              >
                {people.length === 0 && <option value="">No {cfg.labelPlural.toLowerCase()}</option>}
                {people.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e[cfg.codeField]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
              <div className="text-sm font-medium px-2 min-w-[10rem] text-center">{monthLabel}</div>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>This month</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          return (
            <Card key={s} className={cn("border bg-gradient-card shadow-elegant", m.cls.replace(/hover:[^\s]+/g, ""))}>
              <CardContent className="p-3">
                <div className="text-xs uppercase tracking-wide opacity-80">{m.label}</div>
                <div className="text-2xl font-bold leading-none mt-1">{totals[s]}</div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border bg-gradient-card shadow-elegant border-border/60">
          <CardContent className="p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Unmarked</div>
            <div className="text-2xl font-bold leading-none mt-1">{totals.unmarked}</div>
          </CardContent>
        </Card>
        <Card className="border bg-gradient-card shadow-elegant border-border/60">
          <CardContent className="p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total hours</div>
            <div className="text-2xl font-bold leading-none mt-1">{totals.hours}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardContent className="p-4">
          {!selected ? (
            <div className="text-center text-muted-foreground py-8">Select {cfg.kind === "agent" ? "an agent" : "an employee"} to view monthly attendance.</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-2 text-xs uppercase tracking-wide text-muted-foreground text-center">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const r: any = byDate.get(dateStr);
                  const cur = r?.status as StatusKey | undefined;
                  const meta = cur ? STATUS_META[cur] : null;
                  return (
                    <div key={day} className={cn("rounded-md border p-2 min-h-[84px] flex flex-col justify-between", meta ? meta.cls.replace(/hover:[^\s]+/g, "") : "border-border/60 bg-background/40")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono opacity-80">{day}</span>
                        {meta && <Badge variant={meta.badge} className="text-[10px] px-1 py-0">{meta.short}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {STATUS_ORDER.map((s) => {
                          const m = STATUS_META[s];
                          const active = cur === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setDay(day, s)}
                              title={m.label}
                              className={cn(
                                "h-5 w-5 rounded text-[10px] font-bold border transition-all",
                                active
                                  ? "bg-foreground/90 text-background border-foreground"
                                  : "border-border/60 text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {m.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
