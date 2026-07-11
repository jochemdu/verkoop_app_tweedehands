"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@verkoopassistent/shared";

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
    setSent(true);
    toast.success(`Magic link verstuurd naar ${data.email}`);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-dashed border-accent bg-accent-soft p-4 text-sm">
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
        {isSubmitting ? "Versturen…" : "Stuur magic link"}
      </button>
    </form>
  );
}
