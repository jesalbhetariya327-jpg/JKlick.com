import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";
import { sendPasswordResetLink } from "@/lib/account.functions";
import { notifyNewSignup } from "@/lib/notify.functions";
import { recordLogin } from "@/lib/login-log";
import jklickLogo from "@/assets/jk-infinity-logo.svg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Shop Owner Login | JKlick" },
      {
        name: "description",
        content: "Shop owners sign in with email and password to manage their ethnic wear stock.",
      },
      { property: "og:title", content: "Shop Owner Login | JKlick" },
      { property: "og:description", content: "Email and password login for JKlick shop owners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

async function ensureShop(
  user: User,
  fallback: { ownerName: string; shopName: string; whatsapp: string; email: string },
) {
  const meta = user.user_metadata ?? {};
  const phone = (fallback.whatsapp || (meta["whatsapp_number"] as string) || "").trim() || null;

  const { data: existing } = await supabase
    .from("shops")
    .select("id, whatsapp_number")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (!existing.whatsapp_number && phone) {
      await supabase.from("shops").update({ whatsapp_number: phone }).eq("id", existing.id);
    }
    return;
  }

  await supabase.from("shops").insert({
    user_id: user.id,
    owner_name: (fallback.ownerName || (meta["owner_name"] as string) || "Shop owner").trim(),
    shop_name: (fallback.shopName || (meta["shop_name"] as string) || "My shop").trim(),
    email: user.email ?? fallback.email,
    whatsapp_number: phone,
  });
}

type ForgotStep = "identify" | "sent";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [forgotStep, setForgotStep] = useState<ForgotStep>("identify");
  const [identifier, setIdentifier] = useState("");
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signUp = async () => {
    if (!ownerName.trim() || !shopName.trim()) {
      toast.error("Enter your name and shop name");
      return;
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid 10-digit phone number");
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
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          owner_name: ownerName.trim(),
          shop_name: shopName.trim(),
          whatsapp_number: whatsapp.trim(),
        },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    let session = data.session;
    if (!session) {
      const signedIn = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      session = signedIn.data.session;
      if (!session) {
        setBusy(false);
        toast.error(signedIn.error?.message ?? "Could not sign you in");
        return;
      }
    }
    await ensureShop(session.user, { ownerName, shopName, whatsapp, email: email.trim() });
    void recordLogin(session.user.id);
    void notifyNewSignup({
      data: {
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: whatsapp.trim() || null,
      },
    }).catch(() => undefined);
    setBusy(false);
    toast.success("Shop created!");
    navigate({ to: "/dashboard", replace: true });
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
    await ensureShop(data.session.user, { ownerName, shopName, whatsapp, email: email.trim() });
    void recordLogin(data.session.user.id);
    setBusy(false);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  };

  const sendResetLink = async () => {
    if (identifier.trim().length < 3) {
      toast.error("Enter your email address or phone number");
      return;
    }
    setBusy(true);
    const res = await sendPasswordResetLink({
      data: {
        identifier: identifier.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setSentTo(res.maskedEmail);
    setForgotStep("sent");
    toast.success("Check your email for the reset link");
  };


  const heading =
    mode === "signup"
      ? "Create your shop"
      : mode === "forgot"
        ? "Reset your password"
        : "Shop owner login";

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back to storefront
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
          <h1 className="mt-5 text-2xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? forgotStep === "identify"
                ? "Enter your email or phone number — we'll email you a password reset link."
                : `Check your email and click the reset link to set a new password. We sent it to ${sentTo}.`
              : "Sign in with your email and password."}
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {mode === "forgot" ? (
              <>
                {forgotStep === "identify" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="identifier">Email or phone number</Label>
                      <Input
                        id="identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="you@example.com or 9876543210"
                        className="h-12"
                      />
                      <p className="text-xs text-muted-foreground">
                        The reset link always goes to your registered email, even if you enter your
                        phone number.
                      </p>
                    </div>
                    <Button
                      className="h-12 w-full text-base"
                      disabled={busy}
                      onClick={() => void sendResetLink()}
                    >
                      {busy ? "Please wait..." : "Email me a reset link"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
                      Check your email and click the reset link to set a new password. The link opens
                      a page where you can choose your new password.
                    </div>
                    <button
                      type="button"
                      className="w-full text-sm text-muted-foreground underline underline-offset-4"
                      onClick={() => void sendResetLink()}
                    >
                      Resend reset link
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline underline-offset-4"
                  onClick={() => {
                    setMode("login");
                    setForgotStep("identify");
                  }}
                >
                  Back to login
                </button>

              </>
            ) : (
              <>
                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="owner">Your name</Label>
                      <Input
                        id="owner"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Rekha Patil"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shop">Shop name</Label>
                      <Input
                        id="shop"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Shree Ethnic Collection"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa">Phone number (WhatsApp)</Label>
                      <Input
                        id="wa"
                        inputMode="tel"
                        autoComplete="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="9876543210"
                        className="h-12"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12"
                  />
                  {mode === "signup" && <PasswordChecklist value={password} />}
                </div>

                <Button
                  className="h-12 w-full text-base"
                  disabled={busy}
                  onClick={() => {
                    if (mode === "signup") void signUp();
                    else void signIn();
                  }}
                >
                  {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => {
                      setMode("forgot");
                      setForgotStep("identify");
                      setIdentifier(email);
                    }}
                  >
                    Forgot password?
                  </button>
                )}

                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline underline-offset-4"
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                >
                  {mode === "signup"
                    ? "Already registered? Log in"
                    : "New shop? Create an account"}
                </button>

                <Link
                  to="/customer-login"
                  className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4"
                >
                  Shopping instead? Shopper login
                </Link>

              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
