import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Asks for a person's exit / last working date before marking them inactive. */
export function ExitDateDialog({
  open, onOpenChange, personName, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personName: string;
  onConfirm: (exitDate: string) => void;
}) {
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setError("");
    }
  }, [open]);

  const close = (o: boolean) => { if (!o) setError(""); onOpenChange(o); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Enter date as YYYY-MM-DD"); return; }
    close(false);
    onConfirm(date);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mark {personName} as exited?</DialogTitle>
            <DialogDescription>Enter their last working date. They stay in payroll & attendance for that month only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exit-date">Last working date</Label>
            <Input id="exit-date" type="date" autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
