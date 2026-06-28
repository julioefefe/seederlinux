import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpsertOrganization } from "@/lib/seeder/orgs-api";
import type { Organization, ADMethod, AuthBackend, AuthMethod, DeployProfile } from "@/lib/seeder/types";
import { toast } from "sonner";
import { Building2, Globe, Server, Shield, Printer, Palette, ChevronLeft, ChevronRight } from "lucide-react";

const COLORS = [
  "oklch(0.62 0.16 155)",
  "oklch(0.55 0.12 200)",
  "oklch(0.6 0.18 30)",
  "oklch(0.65 0.18 90)",
  "oklch(0.5 0.18 280)",
  "oklch(0.55 0.18 340)",
];

interface Props {
  trigger: React.ReactNode;
  organization?: Organization;
  onSaved?: (org: Organization) => void;
}

type StepKey = "identidade" | "dominio" | "rede" | "auth" | "impressoras" | "branding";

const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "identidade", label: "Identidade", icon: Building2 },
  { key: "dominio", label: "Dominio", icon: Globe },
  { key: "rede", label: "Rede", icon: Server },
  { key: "auth", label: "Autenticacao", icon: Shield },
  { key: "impressoras", label: "Impressoras", icon: Printer },
  { key: "branding", label: "Identidade Visual", icon: Palette },
];

function createDefaultOrg(): Organization {
  return {
    id: "",
    nome: "",
    sigla: "",
    descricao: "",
    status: "active",
    variaveis: {},
    fqdn: "",
    netbios: "",
    realm: "",
    dcPrimaryIp: "",
    dcSecondaryIp: null,
    dcFqdn: "",
    dnsPrimary: "",
    dnsSecondary: null,
    searchDomains: [],
    ntpServers: [],
    timezone: "America/Sao_Paulo",
    httpProxy: "",
    httpsProxy: "",
    ftpProxy: null,
    noProxy: [],
    authBackend: "sssd",
    authMethod: "ads",
    printServer: null,
    defaultPrinter: null,
    deployProfile: "standard",
    dominio: "",
    dcHostname: "",
    dcIp: "",
    metodoAd: "sssd",
    distrosSuportadas: ["ubuntu", "linuxmint"],
    ambientesSuportados: ["Cinnamon"],
    serial: Number(new Date().toISOString().slice(0, 10).replace(/-/g, "") + "01"),
    scriptsAtivos: 0,
    estacoes: 0,
    cor: COLORS[0],
    criadoEm: new Date().toISOString().slice(0, 10),
  };
}

