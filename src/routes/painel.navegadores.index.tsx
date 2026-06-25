import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth/AuthProvider";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Loader as Loader2, Save, Shield, Eye, X, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/painel/navegadores/")({
  head: () => ({ meta: [{ title: "Politicas de Navegadores - SeederLinux" }] }),
  component: BrowserPoliciesPage,
});

interface BrowserPolicy {
  browser: "firefox" | "chrome" | "chromium";
  homepage: string;
  bookmarksEnabled: boolean;
  proxyEnabled: boolean;
  certificatesEnabled: boolean;
  telemetryDisabled: boolean;
  updatesDisabled: boolean;
}

interface PolicyState {
  orgId: string;
  firefox: BrowserPolicy;
  chrome: BrowserPolicy;
  chromium: BrowserPolicy;
  javaSites: string[];
}

const DEFAULT_POLICY: BrowserPolicy = {
  browser: "firefox",
  homepage: "",
  bookmarksEnabled: false,
  proxyEnabled: true,
  certificatesEnabled: true,
  telemetryDisabled: true,
  updatesDisabled: false,
};

interface UserRoleRow {
  id: string;
  role: AppRole;
  org_sigla: string | null;
}

function BrowserPoliciesPage() {
  const { hasRole, user } = useAuth();
  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations();
  const isAdmin = hasRole("admin_gap");
  const [userRolesWithOrg, setUserRolesWithOrg] = useState<UserRoleRow[]>([]);

  useEffect(() => {
    if (user?.roles && !isAdmin) {
      setUserRolesWithOrg(user.roles as UserRoleRow[]);
    }
  }, [user?.roles, isAdmin]);

  const orgOptions = isAdmin
    ? orgs
    : orgs.filter((o) =>
        userRolesWithOrg.some((ur) => ur.role === "operador_om" && ur.org_sigla === o.sigla),
      );

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PolicyState>({
    orgId: "",
    firefox: { ...DEFAULT_POLICY, browser: "firefox" },
    chrome: { ...DEFAULT_POLICY, browser: "chrome" },
    chromium: { ...DEFAULT_POLICY, browser: "chromium" },
    javaSites: [],
  });
  const [newJavaSite, setNewJavaSite] = useState("");

  useEffect(() => {
    if (orgOptions.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgOptions[0].id);
    }
  }, [orgOptions, selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId) return toast.error("Selecione uma organizacao");
    setSaving(true);
    try {
      // In production, this would call the API
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Politicas de navegadores salvas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const updateBrowserPolicy = (browser: "firefox" | "chrome" | "chromium", updates: Partial<BrowserPolicy>) => {
    setForm((p) => ({
      ...p,
      [browser]: { ...p[browser], ...updates },
    }));
  };

  const addJavaSite = () => {
    if (!newJavaSite.trim()) return;
    if (form.javaSites.includes(newJavaSite.trim())) {
      toast.error("Site ja adicionado");
      return;
    }
    setForm((p) => ({ ...p, javaSites: [...p.javaSites, newJavaSite.trim()] }));
    setNewJavaSite("");
  };

  const removeJavaSite = (site: string) => {
    setForm((p) => ({ ...p, javaSites: p.javaSites.filter((s) => s !== site) }));
  };

  if (orgsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (orgOptions.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-3">
        <Globe className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">Nenhuma OM disponivel</h1>
        <p className="text-sm text-muted-foreground">
          Voce precisa ter acesso a uma organizacao para configurar politicas.
        </p>
        <Link to="/painel/organizacoes" className="inline-block mt-4">
          <Button variant="outline" size="sm">
            <Building2 className="size-4 mr-1.5" /> Gerenciar Organizacoes
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Politicas
          </p>
          <h1 className="text-3xl font-bold mt-1 flex items-center gap-2">
            <Globe className="size-7" /> Navegadores
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure homepage, proxy, telemetria e certificados para Firefox, Chrome e Chromium.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a OM" />
            </SelectTrigger>
            <SelectContent>
              {orgOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: o.cor }} />
                    {o.sigla}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving || !selectedOrgId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            <Save className="size-4" /> Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="firefox" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="firefox">
            <Badge variant="outline" className="mr-2 bg-orange-500/10 text-orange-700 border-orange-500/30">FF</Badge>
            Firefox
          </TabsTrigger>
          <TabsTrigger value="chrome">
            <Badge variant="outline" className="mr-2 bg-blue-500/10 text-blue-700 border-blue-500/30">CH</Badge>
            Chrome
          </TabsTrigger>
          <TabsTrigger value="chromium">
            <Badge variant="outline" className="mr-2 bg-sky-500/10 text-sky-700 border-sky-500/30">CR</Badge>
            Chromium
          </TabsTrigger>
          <TabsTrigger value="java">
            <Badge variant="outline" className="mr-2">Java</Badge>
            Excecoes Java
          </TabsTrigger>
        </TabsList>

        {(["firefox", "chrome", "chromium"] as const).map((browser) => (
          <TabsContent key={browser} value={browser}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm capitalize flex items-center gap-2">
                  {browser === "firefox" && "Mozilla Firefox"}
                  {browser === "chrome" && "Google Chrome"}
                  {browser === "chromium" && "Chromium Browser"}
                </CardTitle>
                <CardDescription>
                  Politicas aplicadas via arquivos de configuracao do navegador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Homepage">
                    <Input
                      value={form[browser].homepage}
                      onChange={(e) => updateBrowserPolicy(browser, { homepage: e.target.value })}
                      placeholder="https://intranet.om.intraer"
                    />
                  </Field>
                  <div className="space-y-4">
                    <Toggle
                      label="Usar Proxy do Sistema"
                      checked={form[browser].proxyEnabled}
                      onChange={(v) => updateBrowserPolicy(browser, { proxyEnabled: v })}
                      hint="Aplica configuracoes de proxy da OM"
                    />
                    <Toggle
                      label="Certificados Institucionais"
                      checked={form[browser].certificatesEnabled}
                      onChange={(v) => updateBrowserPolicy(browser, { certificatesEnabled: v })}
                      hint="Importa certificados SSL da FAB"
                    />
                    <Toggle
                      label="Desabilitar Telemetria"
                      checked={form[browser].telemetryDisabled}
                      onChange={(v) => updateBrowserPolicy(browser, { telemetryDisabled: v })}
                      hint="Desativa envio de dados de uso"
                    />
                    <Toggle
                      label="Desabilitar Atualizacoes Automaticas"
                      checked={form[browser].updatesDisabled}
                      onChange={(v) => updateBrowserPolicy(browser, { updatesDisabled: v })}
                      hint="Atualizacoes controladas pelo GAP"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="java">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="size-4" /> Excecoes de Seguranca Java
              </CardTitle>
              <CardDescription>
                Lista de sites confiaveis para execucao de applets Java
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newJavaSite}
                  onChange={(e) => setNewJavaSite(e.target.value)}
                  placeholder="https://sistema.om.intraer"
                  onKeyDown={(e) => e.key === "Enter" && addJavaSite()}
                />
                <Button variant="outline" onClick={addJavaSite}>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.javaSites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum site adicionado.</p>
                ) : (
                  form.javaSites.map((site) => (
                    <div
                      key={site}
                      className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30"
                    >
                      <span className="font-mono text-xs truncate">{site}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => removeJavaSite(site)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Eye className="size-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              As politicas serao aplicadas durante o provisionamento da estacao via script CORE-006 (Aplicacao de Branding).
              Para navegadores, sao criados arquivos policies.json (Firefox) ou arquivos de gerenciamento (Chrome/Chromium).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label className="text-xs">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
