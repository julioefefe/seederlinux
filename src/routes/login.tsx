import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader as Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar - SeederLinux" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, loading, initialized } = useAuth();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Only redirect AFTER initialization is complete and we have a user
    // Use ref to prevent multiple redirect attempts
    if (initialized && user && !redirectAttempted.current) {
      redirectAttempted.current = true;
      nav({ to: "/painel" });
    }
  }, [initialized, user, nav]);

  // Show loading spinner while checking auth status
  if (loading || !initialized) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verificando autenticacao...</p>
        </div>
      </div>
    );
  }

  // If already logged in, show redirecting message
  if (user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/10 via-accent/10 to-background border-r">
        <div className="flex items-center gap-3">
          <img src="/seederlinux-logo.png" alt="SeederLinux" className="size-12 object-contain" />
          <div>
            <div className="font-display font-bold text-lg">SeederLinux</div>
            <div className="text-xs font-mono text-muted-foreground">built for institutions · open by design</div>
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Acesso restrito
          </p>
          <h1 className="text-3xl font-display font-bold leading-tight">
            Provisionamento Linux para o seu GAP, com auditoria.
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-OM, scripts validados, perfis reutilizaveis e bundles assinados.
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          v3.0 - uso institucional - <Link to="/" className="underline">voltar ao site</Link>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso ao painel</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo!");
      // Navigation happens automatically via AuthProvider user state change
    } catch (error: any) {
      toast.error(error.message === "Invalid credentials" ? "Credenciais invalidas." : error.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="si-email">E-mail institucional</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-pwd">Senha</Label>
        <Input id="si-pwd" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin mr-2" />} Entrar
      </Button>
      <p className="text-[11px] text-muted-foreground text-center pt-2">
        O cadastro e realizado pelo <strong>admin GAP</strong>.
      </p>
    </form>
  );
}
