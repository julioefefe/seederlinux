import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Monitor, Search, AlertTriangle, CheckCircle2, Clock, MinusCircle, Loader2, Plus, Pencil, Trash2, KeyRound, History, Info } from "lucide-react";
import { useStations, useDeleteStation, type StationStatus } from "@/lib/seeder/stations";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { StationFormDialog } from "@/components/seeder/StationFormDialog";
import { StationTokensDialog } from "@/components/seeder/StationTokensDialog";
import { StationRunsDialog } from "@/components/seeder/StationRunsDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/painel/estacoes/")({
  head: () => ({ meta: [{ title: "Estações · SeederLinux" }] }),
  component: EstacoesPage,
});

const STATUS_LABEL: Record<StationStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  atrasada: { label: "Atrasada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: Clock },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  nunca: { label: "Nunca conectou", className: "bg-muted text-muted-foreground border-border", Icon: MinusCircle },
};

function rel(iso: string) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

function EstacoesPage() {
  const { data: organizations = [] } = useOrganizations();
  const { data: stations = [], isLoading } = useStations();
  const { hasRole } = useAuth();
  const del = useDeleteStation();
  const isAdmin = hasRole("admin_gap");
  const isOperator = hasRole("operador_om");
  const canCreate = isAdmin || isOperator;
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return stations.filter((s) => {
      if (orgFilter !== "all" && s.orgId !== orgFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q && !`${s.hostname} ${s.ip} ${s.usuario ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [stations, q, orgFilter, statusFilter]);

  const stats = useMemo(() => {
    const c = { total: stations.length, ok: 0, atrasada: 0, erro: 0, nunca: 0 };
    stations.forEach((s) => (c[s.status] += 1));
    return c;
  }, [stations]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Inventário</p>
          <h1 className="text-3xl font-bold mt-1">Estações</h1>
          <p className="text-muted-foreground mt-1">
            Estações Linux gerenciadas, último check-in e serial aplicado por OM.
          </p>
        </div>
        {canCreate && (
          <StationFormDialog
            trigger={<Button><Plus className="size-4" /> Nova estação</Button>}
          />
        )}
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Fluxo de cadastro:</strong> As estações são criadas automaticamente quando o <strong>SeederAgent</strong> faz o primeiro check-in.
          Use o botão "Nova estação" apenas para registro manual. O fluxo recomendado é: instalar o SeederAgent na estação →
          gerar token de check-in → o agente reporta e a estação aparece no inventário.
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="OK" value={stats.ok} tone="ok" />
        <Stat label="Atrasadas" value={stats.atrasada} tone="warn" />
        <Stat label="Erro" value={stats.erro} tone="err" />
        <Stat label="Nunca conectou" value={stats.nunca} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="size-4 text-primary" /> Lista de estações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="hostname, IP, usuário..."
                className="pl-9"
              />
            </div>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as OMs</SelectItem>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.sigla}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="nunca">Nunca conectou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead>OM</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Distro / DE</TableHead>
                  <TableHead>Serial aplicado</TableHead>
                  <TableHead>Último check-in</TableHead>
                  <TableHead>Status</TableHead>
                  {canCreate && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const org = organizations.find((o) => o.id === s.orgId);
                  const orgSerial = org?.serial ?? 0;
                  const desatualizada = s.serialAplicado > 0 && s.serialAplicado < orgSerial;
                  const meta = STATUS_LABEL[s.status];
                  const Icon = meta.Icon;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link to="/painel/estacoes/$stationId" params={{ stationId: s.id }} className="font-mono text-xs text-primary hover:underline">
                          {s.hostname}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {org ? (
                          <Link to="/painel/organizacoes/$orgId" params={{ orgId: org.id }} className="text-primary hover:underline">
                            {org.sigla}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ip}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{s.distro}</span>
                        <span className="text-muted-foreground"> · {s.desktop}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{s.serialAplicado || "—"}</span>
                        {desatualizada && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-700">
                            desatualizada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rel(s.ultimoCheckin)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                          <Icon className="size-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      {canCreate && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <StationRunsDialog
                              stationId={s.id}
                              hostname={s.hostname}
                              trigger={
                                <Button variant="ghost" size="icon" className="size-8" title="Histórico de execuções">
                                  <History className="size-3.5" />
                                </Button>
                              }
                            />
                            <StationFormDialog
                              station={s}
                              trigger={
                                <Button variant="ghost" size="icon" className="size-8" title="Editar">
                                  <Pencil className="size-3.5" />
                                </Button>
                              }
                            />
                            <StationTokensDialog
                              stationId={s.id}
                              hostname={s.hostname}
                              trigger={
                                <Button variant="ghost" size="icon" className="size-8" title="Tokens de check-in">
                                  <KeyRound className="size-3.5" />
                                </Button>
                              }
                            />
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir estação?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      A estação <span className="font-mono">{s.hostname}</span> será removida do inventário. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        try {
                                          await del.mutateAsync(s.id);
                                          toast.success(`${s.hostname} excluída`);
                                        } catch (e) {
                                          toast.error(`Falha: ${(e as Error).message}`);
                                        }
                                      }}
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {!isLoading && !filtered.length && (
                  <TableRow>
                    <TableCell colSpan={canCreate ? 8 : 7} className="text-center text-sm text-muted-foreground py-10">
                      {stations.length === 0
                        ? "Nenhuma estação cadastrada ainda."
                        : "Nenhuma estação corresponde aos filtros."}
                    </TableCell>
                  </TableRow>
                )}
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={canCreate ? 8 : 7} className="text-center py-10">
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin mr-2" /> Carregando inventário…
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "ok" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "err" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
