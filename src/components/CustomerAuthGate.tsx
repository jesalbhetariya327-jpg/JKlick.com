import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";

/** Shows a sign up / log in card until the visitor has an account, then renders children. */
export function CustomerAuthGate({
  shopName,
  children,
}: {
  shopName?: string | null;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "out" | "in">("loading");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "in" : "out");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) {
      toast.error("Enter your email address");
      return;
    }
    setBusy(true);

    if (mode === "signup") {
      const problem = firstPasswordProblem(password);
      if (problem) {
        setBusy(false);
        toast.error(problem);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName.trim(), account_type: "customer" },
        },
      });
      if (error) {
        setBusy(false);
        toast.error(
          /already/i.test(error.message)
            ? "This email is already registered. Please log in instead."
            : error.message,
        );
        if (/already/i.test(error.message)) setMode("login");
        return;
      }
      let session = data.session;
      if (!session) {
        const signedIn = await supabase.auth.signInWithPassword({ email: mail, password });
        session = signedIn.data.session;
      }
      if (!session) {
        setBusy(false);
        toast.error("Could not sign you in");
        return;
      }
      await ensureProfile(session.user.id, mail);
      setBusy(false);
      toast.success("Welcome!");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (error || !data.session) {
      setBusy(false);
      toast.error(error?.message ?? "Could not sign you in");
      return;
    }
    await ensureProfile(data.session.user.id, mail);
    setBusy(false);
  };

  if (status === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading...</p>;
  }

  if (status === "in") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-royal text-primary-foreground shadow-soft">
            <Sparkles className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            {shopName ? `Welcome to ${shopName}` : "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Create a free account to browse the collection, try outfits on with AI and order."
              : "Log in to browse the collection and continue shopping."}
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gate-name">Your name</Label>
                  <Input
                    id="gate-name"
                    className="h-12"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gate-phone">Phone number (optional)</Label>
                  <Input
                    id="gate-phone"
                    className="h-12"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="gate-email">Email</Label>
              <Input
                id="gate-email"
                type="email"
                autoComplete="email"
                className="h-12"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-password">Password</Label>
              <Input
                id="gate-password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="h-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && <PasswordChecklist value={password} />}
            </div>

            <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void submit()}>
              {busy ? "Please wait..." : mode === "signup" ? "Create account & browse" : "Log in"}
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
