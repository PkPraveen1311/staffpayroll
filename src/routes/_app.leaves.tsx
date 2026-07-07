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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leaves")({ component: LeavesPage });

const TYPES = ["casual", "sick", "earned", "unpaid"];
const STATUSES = ["pending", "approved", "rejected"];
const emptyForm = { employee_id: "", leave_type: "casual", start_date: "", end_date: "", reason: "", status: "pending" };

function LeavesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name, employee_code").eq("status", "active").order("full_name")).data ?? [],
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await supabase.from("leaves").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false })).data ?? [],
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      employee_id: l.employee_id,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason ?? "",
      status: l.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) { toast.error("Fill all fields"); return; }
    if (editingId) {
      const { error } = await supabase.from("leaves").update(form).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Leave updated");
    } else {
      const { error } = await supabase.from("leaves").insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success("Leave request added");
    }
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leaves").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("leaves").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave deleted");
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leaves</h1>
          <p className="text-sm text-muted-foreground">Track, approve, and edit time off anytime.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit leave" : "New leave request"}</DialogTitle></DialogHeader>
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
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit} className="bg-gradient-primary text-primary-foreground">{editingId ? "Save changes" : "Submit"}</Button></DialogFooter>
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
                  <Select value={l.status} onValueChange={(v) => setStatus(l.id, v)}>
                    <SelectTrigger className="h-8 w-32">
                      <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{l.status}</Badge>
                    </SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {l.status === "pending" ? (
                      <>
                        <Button size="icon" variant="ghost" title="Approve" onClick={() => setStatus(l.id, "approved")}><Check className="h-4 w-4 text-primary" /></Button>
                        <Button size="icon" variant="ghost" title="Reject" onClick={() => setStatus(l.id, "rejected")}><X className="h-4 w-4 text-destructive" /></Button>
                      </>
                    ) : (
                      <Button size="icon" variant="ghost" title="Revert to pending" onClick={() => setStatus(l.id, "pending")}><RotateCcw className="h-4 w-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete leave request?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(l.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
