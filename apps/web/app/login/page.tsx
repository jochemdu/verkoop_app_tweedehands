import { Tag } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6 p-8">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Tag className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">VerkoopAssistent</h1>
          <p className="text-sm text-muted-foreground">
            Log in met een magic link in je inbox.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
