import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">VerkoopAssistent</h1>
          <p className="text-sm text-muted-foreground">
            Log in met een magic link in je inbox.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
