import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { session } = useAuthSession();
  const [pwd, setPwd] = useState("");
  const update = async () => {
    if (pwd.length < 6) { toast.error("Min 6 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setPwd("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account & workspace preferences.</p>
      </div>
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>Account</CardTitle><CardDescription>Signed in as {session?.user.email}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={update} className="bg-gradient-primary text-primary-foreground">Update password</Button>
        </CardContent>
      </Card>
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader><CardTitle>About PayPulse</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>HR & Payroll management built for Indian businesses. Computes PF (12% capped at ₹1,800), ESI (0.75% if gross ≤ ₹21,000) and TDS using simplified new regime slabs.</p>
          <p>This is an admin console — every signed-in user has full access.</p>
        </CardContent>
      </Card>
    </div>
  );
}