export function OrganizationFormDialog({ trigger, organization, onSaved }: Props) {
  const upsert = useUpsertOrganization();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepKey>("identidade");
  const isEdit = !!organization;

  const [form, setForm] = useState<Organization>(organization ?? createDefaultOrg());

  const set = <K extends keyof Organization>(k: K, v: Organization[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < STEPS.length - 1;

  const validateStep = (): boolean => {
    switch (step) {
      case "identidade":
        if (!form.sigla || !form.nome) {
          toast.error("Preencha Sigla e Nome.");
          return false;
        }
        return true;
      case "dominio":
        if (!form.fqdn || !form.dcPrimaryIp || !form.dcFqdn) {
          toast.error("Preencha FQDN, IP do DC Primario e FQDN do DC.");
          return false;
        }
        return true;
      case "rede":
        if (!form.dnsPrimary) {
          toast.error("Preencha o DNS Primario.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSave = async () => {
    if (!form.sigla || !form.fqdn || !form.dcPrimaryIp) {
      toast.error("Preencha campos obrigatorios: Sigla, FQDN e IP do DC.");
      return;
    }
    const sigla = form.sigla.toUpperCase();
    const final: Organization = {
      ...form,
      id: form.id,
      sigla,
      netbios: form.netbios || sigla,
      realm: form.realm || sigla.toUpperCase(),
      dominio: form.fqdn,
      dcHostname: form.dcFqdn,
      dcIp: form.dcPrimaryIp,
      metodoAd: form.authBackend as ADMethod,
    };

    try {
      await upsert.mutateAsync(final);
      toast.success(`${sigla} ${isEdit ? "atualizada" : "criada"}`);
      onSaved?.(final);
      setOpen(false);
      setStep("identidade");
      setForm(createDefaultOrg());
    } catch (e) {
      toast.error(`Falha ao salvar: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep("identidade"); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar organizacao" : "Nova organizacao"}</DialogTitle>
          <DialogDescription>
            Configure os parametros da OM. Campos com * sao obrigatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : i < stepIndex
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <s.icon className="size-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {step === "identidade" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sigla *" hint="Ex: COMARA">
                <Input value={form.sigla} onChange={(e) => set("sigla", e.target.value.toUpperCase())} placeholder="COMARA" />
              </Field>
              <Field label="Nome completo *" hint="Nome da OM">
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Comando de Apoio" />
              </Field>
              <Field label="Descricao">
                <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descricao breve" className="col-span-2" />
              </Field>
              <Field label="Estacoes estimadas">
                <Input type="number" value={form.estacoes} onChange={(e) => set("estacoes", Number(e.target.value))} />
              </Field>
              <Field label="Cor">
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => set("cor", c)}
                      className={`size-8 rounded-md border-2 transition-all ${
                        form.cor === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === "dominio" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="FQDN *" hint="comara.intraer">
                <Input value={form.fqdn} onChange={(e) => set("fqdn", e.target.value.toLowerCase())} placeholder="om.intraer" />
              </Field>
              <Field label="NETBIOS" hint="Automatico se vazio">
                <Input value={form.netbios} onChange={(e) => set("netbios", e.target.value.toUpperCase())} placeholder={form.sigla} />
              </Field>
              <Field label="Realm (Kerberos)" hint="Automatico se vazio">
                <Input value={form.realm} onChange={(e) => set("realm", e.target.value.toUpperCase())} placeholder={form.sigla ? `${form.sigla.toUpperCase()}.INTRAER` : ""} />
              </Field>
              <div className="col-span-full border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground mb-3">Controladores de Dominio (DC)</p>
              </div>
              <Field label="DC Primario IP *" hint="IP do DC principal">
                <Input value={form.dcPrimaryIp} onChange={(e) => set("dcPrimaryIp", e.target.value)} placeholder="10.108.1.10" />
              </Field>
              <Field label="DC Secundario IP">
                <Input value={form.dcSecondaryIp ?? ""} onChange={(e) => set("dcSecondaryIp", e.target.value || null)} placeholder="10.108.1.11" />
              </Field>
              <Field label="DC FQDN *" hint="Nome do controlador">
                <Input value={form.dcFqdn} onChange={(e) => set("dcFqdn", e.target.value.toLowerCase())} placeholder="dc01.om.intraer" />
              </Field>
            </div>
          )}

          {step === "rede" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="DNS Primario *" hint="Servidor DNS">
                <Input value={form.dnsPrimary} onChange={(e) => set("dnsPrimary", e.target.value)} placeholder="10.108.1.10" />
              </Field>
              <Field label="DNS Secundario">
                <Input value={form.dnsSecondary ?? ""} onChange={(e) => set("dnsSecondary", e.target.value || null)} placeholder="10.108.1.11" />
              </Field>
              <Field label="Search Domains" hint="Virgula separado">
                <Input value={form.searchDomains.join(", ")} onChange={(e) => set("searchDomains", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="om.intraer, intraer" />
              </Field>
              <div className="col-span-full border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground mb-3">NTP / Timezone</p>
              </div>
              <Field label="NTP Servers" hint="Virgula separado">
                <Input value={form.ntpServers.join(", ")} onChange={(e) => set("ntpServers", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="ntp.om.intraer" />
              </Field>
              <Field label="Timezone">
                <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="America/Sao_Paulo" />
              </Field>
              <div className="col-span-full border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground mb-3">Proxy</p>
              </div>
              <Field label="HTTP Proxy">
                <Input value={form.httpProxy} onChange={(e) => set("httpProxy", e.target.value)} placeholder="10.108.88.4:8080" />
              </Field>
              <Field label="HTTPS Proxy">
                <Input value={form.httpsProxy} onChange={(e) => set("httpsProxy", e.target.value)} placeholder="10.108.88.4:8080" />
              </Field>
              <Field label="FTP Proxy">
                <Input value={form.ftpProxy ?? ""} onChange={(e) => set("ftpProxy", e.target.value || null)} />
              </Field>
              <Field label="No Proxy" hint="Virgula separado">
                <Input value={form.noProxy.join(", ")} onChange={(e) => set("noProxy", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="localhost, 10.0.0.0/8" />
              </Field>
            </div>
          )}

          {step === "auth" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Backend de Autenticacao">
                <Select value={form.authBackend} onValueChange={(v) => set("authBackend", v as AuthBackend)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sssd">SSSD (recomendado)</SelectItem>
                    <SelectItem value="winbind">Winbind</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Metodo de Juncao">
                <Select value={form.authMethod} onValueChange={(v) => set("authMethod", v as AuthMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ads">ADS (Active Directory)</SelectItem>
                    <SelectItem value="ldap">LDAP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Perfil de Deploy">
                <Select value={form.deployProfile} onValueChange={(v) => set("deployProfile", v as DeployProfile)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal (DNS + NTP)</SelectItem>
                    <SelectItem value="standard">Standard (+ Proxy + Auth)</SelectItem>
                    <SelectItem value="full">Full (+ Printers + Branding)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="col-span-full sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  <strong>Minimal:</strong> apenas DNS e NTP.<br/>
                  <strong>Standard:</strong> adiciona proxy e autenticacao.<br/>
                  <strong>Full:</strong> inclui impressoras e branding personalizado.
                </p>
              </div>
            </div>
          )}

          {step === "impressoras" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Servidor CUPS">
                <Input value={form.printServer ?? ""} onChange={(e) => set("printServer", e.target.value || null)} placeholder="cups.om.intraer" />
              </Field>
              <Field label="Impressora Padrao">
                <Input value={form.defaultPrinter ?? ""} onChange={(e) => set("defaultPrinter", e.target.value || null)} placeholder="HP_LaserJet_P2035" />
              </Field>
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">
                  Deixe em branco se a OM nao utiliza impressoras centralizadas.
                </p>
              </div>
            </div>
          )}

          {step === "branding" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Status" className="col-span-full">
                <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Distros Suportadas" hint="Separar por virgula" className="col-span-full">
                <Input value={form.distrosSuportadas.join(", ")} onChange={(e) => set("distrosSuportadas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="ubuntu, linuxmint" />
              </Field>
              <Field label="Ambientes Desktop" hint="Separar por virgula" className="col-span-full">
                <Input value={form.ambientesSuportados.join(", ")} onChange={(e) => set("ambientesSuportados", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Cinnamon, GNOME" />
              </Field>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between mt-6 gap-2">
          <Button variant="outline" onClick={() => canGoBack && setStep(STEPS[stepIndex - 1].key)} disabled={!canGoBack}>
            <ChevronLeft className="size-4" /> Anterior
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            {canGoNext ? (
              <Button
                onClick={() => {
                  if (validateStep()) setStep(STEPS[stepIndex + 1].key);
                }}
              >
                Proximo <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar organizacao"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs flex items-center gap-2">
        {label}
        {hint && <span className="text-muted-foreground font-normal">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}
