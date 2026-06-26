import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/seeder-admin", "");
    const segments = path.split("/").filter(Boolean);
    const resource = segments[0] || "";
    const method = req.method;

    // ── SETUP STATUS ──
    if (resource === "setup-status" && method === "GET") {
      const { data } = await supabase.from("system_config").select("key,value").eq("key", "setup_completed").single();
      return json({ completed: data?.value === "true" });
    }

    // ── SETUP COMPLETE ──
    if (resource === "setup" && method === "POST") {
      const body = await req.json();

      // Verify setup token
      const { data: tokenRow } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "setup_token")
        .single();

      if (tokenRow?.value && body.setupToken !== tokenRow.value) {
        return json({ error: "Invalid setup token" }, 403);
      }

      // Check if already completed
      const { data: setupRow } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "setup_completed")
        .single();

      if (setupRow?.value === "true") {
        return json({ error: "Setup already completed" }, 400);
      }

      // Create admin user
      const { data: authUser, error: userError } = await supabase.auth.admin.createUser({
        email: body.adminEmail,
        password: body.adminPassword,
        email_confirm: true,
        user_metadata: { display_name: body.adminName },
      });

      if (userError) return json({ error: userError.message }, 400);

      // Assign admin_gap role
      await supabase.from("user_roles").insert({
        user_id: authUser.user.id,
        role: "admin_gap",
        org_sigla: null,
      });

      // Create root organization
      const orgId = body.orgSigla.toLowerCase() + "-" + crypto.randomUUID().slice(0, 8);
      const { data: org, error: orgError } = await supabase.from("organizations").insert({
        id: orgId,
        nome: body.orgName,
        sigla: body.orgSigla.toUpperCase(),
        descricao: "",
        status: "active",
        fqdn: body.fqdn || "",
        netbios: body.netbios || body.orgSigla.toUpperCase(),
        realm: body.realm || body.orgSigla.toUpperCase() + ".INTRAER",
        dc_primary_ip: body.dcPrimaryIp || "",
        dc_secondary_ip: body.dcSecondaryIp || null,
        dc_fqdn: body.dcFqdn || "",
        dns_primary: body.dnsPrimary || "",
        dns_secondary: body.dnsSecondary || null,
        search_domains: body.searchDomains || [],
        ntp_servers: body.ntpServers || ["pool.ntp.org"],
        timezone: body.timezone || "America/Sao_Paulo",
        http_proxy: body.httpProxy || "",
        https_proxy: body.httpsProxy || "",
        no_proxy: body.noProxy || [],
        auth_backend: body.authBackend || "sssd",
        auth_method: body.authMethod || "ads",
        print_server: body.printServer || null,
        default_printer: body.defaultPrinter || null,
        deploy_profile: "standard",
        dominio: body.fqdn || "",
        dc_hostname: body.dcFqdn || "",
        dc_ip: body.dcPrimaryIp || "",
        metodo_ad: body.authBackend || "auto",
        distros_suportadas: ["ubuntu", "linuxmint", "debian"],
        ambientes_suportados: ["GNOME", "MATE", "Cinnamon", "XFCE"],
        serial: 0,
        cor: "oklch(0.6 0.15 200)",
      }).select().single();

      if (orgError) return json({ error: orgError.message }, 500);

      // Create branding config
      await supabase.from("branding_config").insert({
        org_id: orgId,
        display_name: body.orgName,
        theme: "Mint-Y-Dark",
        conky_enabled: false,
        shortcuts_enabled: true,
      });

      // Create offline auth config
      await supabase.from("offline_auth_config").insert({
        org_id: orgId,
        enabled: false,
        cache_credentials: false,
        offline_days: 7,
        max_offline_logins: 10,
        auto_sync: true,
        sssd_config: "",
      });

      // Create desktop policy
      await supabase.from("desktop_policies").insert({
        org_id: orgId,
        theme: "Mint-Y-Dark",
        icon_theme: "Mint-Y",
        cursor_theme: "default",
        font: "Cantarell 11",
        sounds_enabled: true,
        notifications_enabled: true,
        screensaver_timeout: 300,
        power_timeout: 600,
      });

      // Create browser policies
      for (const browser of ["firefox", "chrome", "chromium"]) {
        await supabase.from("browser_policies").insert({
          id: orgId + "-" + browser,
          org_id: orgId,
          browser,
          homepage: "",
          bookmarks_enabled: false,
          proxy_enabled: true,
          certificates_enabled: true,
          telemetry_disabled: true,
          updates_disabled: false,
        });
      }

      // Create printer profile
      await supabase.from("printer_profiles").insert({
        id: orgId + "-print",
        org_id: orgId,
        name: body.orgSigla + " Print Profile",
        cups_server: body.printServer || null,
        default_queue: body.defaultPrinter || null,
      });

      // Create default repositories
      for (const repo of [
        { name: "Ubuntu Main", type: "apt", url: "http://archive.ubuntu.com/ubuntu", is_official: true },
        { name: "Ubuntu Universe", type: "apt", url: "http://archive.ubuntu.com/ubuntu", is_official: true },
        { name: "Linux Mint", type: "apt", url: "http://packages.linuxmint.com", is_official: true },
      ]) {
        await supabase.from("repositories").insert({
          id: orgId + "-" + repo.name.toLowerCase().replace(/\s+/g, "-"),
          org_id: orgId,
          name: repo.name,
          type: repo.type,
          url: repo.url,
          enabled: true,
          is_official: repo.is_official,
        });
      }

      // Create initial profile
      await supabase.from("profiles_seeder").insert({
        id: orgId + "-profile-standard",
        nome: "Perfil Standard",
        descricao: "Perfil padrao com scripts essenciais",
        script_ids: [],
        organizacao_origem: orgId,
        publico: false,
        profile_type: "standard",
      });

      // Seed default org variables
      const defaultVars: Record<string, string> = {
        DOMINIO: body.fqdn || "",
        NETBIOS: body.netbios || body.orgSigla.toUpperCase(),
        REALM: body.realm || body.orgSigla.toUpperCase() + ".INTRAER",
        DC_IP: body.dcPrimaryIp || "",
        DC_FQDN: body.dcFqdn || "",
        DNS_PRIMARIO: body.dnsPrimary || "",
        DNS_SECUNDARIO: body.dnsSecondary || "",
        NTP_SERVERS: (body.ntpServers || ["pool.ntp.org"]).join(" "),
        TIMEZONE: body.timezone || "America/Sao_Paulo",
        HTTP_PROXY: body.httpProxy || "",
        HTTPS_PROXY: body.httpsProxy || "",
        NO_PROXY: (body.noProxy || []).join(","),
        AUTH_BACKEND: body.authBackend || "sssd",
        AUTH_METHOD: body.authMethod || "ads",
        PRINT_SERVER: body.printServer || "",
        DEFAULT_PRINTER: body.defaultPrinter || "",
      };

      for (const [key, value] of Object.entries(defaultVars)) {
        await supabase.from("org_variables").insert({ org_id: orgId, key, value });
      }

      // Mark setup as completed
      await supabase.from("system_config").upsert({ key: "setup_completed", value: "true" });

      // Sign in the admin user to get a session
      const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
        email: body.adminEmail,
        password: body.adminPassword,
      });

      return json({
        success: true,
        token: session?.access_token || "",
        user: {
          id: authUser.user.id,
          email: body.adminEmail,
          displayName: body.adminName,
          blocked: false,
          roles: [{ id: "1", role: "admin_gap", orgSigla: null }],
        },
        organization: org,
      });
    }

    // ── USERS LIST ──
    if (resource === "users" && method === "GET") {
      const { data: users, error } = await supabase.auth.admin.listUsers();
      if (error) return json({ error: error.message }, 500);

      const userIds = users.users.map((u: any) => u.id);
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

      const result = users.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.user_metadata?.display_name || null,
        blocked: u.banned_until != null,
        roles: (roles || []).filter((r: any) => r.user_id === u.id).map((r: any) => ({
          id: r.id,
          role: r.role,
          orgSigla: r.org_sigla,
        })),
      }));

      return json(result);
    }

    // ── USERS CREATE ──
    if (resource === "users" && method === "POST") {
      const body = await req.json();

      const { data: authUser, error: userError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: body.displayName || "" },
      });

      if (userError) return json({ error: userError.message }, 400);

      await supabase.from("user_roles").insert({
        user_id: authUser.user.id,
        role: body.role,
        org_sigla: body.orgSigla || null,
      });

      return json({
        id: authUser.user.id,
        email: body.email,
        displayName: body.displayName || null,
        blocked: false,
        roles: [{ id: "1", role: body.role, orgSigla: body.orgSigla || null }],
      });
    }

    // ── USERS DELETE ──
    if (resource === "users" && segments[1] && method === "DELETE") {
      const userId = segments[1];
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── AUTH ME ──
    if (resource === "auth-me" && method === "GET") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "No auth header" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return json({ error: "Invalid token" }, 401);

      const { data: roles } = await supabase.from("user_roles").select("*").eq("user_id", user.id);

      return json({
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.display_name || null,
        blocked: user.banned_until != null,
        roles: (roles || []).map((r: any) => ({
          id: r.id,
          role: r.role,
          orgSigla: r.org_sigla,
        })),
      });
    }

    // ── STATION CHECK-IN (public) ──
    if (resource === "station-checkin" && method === "POST") {
      const body = await req.json();

      // Hash the token and look up the station
      const enc = new TextEncoder();
      const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(body.token));
      const tokenHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: tokenRow, error: tokenError } = await supabase
        .from("station_tokens")
        .select("station_id, revoked_at")
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .single();

      if (tokenError || !tokenRow) {
        return json({ error: "Invalid or revoked token" }, 403);
      }

      // Update station
      const now = new Date().toISOString();
      const { data: station, error: stationError } = await supabase
        .from("stations")
        .update({
          hostname: body.hostname,
          ip: body.ip || null,
          distro: body.distro || "ubuntu",
          desktop: body.desktop || "GNOME",
          kernel_version: body.kernelVersion || null,
          serial_aplicado: body.serial || 0,
          ultimo_checkin: now,
          status: "ok",
          agent_version: body.agentVersion || null,
        })
        .eq("id", tokenRow.station_id)
        .select()
        .single();

      if (stationError) return json({ error: stationError.message }, 500);

      // Update token last_used_at
      await supabase.from("station_tokens").update({ last_used_at: now }).eq("token_hash", tokenHash);

      return json({ success: true, stationId: tokenRow.station_id });
    }

    // ── PROVISIONING PREVIEW ──
    if (resource === "provisioning-preview" && method === "POST") {
      const body = await req.json();

      const { data: org } = await supabase.from("organizations").select("*").eq("id", body.orgId).single();
      if (!org) return json({ error: "Organization not found" }, 404);

      let scripts: any[] = [];
      if (body.profileId) {
        const { data: profile } = await supabase.from("profiles_seeder").select("script_ids").eq("id", body.profileId).single();
        if (profile?.script_ids?.length) {
          const { data: scriptRows } = await supabase.from("scripts").select("*").in("id", profile.script_ids).eq("status", "pronto");
          scripts = scriptRows || [];
        }
      } else if (body.scriptIds?.length) {
        const { data: scriptRows } = await supabase.from("scripts").select("*").in("id", body.scriptIds).eq("status", "pronto");
        scripts = scriptRows || [];
      }

      return json({
        organization: { id: org.id, sigla: org.sigla, nome: org.nome, serial: org.serial },
        scripts: scripts.map((s: any) => ({ id: s.id, nome: s.nome, categoria: s.categoria, versao: s.versao })),
        totalScripts: scripts.length,
      });
    }

    // ── PROVISIONING GENERATE ──
    if (resource === "provisioning-generate" && method === "POST") {
      const body = await req.json();

      const { data: org } = await supabase.from("organizations").select("*").eq("id", body.orgId).single();
      if (!org) return json({ error: "Organization not found" }, 404);

      let scripts: any[] = [];
      if (body.profileId) {
        const { data: profile } = await supabase.from("profiles_seeder").select("script_ids").eq("id", body.profileId).single();
        if (profile?.script_ids?.length) {
          const { data: scriptRows } = await supabase.from("scripts").select("*").in("id", profile.script_ids).eq("status", "pronto");
          scripts = scriptRows || [];
        }
      } else if (body.scriptIds?.length) {
        const { data: scriptRows } = await supabase.from("scripts").select("*").in("id", body.scriptIds).eq("status", "pronto");
        scripts = scriptRows || [];
      }

      // Increment org serial
      const newSerial = (org.serial || 0) + 1;
      await supabase.from("organizations").update({ serial: newSerial }).eq("id", body.orgId);

      // Get org variables
      const { data: orgVars } = await supabase.from("org_variables").select("key,value").eq("org_id", body.orgId);
      const varMap: Record<string, string> = {};
      for (const v of orgVars || []) varMap[v.key] = v.value;

      // Generate config
      const configLines = Object.entries(varMap).map(([k, v]) => `${k}="${v}"`);
      const config = configLines.join("\n");

      return json({
        serial: String(newSerial),
        scripts: scripts.map((s: any) => ({ id: s.id, nome: s.nome, conteudo: s.conteudo, versao: s.versao })),
        config,
      });
    }

    // ── AUDIT LIST ──
    if (resource === "audit" && method === "GET") {
      let query = supabase.from("audit_events").select("*", { count: "exact" }).order("ts", { ascending: false });
      if (url.searchParams.get("categoria")) query = query.eq("categoria", url.searchParams.get("categoria"));
      if (url.searchParams.get("acao")) query = query.eq("acao", url.searchParams.get("acao"));
      const limit = parseInt(url.searchParams.get("limit") || "500");
      query = query.limit(limit);

      const { data, count, error } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({
        events: (data || []).map((e: any) => ({
          id: e.id,
          ts: e.ts,
          atorEmail: e.ator_email,
          atorId: e.ator_id,
          categoria: e.categoria,
          acao: e.acao,
          alvo: e.alvo,
          detalhes: e.detalhes,
        })),
        total: count || 0,
      });
    }

    // ── AUDIT STATS ──
    if (resource === "audit-stats" && method === "GET") {
      const days = parseInt(url.searchParams.get("days") || "30");
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const { data, error } = await supabase
        .from("audit_events")
        .select("categoria,acao,ts")
        .gte("ts", since)
        .order("ts", { ascending: false });

      if (error) return json({ error: error.message }, 500);

      const byCategory: Record<string, number> = {};
      const byAction: Record<string, number> = {};
      for (const e of data || []) {
        byCategory[e.categoria] = (byCategory[e.categoria] || 0) + 1;
        byAction[e.acao] = (byAction[e.acao] || 0) + 1;
      }

      return json({
        total: (data || []).length,
        byCategory,
        byAction,
        recent: (data || []).slice(0, 10),
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
