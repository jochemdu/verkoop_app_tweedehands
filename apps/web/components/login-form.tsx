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
  );
}
