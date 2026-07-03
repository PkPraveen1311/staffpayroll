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
  const qc = useQueryClient();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: employeesData } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees").select("id, full_name, employee_code, department")
        .eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const employees = employeesData ?? [];

  const { data: rowsData } = useQuery({
    queryKey: ["allowed-week-offs", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_week_offs").select("*")
        .eq("year", year).eq("month", month);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!employeesData) return;
    const v: Record<string, string> = {};
    const map = new Map((rowsData ?? []).map((r: any) => [r.employee_id, r]));
    employeesData.forEach((e: any) => {
      const r: any = map.get(e.id);
      v[e.id] = String(r?.allowed ?? 4);
    });
    setValues((current) => (sameValues(current, v) ? current : v));
  }, [employeesData, rowsData, month, year]);

  const setAll = (n: number) => {
    const v: Record<string, string> = {};
    employees.forEach((e: any) => { v[e.id] = String(n); });
    setValues(v);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = employees.map((e: any) => ({
        employee_id: e.id,
        year, month,
        allowed: Math.max(0, Number(values[e.id] ?? 0)),
      }));
      const { error } = await supabase
        .from("allowed_week_offs")
        .upsert(payload, { onConflict: "employee_id,year,month" });
      if (error) throw error;
      toast.success("Saved allowed week-offs");
      qc.invalidateQueries({ queryKey: ["allowed-week-offs", year, month] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Allowed Week-Offs</h1>
        <p className="text-sm text-muted-foreground">
          Set the number of paid week-offs each employee is entitled to for the month.
          Payroll also credits approved leave days from the Leaves tab.
        </p>
      </div>

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
              <TableHead>Employee</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="text-right w-40">Allowed week-offs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Add employees first.</TableCell></TableRow>
            ) : employees.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="font-medium">{e.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{e.employee_code}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{e.department || "—"}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number" min={0} max={31}
                    value={values[e.id] ?? ""}
                    onChange={(ev) => setValues((p) => ({ ...p, [e.id]: ev.target.value }))}
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
