import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Store } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Shop Owner Login | Virar Ethnic Stock" },
      {
        name: "description",
        content: "Shop owners sign in with a 6-digit code sent to their email to manage ethnic wear stock.",
      },
      { property: "og:title", content: "Shop Owner Login | Virar Ethnic Stock" },
      { property: "og:description", content: "Passwordless login for Virar Ethnic Stock shop owners." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const sendCode = async () => {
    if (!email.trim()) return toast.error("Enter your email address");
    if (mode === "signup" && (!ownerName.trim() || !shopName.trim())) {
      return toast.error("Enter your name and shop name");
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: mode === "signup",
        data:
          mode === "signup"
            ? { owner_name: ownerName.trim(), shop_name: shopName.trim(), whatsapp_number: whatsapp.trim() }
            : undefined,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("signups not allowed")
          ? "No account found for this email. Please sign up first."
          : error.message,
      );
      return;
    }
    setStep("otp");
    toast.success("We sent a 6-digit code to your email");
  };

  const verify = async (value: string) => {
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: value,
      type: "email",
    });
    if (error || !data.session) {
      setBusy(false);
      setCode("");
      toast.error(error?.message ?? "That code did not work");
      return;
    }

    const user = data.session.user;
    const { data: existing } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const meta = user.user_metadata ?? {};
      await supabase.from("shops").insert({
        user_id: user.id,
        owner_name: (ownerName || (meta["owner_name"] as string) || "Shop owner").trim(),
        shop_name: (shopName || (meta["shop_name"] as string) || "My shop").trim(),
        email: user.email ?? email.trim(),
        whatsapp_number: (whatsapp || (meta["whatsapp_number"] as string) || "").trim() || null,
      });
    }

    setBusy(false);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
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
            {mode === "signup" ? "Create your shop" : "Shop owner login"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No passwords — we email you a 6-digit code.
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 p-5">
            {step === "details" ? (
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12"
                  />
                </div>
                <Button className="h-12 w-full text-base" disabled={busy} onClick={sendCode}>
                  {busy ? "Sending..." : "Send 6-digit code"}
                </Button>
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
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Enter the code sent to <span className="font-semibold text-foreground">{email}</span>
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      if (v.length === 6) void verify(v);
                    }}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="h-12 w-full text-base"
                  disabled={busy || code.length !== 6}
                  onClick={() => void verify(code)}
                >
                  {busy ? "Verifying..." : "Verify & continue"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline underline-offset-4"
                  onClick={() => {
                    setStep("details");
                    setCode("");
                  }}
                >
                  Use a different email
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
