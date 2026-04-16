"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success(`Magic link verstuurd naar ${data.email}`);
  }

  if (sent) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm">
        Check je inbox voor de magic link. Je kunt dit venster sluiten.
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
          className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "Versturen…" : "Stuur magic link"}
      </button>
    </form>
  );
}
