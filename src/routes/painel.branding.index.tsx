import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth/AuthProvider";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { useBranding, useUpsertBranding, type BrandingConfig } from "@/lib/seeder/branding-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Palette, Loader as Loader2, Save, Image, Box, Monitor, Sparkles, Link as LinkIcon, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/painel/branding/")({
  head: () => ({ meta: [{ title: "Personalizacao - SeederLinux" }] }),
  component: BrandingPage,
});

const THEMES = [
  { value: "Mint-Y-Dark", label: "Mint-Y-Dark (Verde FAB)" },
  { value: "Adwaita-dark", label: "Adwaita Dark" },
  { value: "Arc-Dark", label: "Arc Dark" },
  { value: "Numix", label: "Numix" },
  { value: "Flat-Remix-GTK", label: "Flat Remix" },
  { value: "Mint-Y", label: "Mint-Y (Claro)" },
];

interface UserRoleRow {
  id: string;
  role: AppRole;
  org_sigla: string | null;
}

function BrandingPage() {
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
  const { data: branding, isLoading: brandingLoading } = useBranding(selectedOrgId);
  const upsert = useUpsertBranding();

  const [form, setForm] = useState<BrandingConfig>({
    orgId: "",
    displayName: null,
    wallpaperUrl: null,
    wallpaperLogin: null,
    logoUrl: null,
    greeterUrl: null,
    theme: "Mint-Y-Dark",
    conkyEnabled: false,
    conkyConfig: {},
    shortcutsEnabled: true,
    updatedAt: "",
  });

  useEffect(() => {
    if (orgOptions.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgOptions[0].id);
    }
  }, [orgOptions, selectedOrgId]);

  useEffect(() => {
    if (branding) {
      setForm(branding);
    } else if (selectedOrgId) {
      const org = orgs.find((o) => o.id === selectedOrgId);
      setForm({
        orgId: selectedOrgId,
        displayName: org?.nome || null,
        wallpaperUrl: null,
        wallpaperLogin: null,
        logoUrl: null,
        greeterUrl: null,
        theme: "Mint-Y-Dark",
        conkyEnabled: false,
        conkyConfig: {},
        shortcutsEnabled: true,
        updatedAt: "",
      });
    }
  }, [branding, selectedOrgId, orgs]);

  async function handleSave() {
    if (!selectedOrgId) return toast.error("Selecione uma organizacao");
    try {
      await upsert.mutateAsync({ ...form, orgId: selectedOrgId });
      toast.success("Personalizacao salva");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const parseConkyConfig = (value: string) => {
    try {
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  };

  if (orgsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando organizacoes...
      </div>
    );
  }

  if (orgOptions.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-3">
        <Palette className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">Nenhuma OM disponivel</h1>
        <p className="text-sm text-muted-foreground">
          Voce precisa ser <strong>admin GAP</strong> ou <strong>operador OM</strong> de uma organizacao para personalizar.
        </p>
        <Link to="/painel/organizacoes" className="inline-block mt-4">
          <Button variant="outline" size="sm">
            <Building2 className="size-4 mr-1.5" /> Gerenciar Organizacoes
          </Button>
        </Link>
      </div>
    );
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Identidade visual
          </p>
          <h1 className="text-3xl font-bold mt-1 flex items-center gap-2">
            <Palette className="size-7" /> Personalizacao
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure wallpaper, logo, tema GTK e Conky por organizacao.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a OM" />
            </SelectTrigger>
            <SelectContent>
              {orgOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: o.cor }}
                    />
                    {o.sigla}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={upsert.isPending || !selectedOrgId}>
            {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
            <Save className="size-4" /> Salvar
          </Button>
        </div>
      </div>

      {selectedOrg && (
        <Card className="bg-muted/30">
          <CardContent className="flex items-center gap-4 py-4">
          <div
              className="size-12 rounded-lg grid place-items-center font-bold text-xl text-primary-foreground"
              style={{ backgroundColor: selectedOrg.cor }}
            >
              {selectedOrg.sigla.slice(0, 3)}
            </div>
            <div>
              <div className="font-semibold">{selectedOrg.sigla}</div>
              <div className="text-sm text-muted-foreground">{selectedOrg.nome}</div>
            </div>
            <Badge variant="outline" className="ml-auto">{selectedOrg.fqdn || selectedOrg.dominio}</Badge>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="wallpaper" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wallpaper"><Image className="size-4 mr-1.5" /> Imagens</TabsTrigger>
          <TabsTrigger value="desktop"><Monitor className="size-4 mr-1.5" /> Desktop</TabsTrigger>
          <TabsTrigger value="advanced"><Sparkles className="size-4 mr-1.5" /> Avancado</TabsTrigger>
        </TabsList>

        <TabsContent value="wallpaper" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="size-4" /> Wallpaper Desktop
                </CardTitle>
                <CardDescription>Imagem de fundo do ambiente desktop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="URL do Wallpaper">
                  <Input
                    value={form.wallpaperUrl ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, wallpaperUrl: e.target.value || null }))}
                    placeholder="https://exemplo.com/wallpaper.png"
                  />
                </Field>
                {form.wallpaperUrl && (
                  <div className="rounded-md border overflow-hidden bg-muted/50">
                    <img src={form.wallpaperUrl} alt="Preview" className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="size-4" /> Wallpaper de Login
                </CardTitle>
                <CardDescription>Imagem de fundo da tela de login (greeter)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="URL do Wallpaper Login">
                  <Input
                    value={form.wallpaperLogin ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, wallpaperLogin: e.target.value || null }))}
                    placeholder="https://exemplo.com/login.png"
                  />
                </Field>
                {form.wallpaperLogin && (
                  <div className="rounded-md border overflow-hidden bg-muted/50">
                    <img src={form.wallpaperLogin} alt="Preview Login" className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Box className="size-4" /> Logo da OM
                </CardTitle>
                <CardDescription>Logo exibido no desktop e aplicativos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="URL do Logo">
                  <Input
                    value={form.logoUrl ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value || null }))}
                    placeholder="https://exemplo.com/logo.png"
                  />
                </Field>
                {form.logoUrl && (
                  <div className="rounded-md border p-4 bg-muted/50 flex justify-center">
                    <img src={form.logoUrl} alt="Logo" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="size-4" /> Greeter (MDM/LightDM)
                </CardTitle>
                <CardDescription>HTML/JS customizado para tela de login</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="URL do Greeter">
                  <Input
                    value={form.greeterUrl ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, greeterUrl: e.target.value || null }))}
                    placeholder="https://exemplo.com/greeter.html"
                  />
                </Field>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="desktop" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Nome de Exibicao</CardTitle>
                <CardDescription>Nome amigavel exibido no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Field label="Display Name">
                  <Input
                    value={form.displayName ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value || null }))}
                    placeholder={selectedOrg?.nome || "COMARA - Comando de Apoio"}
                  />
                </Field>
              </CardContent>
            </Card>

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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Conky (Monitor de Sistema)</CardTitle>
                <CardDescription>Widget de monitoramento no desktop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Habilitar Conky</Label>
                  <Switch
                    checked={form.conkyEnabled}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, conkyEnabled: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Atalhos de Desktop</CardTitle>
                <CardDescription>Icones e atalhos pre-configurados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Criar atalhos padrao</Label>
                  <Switch
                    checked={form.shortcutsEnabled}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, shortcutsEnabled: v }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Inclui atalhos para Firefox, LibreOffice, Thunderbird e Pasta do Usuario.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configuracao Conky (JSON)</CardTitle>
              <CardDescription>
                Objeto JSON com configuracoes avancadas do Conky (posicao, cores, fonte, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={JSON.stringify(form.conkyConfig, null, 2)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, conkyConfig: parseConkyConfig(e.target.value) }))
                }
                rows={10}
                className="font-mono text-xs"
                placeholder={`{
  "alignment": "top_right",
  "own_window": true,
  "background": true,
  "font": "JetBrains Mono:size=10",
  "default_color": "white"
}`}
              />
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">
                <LinkIcon className="size-3 inline mr-1" />
                As imagens devem estar hospedadas em servidor acessivel pelas estacoes (http/https).
                Para upload de arquivos, utilize o SeedHub (Fase 4).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
