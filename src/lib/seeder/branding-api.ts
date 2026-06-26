// Cloud-backed CRUD para branding_config por organizacao.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { brandingApi } from "@/lib/api/client";

export interface BrandingConfig {
  orgId: string;
  displayName: string | null;
  wallpaperUrl: string | null;
  wallpaperLogin: string | null;
  logoUrl: string | null;
  greeterUrl: string | null;
  theme: string;
  conkyEnabled: boolean;
  conkyConfig: Record<string, unknown>;
  shortcutsEnabled: boolean;
  updatedAt?: string;
}

function apiToBranding(r: any): BrandingConfig {
  return {
    orgId: r.orgId ?? r.org_id,
    displayName: r.displayName ?? r.display_name ?? null,
    wallpaperUrl: r.wallpaperUrl ?? r.wallpaper_url ?? null,
    wallpaperLogin: r.wallpaperLogin ?? r.wallpaper_login ?? null,
    logoUrl: r.logoUrl ?? r.logo_url ?? null,
    greeterUrl: r.greeterUrl ?? r.greeter_url ?? null,
    theme: r.theme ?? 'Mint-Y-Dark',
    conkyEnabled: r.conkyEnabled ?? r.conky_enabled ?? false,
    conkyConfig: r.conkyConfig ?? r.conky_config ?? {},
    shortcutsEnabled: r.shortcutsEnabled ?? r.shortcuts_enabled ?? true,
    updatedAt: r.updatedAt ?? r.updated_at,
  };
}

export const BRANDING_QK = ["branding"] as const;

export function useBranding(orgId: string | undefined) {
  return useQuery({
    queryKey: [...BRANDING_QK, orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<BrandingConfig | null> => {
      const data = await brandingApi.get(orgId!);
      return apiToBranding(data);
    },
  });
}

export function useUpsertBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (branding: BrandingConfig) => {
      await brandingApi.upsert({
        orgId: branding.orgId,
        displayName: branding.displayName,
        wallpaperUrl: branding.wallpaperUrl,
        wallpaperLogin: branding.wallpaperLogin,
        logoUrl: branding.logoUrl,
        greeterUrl: branding.greeterUrl,
        theme: branding.theme,
        conkyEnabled: branding.conkyEnabled,
        conkyConfig: branding.conkyConfig,
        shortcutsEnabled: branding.shortcutsEnabled,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...BRANDING_QK, vars.orgId] });
      qc.invalidateQueries({ queryKey: BRANDING_QK });
    },
  });
}

export function useDeleteBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      await brandingApi.delete(orgId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDING_QK }),
  });
}
