// SeederLinux v3.0 API Client
// Uses Supabase directly for data operations + edge function for admin operations

import { supabase } from "@/lib/supabase";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seeder-admin`;

// ── Backward-compat no-ops (Supabase manages its own session) ──
export function setAuthToken(_token: string | null) {}
export function getAuthToken(): string | null { return null; }
export function clearAuthToken() {}

// ── Helpers ──
function generateId(): string {
  return crypto.randomUUID();
}

function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function serializeStation(row: any) {
  return {
    id: row.id,
    hostname: row.hostname,
    orgId: row.org_id,
    ip: row.ip,
    distro: row.distro,
    desktop: row.desktop,
    kernelVersion: row.kernel_version,
    serialAplicado: Number(row.serial_aplicado ?? 0),
    ultimoCheckin: row.ultimo_checkin ?? "",
    status: row.status,
    perfilAtivo: row.perfil_ativo,
    usuario: row.usuario,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    agentVersion: row.agent_version,
    organization: row.organization,
  };
}

async function edgeFetch<T>(path: string, options: { method?: string; body?: any } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${EDGE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth API ──
export const authApi = {
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { token: data.session?.access_token || "", user: data.user };
  },

  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return {
      id: user.id,
      email: user.email,
      displayName: (user.user_metadata as any)?.display_name || null,
      blocked: (user as any).banned_until != null,
      roles: (roles || []).map((r: any) => ({
        id: r.id,
        role: r.role,
        orgSigla: r.org_sigla,
      })),
    };
  },

  async logout() {
    await supabase.auth.signOut();
    return { success: true };
  },
};

// ── Setup API ──
export const setupApi = {
  async status() {
    try {
      const { data, error } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "setup_completed")
        .single();
      if (error) return { completed: false };
      return { completed: data?.value === "true" };
    } catch {
      return { completed: false };
    }
  },

  async complete(data: {
    setupToken: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
    orgName: string;
    orgSigla: string;
    fqdn?: string;
    netbios?: string;
    realm?: string;
    dcPrimaryIp?: string;
    dcSecondaryIp?: string;
    dcFqdn?: string;
    dnsPrimary?: string;
    dnsSecondary?: string;
    searchDomains?: string[];
    ntpServers?: string[];
    timezone?: string;
    httpProxy?: string;
    httpsProxy?: string;
    noProxy?: string[];
    authBackend?: "sssd" | "winbind";
    authMethod?: "ads" | "ldap";
    printServer?: string;
    defaultPrinter?: string;
  }) {
    const result = await edgeFetch<{ success: boolean; token: string; user: any; organization: any }>(
      "/setup",
      { method: "POST", body: data },
    );

    if (result.token) {
      const { error } = await supabase.auth.setSession({
        access_token: result.token,
        refresh_token: "",
      });
      if (error) {
        // Fallback: sign in with password
        await supabase.auth.signInWithPassword({
          email: data.adminEmail,
          password: data.adminPassword,
        });
      }
    }

    return result;
  },
};

// ── Users API ──
export const usersApi = {
  list: () => edgeFetch<any[]>("/users"),

  create: (data: {
    email: string;
    password: string;
    displayName?: string;
    role: "admin_gap" | "operador_om" | "auditor";
    orgSigla?: string;
  }) => edgeFetch<any>("/users", { method: "POST", body: data }),

  delete: (id: string) => edgeFetch<{ success: boolean }>(`/users/${id}`, { method: "DELETE" }),
};

// ── Organizations API ──
export const organizationsApi = {
  async list() {
    const { data, error } = await supabase.from("organizations").select("*").order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
  },

  async get(id: string) {
    const { data, error } = await supabase.from("organizations").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);

    // Also fetch variables
    const { data: vars } = await supabase.from("org_variables").select("key,value").eq("org_id", id);
    const variables = (vars || []).map((v: any) => ({ key: v.key, value: v.value }));

    return { ...toCamelCase(data), variables };
  },

  async create(data: any) {
    const id = data.sigla?.toLowerCase() + "-" + generateId().slice(0, 8);
    const insertData: any = {
      id,
      nome: data.nome,
      sigla: data.sigla,
      descricao: data.descricao ?? "",
      status: data.status ?? "active",
      fqdn: data.fqdn ?? "",
      netbios: data.netbios ?? data.sigla?.toUpperCase() ?? "",
      realm: data.realm ?? "",
      dc_primary_ip: data.dcPrimaryIp ?? "",
      dc_secondary_ip: data.dcSecondaryIp ?? null,
      dc_fqdn: data.dcFqdn ?? "",
      dns_primary: data.dnsPrimary ?? "",
      dns_secondary: data.dnsSecondary ?? null,
      search_domains: data.searchDomains ?? [],
      ntp_servers: data.ntpServers ?? ["pool.ntp.org"],
      timezone: data.timezone ?? "America/Sao_Paulo",
      http_proxy: data.httpProxy ?? "",
      https_proxy: data.httpsProxy ?? "",
      ftp_proxy: data.ftpProxy ?? null,
      no_proxy: data.noProxy ?? [],
      auth_backend: data.authBackend ?? "sssd",
      auth_method: data.authMethod ?? "ads",
      print_server: data.printServer ?? null,
      default_printer: data.defaultPrinter ?? null,
      deploy_profile: data.deployProfile ?? "standard",
      dominio: data.dominio || data.fqdn || "",
      dc_hostname: data.dcHostname || data.dcFqdn || "",
      dc_ip: data.dcIp || data.dcPrimaryIp || "",
      metodo_ad: data.metodoAd || data.authBackend || "auto",
      distros_suportadas: data.distrosSuportadas ?? ["ubuntu", "linuxmint", "debian"],
      ambientes_suportados: data.ambientesSuportados ?? ["GNOME", "MATE", "Cinnamon", "XFCE"],
      cor: data.cor ?? "oklch(0.6 0.15 200)",
    };

    const { data: org, error } = await supabase.from("organizations").insert(insertData).select().single();
    if (error) throw new Error(error.message);

    // Cascade: create branding config
    await supabase.from("branding_config").insert({
      org_id: id,
      display_name: data.nome,
      theme: "Mint-Y-Dark",
      conky_enabled: false,
      shortcuts_enabled: true,
    });

    // Cascade: create offline auth config
    await supabase.from("offline_auth_config").insert({
      org_id: id,
      enabled: false,
      cache_credentials: false,
      offline_days: 7,
      max_offline_logins: 10,
      auto_sync: true,
      sssd_config: "",
    });

    // Cascade: create desktop policy
    await supabase.from("desktop_policies").insert({
      org_id: id,
      theme: "Mint-Y-Dark",
      icon_theme: "Mint-Y",
      cursor_theme: "default",
      font: "Cantarell 11",
      sounds_enabled: true,
      notifications_enabled: true,
      screensaver_timeout: 300,
      power_timeout: 600,
    });

    // Cascade: create browser policies
    for (const browser of ["firefox", "chrome", "chromium"]) {
      await supabase.from("browser_policies").insert({
        id: id + "-" + browser,
        org_id: id,
        browser,
        homepage: "",
        bookmarks_enabled: false,
        proxy_enabled: true,
        certificates_enabled: true,
        telemetry_disabled: true,
        updates_disabled: false,
      });
    }

    // Cascade: create printer profile
    await supabase.from("printer_profiles").insert({
      id: id + "-print",
      org_id: id,
      name: (data.sigla ?? "OM") + " Print Profile",
      cups_server: data.printServer || null,
      default_queue: data.defaultPrinter || null,
    });

    // Cascade: create default repositories
    for (const repo of [
      { name: "Ubuntu Main", type: "apt", url: "http://archive.ubuntu.com/ubuntu", is_official: true },
      { name: "Ubuntu Universe", type: "apt", url: "http://archive.ubuntu.com/ubuntu", is_official: true },
      { name: "Linux Mint", type: "apt", url: "http://packages.linuxmint.com", is_official: true },
    ]) {
      await supabase.from("repositories").insert({
        id: id + "-" + repo.name.toLowerCase().replace(/\s+/g, "-"),
        org_id: id,
        name: repo.name,
        type: repo.type,
        url: repo.url,
        enabled: true,
        is_official: repo.is_official,
      });
    }

    // Cascade: create initial profile
    await supabase.from("profiles_seeder").insert({
      id: id + "-profile-standard",
      nome: "Perfil Standard",
      descricao: "Perfil padrao com scripts essenciais",
      script_ids: [],
      organizacao_origem: id,
      publico: false,
      profile_type: "standard",
    });

    return toCamelCase(org);
  },

  async update(id: string, data: any) {
    const updateData: any = {
      nome: data.nome,
      sigla: data.sigla,
      descricao: data.descricao,
      status: data.status,
      fqdn: data.fqdn,
      netbios: data.netbios,
      realm: data.realm,
      dc_primary_ip: data.dcPrimaryIp,
      dc_secondary_ip: data.dcSecondaryIp,
      dc_fqdn: data.dcFqdn,
      dns_primary: data.dnsPrimary,
      dns_secondary: data.dnsSecondary,
      search_domains: data.searchDomains,
      ntp_servers: data.ntpServers,
      timezone: data.timezone,
      http_proxy: data.httpProxy,
      https_proxy: data.httpsProxy,
      ftp_proxy: data.ftpProxy,
      no_proxy: data.noProxy,
      auth_backend: data.authBackend,
      auth_method: data.authMethod,
      print_server: data.printServer,
      default_printer: data.defaultPrinter,
      deploy_profile: data.deployProfile,
      dominio: data.dominio,
      dc_hostname: data.dcHostname,
      dc_ip: data.dcIp,
      metodo_ad: data.metodoAd,
      distros_suportadas: data.distrosSuportadas,
      ambientes_suportados: data.ambientesSuportados,
      cor: data.cor,
    };

    const { data: org, error } = await supabase.from("organizations").update(updateData).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(org);
  },

  async delete(id: string) {
    // Clean up related records
    await supabase.from("org_variables").delete().eq("org_id", id);
    await supabase.from("branding_config").delete().eq("org_id", id);
    await supabase.from("offline_auth_config").delete().eq("org_id", id);
    await supabase.from("desktop_policies").delete().eq("org_id", id);
    await supabase.from("browser_policies").delete().eq("org_id", id);
    await supabase.from("printer_profiles").delete().eq("org_id", id);
    await supabase.from("repositories").delete().eq("org_id", id);
    await supabase.from("profiles_seeder").delete().eq("organizacao_origem", id);
    await supabase.from("station_tokens").delete().in("station_id",
      (await supabase.from("stations").select("id").eq("org_id", id)).data?.map((s: any) => s.id) || []);
    await supabase.from("station_runs").delete().in("station_id",
      (await supabase.from("stations").select("id").eq("org_id", id)).data?.map((s: any) => s.id) || []);
    await supabase.from("stations").delete().eq("org_id", id);

    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  },
};

// ── Scripts API ──
export const scriptsApi = {
  async list() {
    const { data, error } = await supabase.from("scripts").select("*").order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
  },

  async get(id: string) {
    const { data, error } = await supabase.from("scripts").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return toCamelCase(data);
  },

  async create(data: any) {
    const id = generateId();
    const { data: script, error } = await supabase.from("scripts").insert({
      id,
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      versao: data.versao ?? "1.0.0",
      status: data.status ?? "rascunho",
      conteudo: data.conteudo,
      variaveis_usadas: data.variaveisUsadas ?? [],
      compatibilidade: data.compatibilidade ?? ["ubuntu", "linuxmint", "debian"],
      autor: data.autor ?? "",
      oficial: data.oficial ?? false,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(script);
  },

  async update(id: string, data: any) {
    const { data: script, error } = await supabase.from("scripts").update({
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      versao: data.versao,
      status: data.status,
      conteudo: data.conteudo,
      variaveis_usadas: data.variaveisUsadas,
      compatibilidade: data.compatibilidade,
      autor: data.autor,
      oficial: data.oficial,
    }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(script);
  },

  async delete(id: string) {
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  },
};

// ── Variables API ──
export const variablesApi = {
  async list(orgId: string) {
    const { data: org } = await supabase.from("organizations").select("sigla").eq("id", orgId).single();
    const { data, error } = await supabase.from("org_variables").select("*").eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return {
      orgId,
      sigla: org?.sigla ?? "",
      variables: (data || []).map((v: any) => ({ key: v.key, value: v.value })),
    };
  },

  async set(orgId: string, key: string, value: string) {
    const { error } = await supabase.from("org_variables").upsert({
      org_id: orgId,
      key,
      value,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async delete(orgId: string, key: string) {
    const { error } = await supabase.from("org_variables").delete().eq("org_id", orgId).eq("key", key);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async catalog() {
    const { data, error } = await supabase.from("variable_catalog").select("*").order("key");
    if (error) throw new Error(error.message);
    return (data || []).map(toCamelCase);
  },

  async addToCatalog(data: {
    key: string;
    label: string;
    descricao: string;
    tipo: string;
    escopo: string;
    oficial: boolean;
    obrigatoria: boolean;
    exemplo?: string | null;
    defaultValue?: string | null;
  }) {
    const { error } = await supabase.from("variable_catalog").upsert({
      key: data.key,
      label: data.label,
      descricao: data.descricao,
      tipo: data.tipo,
      escopo: data.escopo,
      oficial: data.oficial,
      obrigatoria: data.obrigatoria,
      exemplo: data.exemplo ?? null,
      default_value: data.defaultValue ?? null,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },
};

// ── Branding API ──
export const brandingApi = {
  async get(orgId: string) {
    const { data, error } = await supabase.from("branding_config").select("*").eq("org_id", orgId).single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return toCamelCase(data);
  },

  async upsert(data: any) {
    const { data: result, error } = await supabase.from("branding_config").upsert({
      org_id: data.orgId,
      display_name: data.displayName,
      wallpaper_url: data.wallpaperUrl,
      wallpaper_login: data.wallpaperLogin,
      logo_url: data.logoUrl,
      greeter_url: data.greeterUrl,
      theme: data.theme,
      conky_enabled: data.conkyEnabled,
      conky_config: data.conkyConfig,
      shortcuts_enabled: data.shortcutsEnabled,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(result);
  },

  async delete(orgId: string) {
    const { error } = await supabase.from("branding_config").delete().eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { success: true };
  },
};

// ── Stations API ──
export const stationsApi = {
  async list(orgId?: string) {
    let query = supabase.from("stations").select("*, organization:organizations(*)");
    if (orgId) query = query.eq("org_id", orgId);
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(serializeStation);
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("stations")
      .select("*, organization:organizations(*)")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return serializeStation(data);
  },

  async create(data: any) {
    const id = generateId();
    const { data: station, error } = await supabase.from("stations").insert({
      id,
      hostname: data.hostname,
      org_id: data.orgId,
      ip: data.ip ?? "",
      distro: data.distro ?? "ubuntu",
      desktop: data.desktop ?? "GNOME",
      kernel_version: data.kernelVersion ?? null,
      serial_aplicado: 0,
      status: data.status ?? "registered",
      perfil_ativo: data.perfilAtivo ?? null,
      usuario: data.usuario ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return serializeStation(station);
  },

  async update(id: string, data: any) {
    const updateData: any = {};
    if (data.hostname !== undefined) updateData.hostname = data.hostname;
    if (data.orgId !== undefined) updateData.org_id = data.orgId;
    if (data.ip !== undefined) updateData.ip = data.ip;
    if (data.distro !== undefined) updateData.distro = data.distro;
    if (data.desktop !== undefined) updateData.desktop = data.desktop;
    if (data.kernelVersion !== undefined) updateData.kernel_version = data.kernelVersion;
    if (data.serialAplicado !== undefined) updateData.serial_aplicado = data.serialAplicado;
    if (data.ultimoCheckin !== undefined) updateData.ultimo_checkin = data.ultimoCheckin;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.perfilAtivo !== undefined) updateData.perfil_ativo = data.perfilAtivo;
    if (data.usuario !== undefined) updateData.usuario = data.usuario;

    const { data: station, error } = await supabase.from("stations").update(updateData).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return serializeStation(station);
  },

  async delete(id: string) {
    await supabase.from("station_tokens").delete().eq("station_id", id);
    await supabase.from("station_runs").delete().eq("station_id", id);
    const { error } = await supabase.from("stations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async generateToken(id: string) {
    // Generate a random token
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Hash the token
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("station_tokens").insert({
      station_id: id,
      token_hash: tokenHash,
      label: "agente",
    });
    if (error) throw new Error(error.message);

    return { token };
  },

  async revokeToken(stationId: string, tokenId: string) {
    const { error } = await supabase
      .from("station_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", tokenId)
      .eq("station_id", stationId);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async listTokens(stationId: string) {
    const { data, error } = await supabase
      .from("station_tokens")
      .select("*")
      .eq("station_id", stationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((t: any) => toCamelCase(t));
  },

  async runs(id: string) {
    const { data, error } = await supabase
      .from("station_runs")
      .select("*")
      .eq("station_id", id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => toCamelCase(r));
  },
};

// ── Profiles API ──
export const profilesApi = {
  async list(orgId?: string) {
    let query = supabase.from("profiles_seeder").select("*").order("criado_em", { ascending: false });
    if (orgId) query = query.eq("organizacao_origem", orgId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map((p: any) => toCamelCase(p));
  },

  async get(id: string) {
    const { data, error } = await supabase.from("profiles_seeder").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return toCamelCase(data);
  },

  async create(data: any) {
    const id = generateId();
    const { data: profile, error } = await supabase.from("profiles_seeder").insert({
      id,
      nome: data.nome,
      descricao: data.descricao,
      script_ids: data.scriptIds ?? [],
      organizacao_origem: data.organizacaoOrigem ?? null,
      publico: data.publico ?? false,
      profile_type: "standard",
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(profile);
  },

  async update(id: string, data: any) {
    const { data: profile, error } = await supabase.from("profiles_seeder").update({
      nome: data.nome,
      descricao: data.descricao,
      script_ids: data.scriptIds,
      organizacao_origem: data.organizacaoOrigem,
      publico: data.publico,
    }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(profile);
  },

  async delete(id: string) {
    const { error } = await supabase.from("profiles_seeder").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async importProfile(profileId: string, targetOrgSigla: string) {
    // Fetch the original profile
    const { data: original, error: origError } = await supabase
      .from("profiles_seeder")
      .select("*")
      .eq("id", profileId)
      .single();
    if (origError) throw new Error(origError.message);

    // Find the target org
    const { data: targetOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("sigla", targetOrgSigla)
      .single();

    // Create a copy
    const id = generateId();
    const { data: copy, error: copyError } = await supabase.from("profiles_seeder").insert({
      id,
      nome: original.nome + " (importado)",
      descricao: original.descricao,
      script_ids: original.script_ids,
      organizacao_origem: targetOrg?.id ?? null,
      publico: false,
      profile_type: "standard",
    }).select().single();
    if (copyError) throw new Error(copyError.message);
    return toCamelCase(copy);
  },
};

// ── Browser Policies API ──
export const browserPoliciesApi = {
  async list(orgId: string) {
    const { data, error } = await supabase.from("browser_policies").select("*").eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return (data || []).map((p: any) => toCamelCase(p));
  },

  async upsert(data: any) {
    const id = `${data.orgId}-${data.browser}`;
    const { data: result, error } = await supabase.from("browser_policies").upsert({
      id,
      org_id: data.orgId,
      browser: data.browser,
      homepage: data.homepage ?? "",
      bookmarks_enabled: data.bookmarksEnabled ?? false,
      proxy_enabled: data.proxyEnabled ?? false,
      certificates_enabled: data.certificatesEnabled ?? false,
      telemetry_disabled: data.telemetryDisabled ?? true,
      updates_disabled: data.updatesDisabled ?? false,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(result);
  },
};

// ── Desktop Policies API ──
export const desktopPoliciesApi = {
  async get(orgId: string) {
    const { data, error } = await supabase.from("desktop_policies").select("*").eq("org_id", orgId).single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return toCamelCase(data);
  },

  async upsert(data: any) {
    const { data: result, error } = await supabase.from("desktop_policies").upsert({
      org_id: data.orgId,
      theme: data.theme ?? "Mint-Y-Dark",
      icon_theme: data.iconTheme ?? "Mint-Y",
      cursor_theme: data.cursorTheme ?? "default",
      font: data.font ?? "Cantarell 11",
      sounds_enabled: data.soundsEnabled ?? true,
      sound_scheme: data.soundScheme ?? "freedesktop",
      notifications_enabled: data.notificationsEnabled ?? true,
      screensaver_timeout: data.screensaverTimeout ?? 300,
      power_timeout: data.powerTimeout ?? 600,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(result);
  },
};

// ── Printer Profiles API ──
export const printerProfilesApi = {
  async get(orgId: string) {
    const { data, error } = await supabase.from("printer_profiles").select("*").eq("org_id", orgId).single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return toCamelCase(data);
  },

  async upsert(data: any) {
    const id = `${data.orgId}-print`;
    const { data: result, error } = await supabase.from("printer_profiles").upsert({
      id,
      org_id: data.orgId,
      name: data.name ?? "Print Profile",
      cups_server: data.cupsServer ?? null,
      default_queue: data.defaultQueue ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(result);
  },
};

// ── Offline Auth API ──
export const offlineAuthApi = {
  async get(orgId: string) {
    const { data, error } = await supabase.from("offline_auth_config").select("*").eq("org_id", orgId).single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return toCamelCase(data);
  },

  async upsert(data: any) {
    const { data: result, error } = await supabase.from("offline_auth_config").upsert({
      org_id: data.orgId,
      enabled: data.enabled ?? false,
      cache_credentials: data.cacheCredentials ?? false,
      offline_days: data.offlineDays ?? 7,
      max_offline_logins: data.maxOfflineLogins ?? 10,
      auto_sync: data.autoSync ?? true,
      sssd_config: data.sssdConfig ?? "",
    }).select().single();
    if (error) throw new Error(error.message);
    return toCamelCase(result);
  },
};

// ── Audit API ──
export const auditApi = {
  async list(query?: { categoria?: string; acao?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (query?.categoria) params.set("categoria", query.categoria);
    if (query?.acao) params.set("acao", query.acao);
    if (query?.limit) params.set("limit", query.limit.toString());
    const qs = params.toString();
    return edgeFetch<{ events: any[]; total: number }>(`/audit${qs ? `?${qs}` : ""}`);
  },

  async stats(days?: number) {
    const qs = days ? `?days=${days}` : "";
    return edgeFetch<any>(`/audit-stats${qs}`);
  },
};

// ── Provisioning API ──
export const provisioningApi = {
  preview: (data: { orgId: string; scriptIds?: string[]; profileId?: string }) =>
    edgeFetch<any>("/provisioning-preview", { method: "POST", body: data }),

  generate: (data: { orgId: string; scriptIds?: string[]; profileId?: string; stationId?: string }) =>
    edgeFetch<{ serial: string; scripts: any[]; config: string }>("/provisioning-generate", { method: "POST", body: data }),
};

// ── Station check-in API (public, used by agents) ──
export const stationPublicApi = {
  checkin: (data: {
    token: string;
    hostname: string;
    ip?: string;
    distro?: string;
    desktop?: string;
    kernelVersion?: string;
    serial?: number;
    status?: string;
    agentVersion?: string;
  }) =>
    edgeFetch<{ success: boolean; stationId: string }>("/station-checkin", { method: "POST", body: data }),
};
