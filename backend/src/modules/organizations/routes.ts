import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createOrgSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().min(2).max(10),
  descricao: z.string().optional(),
  status: z.string().optional(),
  fqdn: z.string().optional(),
  netbios: z.string().optional(),
  realm: z.string().optional(),
  dcPrimaryIp: z.string().optional(),
  dcSecondaryIp: z.string().optional(),
  dcFqdn: z.string().optional(),
  dnsPrimary: z.string().optional(),
  dnsSecondary: z.string().optional(),
  searchDomains: z.array(z.string()).optional(),
  ntpServers: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  httpProxy: z.string().optional(),
  httpsProxy: z.string().optional(),
  ftpProxy: z.string().optional(),
  noProxy: z.array(z.string()).optional(),
  authBackend: z.enum(['sssd', 'winbind']).optional(),
  authMethod: z.enum(['ads', 'ldap']).optional(),
  printServer: z.string().optional(),
  defaultPrinter: z.string().optional(),
  deployProfile: z.string().optional(),
  dominio: z.string().optional(),
  dcHostname: z.string().optional(),
  dcIp: z.string().optional(),
  metodoAd: z.enum(['sssd', 'winbind', 'auto']).optional(),
  distrosSuportadas: z.array(z.string()).optional(),
  ambientesSuportados: z.array(z.string()).optional(),
  cor: z.string().optional(),
});

const updateOrgSchema = z.object({
  nome: z.string().min(1).optional(),
  dominio: z.string().optional(),
  dcHostname: z.string().optional(),
  dcIp: z.string().optional(),
  metodoAd: z.enum(['sssd', 'winbind', 'auto']).optional(),
  distrosSuportadas: z.array(z.string()).optional(),
  ambientesSuportados: z.array(z.string()).optional(),
  cor: z.string().optional(),
});

function isAdminGap(roles: any[]) {
  return roles.some((r: any) => r.role === 'admin_gap');
}

