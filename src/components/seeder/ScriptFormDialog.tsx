import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertScript } from "@/lib/seeder/scripts-api";
import { useVariableCatalog } from "@/lib/seeder/variables-api";
import { extractUsedVars } from "@/lib/seeder/variables";
import { lintScript, lintSummary, type LintIssue } from "@/lib/seeder/lint";
import { logEvent } from "@/lib/seeder/audit";
import type { SeederScript, ScriptCategory } from "@/lib/seeder/types";
import { toast } from "sonner";
import { Upload, OctagonAlert as AlertOctagon, TriangleAlert as AlertTriangle, Info } from "lucide-react";

const CATEGORIAS: ScriptCategory[] = [
  "ingresso", "personalizacao", "logon", "logoff",
  "atualizacao", "senha", "impressoras", "legados", "inventario",
];

const DISTROS: { value: import("@/lib/seeder/types").Distro; label: string }[] = [
  { value: "ubuntu",     label: "Ubuntu" },
  { value: "linuxmint",  label: "Linux Mint" },
  { value: "debian",     label: "Debian" },
  { value: "rocky",      label: "Rocky" },
  { value: "almalinux",  label: "AlmaLinux" },
  { value: "zorin",      label: "Zorin" },
];

interface Props {
  trigger: React.ReactNode;
  script?: SeederScript;
}

