import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { applySalaryRevisions, type SalaryRevision } from "@/lib/salary-revisions";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NUM_FIELDS: [keyof SalaryRevision, string][] = [
  ["basic_salary", "Basic salary (₹)"], ["hra", "HRA (₹)"], ["allowances", "Other Allowances (₹)"],
  ["medical_allowance", "Medical Allowance (₹)"], ["leave_encashment", "Leave Encashment (₹)"],
  ["statutory_bonus", "Statutory Bonus (₹)"], ["special_allowance", "Special Allowance (₹)"],
];

type Emp = { id: string; full_name: string; employee_code: string } & Record<string, any>;

export function SalaryRevisionDialog({ employee, open, onOpenChange, ctcOf }: {
  employee: Emp | null; open: boolean; onOpenChange: (o: boolean) => void; ctcOf: (e: any) => number;
}) {
  const qc = useQueryClient();
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [year, setYear] = useState(next.getFullYear());
  const [month, setMonth] = useState(next.getMonth() + 1);
  const [form, setForm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");

  const { data: revisions = [] } = useQuery({
    queryKey: ["salary_revisions", employee?.id],
    enabled: !!employee && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("salary_revisions").select("*")
        .eq("employee_id", employee!.id).order("effective_year").order("effective_month");
      if (error) throw error;
      return data as SalaryRevision[];
    },
  });

  // Prefill with the structure effective for the chosen month
  useEffect(() => {
    if (!employee || !open) return;
    applySalaryRevisions([employee], year, month).then(([e]) => {
      setForm({
        basic_salary: e.basic_salary, hra: e.hra, allowances: e.allowances,
        medical_allowance: e.medical_allowance, leave_encashment: e.leave_encashment,
        statutory_bonus: e.statutory_bonus, special_allowance: e.special_allowance,
        pf_enabled: e.pf_enabled, esi_enabled: e.esi_enabled, tds_enabled: e.tds_enabled,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, open, year, month, revisions.length]);

  const save = async () => {
    if (!employee) return;
    const payload: any = { employee_id: employee.id, effective_year: year, effective_month: month, notes: notes || null };
    for (const [f] of NUM_FIELDS) payload[f] = Number(form[f]) || 0;
    payload.pf_enabled = !!form.pf_enabled; payload.esi_enabled = !!form.esi_enabled; payload.tds_enabled = !!form.tds_enabled;
    const { error } = await supabase.from("salary_revisions")
      .upsert(payload, { onConflict: "employee_id,effective_year,effective_month" });
    if (error) { toast.error(error.message); return; }
    toast.success(`New salary for ${employee.full_name} effective ${MONTHS[month - 1]} ${year}`);
    setNotes("");
    qc.invalidateQueries({ queryKey: ["salary_revisions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this salary revision?")) return;
    const { error } = await supabase.from("salary_revisions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["salary_revisions"] });
  };

  const gross = NUM_FIELDS.reduce((s, [f]) => s + (Number(form[f]) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restructure salary — {employee?.full_name}</DialogTitle>
          <DialogDescription>
            Set a revised salary, or start/stop PF, ESI or TDS, from a chosen month. Payroll for that month and later uses the new structure; earlier months keep the old one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Effective from month</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1} className="bg-background">{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          {NUM_FIELDS.map(([f, label]) => (
            <div key={f} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input type="number" value={form[f] ?? 0} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={notes} placeholder="e.g. Annual increment" onChange={(e) => setNotes(e.target.value)} />
          </div>
          {(["pf_enabled", "esi_enabled", "tds_enabled"] as const).map((f) => (
            <div key={f} className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <Label>{f === "pf_enabled" ? "PF" : f === "esi_enabled" ? "ESI" : "TDS"} enabled</Label>
              <Switch checked={!!form[f]} onCheckedChange={(v) => setForm({ ...form, [f]: v })} />
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border/60 p-3 text-sm flex gap-6">
          <span>Gross/month: <b>{fmtINR(gross)}</b></span>
          <span>CTC/month: <b>{fmtINR(ctcOf({ ...form, basic_salary: Number(form.basic_salary) || 0, ...Object.fromEntries(NUM_FIELDS.map(([f]) => [f, Number(form[f]) || 0])) }))}</b></span>
        </div>

        {revisions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Revision history</div>
            <div className="rounded-md border border-border/60 divide-y divide-border/60 text-sm">
              {revisions.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <b>{MONTHS[r.effective_month - 1]} {r.effective_year}</b> — Basic {fmtINR(Number(r.basic_salary))}, CTC {fmtINR(ctcOf(r))}
                    {" · "}PF {r.pf_enabled ? "Yes" : "No"} · ESI {r.esi_enabled ? "Yes" : "No"}
                    {r.notes && <span className="text-muted-foreground"> · {r.notes}</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground">Save revision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
