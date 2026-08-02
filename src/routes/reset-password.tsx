import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password — PayPulse HR & Payroll" },
      { name: "description", content: "Set a new password for your PayPulse admin account." },
      { property: "og:title", content: "Reset password — PayPulse HR & Payroll" },
      { property: "og:description", content: "Set a new password for your PayPulse admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onKeyCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCaps(e.getModifierState?.("CapsLock") ?? false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ password: f.password?.[0], confirm: f.confirm?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/" });
    } catch (err: any) {
      setFormError(err?.message ?? "Could not update password. Request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-elegant border-border/60">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a strong password for your admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={onKeyCaps}
                  onKeyDown={onKeyCaps}
                  onBlur={() => setCaps(false)}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "new-password-error" : undefined}
                  className="pr-11 placeholder:text-muted-foreground"
                  placeholder="••••••••"
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
                <p className="flex items-center gap-1.5 text-sm text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Caps Lock is on
                </p>
              )}
              {errors.password && (
                <p id="new-password-error" role="alert" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "confirm-password-error" : undefined}
                placeholder="••••••••"
                className="placeholder:text-muted-foreground"
              />
              {errors.confirm && (
                <p id="confirm-password-error" role="alert" className="text-sm text-destructive">
                  {errors.confirm}
                </p>
              )}
            </div>

            {formError && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
