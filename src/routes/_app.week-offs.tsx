import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { monthName } from "@/lib/format";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_app/week-offs")({ component: WeekOffsPage });

const now = new Date();
const monthsList = Array.from({ length: 12 }, (_, i) => i + 1);
const yearsList = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const sameValues = (a: Record<string, string>, b: Record<string, string>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
};

function WeekOffsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Allowed Week-Offs</h1>
        <p className="text-sm text-muted-foreground">
          Set the number of paid week-offs each person is entitled to for the month.
          Payroll also credits approved leave days from the Leaves tab.
        </p>
      </div>
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="agents">Commission Agents</TabsTrigger>
        </TabsList>
        <TabsContent value="employees">
          <WeekOffEditor kind="employee" />
        </TabsContent>
        <TabsContent value="agents">
          <WeekOffEditor kind="agent" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const CONFIG = {
  employee: {
    peopleTable: "employees" as const,
    codeField: "employee_code",
    woTable: "allowed_week_offs" as const,
    fk: "employee_id",
    conflict: "employee_id,year,month",
    label: "employees",
  },
  agent: {
    peopleTable: "commission_agents" as const,
    codeField: "agent_code",
    woTable: "agent_allowed_week_offs" as const,
    fk: "agent_id",
    conflict: "agent_id,year,month",
    label: "commission agents",
  },
};

function WeekOffEditor({ kind }: { kind: "employee" | "agent" }) {
  const cfg = CONFIG[kind];
  const qc = useQueryClient();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: peopleData } = useQuery({
    queryKey: [`${kind}-min-weekoffs`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.peopleTable)
        .select(`id, full_name, ${cfg.codeField}, department`)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });
  const people = peopleData ?? [];

  const { data: rowsData } = useQuery({
    queryKey: [`${cfg.woTable}`, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.woTable).select("*")
        .eq("year", year).eq("month", month);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (!peopleData) return;
    const v: Record<string, string> = {};
    const map = new Map((rowsData ?? []).map((r: any) => [r[cfg.fk], r]));
    peopleData.forEach((p: any) => {
      const r: any = map.get(p.id);
      v[p.id] = String(r?.allowed ?? 4);
    });
    setValues((current) => (sameValues(current, v) ? current : v));
  }, [peopleData, rowsData, month, year, cfg.fk]);

  const setAll = (n: number) => {
    const v: Record<string, string> = {};
    people.forEach((p: any) => { v[p.id] = String(n); });
    setValues(v);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = people.map((p: any) => ({
        [cfg.fk]: p.id,
        year, month,
        allowed: Math.max(0, Number(values[p.id] ?? 0)),
      }));
      const { error } = await supabase
        .from(cfg.woTable)
        .upsert(payload as any, { onConflict: cfg.conflict });
      if (error) throw error;
      toast.success("Saved allowed week-offs");
      qc.invalidateQueries({ queryKey: [`${cfg.woTable}`, year, month] });
      qc.invalidateQueries({ queryKey: ["agent-allowed-week-offs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>Select period</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsList.map(m => <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{yearsList.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setAll(4)}>Set all to 4</Button>
            <Button variant="outline" size="sm" onClick={() => setAll(5)}>Set all to 5</Button>
            <Button variant="outline" size="sm" onClick={() => setAll(0)}>Clear all</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{kind === "employee" ? "Employee" : "Agent"}</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="text-right w-40">Allowed week-offs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Add {cfg.label} first.</TableCell></TableRow>
            ) : people.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p[cfg.codeField]}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{p.department || "—"}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number" min={0} max={31}
                    value={values[p.id] ?? ""}
                    onChange={(ev) => setValues((prev) => ({ ...prev, [p.id]: ev.target.value }))}
                    className="w-24 ml-auto text-right"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
