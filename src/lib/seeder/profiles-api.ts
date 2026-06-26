// Cloud-backed CRUD para perfis (templates de scripts).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profilesApi } from "@/lib/api/client";
import type { SeederProfile } from "./types";

function apiToProfile(r: any): SeederProfile {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    scriptIds: r.scriptIds ?? r.script_ids ?? [],
    organizacaoOrigem: r.organizacaoOrigem ?? r.organizacao_origem,
    publico: r.publico,
    criadoEm: r.criadoEm ?? r.criado_em,
  };
}

export const PROFILES_QK = ["profiles_seeder"] as const;

export function useProfiles(orgId?: string) {
  return useQuery({
    queryKey: orgId ? [...PROFILES_QK, orgId] : PROFILES_QK,
    queryFn: async (): Promise<SeederProfile[]> => {
      const data = await profilesApi.list(orgId);
      return data.map((r: any) => apiToProfile(r));
    },
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: [...PROFILES_QK, id],
    queryFn: async (): Promise<SeederProfile> => {
      const data = await profilesApi.get(id);
      return apiToProfile(data);
    },
    enabled: !!id,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: SeederProfile) => {
      const data: any = {
        nome: p.nome,
        descricao: p.descricao,
        scriptIds: p.scriptIds,
        organizacaoOrigem: p.organizacaoOrigem,
        publico: p.publico,
      };

      if (p.id) {
        await profilesApi.update(p.id, data);
      } else {
        await profilesApi.create(data);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROFILES_QK }),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await profilesApi.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROFILES_QK }),
  });
}