export function ScriptFormDialog({ trigger, script }: Props) {
  const { data: catalog = [] } = useVariableCatalog();
  const upsert = useUpsertScript();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!script;

  const [form, setForm] = useState<SeederScript>(
    script ?? {
      id: "",
      nome: "",
      categoria: "personalizacao",
      descricao: "",
      finalidade: "",
      localExecucao: "root",
      momento: "Implantação",
      permissoes: "sudo",
      compatibilidade: ["ubuntu", "linuxmint"],
      dependencias: [],
      impacto: "baixo",
      reinicializacao: false,
      autor: "DASTI",
      variaveisUsadas: [],
      oficial: false,
      versao: "1.0.0",
      serial: Number(new Date().toISOString().slice(0, 10).replace(/-/g, "") + "01"),
      status: "rascunho",
      compartilhado: false,
      conteudo: "#!/usr/bin/env bash\nsource /opt/seederlinux/etc/${ORG}.conf\n# Novo script\n",
      atualizadoEm: new Date().toISOString().slice(0, 10),
    },
  );

  const set = <K extends keyof SeederScript>(k: K, v: SeederScript[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Detecta variáveis usadas + lint em tempo real
  const detected = useMemo(() => extractUsedVars(form.conteudo), [form.conteudo]);
  const issues: LintIssue[] = useMemo(() => lintScript(form.conteudo, catalog), [form.conteudo, catalog]);
  const summary = lintSummary(issues);
  const knownKeys = new Set(catalog.map((v: any) => v.key));

  const catalogMap = useMemo(() => new Map(catalog.map((v: any) => [v.key, v])), [catalog]);

  const handleUpload = async (file: File) => {
    const text = await file.text();
    set("conteudo", text);
    if (!form.nome) set("nome", file.name);
    toast.success(`${file.name} carregado`);
  };

  const handleSave = async () => {
    if (!form.nome || !form.descricao) {
      toast.error("Preencha nome e descrição.");
      return;
    }
    if (summary.errors > 0 && form.status !== "rascunho") {
      toast.error(`Há ${summary.errors} erro(s) bloqueante(s) — corrija ou salve como rascunho.`);
      return;
    }
    const id = form.id || `s-${Date.now().toString(36)}`;
    const final: SeederScript = {
      ...form,
      id,
      variaveisUsadas: detected,
      atualizadoEm: new Date().toISOString().slice(0, 10),
    };
    try {
      await upsert.mutateAsync(final);
      logEvent({
        categoria: "script",
        acao: isEdit ? "Script atualizado" : "Script criado",
        alvo: form.nome,
        detalhes: `v${form.versao} · ${detected.length} var(s) · ${summary.warns} aviso(s)`,
      });
      toast.success(`${form.nome} ${isEdit ? "atualizado" : "criado"}`);
      setOpen(false);
    } catch (e) {
      toast.error(`Falha ao salvar: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar script" : "Novo script"}</DialogTitle>
          <DialogDescription>
            Scripts são globais e parametrizados pelas variáveis da OM. Use{" "}
            <code className="font-mono">$VAR</code> via <code>source</code> ou{" "}
            <code className="font-mono">{"{{VAR}}"}</code> para renderização no bundle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome (com .sh) *">
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="meu_script.sh" />
            </Field>
            <Field label="Versão">
              <Input value={form.versao} onChange={(e) => set("versao", e.target.value)} />
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria} onValueChange={(v) => set("categoria", v as ScriptCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Local de execução">
              <Select value={form.localExecucao} onValueChange={(v) => set("localExecucao", v as SeederScript["localExecucao"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">root</SelectItem>
                  <SelectItem value="usuario">usuário</SelectItem>
                  <SelectItem value="login">login (PAM)</SelectItem>
                  <SelectItem value="logoff">logoff</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Impacto">
              <Select value={form.impacto} onValueChange={(v) => set("impacto", v as SeederScript["impacto"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">baixo</SelectItem>
                  <SelectItem value="medio">médio</SelectItem>
                  <SelectItem value="alto">alto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v as SeederScript["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">rascunho</SelectItem>
                  <SelectItem value="validado">validado</SelectItem>
                  <SelectItem value="publicado">publicado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Autor">
              <Input value={form.autor} onChange={(e) => set("autor", e.target.value)} />
            </Field>
          </div>

          <Field label="Descrição *">
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} />
          </Field>

          <Field label="Compatibilidade (distros) — vazio = todas">
            <div className="flex flex-wrap gap-2">
              {DISTROS.map((d) => {
                const checked = form.compatibilidade.includes(d.value);
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() =>
                      set(
                        "compatibilidade",
                        checked
                          ? form.compatibilidade.filter((x) => x !== d.value)
                          : [...form.compatibilidade, d.value],
                      )
                    }
                    className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                      checked
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Conteúdo bash</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" /> Upload .sh
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".sh,text/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </div>
            <Textarea
              value={form.conteudo}
              onChange={(e) => set("conteudo", e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          {detected.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Variáveis detectadas ({detected.length})
              </div>
              <div className="space-y-2">
                {detected.map((k) => {
                  const entry = catalogMap.get(k);
                  const isKnown = !!entry;
                  return (
                    <div key={k} className={`flex items-center gap-3 text-xs p-2 rounded-md ${isKnown ? "bg-background border" : "bg-destructive/5 border border-destructive/20"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold">{k}</code>
                          {entry?.label && (
                            <span className="text-muted-foreground">{entry.label}</span>
                          )}
                          {!isKnown && (
                            <Badge variant="destructive" className="text-[9px] h-4">nao catalogada</Badge>
                          )}
                          {entry?.obrigatoria && (
                            <Badge variant="outline" className="text-[9px] h-4 border-destructive/30 text-destructive">obrigatoria</Badge>
                          )}
                        </div>
                        {entry?.descricao && (
                          <p className="text-muted-foreground mt-0.5 truncate">{entry.descricao}</p>
                        )}
                      </div>
                      {entry?.tipo && (
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">{entry.tipo}</Badge>
                      )}
                      {entry?.default && (
                        <span className="text-muted-foreground font-mono shrink-0">padrao: {entry.default}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground flex items-center gap-3">
                <span>Análise de segurança</span>
                {summary.errors > 0 && <span className="text-destructive">● {summary.errors} erro(s)</span>}
                {summary.warns > 0 && <span className="text-amber-600">● {summary.warns} aviso(s)</span>}
                {summary.infos > 0 && <span className="text-muted-foreground">● {summary.infos} info</span>}
              </div>
              <ul className="space-y-1.5">
                {issues.map((i, idx) => {
                  const Icon = i.severity === "error" ? AlertOctagon : i.severity === "warn" ? AlertTriangle : Info;
                  const color =
                    i.severity === "error" ? "text-destructive" :
                    i.severity === "warn" ? "text-amber-600" : "text-muted-foreground";
                  return (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      <Icon className={`size-3.5 mt-0.5 shrink-0 ${color}`} />
                      <span>
                        {i.line && <span className="font-mono text-muted-foreground">L{i.line} · </span>}
                        <span dangerouslySetInnerHTML={{ __html: i.message.replace(/`([^`]+)`/g, '<code class="font-mono">$1</code>') }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              {summary.errors > 0 && (
                <p className="text-[11px] text-destructive">
                  Scripts com erros só podem ser salvos como <strong>rascunho</strong>.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
