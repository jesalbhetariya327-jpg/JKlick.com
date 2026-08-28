import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";
import jklickLogo from "@/assets/jk-infinity-logo.svg";

export const Route = createFileRoute("/customer-login")({
  head: () => ({
    meta: [
      { title: "Customer Login | JKlick" },
      {
        name: "description",
        content:
          "Create a shopper account to save your AI try-on photos, order ethnic wear and pay by UPI.",
      },
      { property: "og:title", content: "Customer Login | JKlick" },
      {
        property: "og:description",
        content: "Save try-on photos and order from any shop with one account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerLogin,
});

function CustomerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const ensureProfile = async (userId: string, mail: string) => {
    const { data: existing } = await supabase
      .from("customers")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return;
    await supabase.from("customers").insert({
      user_id: userId,
      full_name: fullName.trim() || "Shopper",
      phone: phone.trim() || null,
      email: mail,
    });
  };

  const signUp = async () => {
    if (!fullName.trim()) {
      toast.error("Enter your name");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    const problem = firstPasswordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), account_type: "customer" } },
    });
    if (error) {
      setBusy(false);
      toast.error(
        /already/i.test(error.message)
          ? "This email is already registered. Log in instead, or use a different email."
          : error.message,
      );
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setBusy(false);
      setMode("login");
      toast.error("This email is already registered. Log in instead, or use a different email.");
      return;
    }
    let session = data.session;
    if (!session) {
      const signedIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      session = signedIn.data.session;
    }
    if (!session) {
      setBusy(false);
      toast.error("Could not sign you in");
      return;
    }
    await ensureProfile(session.user.id, email.trim());
    setBusy(false);
    toast.success("Welcome!");
    navigate({ to: "/account", replace: true });
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      setBusy(false);
      toast.error(error?.message ?? "Could not sign you in");
      return;
    }
    await ensureProfile(data.session.user.id, email.trim());
    setBusy(false);
    navigate({ to: "/account", replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="mx-auto mt-5 max-w-md">
        <div className="mb-6 text-center">
          <img
            src={jklickLogo}
            alt="JKlick — Virar ethnic wear"
            className="mx-auto w-full max-w-sm object-contain"
            decoding="async"
          />
          <p className="mt-4 font-display text-lg italic text-primary">
            Infinite styles, infinite try-ons
          </p>
          <h1 className="mt-5 text-2xl font-bold">
            {mode === "signup" ? "Create your shopper account" : "Shopper login"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is linked to the shop you signed up through — save try-ons and track your orders.
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" className="h-12" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number (optional)</Label>
                  <Input
                    id="phone"
                    className="h-12"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="h-12"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && <PasswordChecklist value={password} />}
            </div>

            <Button
              className="h-12 w-full text-base"
              disabled={busy}
              onClick={() => void (mode === "signup" ? signUp() : signIn())}
            >
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "I already have an account" : "New here? Create an account"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Shop owner?{" "}
              <Link to="/auth" className="underline underline-offset-4">
                Sign in here
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
