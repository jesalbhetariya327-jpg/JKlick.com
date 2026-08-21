import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Store } from "lucide-react";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";
import { requestPasswordOtp, verifyPasswordOtp } from "@/lib/account.functions";
import { notifyNewSignup } from "@/lib/notify.functions";
import { recordLogin } from "@/lib/login-log";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Shop Owner Login | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Shop owners sign in with email and password to manage their ethnic wear stock.",
      },
      { property: "og:title", content: "Shop Owner Login | Virar Ethnic Stock" },
      { property: "og:description", content: "Email and password login for Virar Ethnic Stock shop owners." },
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

type ForgotStep = "identify" | "otp" | "password";

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
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
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

  const sendOtp = async () => {
    if (identifier.trim().length < 3) {
      toast.error("Enter your email address or phone number");
      return;
    }
    setBusy(true);
    const res = await requestPasswordOtp({ data: { identifier: identifier.trim() } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setSentTo(res.maskedEmail);
    setForgotStep("otp");
    toast.success("We sent a 6-digit code to your email");
  };

  const verifyOtp = async () => {
    if (otp.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    setBusy(true);
    const res = await verifyPasswordOtp({
      data: { identifier: identifier.trim(), token: otp.trim() },
    });
    if (!res.ok) {
      setBusy(false);
      toast.error(res.message);
      return;
    }
    const { error } = await supabase.auth.setSession({
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForgotStep("password");
  };

  const saveNewPassword = async () => {
    const problem = firstPasswordProblem(newPassword);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (userData.user) {
      await ensureShop(userData.user, {
        ownerName: "",
        shopName: "",
        whatsapp: "",
        email: userData.user.email ?? "",
      });
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
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

      <div className="mx-auto mt-8 max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-royal text-primary-foreground shadow-soft">
            <Store className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? forgotStep === "identify"
                ? "Enter your email or phone number — we'll email you a 6-digit code."
                : forgotStep === "otp"
                  ? `Enter the 6-digit code sent to ${sentTo}.`
                  : "Choose a new password."
              : "Sign in with your email and password."}
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {mode === "forgot" ? (
              <>
                {forgotStep === "identify" && (
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
                        The code always goes to your registered email, even if you enter your phone
                        number.
                      </p>
                    </div>
                    <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void sendOtp()}>
                      {busy ? "Please wait..." : "Send 6-digit code"}
                    </Button>
                  </>
                )}

                {forgotStep === "otp" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="otp">6-digit code</Label>
                      <Input
                        id="otp"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="h-12 text-center text-lg tracking-[0.4em]"
                      />
                    </div>
                    <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void verifyOtp()}>
                      {busy ? "Please wait..." : "Verify code"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-sm text-muted-foreground underline underline-offset-4"
                      onClick={() => void sendOtp()}
                    >
                      Resend code
                    </button>
                  </>
                )}

                {forgotStep === "password" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="new-pass">New password</Label>
                      <Input
                        id="new-pass"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-12"
                      />
                      <PasswordChecklist value={newPassword} />
                    </div>
                    <Button
                      className="h-12 w-full text-base"
                      disabled={busy}
                      onClick={() => void saveNewPassword()}
                    >
                      {busy ? "Saving..." : "Save password and continue"}
                    </Button>
                  </>
                )}

                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline underline-offset-4"
                  onClick={() => {
                    setMode("login");
                    setForgotStep("identify");
                    setOtp("");
                    setNewPassword("");
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
