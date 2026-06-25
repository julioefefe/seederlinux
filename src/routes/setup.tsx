import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { setupApi, setAuthToken } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleCheck as CheckCircle2, ChevronRight, Loader as Loader2, Lock, Building2, ShieldCheck, Globe, Server, Network, Clock, Printer, Users, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Configuracao Inicial - SeederLinux" }] }),
  component: SetupPage,
});

const STEPS = [
  { id: 1, label: "Token", icon: Lock },
  { id: 2, label: "Administrador", icon: ShieldCheck },
  { id: 3, label: "Organizacao", icon: Building2 },
  { id: 4, label: "Concluido", icon: CheckCircle2 },
] as const;

type Step = (typeof STEPS)[number]["id"];

function SetupPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [token, setToken] = useState("");
  const setupCompleteRef = useRef(false);

  // Step 2: Admin info
  const [admin, setAdmin] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  // Step 3: Organization info
  const [org, setOrg] = useState({
    nome: "",
    sigla: "",
    fqdn: "",
    netbios: "",
    realm: "",
    dcPrimaryIp: "",
    dcSecondaryIp: "",
    dcFqdn: "",
    dnsPrimary: "",
    dnsSecondary: "",
    searchDomains: "",
    ntpServers: "pool.ntp.org",
    timezone: "America/Sao_Paulo",
    httpProxy: "",
    httpsProxy: "",
    noProxy: "localhost, 127.0.0.1, 10.0.0.0/8, *.intraer",
    authBackend: "sssd" as "sssd" | "winbind",
    authMethod: "ads" as "ads" | "ldap",
    printServer: "",
    defaultPrinter: "",
  });

  // Check if setup already completed on mount
  useEffect(() => {
    setupApi
      .status()
      .then((status) => {
        if (status.completed) {
          nav({ to: "/login" });
        } else {
          setCheckingStatus(false);
        }
      })
      .catch(() => {
        setCheckingStatus(false);
      });
  }, [nav]);

  // Handle redirect after completion
  useEffect(() => {
    if (step === STEPS.length && setupCompleteRef.current) {
      const timer = setTimeout(() => {
        nav({ to: "/painel" });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, nav]);

  // Show loading while checking setup status
  if (checkingStatus) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verificando status do sistema...</p>
        </div>
      </div>
    );
  }

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length) as Step);
  const prevStep = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const validateStep1 = () => {
    if (!token.trim()) {
      toast.error("Informe o token de configuracao.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!admin.email || !admin.password) {
      toast.error("Preencha email e senha do administrador.");
      return false;
    }
    if (admin.password.length < 6) {
      toast.error("Senha deve ter no minimo 6 caracteres.");
      return false;
    }
    if (admin.password !== admin.confirm) {
      toast.error("Senhas nao coincidem.");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!org.nome || !org.sigla) {
      toast.error("Nome e sigla da organizacao sao obrigatorios.");
      return false;
    }
    if (!org.fqdn) {
      toast.error("O FQDN do dominio e obrigatorio.");
      return false;
    }
    if (!org.dcPrimaryIp) {
      toast.error("O IP do Domain Controller primario e obrigatorio.");
      return false;
    }
    if (!org.dnsPrimary) {
      toast.error("O DNS primario e obrigatorio.");
      return false;
    }
    return true;
  };

  const submitSetup = async () => {
    if (!validateStep3()) return;

    setBusy(true);
    try {
      const result = await setupApi.complete({
        setupToken: token.trim(),
        adminEmail: admin.email.trim().toLowerCase(),
        adminPassword: admin.password,
        adminName: admin.name.trim(),
        orgName: org.nome.trim(),
        orgSigla: org.sigla.trim().toUpperCase(),
        fqdn: org.fqdn.trim().toLowerCase(),
        netbios: org.netbios.trim().toUpperCase() || org.sigla.trim().toUpperCase(),
        realm: org.realm.trim().toUpperCase() || org.sigla.trim().toUpperCase() + ".INTRAER",
        dcPrimaryIp: org.dcPrimaryIp.trim(),
        dcSecondaryIp: org.dcSecondaryIp.trim() || undefined,
        dcFqdn: org.dcFqdn.trim(),
        dnsPrimary: org.dnsPrimary.trim(),
        dnsSecondary: org.dnsSecondary.trim() || undefined,
        searchDomains: org.searchDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ntpServers: org.ntpServers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        timezone: org.timezone,
        httpProxy: org.httpProxy.trim(),
        httpsProxy: org.httpsProxy.trim(),
        noProxy: org.noProxy
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        authBackend: org.authBackend,
        authMethod: org.authMethod,
        printServer: org.printServer.trim() || undefined,
        defaultPrinter: org.defaultPrinter.trim() || undefined,
      });

      setAuthToken(result.token);
      toast.success("Sistema configurado com sucesso!");
      setupCompleteRef.current = true;
      setStep(STEPS.length);
    } catch (e: any) {
      const errorMsg = e.message || "Erro ao configurar sistema";
      if (errorMsg.includes("Invalid setup token") || errorMsg.includes("token")) {
        toast.error("Token de configuracao invalido.");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <img src="/seederlinux-logo.png" alt="SeederLinux" className="size-9 object-contain" />
          <div>
            <div className="font-display font-bold leading-tight">SeederLinux</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Configuracao inicial - Setup Wizard
            </div>
          </div>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            Passo {step} / {STEPS.length}
          </Badge>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Stepper */}
        <div className="flex items-center gap-1 mb-10 w-full max-w-xl">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div
                  className={`flex flex-col items-center gap-1 flex-1 ${active ? "opacity-100" : done ? "opacity-70" : "opacity-30"}`}
                >
                  <div
                    className={`size-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      done
                        ? "bg-success text-success-foreground border-success"
                        : active
                          ? "border-primary text-primary bg-primary/10"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <span className="text-[10px] font-mono hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 max-w-8 ${done ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="w-full max-w-2xl">
          {/* STEP 1: Token */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="size-5 text-primary" /> Verificacao de instalacao
                </CardTitle>
                <CardDescription>
                  Informe o token exibido ao final do <code className="font-mono text-xs">install.sh</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Setup Token</Label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Token gerado pelo instalador"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontrado em <code className="font-mono">/opt/seederlinux/.env</code> (variavel{" "}
                    <code className="font-mono">SETUP_TOKEN</code>).
                  </p>
                </div>
                <Button className="w-full" onClick={() => validateStep1() && nextStep()} disabled={!token}>
                  Verificar e continuar <ChevronRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Admin */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" /> Administrador do Sistema
                </CardTitle>
                <CardDescription>
                  Crie a conta de administrador global (admin_gap). Esta conta tera acesso total ao sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input
                    value={admin.name}
                    onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
                    placeholder="Ten Cel Joao Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={admin.email}
                    onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                    placeholder="admin@gapsp.intraer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Senha *</Label>
                    <Input
                      type="password"
                      value={admin.password}
                      onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                      placeholder="Minimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirmar senha *</Label>
                    <Input
                      type="password"
                      value={admin.confirm}
                      onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="size-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" onClick={() => validateStep2() && nextStep()}>
                    Proximo <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Organization */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-primary" /> Organizacao Raiz
                </CardTitle>
                <CardDescription>
                  Configure a primeira organizacao (OM). Todos os dados do sistema pertencem a uma organizacao.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Identity */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="size-4" /> Identidade
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Sigla *</Label>
                      <Input
                        value={org.sigla}
                        onChange={(e) => setOrg({ ...org, sigla: e.target.value.toUpperCase() })}
                        placeholder="COMARA"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome completo *</Label>
                      <Input
                        value={org.nome}
                        onChange={(e) => setOrg({ ...org, nome: e.target.value })}
                        placeholder="Comando de Apoio Regional de Aeronautica"
                      />
                    </div>
                  </div>
                </div>

                {/* Domain */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Globe className="size-4" /> Dominio Active Directory
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>FQDN *</Label>
                      <Input
                        value={org.fqdn}
                        onChange={(e) => setOrg({ ...org, fqdn: e.target.value.toLowerCase() })}
                        placeholder="comara.intraer"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>NETBIOS</Label>
                      <Input
                        value={org.netbios}
                        onChange={(e) => setOrg({ ...org, netbios: e.target.value.toUpperCase() })}
                        placeholder={org.sigla}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Realm (Kerberos)</Label>
                      <Input
                        value={org.realm}
                        onChange={(e) => setOrg({ ...org, realm: e.target.value.toUpperCase() })}
                        placeholder={org.sigla ? `${org.sigla.toUpperCase()}.INTRAER` : ""}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Domain Controllers */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Server className="size-4" /> Domain Controllers
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>DC Primario IP *</Label>
                      <Input
                        value={org.dcPrimaryIp}
                        onChange={(e) => setOrg({ ...org, dcPrimaryIp: e.target.value })}
                        placeholder="10.1.1.10"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DC Secundario IP</Label>
                      <Input
                        value={org.dcSecondaryIp}
                        onChange={(e) => setOrg({ ...org, dcSecondaryIp: e.target.value })}
                        placeholder="10.1.1.11"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DC FQDN *</Label>
                      <Input
                        value={org.dcFqdn}
                        onChange={(e) => setOrg({ ...org, dcFqdn: e.target.value.toLowerCase() })}
                        placeholder="dc01.comara.intraer"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* DNS */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Network className="size-4" /> DNS
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>DNS Primario *</Label>
                      <Input
                        value={org.dnsPrimary}
                        onChange={(e) => setOrg({ ...org, dnsPrimary: e.target.value })}
                        placeholder={org.dcPrimaryIp || "10.1.1.10"}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DNS Secundario</Label>
                      <Input
                        value={org.dnsSecondary}
                        onChange={(e) => setOrg({ ...org, dnsSecondary: e.target.value })}
                        placeholder={org.dcSecondaryIp || "8.8.4.4"}
                        className="font-mono"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Search Domains (separados por virgula)</Label>
                      <Input
                        value={org.searchDomains}
                        onChange={(e) => setOrg({ ...org, searchDomains: e.target.value })}
                        placeholder={org.fqdn || "comara.intraer, intraer"}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* NTP */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="size-4" /> NTP e Timezone
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Servidores NTP (separados por virgula)</Label>
                      <Input
                        value={org.ntpServers}
                        onChange={(e) => setOrg({ ...org, ntpServers: e.target.value })}
                        placeholder="pool.ntp.org, ntp.ubuntu.com"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Timezone</Label>
                      <Input
                        value={org.timezone}
                        onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                        placeholder="America/Sao_Paulo"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Proxy */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3">Proxy (deixe em branco se nao houver)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>HTTP Proxy</Label>
                      <Input
                        value={org.httpProxy}
                        onChange={(e) => setOrg({ ...org, httpProxy: e.target.value })}
                        placeholder="10.108.88.4:8080"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>HTTPS Proxy</Label>
                      <Input
                        value={org.httpsProxy}
                        onChange={(e) => setOrg({ ...org, httpsProxy: e.target.value })}
                        placeholder="10.108.88.4:8080"
                        className="font-mono"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>No Proxy (separados por virgula)</Label>
                      <Input
                        value={org.noProxy}
                        onChange={(e) => setOrg({ ...org, noProxy: e.target.value })}
                        placeholder="localhost, 127.0.0.1, 10.0.0.0/8, *.intraer"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Auth */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold mb-3">Autenticacao</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Backend</Label>
                      <Select
                        value={org.authBackend}
                        onValueChange={(v) => setOrg({ ...org, authBackend: v as "sssd" | "winbind" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sssd">SSSD</SelectItem>
                          <SelectItem value="winbind">Winbind</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Metodo</Label>
                      <Select
                        value={org.authMethod}
                        onValueChange={(v) => setOrg({ ...org, authMethod: v as "ads" | "ldap" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ads">ADS (Active Directory)</SelectItem>
                          <SelectItem value="ldap">LDAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Printers */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Printer className="size-4" /> Impressoras (opcional)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Servidor CUPS</Label>
                      <Input
                        value={org.printServer}
                        onChange={(e) => setOrg({ ...org, printServer: e.target.value })}
                        placeholder="cups.comara.intraer"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Impressora Padrao</Label>
                      <Input
                        value={org.defaultPrinter}
                        onChange={(e) => setOrg({ ...org, defaultPrinter: e.target.value })}
                        placeholder="HP_LaserJet"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-md bg-muted/40 border p-4 text-xs font-mono space-y-2">
                  <div className="text-sm font-semibold">Resumo da Configuracao:</div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Organizacao:</span>
                    <span className="text-foreground">
                      {org.sigla} - {org.nome}
                    </span>
                    <span>Dominio:</span>
                    <span className="text-foreground">{org.fqdn}</span>
                    <span>DC Primario:</span>
                    <span className="text-foreground">{org.dcPrimaryIp}</span>
                    <span>Admin:</span>
                    <span className="text-foreground">{admin.email}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="size-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" onClick={submitSetup} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Concluir Configuracao
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 4: Complete */}
          {step === STEPS.length && (
            <Card>
              <CardContent className="pt-8 pb-6 text-center space-y-5">
                <div className="size-16 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-9" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">SeederLinux Configurado!</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    O sistema esta pronto para uso. Faça login com a conta administrador criada.
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 border p-4 text-xs font-mono text-left space-y-1 text-muted-foreground">
                  <p>Banco de dados inicializado</p>
                  <p>Administrador criado: {admin.email}</p>
                  <p>Organizacao configurada: {org.sigla}</p>
                  <p>Variaveis padrao criadas</p>
                  <p>Branding padrao configurado</p>
                </div>
                <Button className="w-full" size="lg" onClick={() => nav({ to: "/painel" })}>
                  Ir para o Painel
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
