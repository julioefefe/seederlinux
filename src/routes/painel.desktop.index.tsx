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
import { Cpu, Loader as Loader2, Save, Volume2, Monitor, Keyboard, Bell, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/painel/desktop/")({
  head: () => ({ meta: [{ title: "Politicas Desktop - SeederLinux" }] }),
  component: DesktopPoliciesPage,
});

const THEMES = [
  { value: "Mint-Y-Dark", label: "Mint-Y-Dark (Padrao FAB)" },
  { value: "Mint-Y", label: "Mint-Y (Claro)" },
  { value: "Adwaita-dark", label: "Adwaita Dark" },
  { value: "Arc-Dark", label: "Arc Dark" },
];

const SOUND_SCHEMES = [
  { value: "default", label: "Padrao do Sistema" },
  { value: "silent", label: "Silencioso" },
  { value: "minimal", label: "Minimal (apenas alertas)" },
];

interface DesktopPolicy {
  orgId: string;
  theme: string;
  iconTheme: string;
  cursorTheme: string;
  font: string;
  soundsEnabled: boolean;
  soundScheme: string;
  notificationsEnabled: boolean;
  screensaverEnabled: boolean;
  screensaverTimeout: number;
  powerTimeout: number;
}

interface UserRoleRow {
  id: string;
  role: AppRole;
  org_sigla: string | null;
}

function DesktopPoliciesPage() {
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
  const [form, setForm] = useState<DesktopPolicy>({
    orgId: "",
    theme: "Mint-Y-Dark",
    iconTheme: "Mint-Y",
    cursorTheme: "DMZ-White",
    font: "Noto Sans 10",
    soundsEnabled: false,
    soundScheme: "minimal",
    notificationsEnabled: true,
    screensaverEnabled: true,
    screensaverTimeout: 300,
    powerTimeout: 600,
  });

  useEffect(() => {
    if (orgOptions.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgOptions[0].id);
    }
  }, [orgOptions, selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId) return toast.error("Selecione uma organizacao");
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Politicas de desktop salvas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

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
        <Monitor className="size-10 mx-auto text-muted-foreground" />
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
            Personalizacao
          </p>
          <h1 className="text-3xl font-bold mt-1 flex items-center gap-2">
            <Cpu className="size-7" /> Politicas Desktop
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure tema, sons, protecao de tela e energia para as estacoes.
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

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="appearance"><Monitor className="size-4 mr-1.5" /> Aparencia</TabsTrigger>
          <TabsTrigger value="sounds"><Volume2 className="size-4 mr-1.5" /> Sons</TabsTrigger>
          <TabsTrigger value="power"><Cpu className="size-4 mr-1.5" /> Energia</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="size-4 mr-1.5" /> Notificacoes</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tema GTK</CardTitle>
                <CardDescription>Tema visual do ambiente desktop</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={form.theme}
                  onValueChange={(v) => setForm((p) => ({ ...p, theme: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tema de Icones</CardTitle>
                <CardDescription>Conjunto de icones do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={form.iconTheme}
                  onChange={(e) => setForm((p) => ({ ...p, iconTheme: e.target.value }))}
                  placeholder="Mint-Y"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tema de Cursor</CardTitle>
                <CardDescription>Estilo do ponteiro do mouse</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={form.cursorTheme}
                  onChange={(e) => setForm((p) => ({ ...p, cursorTheme: e.target.value }))}
                  placeholder="DMZ-White"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Fonte do Sistema</CardTitle>
                <CardDescription>Fonte padrao para interface</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={form.font}
                  onChange={(e) => setForm((p) => ({ ...p, font: e.target.value }))}
                  placeholder="Noto Sans 10"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sounds">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Volume2 className="size-4" /> Eventos de Som
              </CardTitle>
              <CardDescription>Sons de notificacao e alertas do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Habilitar Sons do Sistema</Label>
                  <p className="text-[10px] text-muted-foreground">Reproduz sons em eventos (login, logout, erros)</p>
                </div>
                <Switch
                  checked={form.soundsEnabled}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, soundsEnabled: v }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Esquema de Som</Label>
                <Select
                  value={form.soundScheme}
                  onValueChange={(v) => setForm((p) => ({ ...p, soundScheme: v }))}
                  disabled={!form.soundsEnabled}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOUND_SCHEMES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="power">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="size-4" /> Protecao de Tela
                </CardTitle>
                <CardDescription>Bloqueio automatico de tela</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Habilitar Protecao de Tela</Label>
                  <Switch
                    checked={form.screensaverEnabled}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, screensaverEnabled: v }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeout (segundos)</Label>
                  <Input
                    type="number"
                    value={form.screensaverTimeout}
                    onChange={(e) => setForm((p) => ({ ...p, screensaverTimeout: Number(e.target.value) }))}
                    disabled={!form.screensaverEnabled}
                  />
                  <p className="text-[10px] text-muted-foreground">Tempo ate bloqueio automatico</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Gerenciamento de Energia</CardTitle>
                <CardDescription>Suspensao automatica</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Suspender apos (segundos)</Label>
                  <Input
                    type="number"
                    value={form.powerTimeout}
                    onChange={(e) => setForm((p) => ({ ...p, powerTimeout: Number(e.target.value) }))}
                  />
                  <p className="text-[10px] text-muted-foreground">0 = nunca suspender</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="size-4" /> Notificacoes do Sistema
              </CardTitle>
              <CardDescription>Alertas visuais para eventos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Habilitar Notificacoes</Label>
                  <p className="text-[10px] text-muted-foreground">Exibe notificacoes desktop para eventos do sistema</p>
                </div>
                <Switch
                  checked={form.notificationsEnabled}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, notificationsEnabled: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            As politicas de desktop sao aplicadas via script CORE-006 (Aplicacao de Branding) e afetam
            todas as estacoes da OM. Configuracoes individuais podem ser sobrescritas pelo usuario.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
