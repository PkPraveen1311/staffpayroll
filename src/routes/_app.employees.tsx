import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

type Employee = {
  id: string; employee_code: string; full_name: string; email: string; phone?: string | null;
  department?: string | null; designation?: string | null; joining_date: string;
  basic_salary: number; hra: number; allowances: number;
  medical_allowance: number; leave_encashment: number; statutory_bonus: number; special_allowance: number;
  pf_enabled: boolean; esi_enabled: boolean; status: string; bank_account?: string | null; pan?: string | null;
};

const empty: Partial<Employee> = {
  employee_code: "", full_name: "", email: "", phone: "", department: "", designation: "",
  joining_date: new Date().toISOString().slice(0,10),
  basic_salary: 0, hra: 0, allowances: 0,
  medical_allowance: 0, leave_encashment: 0, statutory_bonus: 0, special_allowance: 0,
  pf_enabled: true, esi_enabled: false, status: "active",
};

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const [q, setQ] = useState("");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Employee[];
    },
  });

  const filtered = employees.filter(e =>
    !q || e.full_name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()) || e.employee_code.toLowerCase().includes(q.toLowerCase())
  );

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing,
      basic_salary: Number(editing.basic_salary) || 0,
      hra: Number(editing.hra) || 0,
      allowances: Number(editing.allowances) || 0,
    };
    const { error } = editing.id
      ? await supabase.from("employees").update(payload).eq("id", editing.id)
      : await supabase.from("employees").insert(payload as any);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Employee updated" : "Employee added");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["employees"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this employee?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["employees"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your workforce, salary structure and bank details.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(empty)} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4 mr-1" /> Add employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} employee</DialogTitle></DialogHeader>
            {editing && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee code" value={editing.employee_code} onChange={(v) => setEditing({ ...editing, employee_code: v })} />
                <Field label="Full name" value={editing.full_name} onChange={(v) => setEditing({ ...editing, full_name: v })} />
                <Field label="Email" type="email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
                <Field label="Phone" value={editing.phone ?? ""} onChange={(v) => setEditing({ ...editing, phone: v })} />
                <Field label="Department" value={editing.department ?? ""} onChange={(v) => setEditing({ ...editing, department: v })} />
                <Field label="Designation" value={editing.designation ?? ""} onChange={(v) => setEditing({ ...editing, designation: v })} />
                <Field label="Joining date" type="date" value={editing.joining_date as any} onChange={(v) => setEditing({ ...editing, joining_date: v })} />
                <Field label="PAN" value={editing.pan ?? ""} onChange={(v) => setEditing({ ...editing, pan: v })} />
                <Field label="Bank account" value={editing.bank_account ?? ""} onChange={(v) => setEditing({ ...editing, bank_account: v })} />
                <Field label="Basic salary (₹)" type="number" value={String(editing.basic_salary ?? 0)} onChange={(v) => setEditing({ ...editing, basic_salary: Number(v) })} />
                <Field label="HRA (₹)" type="number" value={String(editing.hra ?? 0)} onChange={(v) => setEditing({ ...editing, hra: Number(v) })} />
                <Field label="Allowances (₹)" type="number" value={String(editing.allowances ?? 0)} onChange={(v) => setEditing({ ...editing, allowances: Number(v) })} />
                <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <Label>PF enabled</Label>
                  <Switch checked={!!editing.pf_enabled} onCheckedChange={(v) => setEditing({ ...editing, pf_enabled: v })} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <Label>ESI enabled</Label>
                  <Switch checked={!!editing.esi_enabled} onCheckedChange={(v) => setEditing({ ...editing, esi_enabled: v })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
              <Button onClick={save} className="bg-gradient-primary text-primary-foreground">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <div className="p-4 flex items-center gap-2 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or code…" className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead className="text-right">CTC / month</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No employees yet. Click “Add employee” to get started.</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                <TableCell>
                  <div className="font-medium">{e.full_name}</div>
                  <div className="text-xs text-muted-foreground">{e.email}</div>
                </TableCell>
                <TableCell>{e.department || "—"}</TableCell>
                <TableCell>{e.designation || "—"}</TableCell>
                <TableCell className="text-right font-medium">{fmtINR(Number(e.basic_salary) + Number(e.hra) + Number(e.allowances))}</TableCell>
                <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
