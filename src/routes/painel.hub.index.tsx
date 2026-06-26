import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProfiles, useUpsertProfile } from "@/lib/seeder/profiles-api";
import { useScripts } from "@/lib/seeder/scripts-api";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Globe, Share2, Bell, ShieldCheck, Search, Download, Building2 } from "lucide-react";
import { toast } from "sonner";
import { profilesApi } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/painel/hub/")({
  head: () => ({ meta: [{ title: "SeederHub · SeederLinux" }] }),
  component: HubPage,
});

function HubPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: scripts = [] } = useScripts();
  const { data: organizations = [] } = useOrganizations();
  const upsert = useUpsertProfile();
  const qc = useQueryClient();
  const [conectado, setConectado] = useState(false);
  const [busca, setBusca] = useState("");

  const perfisPublicos = profiles.filter((p) => p.publico);
  const scriptsPublicos = scripts.filter((s) => s.compartilhado && s.status !== "rascunho");

  const filtroPerfis = perfisPublicos.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(busca.toLowerCase()),
  );
  const filtroScripts = scriptsPublicos.filter(
    (s) =>
      s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      s.descricao.toLowerCase().includes(busca.toLowerCase()),
  );

  const importarPerfil = async (perfilId: string) => {
    const original = profiles.find((p) => p.id === perfilId);
    if (!original) return;
    try {
      await profilesApi.importProfile(perfilId, organizations[0]?.sigla ?? "");
      qc.invalidateQueries({ queryKey: ["profiles_seeder"] });
      toast.success(`Perfil "${original.nome}" importado para sua instancia`);
    } catch (e) {
      toast.error(`Falha: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Federação opcional
          </p>
          <h1 className="text-3xl font-bold mt-1">SeederHub</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Catálogo federado de scripts e perfis publicados por outras OMs.
          </p>
        </div>
        <Badge variant={conectado ? "default" : "outline"} className="text-xs">
          {conectado ? "● Conectado" : "○ Desconectado"}
        </Badge>
      </div>

      {!conectado && (
        <Card className="bg-gradient-hero text-primary-foreground border-0 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-radial opacity-40" />
          <CardContent className="p-8 relative">
            <div className="max-w-2xl space-y-4">
              <Network className="size-8" />
              <h2 className="font-display text-2xl font-bold">Conecte sua instância</h2>
              <p className="text-sm text-primary-foreground/80">
                Ao conectar, você poderá publicar perfis validados e receber atualizações
                da comunidade. A sanitização automática bloqueia dados sensíveis.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => { setConectado(true); toast.success("Instância conectada ao SeederHub (modo demo)"); }}>
                  Conectar instância
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FeatureCard icon={Globe} title="Catálogo federado" desc="Scripts e perfis publicados por outras OMs." />
        <FeatureCard icon={Share2} title="Sanitização" desc="Validação automática antes de publicar." />
        <FeatureCard icon={Bell} title="Notificações" desc="Alertas de atualizações e correções." />
        <FeatureCard icon={ShieldCheck} title="Validação cruzada" desc="Marque scripts como testados em ambientes específicos." />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Catálogo público</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar perfis e scripts..."
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="perfis">
            <TabsList>
              <TabsTrigger value="perfis">Perfis ({filtroPerfis.length})</TabsTrigger>
              <TabsTrigger value="scripts">Scripts ({filtroScripts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="perfis" className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtroPerfis.map((p) => {
                const origem = organizations.find((o) => o.id === p.organizacaoOrigem);
                return (
                  <Card key={p.id} className="hover:shadow-elegant transition-all">
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="size-3" />
                          <span>{origem?.sigla ?? "Comunidade"}</span>
                        </div>
                        <div className="font-semibold mt-1">{p.nome}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.scriptIds.length} scripts
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => importarPerfil(p.id)}>
                          <Download className="size-3.5" /> Importar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtroPerfis.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  Nenhum perfil público encontrado.
                </p>
              )}
            </TabsContent>
            <TabsContent value="scripts" className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtroScripts.map((s) => (
                <Card key={s.id} className="hover:shadow-elegant transition-all">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{s.autor}</span>
                      <span>·</span>
                      <span className="font-mono">v{s.versao}</span>
                    </div>
                    <div className="font-mono text-sm font-semibold">{s.nome}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className="text-[10px]">{s.categoria}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {s.variaveisUsadas.length} vars
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtroScripts.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  Nenhum script público encontrado.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Icon className="size-5 text-primary" />
        <CardTitle className="text-base mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
