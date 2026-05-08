import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

const STATUSES = ["present", "absent", "half-day", "leave", "week-off"] as const;

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

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

  const recMap = new Map(records.map((r: any) => [r.employee_id, r]));

  const setStatus = async (employee_id: string, status: string) => {
    const existing: any = recMap.get(employee_id);
    const hours = status === "present" || status === "week-off" ? 8 : status === "half-day" ? 4 : 0;
    const { error } = existing
      ? await supabase.from("attendance").update({ status, hours }).eq("id", existing.id)
      : await supabase.from("attendance").insert({ employee_id, date, status, hours });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["attendance", date] });
  };

  const markAllPresent = async () => {
    const toInsert = employees
      .filter((e) => !recMap.has(e.id))
      .map((e) => ({ employee_id: e.id, date, status: "present", hours: 8 }));
    if (toInsert.length) {
      const { error } = await supabase.from("attendance").insert(toInsert);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Marked all as present");
    qc.invalidateQueries({ queryKey: ["attendance", date] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark daily attendance for your team.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={markAllPresent} className="bg-gradient-primary text-primary-foreground">
            Mark all present
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Add employees first.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => {
                const rec: any = recMap.get(e.id);
                const status = rec?.status ?? "—";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.employee_code}</div>
                    </TableCell>
                    <TableCell>{e.department || "—"}</TableCell>
                    <TableCell>
                      <Select value={rec?.status ?? ""} onValueChange={(v) => setStatus(e.id, v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Mark…" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          status === "present" ? "default" : status === "absent" ? "destructive" : "secondary"
                        }
                      >
                        {rec?.hours ?? 0}h
                      </Badge>
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
