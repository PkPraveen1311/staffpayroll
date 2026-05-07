import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, CalendarCheck, Plane } from "lucide-react";
import { fmtINR, monthName } from "@/lib/format";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [emp, att, lv, runs, slips] = await Promise.all([
        supabase.from("employees").select("id, basic_salary, hra, allowances", { count: "exact" }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", new Date().toISOString().slice(0,10)).eq("status", "present"),
        supabase.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("payroll_runs").select("id, month, year, total_net").order("year", { ascending: false }).order("month", { ascending: false }).limit(6),
        supabase.from("payslips").select("net_pay"),
      ]);
      const totalEmployees = emp.count ?? 0;
      const monthlyCost = (emp.data ?? []).reduce((s, e) => s + Number(e.basic_salary) + Number(e.hra) + Number(e.allowances), 0);
      const totalPaid = (slips.data ?? []).reduce((s, p) => s + Number(p.net_pay), 0);
      return {
        totalEmployees,
        presentToday: att.count ?? 0,
        pendingLeaves: lv.count ?? 0,
        monthlyCost,
        totalPaid,
        runs: (runs.data ?? []).reverse(),
      };
    },
  });

  const cards = [
    { label: "Employees", value: stats?.totalEmployees ?? 0, icon: Users, color: "from-teal-400 to-cyan-500" },
    { label: "Present today", value: stats?.presentToday ?? 0, icon: CalendarCheck, color: "from-emerald-400 to-teal-500" },
    { label: "Pending leaves", value: stats?.pendingLeaves ?? 0, icon: Plane, color: "from-violet-400 to-fuchsia-500" },
    { label: "Monthly cost", value: fmtINR(stats?.monthlyCost ?? 0), icon: Wallet, color: "from-amber-400 to-orange-500" },
  ];

  const chartData = (stats?.runs ?? []).map(r => ({
    name: `${monthName(r.month).slice(0,3)} ${String(r.year).slice(2)}`,
    Net: Number(r.total_net),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your workforce & payroll.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="bg-gradient-card border-border/60 shadow-elegant overflow-hidden relative">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="mt-2 text-2xl font-bold font-display">{c.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl grid place-items-center bg-gradient-to-br ${c.color} text-background shadow-glow`}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <CardTitle>Recent payroll runs</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">No payroll runs yet. Generate one from the Payroll page.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="oklch(0.7 0.02 260)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.02 260)" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.02 265)", border: "1px solid oklch(0.32 0.02 265)", borderRadius: 8 }} formatter={(v: number) => fmtINR(v)} />
                <Bar dataKey="Net" fill="oklch(0.78 0.16 175)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
