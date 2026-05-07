import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (mode: "signin" | "signup") => {
    setLoading(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn({
        email, password,
        ...(mode === "signup" ? { options: { emailRedirectTo: window.location.origin } } : {}),
      } as any);
      if (error) throw error;
      toast.success(mode === "signin" ? "Welcome back" : "Account created");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center font-display font-bold text-2xl text-primary-foreground">P</div>
          <h1 className="mt-4 text-3xl font-bold text-gradient">PayPulse</h1>
          <p className="text-sm text-muted-foreground">Admin console for HR & Payroll</p>
        </div>
        <Card className="bg-gradient-card shadow-elegant border-border/60">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your admin email & password</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create admin</TabsTrigger>
              </TabsList>
              {(["signin","signup"] as const).map(mode => (
                <TabsContent key={mode} value={mode} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <Button onClick={() => submit(mode)} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">
                    {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
