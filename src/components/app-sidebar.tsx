import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, CalendarOff, Plane, History, Wallet, FileText, Receipt, Plug, Settings, LogOut, Cake, HandCoins, Percent,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Commission Agents", url: "/commission-agents", icon: Percent },
  { title: "Commission", url: "/commission", icon: HandCoins },
  { title: "Commission Slips", url: "/commission-slips", icon: FileText },
  { title: "Celebrations", url: "/celebrations", icon: Cake },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Attendance Sheet", url: "/attendance-sheet", icon: CalendarDays },
  { title: "Allowed Week-Offs", url: "/week-offs", icon: CalendarOff },
  { title: "Leaves", url: "/leaves", icon: Plane },
  { title: "Leave History", url: "/leave-history", icon: History },
  { title: "Payroll", url: "/payroll", icon: Wallet },
  { title: "Payslips", url: "/payslips", icon: FileText },
  { title: "Advances", url: "/advances", icon: HandCoins },
  { title: "Challans", url: "/challans", icon: Receipt },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isActive = (url: string) => (url === "/" || url === "/commission") ? path === url : path.startsWith(url);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary shadow-glow grid place-items-center font-display font-bold text-primary-foreground">P</div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">PayPulse</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HR & Payroll</div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button onClick={logout} variant="ghost" className="justify-start gap-2 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
