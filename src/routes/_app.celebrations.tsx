import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake, Heart } from "lucide-react";

export const Route = createFileRoute("/_app/celebrations")({ component: CelebrationsPage });

const ageFromDOB = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

const matchToday = (d?: string | null) => {
  if (!d) return false;
  const x = new Date(d);
  const t = new Date();
  return x.getMonth() === t.getMonth() && x.getDate() === t.getDate();
};

const matchMonth = (d?: string | null) => {
  if (!d) return false;
  return new Date(d).getMonth() === new Date().getMonth();
};

const formatMD = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

function CelebrationsPage() {
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-celebrations"],
    queryFn: async () => (await supabase.from("employees").select("*").eq("status", "active")).data ?? [],
  });

  const todayBirthdays = employees.filter((e: any) => matchToday(e.date_of_birth));
  const todayAnniversaries = employees.filter((e: any) => matchToday(e.wedding_anniversary));
  const todayWorkAnniv = employees.filter((e: any) => matchToday(e.joining_date));

  const monthBirthdays = employees
    .filter((e: any) => matchMonth(e.date_of_birth) && !matchToday(e.date_of_birth))
    .sort((a: any, b: any) => new Date(a.date_of_birth).getDate() - new Date(b.date_of_birth).getDate());
  const monthAnniv = employees
    .filter((e: any) => matchMonth(e.wedding_anniversary) && !matchToday(e.wedding_anniversary))
    .sort((a: any, b: any) => new Date(a.wedding_anniversary).getDate() - new Date(b.wedding_anniversary).getDate());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Celebrations</h1>
        <p className="text-sm text-muted-foreground">Birthdays, work and wedding anniversaries today.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <HighlightCard title="🎂 Birthdays Today" icon={<Cake className="h-5 w-5" />} list={todayBirthdays} dateKey="date_of_birth" showAge />
        <HighlightCard title="💍 Wedding Anniversary Today" icon={<Heart className="h-5 w-5" />} list={todayAnniversaries} dateKey="wedding_anniversary" showYears />
        <HighlightCard title="🎉 Work Anniversary Today" icon={<Cake className="h-5 w-5" />} list={todayWorkAnniv} dateKey="joining_date" showYears />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle className="text-base">Upcoming birthdays this month</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {monthBirthdays.length === 0 ? <p className="text-sm text-muted-foreground">No more birthdays this month.</p>
              : monthBirthdays.map((e: any) => (
                <div key={e.id} className="flex justify-between items-center text-sm border-b border-border/40 pb-1">
                  <div><div className="font-medium">{e.full_name}</div><div className="text-xs text-muted-foreground">{e.employee_code}</div></div>
                  <Badge variant="secondary">{formatMD(e.date_of_birth)}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle className="text-base">Upcoming wedding anniversaries this month</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {monthAnniv.length === 0 ? <p className="text-sm text-muted-foreground">No more anniversaries this month.</p>
              : monthAnniv.map((e: any) => (
                <div key={e.id} className="flex justify-between items-center text-sm border-b border-border/40 pb-1">
                  <div><div className="font-medium">{e.full_name}</div><div className="text-xs text-muted-foreground">{e.employee_code}</div></div>
                  <Badge variant="secondary">{formatMD(e.wedding_anniversary)}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HighlightCard({ title, icon, list, dateKey, showAge, showYears }: any) {
  return (
    <Card className="bg-gradient-primary text-primary-foreground shadow-glow border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? <p className="text-sm opacity-80">None today.</p> : (
          <ul className="space-y-2">
            {list.map((e: any) => (
              <li key={e.id} className="bg-white/15 backdrop-blur rounded-md px-3 py-2 animate-pulse-slow">
                <div className="font-semibold">{e.full_name}</div>
                <div className="text-xs opacity-90">
                  {e.employee_code} {e.designation ? `· ${e.designation}` : ""}
                  {showAge && e.date_of_birth ? ` · turning ${(ageFromDOB(e.date_of_birth) ?? 0)}` : ""}
                  {showYears && e[dateKey] ? ` · ${new Date().getFullYear() - new Date(e[dateKey]).getFullYear()} yrs` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
