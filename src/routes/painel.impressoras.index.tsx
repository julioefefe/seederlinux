import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth/AuthProvider";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Loader as Loader2, Save, Plus, Pencil, Trash2, Check, Server, Building2 } from "lucide-react";
import { toast } from "sonner";
import { printerProfilesApi } from "@/lib/api/client";

export const Route = createFileRoute("/painel/impressoras/")({
  head: () => ({ meta: [{ title: "Impressoras - SeederLinux" }] }),
  component: PrintersPage,
});

interface PrinterQueue {
  id: string;
  name: string;
  location: string;
  driver: string;
  uri: string;
  isDefault: boolean;
}

interface PrinterProfile {
  orgId: string;
  cupsServer: string;
  queues: PrinterQueue[];
}

interface UserRoleRow {
  id: string;
  role: AppRole;
  org_sigla: string | null;
}

function PrintersPage() {
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
  const [form, setForm] = useState<PrinterProfile>({
    orgId: "",
    cupsServer: "",
    queues: [],
  });

  const [editingQueue, setEditingQueue] = useState<PrinterQueue | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (orgOptions.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgOptions[0].id);
    }
  }, [orgOptions, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      const org = orgs.find((o) => o.id === selectedOrgId);
      setForm({
        orgId: selectedOrgId,
        cupsServer: org?.printServer || "",
        queues: [],
      });
    }
  }, [selectedOrgId, orgs]);

  async function handleSave() {
    if (!selectedOrgId) return toast.error("Selecione uma organizacao");
    setSaving(true);
    try {
      await printerProfilesApi.upsert({
        orgId: selectedOrgId,
        name: `${orgs.find(o => o.id === selectedOrgId)?.sigla ?? "OM"} Print Profile`,
        cupsServer: form.cupsServer,
        defaultQueue: form.queues.find(q => q.isDefault)?.name || null,
      });
      toast.success("Configuracao de impressoras salva");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const addQueue = (queue: PrinterQueue) => {
    setForm((p) => ({
      ...p,
      queues: [...p.queues, { ...queue, id: crypto.randomUUID() }],
    }));
    setShowForm(false);
    setEditingQueue(null);
  };

  const updateQueue = (id: string, updates: Partial<PrinterQueue>) => {
    setForm((p) => ({
      ...p,
      queues: p.queues.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    }));
  };

  const removeQueue = (id: string) => {
    setForm((p) => ({
      ...p,
      queues: p.queues.filter((q) => q.id !== id),
    }));
  };

  const setDefaultQueue = (id: string) => {
    setForm((p) => ({
      ...p,
      queues: p.queues.map((q) => ({ ...q, isDefault: q.id === id })),
    }));
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
        <Printer className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">Nenhuma OM disponivel</h1>
        <p className="text-sm text-muted-foreground">
          Voce precisa ter acesso a uma organizacao para configurar impressoras.
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
            Perifericos
          </p>
          <h1 className="text-3xl font-bold mt-1 flex items-center gap-2">
            <Printer className="size-7" /> Impressoras
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure o servidor CUPS e filas de impressao por OM.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="size-4" /> Servidor CUPS
          </CardTitle>
          <CardDescription>
            Endereco do servidor de impressao centralizado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">URL do Servidor CUPS</Label>
              <Input
                value={form.cupsServer}
                onChange={(e) => setForm((p) => ({ ...p, cupsServer: e.target.value }))}
                placeholder="http://cups.om.intraer:631"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground pb-2">
                O servidor CUPS deve estar acessivel pelas estacoes da OM.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Filas de Impressao</CardTitle>
            <CardDescription>Impressoras disponiveis para as estacoes</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setShowForm(true); setEditingQueue(null); }}>
            <Plus className="size-4" /> Adicionar Fila
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome da Fila</Label>
                    <Input
                      value={editingQueue?.name || ""}
                      onChange={(e) => setEditingQueue((q) => q ? { ...q, name: e.target.value } : null)}
                      placeholder="HP_LaserJet_P2035"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Localizacao</Label>
                    <Input
                      value={editingQueue?.location || ""}
                      onChange={(e) => setEditingQueue((q) => q ? { ...q, location: e.target.value } : null)}
                      placeholder="Sala 101"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Driver (PPD)</Label>
                    <Input
                      value={editingQueue?.driver || ""}
                      onChange={(e) => setEditingQueue((q) => q ? { ...q, driver: e.target.value } : null)}
                      placeholder="hp-laserjet-p2035.ppd"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">URI (ipp/socket)</Label>
                    <Input
                      value={editingQueue?.uri || ""}
                      onChange={(e) => setEditingQueue((q) => q ? { ...q, uri: e.target.value } : null)}
                      placeholder="ipp://10.108.1.50/ipp/print"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingQueue(null); }}>Cancelar</Button>
                  <Button size="sm" onClick={() => editingQueue && addQueue(editingQueue)} disabled={!editingQueue?.name}>
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {form.queues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma fila de impressao configurada. Clique em "Adicionar Fila" para comecar.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Padrao</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Localizacao</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>URI</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.queues.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Button
                          variant={q.isDefault ? "default" : "outline"}
                          size="icon"
                          className="size-6"
                          onClick={() => setDefaultQueue(q.id)}
                        >
                          {q.isDefault && <Check className="size-3" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{q.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{q.location || "-"}</TableCell>
                      <TableCell className="text-xs">{q.driver || "-"}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[200px] truncate">{q.uri}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => removeQueue(q.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            As impressoras serao configuradas via script CORE-008 (Gestao de Impressoras) durante o provisionamento.
            O script cria as filas CUPS locais apontando para o servidor central.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
