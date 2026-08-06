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
import { Plus, Pencil, Trash2, Search, Printer, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { exportToXlsx } from "@/lib/xlsx-export";
import { ExcelImportDialog } from "@/components/excel-import-dialog";
import { pick, toBool, toDate, toNumber, type SheetRow } from "@/lib/excel-import";

const EMP_TEMPLATE_HEADERS = [
  "Code", "Name", "Email", "Phone", "Department", "Designation", "Joining Date", "Date of Birth",
  "Wedding Anniversary", "PAN", "Bank A/C", "IFSC", "UAN", "PF No.", "ESI No.",
  "Basic", "HRA", "Allowances", "Medical", "Leave Enc.", "Bonus", "Special", "PF", "ESI", "TDS", "Status",
];
const EMP_TEMPLATE_SAMPLE = [
  "EMP001", "Ramesh Kumar", "ramesh@example.com", "9876543210", "Sales", "Executive", "2024-04-01", "1995-06-15",
  "2020-02-14", "ABCDE1234F", "1234567890", "SBIN0001234", "100200300400", "PF/1234", "ESI/5678",
  15000, 6000, 2000, 1250, 0, 1400, 3000, "Yes", "Yes", "No", "active",
];

function mapEmployeeRow(row: SheetRow) {
  const code = pick(row, "Code", "Employee Code");
  const name = pick(row, "Name", "Full Name", "Employee");
  if (!code) throw new Error("Code is required");
  if (!name) throw new Error("Name is required");
  const email = pick(row, "Email");
  return {
    employee_code: code,
    full_name: name,
    email: email || `${code.toLowerCase()}@example.com`,
    phone: pick(row, "Phone", "Mobile") || null,
    department: pick(row, "Department") || null,
    designation: pick(row, "Designation") || null,
    joining_date: toDate(pick(row, "Joining Date", "DOJ")) ?? new Date().toISOString().slice(0, 10),
    date_of_birth: toDate(pick(row, "Date of Birth", "DOB")),
    wedding_anniversary: toDate(pick(row, "Wedding Anniversary", "Anniversary")),
    pan: pick(row, "PAN").toUpperCase() || null,
    bank_account: pick(row, "Bank A/C", "Bank Account", "Account No") || null,
    ifsc_code: pick(row, "IFSC", "IFSC Code").toUpperCase() || null,
    uan: pick(row, "UAN") || null,
    pf_number: pick(row, "PF No.", "PF Number") || null,
    esi_number: pick(row, "ESI No.", "ESI Number") || null,
    basic_salary: toNumber(pick(row, "Basic", "Basic Salary")),
    hra: toNumber(pick(row, "HRA")),
    allowances: toNumber(pick(row, "Allowances", "Other Allowances")),
    medical_allowance: toNumber(pick(row, "Medical", "Medical Allowance")),
    leave_encashment: toNumber(pick(row, "Leave Enc.", "Leave Encashment")),
    statutory_bonus: toNumber(pick(row, "Bonus", "Statutory Bonus")),
    special_allowance: toNumber(pick(row, "Special", "Special Allowance")),
    pf_enabled: toBool(pick(row, "PF"), true),
    esi_enabled: toBool(pick(row, "ESI"), false),
    tds_enabled: toBool(pick(row, "TDS"), false),
    status: (pick(row, "Status") || "active").toLowerCase(),
  };
}

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

type Employee = {
  id: string; employee_code: string; full_name: string; email: string; phone?: string | null;
  department?: string | null; designation?: string | null; joining_date: string;
  basic_salary: number; hra: number; allowances: number;
  medical_allowance: number; leave_encashment: number; statutory_bonus: number; special_allowance: number;
  pf_enabled: boolean; esi_enabled: boolean; tds_enabled: boolean; status: string;
  bank_account?: string | null; pan?: string | null; ifsc_code?: string | null;
  date_of_birth?: string | null; wedding_anniversary?: string | null;
  pf_number?: string | null; esi_number?: string | null; uan?: string | null;
};

const empty: Partial<Employee> = {
  employee_code: "", full_name: "", email: "", phone: "", department: "", designation: "",
  joining_date: new Date().toISOString().slice(0,10),
  basic_salary: 0, hra: 0, allowances: 0,
  medical_allowance: 0, leave_encashment: 0, statutory_bonus: 0, special_allowance: 0,
  pf_enabled: true, esi_enabled: false, tds_enabled: false, status: "active",
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
      medical_allowance: Number(editing.medical_allowance) || 0,
      leave_encashment: Number(editing.leave_encashment) || 0,
      statutory_bonus: Number(editing.statutory_bonus) || 0,
      special_allowance: Number(editing.special_allowance) || 0,
      date_of_birth: editing.date_of_birth || null,
      wedding_anniversary: editing.wedding_anniversary || null,
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

  const exportExcel = () => {
    const rows = filtered.map(e => ({
      Code: e.employee_code,
      Name: e.full_name,
      Email: e.email,
      Phone: e.phone ?? "",
      Department: e.department ?? "",
      Designation: e.designation ?? "",
      "Joining Date": e.joining_date,
      "Date of Birth": e.date_of_birth ?? "",
      "Wedding Anniversary": e.wedding_anniversary ?? "",
      PAN: e.pan ?? "",
      "Bank A/C": e.bank_account ?? "",
      IFSC: e.ifsc_code ?? "",
      UAN: e.uan ?? "",
      "PF No.": e.pf_number ?? "",
      "ESI No.": e.esi_number ?? "",
      Basic: Number(e.basic_salary),
      HRA: Number(e.hra),
      Allowances: Number(e.allowances),
      Medical: Number(e.medical_allowance),
      "Leave Enc.": Number(e.leave_encashment),
      Bonus: Number(e.statutory_bonus),
      Special: Number(e.special_allowance),
      "CTC/Month": Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) + Number(e.medical_allowance) + Number(e.leave_encashment) + Number(e.statutory_bonus) + Number(e.special_allowance),
      PF: e.pf_enabled ? "Yes" : "No",
      ESI: e.esi_enabled ? "Yes" : "No",
      TDS: e.tds_enabled ? "Yes" : "No",
      Status: e.status,
    }));
    exportToXlsx(`Employee_Master_${new Date().toISOString().slice(0,10)}.xlsx`, rows, "Employees");
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; color: #000 !important; }
          .print-area { position: absolute !important; left: 0; top: 0; width: 100%; background: white !important; }
          .print-area table { font-size: 9px; border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td { border: 1px solid #999 !important; padding: 3px 4px !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your workforce, salary structure and bank details.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <ExcelImportDialog
            title="Import employees from Excel"
            description="Upload a sheet of employee details. The first row must contain column headers — download the template for the exact format."
            templateName="Employee_Import_Template.xlsx"
            templateHeaders={EMP_TEMPLATE_HEADERS}
            templateSample={EMP_TEMPLATE_SAMPLE}
            mapRow={mapEmployeeRow}
            onImport={async (records) => {
              const existing = new Map(employees.map((e) => [e.employee_code.trim().toLowerCase(), e.id]));
              let created = 0, updated = 0;
              for (const r of records) {
                const id = existing.get(String(r.employee_code).trim().toLowerCase());
                if (id) {
                  const { error } = await supabase.from("employees").update(r as never).eq("id", id);
                  if (error) throw error;
                  updated++;
                } else {
                  const { error } = await supabase.from("employees").insert(r as any);
                  if (error) throw error;
                  created++;
                }
              }
              qc.invalidateQueries({ queryKey: ["employees"] });
              return { created, updated };
            }}
          />
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(empty)} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4 mr-1" /> Add employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  <Field label="Date of birth" type="date" value={editing.date_of_birth ?? ""} onChange={(v) => setEditing({ ...editing, date_of_birth: v })} />
                  <Field label="Wedding anniversary" type="date" value={editing.wedding_anniversary ?? ""} onChange={(v) => setEditing({ ...editing, wedding_anniversary: v })} />
                  <Field label="PAN" value={editing.pan ?? ""} onChange={(v) => setEditing({ ...editing, pan: v })} />
                  <Field label="Bank account" value={editing.bank_account ?? ""} onChange={(v) => setEditing({ ...editing, bank_account: v })} />
                  <Field label="Bank IFSC code" value={editing.ifsc_code ?? ""} onChange={(v) => setEditing({ ...editing, ifsc_code: v.toUpperCase() })} />
                  <Field label="UAN" value={editing.uan ?? ""} onChange={(v) => setEditing({ ...editing, uan: v })} />
                  <Field label="PF number" value={editing.pf_number ?? ""} onChange={(v) => setEditing({ ...editing, pf_number: v })} />
                  <Field label="ESI number" value={editing.esi_number ?? ""} onChange={(v) => setEditing({ ...editing, esi_number: v })} />
                  <Field label="Basic salary (₹)" type="number" value={String(editing.basic_salary ?? 0)} onChange={(v) => setEditing({ ...editing, basic_salary: Number(v) })} />
                  <Field label="HRA (₹)" type="number" value={String(editing.hra ?? 0)} onChange={(v) => setEditing({ ...editing, hra: Number(v) })} />
                  <Field label="Other Allowances (₹)" type="number" value={String(editing.allowances ?? 0)} onChange={(v) => setEditing({ ...editing, allowances: Number(v) })} />
                  <Field label="Medical Allowance (₹)" type="number" value={String(editing.medical_allowance ?? 0)} onChange={(v) => setEditing({ ...editing, medical_allowance: Number(v) })} />
                  <Field label="Leave Encashment (₹)" type="number" value={String(editing.leave_encashment ?? 0)} onChange={(v) => setEditing({ ...editing, leave_encashment: Number(v) })} />
                  <Field label="Statutory Bonus (₹)" type="number" value={String(editing.statutory_bonus ?? 0)} onChange={(v) => setEditing({ ...editing, statutory_bonus: Number(v) })} />
                  <Field label="Special Allowance (₹)" type="number" value={String(editing.special_allowance ?? 0)} onChange={(v) => setEditing({ ...editing, special_allowance: Number(v) })} />
                  <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                    <Label>PF enabled</Label>
                    <Switch checked={!!editing.pf_enabled} onCheckedChange={(v) => setEditing({ ...editing, pf_enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                    <Label>ESI enabled</Label>
                    <Switch checked={!!editing.esi_enabled} onCheckedChange={(v) => setEditing({ ...editing, esi_enabled: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                    <div>
                      <Label>TDS deduction</Label>
                      <p className="text-xs text-muted-foreground">Optional — enable to deduct income tax monthly.</p>
                    </div>
                    <Switch checked={!!editing.tds_enabled} onCheckedChange={(v) => setEditing({ ...editing, tds_enabled: v })} />
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
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <div className="p-4 flex items-center gap-2 border-b border-border/60 no-print">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or code…" className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
        <div className="print-area">
          <div className="hidden print:block p-3 text-center">
            <div className="text-lg font-bold">PayPulse — Employee Master</div>
            <div className="text-xs">Printed: {new Date().toLocaleDateString("en-IN")}</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>UAN</TableHead>
                <TableHead>PF No.</TableHead>
                <TableHead>ESI No.</TableHead>
                <TableHead className="text-right">CTC / month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No employees yet. Click "Add employee" to get started.</TableCell></TableRow>
              ) : filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{e.full_name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </TableCell>
                  <TableCell>{e.department || "—"}</TableCell>
                  <TableCell>{e.designation || "—"}</TableCell>
                  <TableCell className="text-xs">{e.date_of_birth || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.uan || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.pf_number || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.esi_number || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmtINR(Number(e.basic_salary) + Number(e.hra) + Number(e.allowances) + Number(e.medical_allowance ?? 0) + Number(e.leave_encashment ?? 0) + Number(e.statutory_bonus ?? 0) + Number(e.special_allowance ?? 0))}</TableCell>
                  <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right no-print">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
