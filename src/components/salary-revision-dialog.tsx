import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { resolveSalaryRevisions, revisionMonth, type SalaryRevision } from "@/lib/salary-revisions";

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
  const [effectiveDate, setEffectiveDate] = useState(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  const period = revisionMonth(effectiveDate);
  const year = period?.year ?? next.getFullYear();
  const month = period?.month ?? next.getMonth() + 1;
  const [form, setForm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: revisions = [] } = useQuery({
    queryKey: ["salary_revisions", employee?.id],
    enabled: !!employee && open,
    queryFn: async () => {
      if (!employee) return [];
      const { data, error } = await supabase.from("salary_revisions").select("*")
        .eq("employee_id", employee.id).order("effective_year").order("effective_month");
      if (error) throw error;
      return data as SalaryRevision[];
    },
  });

  // Prefill with the structure effective for the chosen month
  useEffect(() => {
    if (!employee || !open) return;
    const [e] = resolveSalaryRevisions([employee], revisions, year, month);
    if (e) {
      setForm({
        basic_salary: e.basic_salary, hra: e.hra, allowances: e.allowances,
        medical_allowance: e.medical_allowance, leave_encashment: e.leave_encashment,
        statutory_bonus: e.statutory_bonus, special_allowance: e.special_allowance,
        pf_enabled: e.pf_enabled, esi_enabled: e.esi_enabled, tds_enabled: e.tds_enabled,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, open, year, month, revisions]);

  useEffect(() => { if (open) setNotes(""); }, [open, employee?.id]);

  const save = async () => {
    if (!employee) return;
    if (!period) { toast.error("Enter a valid effective date"); return; }
    setSaving(true);
    const payload: any = { employee_id: employee.id, effective_year: year, effective_month: month, effective_date: effectiveDate, notes: notes || null };
    for (const [f] of NUM_FIELDS) payload[f] = Number(form[f]) || 0;
    payload.pf_enabled = !!form.pf_enabled; payload.esi_enabled = !!form.esi_enabled; payload.tds_enabled = !!form.tds_enabled;
    const { error } = await supabase.from("salary_revisions")
      .upsert(payload, { onConflict: "employee_id,effective_year,effective_month" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Salary revision saved from ${effectiveDate} for all of ${MONTHS[month - 1]} ${year}`);
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
            Effective date is recorded exactly. Revised salary and PF, ESI or TDS settings apply to the whole effective month onward; earlier months stay unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="revision-date" className="text-xs">Effective date</Label>
            <Input id="revision-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
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
                    <b>{r.effective_date ?? `${r.effective_year}-${String(r.effective_month).padStart(2, "0")}-01`}</b> — Basic {fmtINR(Number(r.basic_salary))}, CTC {fmtINR(ctcOf(r))}
                    {" · "}PF {r.pf_enabled ? "Yes" : "No"} · ESI {r.esi_enabled ? "Yes" : "No"}
                    {r.notes && <span className="text-muted-foreground"> · {r.notes}</span>}
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" title="Edit salary revision" aria-label={`Edit salary revision ${r.effective_date}`} onClick={() => { setEffectiveDate(r.effective_date ?? `${r.effective_year}-${String(r.effective_month).padStart(2, "0")}-01`); setForm({ ...r }); setNotes(r.notes ?? ""); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Delete salary revision" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={save} disabled={saving || !period} className="bg-gradient-primary text-primary-foreground">{saving ? "Saving…" : "Save revision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
