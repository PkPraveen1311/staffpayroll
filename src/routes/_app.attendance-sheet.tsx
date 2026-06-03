import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/attendance-sheet")({
  component: AttendanceSheetPage,
});

type StatusKey = "present" | "absent" | "half-day" | "leave" | "week-off";

const STATUS_SHORT: Record<StatusKey, string> = {
  present: "P",
  absent: "A",
  "half-day": "H",
  leave: "L",
  "week-off": "W",
};

const STATUS_COLOR: Record<StatusKey, string> = {
  present: "text-emerald-600 print:text-black",
  absent: "text-rose-600 print:text-black",
  "half-day": "text-amber-600 print:text-black",
  leave: "text-sky-600 print:text-black",
  "week-off": "text-violet-600 print:text-black",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function AttendanceSheetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active-sheet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, full_name, department")
        .eq("status", "active")
        .order("employee_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-sheet", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("employee_id, date, status")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data ?? [];
    },
  });

  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, StatusKey>>();
    for (const r of attendance) {
      let inner = m.get(r.employee_id);
      if (!inner) {
        inner = new Map();
        m.set(r.employee_id, inner);
      }
      inner.set(r.date, r.status as StatusKey);
    }
    return m;
  }, [attendance]);

  const rows = useMemo(() => {
    return employees.map((e) => {
      const inner = matrix.get(e.id);
      const counts = { P: 0, A: 0, H: 0, L: 0, W: 0 };
      let net = 0;
      for (const d of days) {
        const ds = `${year}-${pad(month)}-${pad(d)}`;
        const s = inner?.get(ds);
        if (!s) continue;
        if (s === "present") { counts.P++; net += 1; }
        else if (s === "absent") counts.A++;
        else if (s === "half-day") { counts.H++; net += 0.5; }
        else if (s === "leave") { counts.L++; net += 1; }
        else if (s === "week-off") { counts.W++; net += 1; }
      }
      return { emp: e, counts, net };
    });
  }, [employees, matrix, days, month, year]);

  const isSunday = (d: number) => new Date(year, month - 1, d).getDay() === 0;

  return (
    <div className="p-6 print:p-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { color: black !important; }
          .print-area table { border-color: #000 !important; }
          .print-area th, .print-area td { border-color: #000 !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Monthly Attendance Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Printable matrix view — all employees on one page.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Month</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Year</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="print-area">
        <div className="hidden print:block text-center mb-2">
          <div className="text-base font-bold">Monthly Attendance Sheet</div>
          <div className="text-xs">{MONTHS[month - 1]} {year}</div>
        </div>

        <div className="rounded-lg border border-border overflow-x-auto print:border-0 print:overflow-visible">
          <table className="w-full text-[10px] print:text-[8px] border-collapse">
            <thead>
              <tr className="bg-muted/40 print:bg-white">
                <th className="border border-border px-1 py-1 text-left sticky left-0 bg-muted/40 print:bg-white">#</th>
                <th className="border border-border px-2 py-1 text-left sticky left-6 bg-muted/40 print:bg-white min-w-[140px]">Employee</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`border border-border px-0.5 py-1 text-center w-6 ${isSunday(d) ? "bg-rose-500/10 print:bg-gray-200" : ""}`}
                  >
                    {d}
                  </th>
                ))}
                <th className="border border-border px-1 py-1 text-center w-7">P</th>
                <th className="border border-border px-1 py-1 text-center w-7">A</th>
                <th className="border border-border px-1 py-1 text-center w-7">H</th>
                <th className="border border-border px-1 py-1 text-center w-7">L</th>
                <th className="border border-border px-1 py-1 text-center w-7">W</th>
                <th className="border border-border px-1 py-1 text-center w-10 font-bold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ emp, counts, net }, idx) => {
                const inner = matrix.get(emp.id);
                return (
                  <tr key={emp.id} className="hover:bg-muted/30 print:hover:bg-transparent">
                    <td className="border border-border px-1 py-0.5 text-center sticky left-0 bg-background print:bg-white">{idx + 1}</td>
                    <td className="border border-border px-2 py-0.5 sticky left-6 bg-background print:bg-white">
                      <div className="font-medium leading-tight">{emp.full_name}</div>
                      <div className="text-[8px] text-muted-foreground print:text-gray-600">{emp.employee_code}</div>
                    </td>
                    {days.map((d) => {
                      const ds = `${year}-${pad(month)}-${pad(d)}`;
                      const s = inner?.get(ds);
                      return (
                        <td
                          key={d}
                          className={`border border-border px-0.5 py-0.5 text-center font-semibold ${isSunday(d) ? "bg-rose-500/5 print:bg-gray-100" : ""} ${s ? STATUS_COLOR[s] : "text-muted-foreground print:text-gray-400"}`}
                        >
                          {s ? STATUS_SHORT[s] : "-"}
                        </td>
                      );
                    })}
                    <td className="border border-border px-1 py-0.5 text-center text-emerald-600 print:text-black font-semibold">{counts.P}</td>
                    <td className="border border-border px-1 py-0.5 text-center text-rose-600 print:text-black font-semibold">{counts.A}</td>
                    <td className="border border-border px-1 py-0.5 text-center text-amber-600 print:text-black font-semibold">{counts.H}</td>
                    <td className="border border-border px-1 py-0.5 text-center text-sky-600 print:text-black font-semibold">{counts.L}</td>
                    <td className="border border-border px-1 py-0.5 text-center text-violet-600 print:text-black font-semibold">{counts.W}</td>
                    <td className="border border-border px-1 py-0.5 text-center font-bold">{net}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={days.length + 8} className="text-center py-8 text-muted-foreground">
                    No active employees.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground print:text-black">
          <span><b className="text-emerald-600 print:text-black">P</b> Present</span>
          <span><b className="text-rose-600 print:text-black">A</b> Absent</span>
          <span><b className="text-amber-600 print:text-black">H</b> Half-day</span>
          <span><b className="text-sky-600 print:text-black">L</b> Leave</span>
          <span><b className="text-violet-600 print:text-black">W</b> Week-off</span>
          <span>- No record</span>
        </div>
      </div>
    </div>
  );
}
