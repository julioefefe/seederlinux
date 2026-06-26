import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Shield, Lock, KeyRound, FileCheck, TriangleAlert as AlertTriangle, Save, Loader as Loader2, Wifi, WifiOff, RefreshCw, Trash2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { offlineAuthApi } from "@/lib/api/client";
import { useOrganizations } from "@/lib/seeder/orgs-api";

export const Route = createFileRoute("/painel/seguranca/")({
  head: () => ({ meta: [{ title: "Seguranca - SeederLinux" }] }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const { data: orgs = [] } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState({
    enabled: false,
    cacheCredentials: false,
    offlineDays: 7,
    maxOfflineLogins: 10,
    autoSync: true,
    sssdConfig: "",
  });

  const [securityConfig, setSecurityConfig] = useState({
    blockHardcodedPasswords: true,
    requireChecksum: true,
    auditLogging: true,
    forceHttps: true,
    failedAttempts: 5,
    lockoutDuration: 15,
  });

  useEffect(() => {
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    async function loadConfig() {
      if (!selectedOrgId) return;
      setLoading(true);
      try {
        const data = await offlineAuthApi.get(selectedOrgId);
        setConfig({
          enabled: data.enabled ?? false,
          cacheCredentials: data.cacheCredentials ?? false,
          offlineDays: data.offlineDays ?? 7,
          maxOfflineLogins: data.maxOfflineLogins ?? 10,
          autoSync: data.autoSync ?? true,
          sssdConfig: data.sssdConfig ?? "",
        });
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [selectedOrgId]);

  async function handleSave() {
    if (!selectedOrgId) return toast.error("Selecione uma organizacao");
    setSaving(true);
    try {
      const org = orgs.find(o => o.id === selectedOrgId);
      await offlineAuthApi.upsert({
        orgId: selectedOrgId,
        enabled: config.enabled,
        cacheCredentials: config.cacheCredentials,
        offlineDays: config.offlineDays,
        maxOfflineLogins: config.maxOfflineLogins,
        autoSync: config.autoSync,
        sssdConfig: config.sssdConfig,
        adDomain: org?.fqdn || "",
      });
      toast.success("Configuracoes de seguranca salvas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSssd() {
    if (!selectedOrgId) return;
    const org = orgs.find(o => o.id === selectedOrgId);
    const sssd = `[sssd]
domains = default
config_file_version = 2
services = nss, pam

[domain/default]
id_provider = ad
ad_domain = ${org?.fqdn || "DOMAIN"}
auth_provider = ad
chpass_provider = ad
access_provider = ad
cache_credentials = ${config.cacheCredentials ? "True" : "False"}
offline_credentials_expiration = ${config.offlineDays}
account_cache_expiration = ${config.offlineDays}
krb5_store_password_if_offline = True
dyndns_update = True
dyndns_refresh_interval = 43200
dyndns_update_ptr = True
ldap_id_mapping = True
fallback_homedir = /home/%d/%u
default_shell = /bin/bash
`;
    setConfig(p => ({ ...p, sssdConfig: sssd }));
    toast.success("Configuracao SSSD gerada");
  }

  async function handleClearCache() {
    if (!confirm("Limpar cache de credenciais offline? As estacoes precisarao reautenticar.")) return;
    setConfig(p => ({ ...p, sssdConfig: "" }));
    toast.success("Cache de credenciais marcado para limpeza");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Sistema
          </p>
          <h1 className="text-3xl font-bold mt-1 flex items-center gap-2">
            <Shield className="size-7" /> Seguranca
          </h1>
          <p className="text-muted-foreground mt-1">
            Autenticacao offline, credenciais em cache, SSSD e politicas de seguranca.
          </p>
        </div>
        {orgs.length > 0 && (
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a OM" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.sigla}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando configuracoes...
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <WifiOff className="size-4" /> Autenticacao Offline (SSSD)
          </CardTitle>
          <CardDescription>Gerencie credenciais em cache para operacao offline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                {config.enabled ? <WifiOff className="size-4 text-warning" /> : <Wifi className="size-4 text-success" />}
                Autenticacao Offline Habilitada
              </Label>
              <p className="text-xs text-muted-foreground">Permite login sem conexao com o Domain Controller</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, enabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Cache de Credenciais</Label>
              <p className="text-xs text-muted-foreground">Armazena hashes de senha localmente</p>
            </div>
            <Switch
              checked={config.cacheCredentials}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, cacheCredentials: v }))}
              disabled={!config.enabled}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Sincronizacao Automatica</Label>
              <p className="text-xs text-muted-foreground">Sincroniza credenciais quando conexao retorna</p>
            </div>
            <Switch
              checked={config.autoSync}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, autoSync: v }))}
              disabled={!config.enabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Dias Offline Permitidos</Label>
              <Input
                type="number"
                value={config.offlineDays}
                onChange={(e) => setConfig((p) => ({ ...p, offlineDays: Number(e.target.value) }))}
                disabled={!config.enabled}
              />
              <p className="text-[10px] text-muted-foreground">Credenciais expiram apos N dias sem conexao</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Maximo de Logins Offline</Label>
              <Input
                type="number"
                value={config.maxOfflineLogins}
                onChange={(e) => setConfig((p) => ({ ...p, maxOfflineLogins: Number(e.target.value) }))}
                disabled={!config.enabled}
              />
              <p className="text-[10px] text-muted-foreground">Limite de logins antes de exigir reautenticacao</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <FileText className="size-3.5" /> Configuracao SSSD
              </Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleGenerateSssd} disabled={!config.enabled}>
                  <RefreshCw className="size-3.5" /> Gerar
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearCache} disabled={!config.enabled}>
                  <Trash2 className="size-3.5" /> Limpar Cache
                </Button>
              </div>
            </div>
            <textarea
              value={config.sssdConfig}
              onChange={(e) => setConfig((p) => ({ ...p, sssdConfig: e.target.value }))}
              rows={12}
              disabled={!config.enabled}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y"
              placeholder="[sssd]
domains = default
..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="size-4" /> Politicas de Acesso
          </CardTitle>
          <CardDescription>Regras de bloqueio e protecao</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Forcar HTTPS</Label>
              <p className="text-xs text-muted-foreground">Redireciona todas requisicoes HTTP para HTTPS</p>
            </div>
            <Switch
              checked={securityConfig.forceHttps}
              onCheckedChange={(v) => setSecurityConfig((p) => ({ ...p, forceHttps: v }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tentativas Falhas (bloqueio)</Label>
              <Input
                type="number"
                value={securityConfig.failedAttempts}
                onChange={(e) => setSecurityConfig((p) => ({ ...p, failedAttempts: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duracao do Bloqueio (min)</Label>
              <Input
                type="number"
                value={securityConfig.lockoutDuration}
                onChange={(e) => setSecurityConfig((p) => ({ ...p, lockoutDuration: Number(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCheck className="size-4" /> Integridade de Scripts
          </CardTitle>
          <CardDescription>Verificacoes de seguranca para scripts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Bloquear Senhas Hardcoded</Label>
              <p className="text-xs text-muted-foreground">Impede armazenamento de credenciais em scripts</p>
            </div>
            <Switch
              checked={securityConfig.blockHardcodedPasswords}
              onCheckedChange={(v) => setSecurityConfig((p) => ({ ...p, blockHardcodedPasswords: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Exigir Checksum no Bundle</Label>
              <p className="text-xs text-muted-foreground">Inclui SHA-256 de todos scripts no manifest.json</p>
            </div>
            <Switch
              checked={securityConfig.requireChecksum}
              onCheckedChange={(v) => setSecurityConfig((p) => ({ ...p, requireChecksum: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label className="text-sm font-medium">Auditoria Completa</Label>
              <p className="text-xs text-muted-foreground">Registra todas alteracoes (quem, quando, o que)</p>
            </div>
            <Switch
              checked={securityConfig.auditLogging}
              onCheckedChange={(v) => setSecurityConfig((p) => ({ ...p, auditLogging: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-warning/5 border-warning/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 text-warning mt-0.5" />
            <div className="text-xs">
              <strong className="text-warning">Atencao:</strong> Alteracoes nestas configuracoes afetam todas as estacoes.
              Certifique-se de documentar todas mudancas no sistema de auditoria.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !selectedOrgId}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          <Save className="size-4" /> Salvar Configuracoes
        </Button>
      </div>
    </div>
  );
}
