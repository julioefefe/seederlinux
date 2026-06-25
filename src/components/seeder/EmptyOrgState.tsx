import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  showCreateButton?: boolean;
}

export function EmptyOrgState({
  title = "Nenhuma OM disponivel",
  description = "Voce precisa ter acesso a uma organizacao para usar esta funcionalidade.",
  showCreateButton = true,
}: Props) {
  return (
    <div className="max-w-lg mx-auto text-center py-12 space-y-4">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto">
        <Building2 className="size-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{description}</p>
      </div>
      {showCreateButton && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            Entre em contato com o admin GAP ou crie uma nova organizacao.
          </p>
          <Link to="/painel/organizacoes">
            <Button variant="outline" size="sm">
              <Plus className="size-4 mr-1.5" /> Gerenciar Organizacoes
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
