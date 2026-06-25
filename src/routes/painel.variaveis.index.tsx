import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOrganizations } from "@/lib/seeder/orgs-api";
import { useVariables } from "@/lib/seeder/variables-api";
import { useVariableCatalog } from "@/lib/seeder/variables-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Variable, Loader as Loader2, BookOpen, Tag, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from "lucide-react";
import { EmptyOrgState } from "@/components/seeder/EmptyOrgState";

export const Route = createFileRoute("/painel/variaveis/")({
  head: () => ({ meta: [{ title: "Variaveis - SeederLinux" }] }),
  component: VariablesPage,
});

function VariablesPage() {
  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [showOnlyUsed, setShowOnlyUsed] = useState(false);

  const { data: variables = [], isLoading: varsLoading } = useVariables(selectedOrgId);
  const { data: catalog = [], isLoading: catalogLoading } = useVariableCatalog();

  const isLoading = orgsLoading || varsLoading || catalogLoading;

  // Build variable map for quick lookup
  const varMap = new Map(variables.map((v: any) => [v.key, v.value]));

  // Filter catalog entries
  const filtered = catalog
    .filter((entry: any) => {
      const matchQ =
        !q ||
        entry.key.toLowerCase().includes(q.toLowerCase()) ||
        entry.label?.toLowerCase().includes(q.toLowerCase()) ||
        entry.descricao?.toLowerCase().includes(q.toLowerCase());
      const matchCat = catFilter === "todos" || entry.escopo === catFilter;
      const matchRequired = !showOnlyRequired || entry.obrigatoria;
      const matchUsed = !showOnlyUsed || varMap.has(entry.key);
      return matchQ && matchCat && matchRequired && matchUsed;
    })
    .map((entry: any) => ({
      ...entry,
      valorAtual: varMap.get(entry.key) || entry.defaultValue || "",
      temValor: varMap.has(entry.key),
    }));

  // Categories for filter
  const categories = [
    { id: "todos", label: "Todas" },
    { id: "core", label: "Core" },
    { id: "custom", label: "Custom" },
  ];

  if (orgs.length === 0 && !orgsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Catalogo
          </p>
          <h1 className="text-3xl font-bold mt-1">Variaveis</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie o catalogo de variaveis do sistema.
          </p>
        </div>
        <EmptyOrgState
          title="Nenhuma OM configurada"
          description="O catalogo de variaveis e vinculado a uma organizacao. Crie uma organizacao primeiro."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Catalogo
          </p>
          <h1 className="text-3xl font-bold mt-1">Variaveis</h1>
          <p className="text-muted-foreground mt-1">
            Catalogo de variaveis do sistema. Cada variavel pertence a uma organizacao.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione uma OM" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.sigla} - {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, label ou descricao..."
            className="pl-9"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36">
            <Tag className="size-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showOnlyRequired ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyRequired(!showOnlyRequired)}
          className="h-9"
        >
          <AlertCircle className="size-3.5 mr-1.5" />
          Obrigatorias
        </Button>
        <Button
          variant={showOnlyUsed ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyUsed(!showOnlyUsed)}
          className="h-9"
        >
          <CheckCircle className="size-3.5 mr-1.5" />
          Com valor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Carregando catalogo...
        </div>
      ) : selectedOrgId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((entry: any) => (
            <Card key={entry.key} className="hover:shadow-elegant hover:border-primary/50 transition-all">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Variable className="size-4" />
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-sm">{entry.key}</div>
                      <div className="text-xs text-muted-foreground">{entry.label}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {entry.oficial && (
                      <Badge variant="default" className="text-[10px]">oficial</Badge>
                    )}
                    {entry.obrigatoria && (
                      <Badge variant="destructive" className="text-[10px]">obrigatoria</Badge>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {entry.descricao || "Sem descricao"}
                </p>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{entry.tipo}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Escopo:</span>
                    <Badge variant="secondary" className="text-[10px]">{entry.escopo}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Variable className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Valor atual:</span>
                    <span className="font-mono text-foreground truncate max-w-[200px]">
                      {entry.valorAtual || "(vazio)"}
                    </span>
                  </div>
                  {entry.defaultValue && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Padrao:</span>
                      <span className="font-mono text-muted-foreground">{entry.defaultValue}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t flex items-center gap-2">
                  {entry.temValor ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                      <CheckCircle className="size-3 mr-1" /> Configurada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                      <AlertCircle className="size-3 mr-1" /> Nao configurada
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Variable className="size-10 mx-auto mb-3" />
          <p className="text-sm">Selecione uma organizacao para visualizar o catalogo de variaveis.</p>
        </div>
      )}

      {!isLoading && selectedOrgId && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          Nenhuma variavel encontrada com os filtros atuais.
        </p>
      )}
    </div>
  );
}
