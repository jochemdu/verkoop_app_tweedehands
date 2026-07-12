"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    // Via rate-limited proxy endpoint ipv direct Supabase aanroepen.
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.code === "RATE_LIMITED") {
        toast.error("Te veel pogingen, wacht 15 minuten.");
      } else {
        toast.error(json.error ?? "Kon magic link niet versturen");
      }
      return;
    }
    setSentTo(data.email);
    toast.success(`Inlogmail verstuurd naar ${data.email}`);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(`Google-login mislukt: ${error.message}`);
    // Bij succes navigeert de browser vanzelf naar Google.
  }

  // OTP-code als alternatief voor de link: mail-scanners (Outlook SafeLinks
  // bij Hotmail) kunnen de magic link vooraf "aanklikken" waardoor het token
  // al verbruikt is — de 6-cijferige code heeft daar geen last van.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo || code.trim().length < 6) return;
    setVerifying(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: sentTo,
        token: code.trim(),
        type: "email",
      });
      if (error) {
        toast.error("Code onjuist of verlopen — probeer opnieuw.");
        return;
      }
      toast.success("Ingelogd!");
      router.push("/");
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-accent bg-accent-soft p-4 text-sm">
          Check je inbox: klik de magic link, <em>of</em> vul hieronder de
          6-cijferige code uit de mail in.
        </div>
        <form onSubmit={verifyCode} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Inlogcode</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              autoFocus
              className="input text-center font-mono text-lg tracking-[0.4em]"
            />
          </label>
          <button
            type="submit"
            disabled={verifying || code.length < 6}
            className="btn btn-accent w-full"
          >
            {verifying ? "Controleren…" : "Log in met code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setCode("");
            }}
            className="btn btn-ghost w-full"
          >
            Ander e-mailadres / opnieuw versturen
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">E-mailadres</span>
          <input
            type="email"
            autoComplete="email"
            autoFocus
            className="input"
            placeholder="jij@voorbeeld.nl"
            {...register("email")}
          />
          {errors.email && (
            <span className="text-xs text-destructive">{errors.email.message}</span>
          )}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-accent w-full"
        >
          {isSubmitting ? "Versturen…" : "Stuur inlogmail"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        of
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="btn btn-outline w-full"
      >
        <GoogleIcon className="size-4" />
        Log in met Google
      </button>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
