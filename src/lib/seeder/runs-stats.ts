// Estatísticas agregadas de execuções (station_runs).
import { useQuery } from "@tanstack/react-query";
import { stationsApi } from "@/lib/api/client";

export interface OrgRunStats {
  orgId: string;
  total: number;
  ok: number;
  erro: number;
  successRate: number; // 0..1
  topFails: Array<{ scriptId: string; nome: string; falhas: number }>;
  ultimaExecucao: string | null;
}

export function useRunsStats(days = 30) {
  return useQuery({
    queryKey: ["runs_stats", days],
    queryFn: async (): Promise<Map<string, OrgRunStats>> => {
      // Get all stations with organization info
      const stations: any[] = await stationsApi.list();

      const stationOrg = new Map<string, string>();
      for (const s of stations) {
        stationOrg.set(s.id, s.orgId ?? s.org_id);
      }

      // Get runs for each station
      const map = new Map<string, OrgRunStats>();
      const failCounts = new Map<string, Map<string, { nome: string; falhas: number }>>();

      const since = new Date(Date.now() - days * 86400_000).toISOString();

      // Fetch runs for each station
      const runPromises = stations.map(async (station) => {
        try {
          const runs = await stationsApi.runs(station.id);
          return runs.filter((r: any) => r.finishedAt >= since || r.finished_at >= since);
        } catch {
          return [];
        }
      });

      const allRuns = await Promise.all(runPromises);

      const ensure = (orgId: string): OrgRunStats => {
        let s = map.get(orgId);
        if (!s) {
          s = { orgId, total: 0, ok: 0, erro: 0, successRate: 0, topFails: [], ultimaExecucao: null };
          map.set(orgId, s);
        }
        return s;
      };

      for (let i = 0; i < stations.length; i++) {
        const station = stations[i];
        const runs = allRuns[i] || [];
        const orgId = stationOrg.get(station.id);
        if (!orgId) continue;

        const s = ensure(orgId);

        for (const r of runs) {
          s.total++;
          if (r.status === "ok") s.ok++;
          else s.erro++;

          const finishedAt = r.finishedAt ?? r.finished_at;
          if (!s.ultimaExecucao || finishedAt > s.ultimaExecucao) {
            s.ultimaExecucao = finishedAt;
          }

          const log = r.log ?? [];
          for (const entry of log) {
            if (entry.exit_code !== 0) {
              let bucket = failCounts.get(orgId);
              if (!bucket) { bucket = new Map(); failCounts.set(orgId, bucket); }
              const cur = bucket.get(entry.id) ?? { nome: entry.nome, falhas: 0 };
              cur.falhas++;
              bucket.set(entry.id, cur);
            }
          }
        }
      }

      for (const s of map.values()) {
        s.successRate = s.total === 0 ? 0 : s.ok / s.total;
        const bucket = failCounts.get(s.orgId);
        if (bucket) {
          s.topFails = [...bucket.entries()]
            .map(([scriptId, v]) => ({ scriptId, nome: v.nome, falhas: v.falhas }))
            .sort((a, b) => b.falhas - a.falhas)
            .slice(0, 3);
        }
      }

      return map;
    },
  });
}
