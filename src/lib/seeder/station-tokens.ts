// CRUD de tokens de check-in por estação.
// O token plain só é exibido uma vez (ao criar).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stationsApi } from "@/lib/api/client";

export interface StationToken {
  id: string;
  stationId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const stationTokensQK = (stationId: string) => ["station-tokens", stationId] as const;

export function useStationTokens(stationId: string) {
  return useQuery({
    queryKey: stationTokensQK(stationId),
    enabled: !!stationId,
    queryFn: async (): Promise<StationToken[]> => {
      const data = await stationsApi.listTokens(stationId);
      return data.map((r: any) => ({
        id: r.id,
        stationId: r.stationId ?? r.station_id,
        label: r.label,
        createdAt: r.createdAt ?? r.created_at,
        lastUsedAt: r.lastUsedAt ?? r.last_used_at,
        revokedAt: r.revokedAt ?? r.revoked_at,
      }));
    },
  });
}

export function useCreateStationToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stationId: string; label: string }): Promise<{ token: string }> => {
      const result = await stationsApi.generateToken(input.stationId);
      return { token: result.token };
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: stationTokensQK(vars.stationId) }),
  });
}

export function useRevokeStationToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stationId: string }) => {
      await stationsApi.revokeToken(input.stationId, input.id);
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: stationTokensQK(vars.stationId) }),
  });
}

export function useDeleteStationToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stationId: string }) => {
      // Delete is same as revoke in our API
      await stationsApi.revokeToken(input.stationId, input.id);
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: stationTokensQK(vars.stationId) }),
  });
}
