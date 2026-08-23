import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password | JKlick" },
      {
        name: "description",
        content: "Choose a new password for your JKlick shop owner account.",
      },
      { property: "og:title", content: "Set a New Password | JKlick" },
      { property: "og:description", content: "Complete your password reset for JKlick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");

  useEffect(() => {
    let active = true;

    const check = async () => {
      // Supabase may return either hash tokens or a PKCE ?code= param.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setReady(data.session ? "ok" : "invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady("ok");
    });
    void check();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  const submit = async () => {
    const problem = firstPasswordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (password !== confirm) {
      toast.error("Both passwords must match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-royal text-primary-foreground shadow-soft">
            <KeyRound className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
        </div>
        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {ready === "checking" && (
              <p className="text-sm text-muted-foreground">Checking your reset link...</p>
            )}
            {ready === "invalid" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has expired. Please request a new one.
                </p>
                <Button className="h-12 w-full" onClick={() => navigate({ to: "/auth" })}>
                  Back to login
                </Button>
              </div>
            )}
            {ready === "ok" && (
              <>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="h-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordChecklist value={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="h-12"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void submit()}>
              {busy ? "Saving..." : "Update password"}
            </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
