import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Re-verifies the signed-in user's login password before a sensitive action. */
export function PasswordConfirmDialog({
  open, onOpenChange, title, description, onConfirmed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  onConfirmed: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (o: boolean) => {
    if (!o) { setPassword(""); setError(""); }
    onOpenChange(o);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new Error("Not signed in");
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError("Incorrect password"); return; }
      close(false);
      onConfirmed();
    } catch (er: any) {
      setError(er.message ?? "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Your login password</Label>
            <Input id="confirm-pw" type="password" autoFocus autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !password}>{busy ? "Verifying…" : "Confirm"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