export default async function organizationsRoutes(app: FastifyInstance) {
  // List organizations
  app.get('/', async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = isAdminGap(user.roles);

    let orgs;
    if (isAdmin || user.roles.some((r: any) => r.role === 'auditor')) {
      orgs = await app.prisma.organization.findMany({
        orderBy: { sigla: 'asc' },
      });
    } else {
      // Operador OM sees only their orgs
      const siglas = user.roles
        .filter((r: any) => r.role === 'operador_om' && r.orgSigla)
        .map((r: any) => r.orgSigla);
      orgs = await app.prisma.organization.findMany({
        where: { sigla: { in: siglas } },
        orderBy: { sigla: 'asc' },
      });
    }

    return orgs;
  });

  // Get single organization
  app.get('/:id', async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const org = await app.prisma.organization.findUnique({
      where: { id },
      include: { variables: true, branding: true },
    });

    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    // Check access
    const isAdmin = isAdminGap(user.roles);
    const isAuditor = user.roles.some((r: any) => r.role === 'auditor');
    const isOperador = user.roles.some(
      (r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla
    );

    if (!isAdmin && !isAuditor && !isOperador) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return org;
  });

  // Create organization (admin_gap only)
  app.post('/', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdminGap(user.roles)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = createOrgSchema.parse(request.body);

    const existing = await app.prisma.organization.findUnique({
      where: { sigla: body.sigla.toUpperCase() },
    });

    if (existing) {
      return reply.code(400).send({ error: 'Sigla already exists' });
    }

    const sigla = body.sigla.toUpperCase();
    const fqdn = body.fqdn || body.dominio || `${sigla.toLowerCase()}.intraer`;
    const netbios = body.netbios || sigla;
    const realm = body.realm || `${sigla}.INTRAER`;

    const org = await app.prisma.organization.create({
      data: {
        nome: body.nome,
        sigla,
        descricao: body.descricao || '',
        status: body.status || 'active',
        fqdn,
        netbios,
        realm,
        dcPrimaryIp: body.dcPrimaryIp || body.dcIp || '',
        dcSecondaryIp: body.dcSecondaryIp || null,
        dcFqdn: body.dcFqdn || body.dcHostname || '',
        dnsPrimary: body.dnsPrimary || body.dcPrimaryIp || '8.8.8.8',
        dnsSecondary: body.dnsSecondary || null,
        searchDomains: body.searchDomains || [fqdn],
        ntpServers: body.ntpServers || ['pool.ntp.org'],
        timezone: body.timezone || 'America/Sao_Paulo',
        httpProxy: body.httpProxy || '',
        httpsProxy: body.httpsProxy || '',
        ftpProxy: body.ftpProxy || null,
        noProxy: body.noProxy || ['localhost', '127.0.0.1', '*.intraer'],
        authBackend: body.authBackend || 'sssd',
        authMethod: body.authMethod || 'ads',
        printServer: body.printServer || null,
        defaultPrinter: body.defaultPrinter || null,
        deployProfile: (body.deployProfile as any) || 'standard',
        dominio: fqdn,
        dcHostname: body.dcFqdn || body.dcHostname || '',
        dcIp: body.dcPrimaryIp || body.dcIp || '',
        metodoAd: body.metodoAd || 'auto',
        distrosSuportadas: body.distrosSuportadas || ['ubuntu', 'linuxmint', 'debian'],
        ambientesSuportados: body.ambientesSuportados || ['GNOME', 'Cinnamon', 'XFCE'],
        cor: body.cor || 'oklch(0.6 0.15 200)',
      },
    });

    // Create default variables (Doc 06 - Secao 16)
    const defaultVars = [
      { orgId: org.id, key: 'DOMINIO', value: fqdn },
      { orgId: org.id, key: 'DOMINIO_NETBIOS', value: netbios },
      { orgId: org.id, key: 'DC_IP', value: body.dcPrimaryIp || body.dcIp || '' },
      { orgId: org.id, key: 'DC_HOSTNAME', value: body.dcFqdn || body.dcHostname || '' },
      { orgId: org.id, key: 'DNS_PRIMARIO', value: body.dnsPrimary || body.dcPrimaryIp || '8.8.8.8' },
      { orgId: org.id, key: 'DNS_SECUNDARIO', value: body.dnsSecondary || '8.8.4.4' },
      { orgId: org.id, key: 'NTP_SERVER', value: (body.ntpServers || ['pool.ntp.org'])[0] },
      { orgId: org.id, key: 'TIMEZONE', value: body.timezone || 'America/Sao_Paulo' },
      { orgId: org.id, key: 'PROXY', value: body.httpProxy || '' },
      { orgId: org.id, key: 'ORG_NOME', value: body.nome },
      { orgId: org.id, key: 'ORG_SIGLA', value: sigla },
      { orgId: org.id, key: 'REALM', value: realm },
      { orgId: org.id, key: 'PRINT_SERVER', value: body.printServer || '' },
      { orgId: org.id, key: 'DEFAULT_PRINTER', value: body.defaultPrinter || '' },
    ];

    await app.prisma.orgVariable.createMany({
      data: defaultVars,
      skipDuplicates: true,
    });

    // Create branding config
    await app.prisma.brandingConfig.create({
      data: {
        orgId: org.id,
        displayName: body.nome,
        theme: 'Mint-Y-Dark',
        conkyEnabled: false,
        shortcutsEnabled: true,
        conkyConfig: {},
      },
    });

    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'organizations',
        acao: 'create',
        alvo: org.sigla,
      },
    });

    return org;
  });

  // Update organization
  app.patch('/:id', async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = updateOrgSchema.parse(request.body);

    const org = await app.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    // Check permission
    const isAdmin = isAdminGap(user.roles);
    const isOperador = user.roles.some(
      (r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla
    );

    if (!isAdmin && !isOperador) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const updated = await app.prisma.organization.update({
      where: { id },
      data: body,
    });

    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'organizations',
        acao: 'update',
        alvo: org.sigla,
        detalhes: JSON.stringify(body),
      },
    });

    return updated;
  });

  // Delete organization (admin_gap only)
  app.delete('/:id', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdminGap(user.roles)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };

    const org = await app.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    // Check if org has stations
    const stationCount = await app.prisma.station.count({
      where: { orgId: id },
    });

    if (stationCount > 0) {
      return reply.code(400).send({
        error: 'Cannot delete organization with stations',
      });
    }

    await app.prisma.organization.delete({ where: { id } });

    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'organizations',
        acao: 'delete',
        alvo: org.sigla,
      },
    });

    return { success: true };
  });

  // Increment serial
  app.post('/:id/increment-serial', async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const org = await app.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    // Check permission
    const isAdmin = isAdminGap(user.roles);
    const isOperador = user.roles.some(
      (r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla
    );

    if (!isAdmin && !isOperador) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const updated = await app.prisma.organization.update({
      where: { id },
      data: { serial: { increment: 1 } },
    });

    return { serial: Number(updated.serial) };
  });
}
