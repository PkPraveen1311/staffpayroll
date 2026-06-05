import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/integrations")({ component: IntegrationsPage });

type WaConfig = { enabled: boolean; provider: string; phoneNumberId: string; accessToken: string; templateName: string };
type EmailConfig = { enabled: boolean; provider: string; fromEmail: string; fromName: string; apiKey: string };

const WA_KEY = "paypulse.integrations.whatsapp";
const EMAIL_KEY = "paypulse.integrations.email";

const defaultWa: WaConfig = { enabled: false, provider: "meta", phoneNumberId: "", accessToken: "", templateName: "salary_slip" };
const defaultEmail: EmailConfig = { enabled: false, provider: "resend", fromEmail: "", fromName: "PayPulse Payroll", apiKey: "" };

function IntegrationsPage() {
  const [wa, setWa] = useState<WaConfig>(defaultWa);
  const [email, setEmail] = useState<EmailConfig>(defaultEmail);

  useEffect(() => {
    try {
      const w = localStorage.getItem(WA_KEY);
      const e = localStorage.getItem(EMAIL_KEY);
      if (w) setWa({ ...defaultWa, ...JSON.parse(w) });
      if (e) setEmail({ ...defaultEmail, ...JSON.parse(e) });
    } catch {}
  }, []);

  const saveWa = () => {
    localStorage.setItem(WA_KEY, JSON.stringify(wa));
    toast.success("WhatsApp settings saved (draft)");
  };
  const saveEmail = () => {
    localStorage.setItem(EMAIL_KEY, JSON.stringify(email));
    toast.success("Email settings saved (draft)");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure WhatsApp and Email providers for sending payslips and notifications.
          <Badge variant="secondary" className="ml-2">Setup only · sending coming soon</Badge>
        </p>
      </div>

      {/* WhatsApp */}
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/15 text-green-500 grid place-items-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>WhatsApp Business API</CardTitle>
                <CardDescription>Send payslips and reminders via WhatsApp.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="wa-enabled" className="text-xs">Enabled</Label>
              <Switch id="wa-enabled" checked={wa.enabled} onCheckedChange={(v) => setWa({ ...wa, enabled: v })} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Input value={wa.provider} onChange={(e) => setWa({ ...wa, provider: e.target.value })} placeholder="meta / gupshup / twilio" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number ID</Label>
              <Input value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value })} placeholder="e.g. 1234567890" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Access Token</Label>
              <Input type="password" value={wa.accessToken} onChange={(e) => setWa({ ...wa, accessToken: e.target.value })} placeholder="EAAG…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name</Label>
              <Input value={wa.templateName} onChange={(e) => setWa({ ...wa, templateName: e.target.value })} placeholder="salary_slip" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveWa} variant="outline"><Save className="h-4 w-4 mr-1" /> Save WhatsApp settings</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Saved locally for now. Backend sending will be wired up later — keys will then move to secure server storage.
          </p>
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="bg-gradient-card border-border/60 shadow-elegant">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 text-blue-400 grid place-items-center">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Email Provider</CardTitle>
                <CardDescription>Send payslips and statements over email.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="email-enabled" className="text-xs">Enabled</Label>
              <Switch id="email-enabled" checked={email.enabled} onCheckedChange={(v) => setEmail({ ...email, enabled: v })} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Input value={email.provider} onChange={(e) => setEmail({ ...email, provider: e.target.value })} placeholder="resend / sendgrid / ses" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From name</Label>
              <Input value={email.fromName} onChange={(e) => setEmail({ ...email, fromName: e.target.value })} placeholder="PayPulse Payroll" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From email</Label>
              <Input type="email" value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })} placeholder="payroll@yourcompany.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API key</Label>
              <Input type="password" value={email.apiKey} onChange={(e) => setEmail({ ...email, apiKey: e.target.value })} placeholder="re_…" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveEmail} variant="outline"><Save className="h-4 w-4 mr-1" /> Save email settings</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Saved locally for now. Backend sending will be wired up later — keys will then move to secure server storage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
