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
  const { data: existing } = await supabase
    .from("shops")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return;

  const meta = user.user_metadata ?? {};
  await supabase.from("shops").insert({
    user_id: user.id,
    owner_name: (fallback.ownerName || (meta["owner_name"] as string) || "Shop owner").trim(),
    shop_name: (fallback.shopName || (meta["shop_name"] as string) || "My shop").trim(),
    email: user.email ?? fallback.email,
    whatsapp_number: (fallback.whatsapp || (meta["whatsapp_number"] as string) || "").trim() || null,
  });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState<null | "confirm" | "reset">(null);

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
    if (!email.trim() || password.length < 6) {
      toast.error("Enter an email and a password of at least 6 characters");
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
    if (!data.session) {
      setBusy(false);
      setCheckEmail("confirm");
      return;
    }
    await ensureShop(data.session.user, {
      ownerName,
      shopName,
      whatsapp,
      email: email.trim(),
    });
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
    await ensureShop(data.session.user, {
      ownerName,
      shopName,
      whatsapp,
      email: email.trim(),
    });
    setBusy(false);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  };

  const sendReset = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCheckEmail("reset");
  };

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
          <h1 className="mt-4 text-2xl font-bold">
            {mode === "signup"
              ? "Create your shop"
              : mode === "forgot"
                ? "Reset your password"
                : "Shop owner login"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a link to set a new password."
              : "Sign in with your email and password."}
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {checkEmail ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {checkEmail === "confirm"
                    ? "Check your inbox and click the confirmation link to activate your shop account."
                    : "Check your inbox for the password reset link."}
                </p>
                <Button
                  variant="outline"
                  className="h-12 w-full text-base"
                  onClick={() => {
                    setCheckEmail(null);
                    setMode("login");
                    setPassword("");
                  }}
                >
                  Back to login
                </Button>
              </div>
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
                      <Label htmlFor="wa">WhatsApp number</Label>
                      <Input
                        id="wa"
                        inputMode="tel"
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

                {mode !== "forgot" && (
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
                  </div>
                )}

                <Button
                  className="h-12 w-full text-base"
                  disabled={busy}
                  onClick={() => {
                    if (mode === "signup") void signUp();
                    else if (mode === "forgot") void sendReset();
                    else void signIn();
                  }}
                >
                  {busy
                    ? "Please wait..."
                    : mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Log in"}
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => setMode("forgot")}
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
