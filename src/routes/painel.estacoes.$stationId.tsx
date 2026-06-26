import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useStation } from "@/lib/seeder/stations";
import { useStationRuns } from "@/lib/seeder/station-runs";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StationTokensDialog } from "@/components/seeder/StationTokensDialog";
import { StationRunsDialog } from "@/components/seeder/StationRunsDialog";
import { StationFormDialog } from "@/components/seeder/StationFormDialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ArrowLeft, Monitor, Network, Cpu, Clock, Hash, Building2,
  CheckCircle2, AlertTriangle, MinusCircle, Loader2, KeyRound,
  History, Pencil, Activity, Server, User, HardDrive
} from "lucide-react";

export const Route = createFileRoute("/painel/estacoes/$stationId")({
  head: ({ params }) => ({ meta: [{ title: `${params.stationId} · Estações · SeederLinux` }] }),
  component: StationDetailPage,
});

const STATUS_META: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  atrasada: { label: "Atrasada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: Clock },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  nunca: { label: "Nunca conectou", className: "bg-muted text-muted-foreground border-border", Icon: MinusCircle },
  registered: { label: "Registrada", className: "bg-blue-500/15 text-blue-700 border-blue-500/30", Icon: Server },
  online: { label: "Online", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  offline: { label: "Offline", className: "bg-muted text-muted-foreground border-border", Icon: MinusCircle },
  blocked: { label: "Bloqueada", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  decommissioned: { label: "Desativada", className: "bg-muted text-muted-foreground border-border", Icon: MinusCircle },
};

function rel(iso: string) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

function fmt(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function StationDetailPage() {
  const { stationId } = useParams({ from: "/painel/estacoes/$stationId" });
  const nav = useNavigate();
  const { data: station, isLoading, error } = useStation(stationId);
  const { data: organizations = [] } = useOrganizations();
  const { data: runs = [] } = useStationRuns(stationId, 5);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin_gap");
  const isOperator = hasRole("operador_om");
  const canEdit = isAdmin || isOperator;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Carregando estação…
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="space-y-4 py-12 text-center">
        <Monitor className="size-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Estação não encontrada.</p>
        <Link to="/painel/estacoes" className="text-primary underline text-sm">
          Voltar para estações
        </Link>
      </div>
    );
  }

  const org = organizations.find((o) => o.id === station.orgId);
  const orgSerial = org?.serial ?? 0;
  const desatualizada = station.serialAplicado > 0 && station.serialAplicado < orgSerial;
  const meta = STATUS_META[station.status] ?? STATUS_META.nunca;
  const StatusIcon = meta.Icon;
  const pendingJobs = runs.filter((r: any) => r.status === "pending" || r.status === "running").length;

  return (
    <div className="space-y-6">
      <Link to="/painel/estacoes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Estações
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`gap-1 ${meta.className}`}>
              <StatusIcon className="size-3" />
              {meta.label}
            </Badge>
            {desatualizada && (
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                desatualizada
              </Badge>
            )}
          </div>
          <h1 className="font-mono text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Monitor className="size-7 text-primary" />
            {station.hostname}
          </h1>
          <p className="text-muted-foreground">
            Estação Linux gerenciada pelo SeederLinux
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <StationRunsDialog
              stationId={station.id}
              hostname={station.hostname}
              trigger={
                <Button variant="outline">
                  <History className="size-4" /> Histórico
                </Button>
              }
            />
            <StationTokensDialog
              stationId={station.id}
              hostname={station.hostname}
              trigger={
                <Button variant="outline">
                  <KeyRound className="size-4" /> Tokens
                </Button>
              }
            />
            <StationFormDialog
              station={station}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" /> Editar
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard
          icon={Building2}
          label="Organização"
          value={org ? org.sigla : "—"}
          sub={org?.nome ?? ""}
          link={org ? `/painel/organizacoes/${org.id}` : undefined}
        />
        <InfoCard
          icon={Activity}
          label="Status"
          value={meta.label}
          iconColor={meta.className}
        />
        <InfoCard
          icon={Clock}
          label="Último check-in"
          value={rel(station.ultimoCheckin)}
          sub={fmt(station.ultimoCheckin)}
        />
        <InfoCard
          icon={Hash}
          label="Serial aplicado"
          value={String(station.serialAplicado || "—")}
          sub={desatualizada ? `atual: ${orgSerial}` : undefined}
          subColor="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="size-4 text-primary" /> Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow icon={HardDrive} label="Distribuição" value={station.distro || "—"} />
            <DetailRow icon={Monitor} label="Ambiente Desktop" value={station.desktop || "—"} />
            <DetailRow icon={Cpu} label="Kernel" value={station.kernelVersion || "—"} />
            <DetailRow icon={Server} label="Agente" value={station.agentVersion ? `v${station.agentVersion}` : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="size-4 text-primary" /> Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow icon={Network} label="Endereço IP" value={station.ip || "—"} mono />
            <DetailRow icon={User} label="Usuário" value={station.usuario || "—"} />
            <DetailRow icon={Hash} label="Asset Tag" value={station.assetTag || "—"} mono />
            <DetailRow icon={Hash} label="Serial Number" value={station.serialNumber || "—"} mono />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Execuções recentes
            </CardTitle>
            <CardDescription>Últimas aplicações de perfil reportadas pelo agente</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma execução registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 5).map((r: any) => {
                  const ok = r.status === "ok";
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-md border ${ok ? "" : "border-destructive/40 bg-destructive/5"}`}
                    >
                      <div className="flex items-center gap-2">
                        {ok ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="size-4 text-destructive" />
                        )}
                        <span className="text-xs text-muted-foreground">{fmt(r.finishedAt)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>serial <span className="font-mono">{r.serialAnterior}</span> → <span className="font-mono">{r.serialAlvo}</span></span>
                        <span>scripts <span className="font-mono">{r.scriptsOk}/{r.scriptsTotal}</span></span>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => nav({ to: "/painel/estacoes" })}>
                  Ver histórico completo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="size-4 text-primary" /> Perfil e provisionamento
            </CardTitle>
            <CardDescription>Perfil ativo e estado do provisionamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow icon={Server} label="Perfil ativo" value={station.perfilAtivo || "Nenhum"} mono />
            <DetailRow icon={Activity} label="Jobs pendentes" value={String(pendingJobs)} />
            <DetailRow icon={Clock} label="Registrada em" value={fmt(station.ultimoCheckin || "")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  subColor,
  iconColor,
  link,
}: {
  icon: typeof Monitor;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  iconColor?: string;
  link?: string;
}) {
  const content = (
    <Card className="h-full hover:shadow-elegant transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={`size-10 rounded-md grid place-items-center shrink-0 ${iconColor ?? "bg-primary/10 text-primary"}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-lg font-bold mt-0.5 truncate">{value}</p>
            {sub && <p className={`text-xs mt-0.5 truncate ${subColor ?? "text-muted-foreground"}`}>{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (link) {
    return <Link to={link as any}>{content}</Link>;
  }
  return content;
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Monitor;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <span className={`text-sm text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
