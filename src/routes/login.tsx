import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — PayPulse HR & Payroll" },
      { name: "description", content: "Secure admin sign-in for PayPulse HR & Payroll management." },
      { property: "og:title", content: "Sign in — PayPulse HR & Payroll" },
      { property: "og:description", content: "Secure admin sign-in for PayPulse HR & Payroll management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const schema = z.object({
  email: z.string().trim().nonempty("Email is required").email("Enter a valid email address").max(255),
  password: z.string().nonempty("Password is required").min(6, "Password must be at least 6 characters").max(128),
});

type Mode = "signin" | "signup";

function AuthForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentReset, setSentReset] = useState(false);

  const ids = {
    email: `${mode}-email`,
    password: `${mode}-password`,
    emailErr: `${mode}-email-error`,
    passErr: `${mode}-password-error`,
    caps: `${mode}-caps`,
    form: `${mode}-form-error`,
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
          : await supabase.auth.signUp({
              email: parsed.data.email,
              password: parsed.data.password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (error) throw error;
      if (mode === "signup") {
        toast.success("Account created — check your email to confirm.");
      } else {
        toast.success("Welcome back");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setFormError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    const res = z.string().trim().email().safeParse(email);
    if (!res.success) {
      setErrors((p) => ({ ...p, email: "Enter your email above first, then click Forgot password." }));
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(res.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSentReset(true);
      toast.success("Password reset link sent to your email.");
    } catch (err: any) {
      setFormError(err?.message ?? "Could not send reset email.");
    }
  };

  const onKeyCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCaps(e.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor={ids.email}>Email</Label>
        <Input
          id={ids.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@company.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? ids.emailErr : undefined}
          className="placeholder:text-muted-foreground"
        />
        {errors.email && (
          <p id={ids.emailErr} role="alert" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.password}>Password</Label>
        <div className="relative">
          <Input
            id={ids.password}
            type={show ? "text" : "password"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={onKeyCaps}
            onKeyDown={onKeyCaps}
            onBlur={() => setCaps(false)}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={
              [errors.password ? ids.passErr : null, caps ? ids.caps : null].filter(Boolean).join(" ") || undefined
            }
            className="pr-11 placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {caps && (
          <p id={ids.caps} className="flex items-center gap-1.5 text-sm text-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Caps Lock is on
          </p>
        )}
        {errors.password && (
          <p id={ids.passErr} role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
        {mode === "signin" && (
          <div className="pt-1 text-right">
            <button
              type="button"
              onClick={forgot}
              className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Forgot password?
            </button>
          </div>
        )}
        {sentReset && (
          <p role="status" className="text-sm text-success">
            Reset link sent. Check your inbox.
          </p>
        )}
      </div>

      {formError && (
        <p id={ids.form} role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center font-display font-bold text-2xl text-primary-foreground">
            P
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gradient">PayPulse</h1>
          <p className="text-sm text-muted-foreground">Admin console for HR &amp; Payroll</p>
        </div>
        <Card className="bg-gradient-card shadow-elegant border-border/60">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your admin email &amp; password</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create admin</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <AuthForm mode="signin" />
              </TabsContent>
              <TabsContent value="signup">
                <AuthForm mode="signup" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Authorized administrators only.
        </p>
      </div>
    </main>
  );
}
