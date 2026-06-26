// Cloud-backed CRUD para o catalogo global de variaveis e variaveis por organizacao.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { variablesApi } from "@/lib/api/client";
import type { VariableDef, VarType, VarScope } from "./types";

function apiToVar(r: any): VariableDef {
  return {
    key: r.key,
    label: r.label,
    descricao: r.descricao,
    tipo: r.tipo as VarType,
    escopo: r.escopo as VarScope,
    oficial: r.oficial,
    obrigatoria: r.obrigatoria,
    exemplo: r.exemplo ?? undefined,
    default: r.defaultValue ?? r.default_value ?? undefined,
  };
}

export const VARS_QK = ["variable_catalog"] as const;
export const ORG_VARS_QK = ["org_variables"] as const;

// Catalogo global de variaveis
export function useVariableCatalog() {
  return useQuery({
    queryKey: VARS_QK,
    queryFn: async (): Promise<VariableDef[]> => {
      const data = await variablesApi.catalog();
      return data.map((r: any) => apiToVar(r));
    },
  });
}

// Variaveis de uma organizacao especifica
export function useVariables(orgId: string) {
  return useQuery({
    queryKey: [...ORG_VARS_QK, orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const data = await variablesApi.list(orgId);
      return data.variables ?? [];
    },
    enabled: !!orgId,
  });
}

export function useAddVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: VariableDef) => {
      await variablesApi.addToCatalog({
        key: v.key,
        label: v.label,
        descricao: v.descricao,
        tipo: v.tipo,
        escopo: v.escopo,
        oficial: false,
        obrigatoria: v.obrigatoria,
        exemplo: v.exemplo ?? null,
        defaultValue: v.default ?? null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VARS_QK }),
  });
}

export function useDeleteVariable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { api } = await import("@/lib/api/client");
      await api(`/api/variables/catalog/${key}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VARS_QK }),
  });
}
