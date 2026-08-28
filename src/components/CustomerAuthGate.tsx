import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { firstPasswordProblem } from "@/lib/password";

/** Shows a sign up / log in card until the visitor has an account for THIS shop, then renders children. */
export function CustomerAuthGate({
  shopId,
  shopName,
  children,
}: {
  shopId?: string | null;
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
  const [blocked, setBlocked] = useState<string | null>(null);

  /** Confirms the signed-in account belongs to this shop; signs out and explains if not. */
  const verifyShop = async (userId: string): Promise<boolean> => {
    if (!shopId) return true;
    const { data: profile } = await supabase
      .from("customers")
      .select("shop_id")
      .eq("user_id", userId)
      .maybeSingle();
    // Shop owners / admins have no customer profile — let them through.
    if (!profile) return true;
    const ownShopId = (profile as { shop_id: string | null }).shop_id;
    if (!ownShopId || ownShopId === shopId) return true;

    const { data: ownShop } = await supabase
      .from("shops")
      .select("shop_name, slug")
      .eq("id", ownShopId)
      .maybeSingle();
    const own = ownShop as { shop_name: string; slug: string } | null;
    await supabase.auth.signOut();
    setBlocked(
      `This account isn't registered with ${shopName ?? "this shop"}. Please sign up here with a different email, or visit ${
        own ? `${own.shop_name} (/${own.slug})` : "your own shop's link"
      } to log in.`,
    );
    setStatus("out");
    return false;
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        setStatus("out");
        return;
      }
      const ok = await verifyShop(data.session.user.id);
      if (active && ok) setStatus("in");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const ensureProfile = async (userId: string, mail: string) => {
    const { data: existing } = await supabase
      .from("customers")
      .select("user_id, shop_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      if (shopId && !(existing as { shop_id: string | null }).shop_id) {
        await supabase.from("customers").update({ shop_id: shopId }).eq("user_id", userId);
      }
      return;
    }
    await supabase.from("customers").insert({
      user_id: userId,
      full_name: fullName.trim() || "Shopper",
      phone: phone.trim() || null,
      email: mail,
      shop_id: shopId ?? null,
    });
  };

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) {
      toast.error("Enter your email address");
      return;
    }
    setBlocked(null);
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
      const duplicate =
        (error && /already/i.test(error.message)) ||
        (!error && data.user && (data.user.identities?.length ?? 0) === 0);
      if (duplicate) {
        setBusy(false);
        setMode("login");
        toast.error("This email is already registered. Log in instead, or use a different email.");
        return;
      }
      if (error) {
        setBusy(false);
        toast.error(error.message);
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
      setStatus("in");
      toast.success("Welcome!");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (error || !data.session) {
      setBusy(false);
      toast.error(error?.message ?? "Could not sign you in");
      return;
    }
    const ok = await verifyShop(data.session.user.id);
    setBusy(false);
    if (!ok) return;
    await ensureProfile(data.session.user.id, mail);
    setStatus("in");
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

        {blocked && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {blocked}
          </div>
        )}


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

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
