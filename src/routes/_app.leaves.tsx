import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leaves")({ component: LeavesPage });

const TYPES = ["casual", "sick", "earned", "unpaid"];

function LeavesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", reason: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name, employee_code").eq("status", "active").order("full_name")).data ?? [],
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await supabase.from("leaves").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) { toast.error("Fill all fields"); return; }
    const { error } = await supabase.from("leaves").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave request added");
    setOpen(false);
    setForm({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", reason: "" });
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leaves").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leaves</h1>
          <p className="text-sm text-muted-foreground">Track and approve time off.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New leave request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit} className="bg-gradient-primary text-primary-foreground">Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead>
              <TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leave requests yet.</TableCell></TableRow>
            ) : leaves.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell><div className="font-medium">{l.employees?.full_name}</div><div className="text-xs text-muted-foreground font-mono">{l.employees?.employee_code}</div></TableCell>
                <TableCell className="capitalize">{l.leave_type}</TableCell>
                <TableCell className="text-sm">{l.start_date} → {l.end_date}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{l.reason || "—"}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {l.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => setStatus(l.id, "approved")}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setStatus(l.id, "rejected")}><X className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
