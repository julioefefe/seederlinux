import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';

// Prisma 5: construtor vazio, lê DATABASE_URL do ambiente automaticamente
const prisma = new PrismaClient();

// Helper to check roles
function hasRole(userRoles: any[], role: string): boolean {
  return userRoles.some((r: any) => r.role === role);
}

function isAdminGap(userRoles: any[]): boolean {
  return hasRole(userRoles, 'admin_gap');
}

function canAccessOrg(userRoles: any[], orgSigla: string): boolean {
  return isAdminGap(userRoles) ||
    hasRole(userRoles, 'auditor') ||
    userRoles.some((r: any) => r.role === 'operador_om' && r.orgSigla === orgSigla);
}

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'seederlinux-jwt-secret',
  });

  // Authentication middleware - adds request.user from JWT
  const authenticate = async function(request: any, reply: any) {
    try {
      await request.jwtVerify();
      // request.user is now populated with { userId, email, roles }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  // Add authentication to all /api/* routes except public ones
  app.addHook('onRequest', async (request: any, reply) => {
    // Skip authentication for public routes
    if (request.url === '/health' ||
        request.url === '/api/setup' ||
        request.url === '/api/setup/status' ||
        request.url === '/api/auth/login' ||
        request.url.startsWith('/api/public/')) {
      return;
    }
    // Apply authentication to all other /api/* routes
    if (request.url.startsWith('/api/')) {
      await authenticate(request, reply);
    }
  });

  // Health check (public)
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // ============================================================================
  // SETUP ROUTE (PUBLIC - Create admin, org, core scripts) - 4 Step Wizard
  // ============================================================================
  app.post('/api/setup', async (request, reply) => {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'setup_completed' },
    });
    if (config?.value === 'true') {
      return reply.code(400).send({ error: 'Setup already completed' });
    }

    const {
      setupToken,
      // Step 2: Admin
      adminEmail,
      adminPassword,
      adminName,
      // Step 2: Domain Configuration
      orgName,
      orgSigla,
      orgDescricao,
      fqdn,
      netbios,
      realm,
      dcPrimaryIp,
      dcSecondaryIp,
      dcFqdn,
      dnsPrimary,
      dnsSecondary,
      searchDomains,
      // Step 3: NTP
      ntpServers,
      timezone,
      // Step 3: Proxy
      httpProxy,
      httpsProxy,
      ftpProxy,
      noProxy,
      // Step 3: Authentication
      authBackend,
      authMethod,
      // Step 3: Printers
      printServer,
      defaultPrinter,
      // Step 4: Branding
      displayName,
      wallpaperUrl,
      wallpaperLogin,
      logoUrl,
      greeterUrl,
      theme,
      // Step 4: Profile
      deployProfile,
    } = request.body as any;

    // Trim tokens before comparison to avoid whitespace issues
    const expectedToken = (process.env.SETUP_TOKEN || '').trim();
    const receivedToken = (setupToken || '').trim();

    if (!expectedToken || receivedToken !== expectedToken) {
      console.log('[setup] Token mismatch. Expected:', expectedToken ? 'set' : 'not set', 'Received:', receivedToken ? 'set' : 'not set');
      return reply.code(401).send({ error: 'Invalid setup token' });
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create organization with all fields
    const org = await prisma.organization.create({
      data: {
        nome: orgName,
        sigla: orgSigla.toUpperCase(),
        descricao: orgDescricao || '',
        status: 'active',
        // Domain
        fqdn: fqdn?.toLowerCase() || '',
        netbios: netbios?.toUpperCase() || orgSigla.toUpperCase(),
        realm: realm?.toUpperCase() || (orgSigla.toUpperCase() + '.INTRAER'),
        // DC
        dcPrimaryIp: dcPrimaryIp || '',
        dcSecondaryIp: dcSecondaryIp || null,
        dcFqdn: dcFqdn || '',
        // DNS
        dnsPrimary: dnsPrimary || '8.8.8.8',
        dnsSecondary: dnsSecondary || null,
        searchDomains: searchDomains || [fqdn].filter(Boolean),
        // NTP
        ntpServers: ntpServers || ['pool.ntp.org'],
        timezone: timezone || 'America/Sao_Paulo',
        // Proxy
        httpProxy: httpProxy || '',
        httpsProxy: httpsProxy || '',
        ftpProxy: ftpProxy || null,
        noProxy: noProxy || ['localhost', '127.0.0.1'],
        // Auth
        authBackend: authBackend || 'sssd',
        authMethod: authMethod || 'ads',
        // Printers
        printServer: printServer || null,
        defaultPrinter: defaultPrinter || null,
        // Profile
        deployProfile: deployProfile || 'standard',
        // Legacy compatibility
        dominio: fqdn || '',
        dcHostname: dcFqdn || '',
        dcIp: dcPrimaryIp || '',
        metodoAd: authBackend === 'sssd' ? 'sssd' : 'winbind',
      },
    });

    // Create default variables
    await prisma.orgVariable.createMany({
      data: [
        // Domain
        { orgId: org.id, key: 'AD_DOMAIN', value: fqdn || '' },
        { orgId: org.id, key: 'AD_REALM', value: realm || orgSigla.toUpperCase() + '.INTRAER' },
        { orgId: org.id, key: 'AD_NETBIOS', value: netbios || orgSigla.toUpperCase() },
        { orgId: org.id, key: 'AD_DC_PRIMARY', value: dcPrimaryIp || '' },
        { orgId: org.id, key: 'AD_DC_SECONDARY', value: dcSecondaryIp || '' },
        { orgId: org.id, key: 'AD_DC_FQDN', value: dcFqdn || '' },
        { orgId: org.id, key: 'AD_BACKEND', value: authBackend || 'sssd' },
        { orgId: org.id, key: 'AD_METHOD', value: authMethod || 'ads' },
        // DNS
        { orgId: org.id, key: 'DNS_PRIMARY', value: dnsPrimary || '8.8.8.8' },
        { orgId: org.id, key: 'DNS_SECONDARY', value: dnsSecondary || '' },
        { orgId: org.id, key: 'DNS_SEARCH_DOMAINS', value: (searchDomains || []).join(',') },
        // NTP
        { orgId: org.id, key: 'NTP_SERVERS', value: (ntpServers || ['pool.ntp.org']).join(',') },
        { orgId: org.id, key: 'TIMEZONE', value: timezone || 'America/Sao_Paulo' },
        // Proxy
        { orgId: org.id, key: 'PROXY_HTTP', value: httpProxy || '' },
        { orgId: org.id, key: 'PROXY_HTTPS', value: httpsProxy || '' },
        { orgId: org.id, key: 'PROXY_FTP', value: ftpProxy || '' },
        { orgId: org.id, key: 'PROXY_NO_PROXY', value: (noProxy || []).join(',') },
        { orgId: org.id, key: 'PROXY_ENABLED', value: httpProxy ? 'true' : 'false' },
        // Printers
        { orgId: org.id, key: 'PRINT_SERVER', value: printServer || '' },
        { orgId: org.id, key: 'PRINT_DEFAULT', value: defaultPrinter || '' },
        // Branding
        { orgId: org.id, key: 'BRANDING_NAME', value: displayName || orgName },
        { orgId: org.id, key: 'BRANDING_WALLPAPER', value: wallpaperUrl || '' },
        { orgId: org.id, key: 'BRANDING_WALLPAPER_LOGIN', value: wallpaperLogin || '' },
        { orgId: org.id, key: 'BRANDING_LOGO', value: logoUrl || '' },
        { orgId: org.id, key: 'BRANDING_GREETER', value: greeterUrl || '' },
        { orgId: org.id, key: 'BRANDING_THEME', value: theme || 'Mint-Y-Dark' },
        // Profile
        { orgId: org.id, key: 'DEPLOY_PROFILE', value: deployProfile || 'standard' },
        // Organization
        { orgId: org.id, key: 'ORG_NAME', value: orgName },
        { orgId: org.id, key: 'ORG_SIGLA', value: orgSigla.toUpperCase() },
      ],
      skipDuplicates: true,
    });

    // Create branding config
    await prisma.brandingConfig.create({
      data: {
        orgId: org.id,
        displayName: displayName || orgName,
        wallpaperUrl: wallpaperUrl || null,
        wallpaperLogin: wallpaperLogin || null,
        logoUrl: logoUrl || null,
        greeterUrl: greeterUrl || null,
        theme: theme || 'Mint-Y-Dark',
      },
    });

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        displayName: adminName,
        roles: { create: { role: 'admin_gap' } }
      },
      include: { roles: true },
    });

    // Create core scripts (12 modules from Doc 07)
    const coreScripts = [
      { id: 'core-001', nome: 'Provisionamento de Estacoes', descricao: 'Automatiza a criacao completa de estacoes Linux padronizadas', categoria: 'core', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Provisionando estacao para $ORG_NAME..."', variaveisUsadas: ['ORG_SIGLA', 'HOSTNAME', 'DEPLOY_PROFILE'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-002', nome: 'Integracao AD / Samba / LDAP', descricao: 'Integra estacao ao dominio institucional', categoria: 'ad', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Ingressando no dominio $AD_DOMAIN..."', variaveisUsadas: ['AD_DOMAIN', 'AD_REALM', 'AD_NETBIOS', 'AD_DC_PRIMARY', 'AD_BACKEND', 'AD_METHOD'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-003', nome: 'Configuracao DNS', descricao: 'Aplica DNS correto conforme localizacao da OM', categoria: 'dns', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Configurando DNS: $DNS_PRIMARY"', variaveisUsadas: ['DNS_PRIMARY', 'DNS_SECONDARY', 'DNS_SEARCH_DOMAINS'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-004', nome: 'Sincronizacao NTP', descricao: 'Sincroniza horario com servidores oficiais', categoria: 'ntp', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Configurando NTP: $NTP_SERVERS"', variaveisUsadas: ['NTP_SERVERS', 'TIMEZONE'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-005', nome: 'Configuracao Proxy', descricao: 'Define acesso a internet via proxy corporativo', categoria: 'proxy', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\nif [ -n "$PROXY_HTTP" ]; then echo "Configurando proxy: $PROXY_HTTP"; fi', variaveisUsadas: ['PROXY_HTTP', 'PROXY_HTTPS', 'PROXY_NO_PROXY', 'PROXY_ENABLED'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-006', nome: 'Aplicacao de Branding', descricao: 'Personaliza identidade visual da OM', categoria: 'branding', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Aplicando branding: $BRANDING_NAME"', variaveisUsadas: ['BRANDING_NAME', 'BRANDING_WALLPAPER', 'BRANDING_LOGO', 'BRANDING_THEME'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-007', nome: 'Gestao de Pacotes Base', descricao: 'Instala e remove pacotes padrao da OM', categoria: 'sistema', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Instalando pacotes base..."', variaveisUsadas: ['DEPLOY_PROFILE'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: false },
      { id: 'core-008', nome: 'Gestao de Impressoras', descricao: 'Configura impressoras por OM', categoria: 'printer', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\nif [ -n "$PRINT_SERVER" ]; then echo "Configurando impressoras: $PRINT_SERVER"; fi', variaveisUsadas: ['PRINT_SERVER', 'PRINT_DEFAULT'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: false },
      { id: 'core-009', nome: 'Inventario Automatico', descricao: 'Coleta informacoes da maquina e envia ao SeederHub', categoria: 'automacao', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Coletando inventario..."', variaveisUsadas: ['ORG_SIGLA'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: false },
      { id: 'core-010', nome: 'Check-in SeederHub', descricao: 'Estacao reporta status periodicamente', categoria: 'automacao', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Reportando status..."', variaveisUsadas: ['ORG_SIGLA'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: false },
      { id: 'core-011', nome: 'Hardening de Sistema', descricao: 'Aplica baseline de seguranca institucional', categoria: 'seguranca', scriptType: 'CORE', conteudo: '#!/bin/bash\necho "Aplicando hardening SSH..."', variaveisUsadas: [], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: true },
      { id: 'core-012', nome: 'Sistema de Atualizacao', descricao: 'Controla updates do sistema por politica OM', categoria: 'sistema', scriptType: 'CORE', conteudo: '#!/bin/bash\nsource /etc/{{ORG_SIGLA}}.conf\necho "Verificando atualizacoes..."', variaveisUsadas: ['DEPLOY_PROFILE'], autor: 'SeederLinux', oficial: true, status: 'pronto', mandatario: false },
    ];

    for (const script of coreScripts) {
      await prisma.script.create({ data: script as any });
    }

    // Create default profiles
    await prisma.seederProfile.createMany({
      data: [
        { id: 'profile-minimal', nome: 'Perfil Minimal', descricao: 'Scripts essenciais apenas', scriptIds: ['core-001', 'core-002', 'core-003', 'core-004'], profileType: 'minimal', publico: true },
        { id: 'profile-standard', nome: 'Perfil Standard', descricao: 'Scripts padroes para uso diario', scriptIds: ['core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006', 'core-007', 'core-011'], profileType: 'standard', publico: true },
        { id: 'profile-full', nome: 'Perfil Full', descricao: 'Todos os scripts CORE', scriptIds: ['core-001', 'core-002', 'core-003', 'core-004', 'core-005', 'core-006', 'core-007', 'core-008', 'core-009', 'core-010', 'core-011', 'core-012'], profileType: 'full', publico: true },
      ],
      skipDuplicates: true,
    });

    // Mark setup as completed
    await prisma.systemConfig.upsert({
      where: { key: 'setup_completed' },
      update: { value: 'true' },
      create: { key: 'setup_completed', value: 'true' },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        atorId: admin.id,
        atorEmail: admin.email,
        orgId: org.id,
        categoria: 'setup',
        acao: 'complete',
        alvo: orgSigla,
        detalhes: `Organization created with profile: ${deployProfile || 'standard'}`
      },
    });

    // Generate JWT
    const token = app.jwt.sign({
      userId: admin.id,
      email: admin.email,
      roles: admin.roles.map((r: any) => ({ role: r.role, orgSigla: r.orgSigla })),
    });

    return {
      success: true,
      token,
      user: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        roles: admin.roles
      },
      organization: org
    };
  });

  app.get('/api/setup/status', async () => {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'setup_completed' } });
    return { completed: config?.value === 'true' };
  });

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { roles: true } });
    if (!user || user.blocked) return reply.code(401).send({ error: 'Invalid credentials' });
    const bcrypt = await import('bcrypt');
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return reply.code(401).send({ error: 'Invalid credentials' });
    const token = app.jwt.sign({
      userId: user.id, email: user.email, roles: user.roles.map((r: any) => ({ role: r.role, orgSigla: r.orgSigla })),
    });
    await prisma.auditEvent.create({ data: { atorId: user.id, atorEmail: user.email, categoria: 'auth', acao: 'login', alvo: user.email } });
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles } };
  });

  app.get('/api/auth/me', async (request: any, reply) => {
    const fullUser = await prisma.user.findUnique({
      where: { id: request.user.userId },
      include: { roles: true },
    });

    if (!fullUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return {
      id: fullUser.id,
      email: fullUser.email,
      displayName: fullUser.displayName,
      blocked: fullUser.blocked,
      roles: fullUser.roles.map((r: any) => ({ id: r.id, role: r.role, orgSigla: r.orgSigla })),
    };
  });

  // ============================================================================
  // USERS ROUTES (Admin GAP only)
  // ============================================================================
  app.get('/api/users', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    const users = await prisma.user.findMany({ include: { roles: true }, orderBy: { email: 'asc' } });
    return users.map((u: any) => ({ id: u.id, email: u.email, displayName: u.displayName, blocked: u.blocked, createdAt: u.createdAt, roles: u.roles }));
  });

  app.post('/api/users', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    const { email, password, displayName, role, orgSigla } = request.body as any;
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), password: hashedPassword, displayName, roles: { create: { role, orgSigla } } },
      include: { roles: true },
    });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'users', acao: 'create', alvo: email },
    });
    return user;
  });

  app.delete('/api/users/:id', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    if (request.params.id === request.user.userId) return reply.code(400).send({ error: 'Cannot delete yourself' });
    const user = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!user) return reply.code(404).send({ error: 'Not found' });
    await prisma.user.delete({ where: { id: request.params.id } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'users', acao: 'delete', alvo: user.email },
    });
    return { success: true };
  });

  // ============================================================================
  // ORGANIZATIONS ROUTES
  // ============================================================================
  app.get('/api/organizations', async (request: any) => {
    const user = request.user;
    if (isAdminGap(user.roles) || hasRole(user.roles, 'auditor')) {
      return prisma.organization.findMany({ orderBy: { sigla: 'asc' } });
    }
    const siglas = user.roles.filter((r: any) => r.role === 'operador_om' && r.orgSigla).map((r: any) => r.orgSigla);
    return prisma.organization.findMany({ where: { sigla: { in: siglas } }, orderBy: { sigla: 'asc' } });
  });

  app.get('/api/organizations/:id', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.id }, include: { variables: true, branding: true } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    return org;
  });

  app.post('/api/organizations', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    const data = request.body as any;
    data.sigla = data.sigla.toUpperCase();
    const org = await prisma.organization.create({ data });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'organizations', acao: 'create', alvo: org.sigla },
    });
    return org;
  });

  app.patch('/api/organizations/:id', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.id } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const updated = await prisma.organization.update({ where: { id: request.params.id }, data: request.body as any });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'organizations', acao: 'update', alvo: org.sigla },
    });
    return updated;
  });

  app.delete('/api/organizations/:id', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    const org = await prisma.organization.findUnique({ where: { id: request.params.id } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    await prisma.organization.delete({ where: { id: request.params.id } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'organizations', acao: 'delete', alvo: org.sigla },
    });
    return { success: true };
  });

  // ============================================================================
  // SCRIPTS ROUTES
  // ============================================================================
  app.get('/api/scripts', async () => {
    return prisma.script.findMany({ orderBy: [{ oficial: 'desc' }, { nome: 'asc' }] });
  });

  app.get('/api/scripts/:id', async (request: any, reply) => {
    const script = await prisma.script.findUnique({ where: { id: request.params.id } });
    if (!script) return reply.code(404).send({ error: 'Not found' });
    return script;
  });

  app.post('/api/scripts', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles) && !hasRole(request.user.roles, 'operador_om')) return reply.code(403).send({ error: 'Forbidden' });
    const script = await prisma.script.create({ data: { ...(request.body as any), status: 'rascunho' } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'scripts', acao: 'create', alvo: script.nome },
    });
    return script;
  });

  app.patch('/api/scripts/:id', async (request: any, reply) => {
    const script = await prisma.script.findUnique({ where: { id: request.params.id } });
    if (!script) return reply.code(404).send({ error: 'Not found' });
    if (script.oficial) return reply.code(403).send({ error: 'Oficial scripts cannot be modified' });
    const updated = await prisma.script.update({ where: { id: request.params.id }, data: { ...(request.body as any), atualizadoEm: new Date() } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'scripts', acao: 'update', alvo: script.nome },
    });
    return updated;
  });

  app.delete('/api/scripts/:id', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles)) return reply.code(403).send({ error: 'Forbidden' });
    const script = await prisma.script.findUnique({ where: { id: request.params.id } });
    if (!script) return reply.code(404).send({ error: 'Not found' });
    if (script.oficial) return reply.code(403).send({ error: 'Cannot delete oficial scripts' });
    await prisma.script.delete({ where: { id: request.params.id } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'scripts', acao: 'delete', alvo: script.nome },
    });
    return { success: true };
  });

  // ============================================================================
  // VARIABLES ROUTES
  // ============================================================================
  app.get('/api/variables/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    const variables = await prisma.orgVariable.findMany({ where: { orgId: request.params.orgId }, orderBy: { key: 'asc' } });
    return { orgId: request.params.orgId, sigla: org.sigla, variables };
  });

  app.post('/api/variables', async (request: any, reply) => {
    const { orgId, key, value } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await prisma.orgVariable.upsert({ where: { orgId_key: { orgId, key } }, update: { value }, create: { orgId, key, value } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'variables', acao: 'set', alvo: `${org.sigla}:${key}` },
    });
    return { success: true };
  });

  // ============================================================================
  // BRANDING ROUTES
  // ============================================================================
  app.get('/api/branding/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    const branding = await prisma.brandingConfig.findUnique({ where: { orgId: request.params.orgId } });
    return branding || { orgId: request.params.orgId, wallpaperUrl: null, logoUrl: null, conkyEnabled: false, conkyConfig: {}, theme: 'Mint-Y-Dark' };
  });

  app.post('/api/branding', async (request: any, reply) => {
    const { orgId, ...data } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return prisma.brandingConfig.upsert({ where: { orgId }, update: data, create: { orgId, ...data } as any });
  });

  // ============================================================================
  // STATIONS ROUTES
  // ============================================================================
  app.get('/api/stations', async (request: any) => {
    const user = request.user;
    const query = request.query as any;
    let where: any = {};
    if (query?.orgId) where.orgId = query.orgId;
    if (!isAdminGap(user.roles) && !hasRole(user.roles, 'auditor')) {
      const siglas = user.roles.filter((r: any) => r.role === 'operador_om' && r.orgSigla).map((r: any) => r.orgSigla);
      const orgs = await prisma.organization.findMany({ where: { sigla: { in: siglas } }, select: { id: true } });
      where.orgId = { in: orgs.map((o: any) => o.id) };
    }
    const stations = await prisma.station.findMany({ where, include: { organization: { select: { sigla: true, nome: true } } }, orderBy: { hostname: 'asc' } });
    return stations.map((s: any) => ({ ...s, serialAplicado: s.serialAplicado.toString() }));
  });

  app.post('/api/stations', async (request: any, reply) => {
    const data = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: data.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const station = await prisma.station.create({ data });
    await prisma.organization.update({ where: { id: data.orgId }, data: { estacoes: { increment: 1 } } });
    return station;
  });

  // ============================================================================
  // AUDIT ROUTES
  // ============================================================================
  app.get('/api/audit', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles) && !hasRole(request.user.roles, 'auditor')) return reply.code(403).send({ error: 'Forbidden' });
    return prisma.auditEvent.findMany({ take: 100, orderBy: { ts: 'desc' } });
  });

  // ============================================================================
  // PROFILES ROUTES
  // ============================================================================
  app.get('/api/profiles', async (request: any) => {
    const query = request.query as any;
    const where: any = { OR: [{ publico: true }] };
    if (query?.orgId) {
      const org = await prisma.organization.findUnique({ where: { id: query.orgId } });
      if (org) where.OR.push({ organizacaoOrigem: org.sigla });
    }
    return prisma.seederProfile.findMany({ where, orderBy: { nome: 'asc' } });
  });

  app.get('/api/profiles/:id', async (request: any, reply) => {
    const profile = await prisma.seederProfile.findUnique({ where: { id: request.params.id } });
    if (!profile) return reply.code(404).send({ error: 'Not found' });
    return profile;
  });

  app.post('/api/profiles', async (request: any, reply) => {
    if (!isAdminGap(request.user.roles) && !hasRole(request.user.roles, 'operador_om')) return reply.code(403).send({ error: 'Forbidden' });
    const profile = await prisma.seederProfile.create({ data: request.body as any });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'profiles', acao: 'create', alvo: request.body.nome },
    });
    return profile;
  });

  app.patch('/api/profiles/:id', async (request: any, reply) => {
    const profile = await prisma.seederProfile.findUnique({ where: { id: request.params.id } });
    if (!profile) return reply.code(404).send({ error: 'Not found' });
    const updated = await prisma.seederProfile.update({ where: { id: request.params.id }, data: request.body as any });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'profiles', acao: 'update', alvo: profile.nome },
    });
    return updated;
  });

  app.delete('/api/profiles/:id', async (request: any, reply) => {
    const profile = await prisma.seederProfile.findUnique({ where: { id: request.params.id } });
    if (!profile) return reply.code(404).send({ error: 'Not found' });
    await prisma.seederProfile.delete({ where: { id: request.params.id } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'profiles', acao: 'delete', alvo: profile.nome },
    });
    return { success: true };
  });

  // ============================================================================
  // VARIABLES ROUTES (Extended)
  // ============================================================================
  app.delete('/api/variables/:orgId/:key', async (request: any, reply) => {
    const { orgId, key } = request.params as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await prisma.orgVariable.delete({ where: { orgId_key: { orgId, key } } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'variables', acao: 'delete', alvo: `${org.sigla}:${key}` },
    });
    return { success: true };
  });

  // ============================================================================
  // STATIONS ROUTES (Extended)
  // ============================================================================
  app.get('/api/stations/:id', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: { select: { sigla: true, nome: true } } } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return { ...station, serialAplicado: station.serialAplicado.toString() };
  });

  app.patch('/api/stations/:id', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: true } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const updated = await prisma.station.update({ where: { id: request.params.id }, data: request.body as any });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'stations', acao: 'update', alvo: station.hostname },
    });
    return { ...updated, serialAplicado: updated.serialAplicado.toString() };
  });

  app.delete('/api/stations/:id', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: true } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await prisma.station.delete({ where: { id: request.params.id } });
    await prisma.organization.update({ where: { id: station.orgId }, data: { estacoes: { decrement: 1 } } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'stations', acao: 'delete', alvo: station.hostname },
    });
    return { success: true };
  });

  // Station tokens
  app.get('/api/stations/:id/tokens', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: true } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return prisma.stationToken.findMany({ where: { stationId: request.params.id, revokedAt: null } });
  });

  app.post('/api/stations/:id/tokens', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: true } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.stationToken.create({ data: { stationId: request.params.id, tokenHash, label: (request.body as any)?.label || 'agent' } });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'stations', acao: 'token_create', alvo: station.hostname },
    });
    return { token };
  });

  app.delete('/api/stations/:stationId/tokens/:tokenId', async (request: any, reply) => {
    await prisma.stationToken.update({
      where: { id: request.params.tokenId },
      data: { revokedAt: new Date() },
    });
    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'stations', acao: 'token_revoke', alvo: request.params.tokenId },
    });
    return { success: true };
  });

  // Station runs
  app.get('/api/stations/:id/runs', async (request: any, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: { organization: true } },
    );
    if (!station) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, station.organization.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return prisma.stationRun.findMany({ where: { stationId: request.params.id }, orderBy: { startedAt: 'desc' }, take: 50 });
  });

  // Station check-in (public API for agents)
  app.post('/api/public/station-checkin', async (request: any, reply) => {
    const { token, hostname, ip, distro, desktop, serial, status, agentVersion } = request.body as any;

    // Find token by hash
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await prisma.stationToken.findUnique({ where: { tokenHash }, include: { station: true } });

    if (!tokenRecord || tokenRecord.revokedAt) {
      return reply.code(401).send({ error: 'Invalid or revoked token' });
    }

    const station = tokenRecord.station;

    // Update station status
    await prisma.station.update({
      where: { id: station.id },
      data: {
        hostname: hostname || station.hostname,
        ip: ip || station.ip,
        distro: distro || station.distro,
        desktop: desktop || station.desktop,
        serialAplicado: BigInt(serial || 0),
        ultimoCheckin: new Date(),
        status: status || 'ok',
      },
    });

    // Update token last used
    await prisma.stationToken.update({
      where: { id: tokenRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Create run record if serial changed
    if (serial && BigInt(serial) > station.serialAplicado) {
      await prisma.stationRun.create({
        data: {
          stationId: station.id,
          serialAlvo: BigInt(serial),
          serialAnterior: station.serialAplicado,
          status: 'ok',
          agentVersion: agentVersion,
        },
      });
    }

    return { success: true, stationId: station.id };
  });

  // ============================================================================
  // PROVISIONING ROUTES
  // ============================================================================
  app.post('/api/provisioning/preview', async (request: any, reply) => {
    const { orgId, scriptIds, profileId } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Organization not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });

    const variables = await prisma.orgVariable.findMany({ where: { orgId } });
    let scripts = await prisma.script.findMany({ where: { status: 'pronto' } });

    if (profileId) {
      const profile = await prisma.seederProfile.findUnique({ where: { id: profileId } });
      if (profile?.scriptIds?.length) {
        scripts = scripts.filter(s => profile.scriptIds.includes(s.id));
      }
    } else if (scriptIds?.length) {
      scripts = scripts.filter(s => scriptIds.includes(s.id));
    }

    // Generate preview of each script with variable substitution
    const varMap: Record<string, string> = {};
    variables.forEach(v => { varMap[v.key] = v.value; });

    const preview = scripts.map(s => ({
      id: s.id,
      nome: s.nome,
      conteudo: s.conteudo.replace(/\{\{\s*([A-Z][A-Z0-9_]+)\s*\}\}/g, (_, key) => varMap[key] || `{{${key}}}`),
    }));

    return { org, scripts: preview, variables };
  });

  app.post('/api/provisioning/generate', async (request: any, reply) => {
    const { orgId, scriptIds, profileId, stationId } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Organization not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });

    const variables = await prisma.orgVariable.findMany({ where: { orgId } });
    let scripts = await prisma.script.findMany({ where: { status: 'pronto' } });

    if (profileId) {
      const profile = await prisma.seederProfile.findUnique({ where: { id: profileId } });
      if (profile?.scriptIds?.length) {
        scripts = scripts.filter(s => profile.scriptIds.includes(s.id));
      }
    } else if (scriptIds?.length) {
      scripts = scripts.filter(s => scriptIds.includes(s.id));
    }

    // Increment serial
    const newSerial = org.serial + BigInt(1);
    await prisma.organization.update({ where: { id: orgId }, data: { serial: newSerial } });

    // Variable substitution
    const varMap: Record<string, string> = {};
    variables.forEach(v => { varMap[v.key] = v.value; });

    const processedScripts = scripts.map(s => ({
      ...s,
      conteudo: s.conteudo.replace(/\{\{\s*([A-Z][A-Z0-9_]+)\s*\}\}/g, (_, key) => varMap[key] || `{{${key}}}`),
    }));

    // Generate configuration file
    const confLines = [
      `# SeederLinux Configuration for ${org.sigla}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Serial: ${newSerial}`,
      ``,
      `export ORG="${org.sigla.toLowerCase()}"`,
      `export SERIAL="${newSerial}"`,
      ``,
    ];
    variables.forEach(v => {
      confLines.push(`export ${v.key}="${v.value}"`);
    });

    await prisma.auditEvent.create({
      data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'provisioning', acao: 'generate', alvo: org.sigla, detalhes: `serial=${newSerial}, scripts=${scripts.length}` },
    });

    return {
      serial: newSerial.toString(),
      scripts: processedScripts,
      config: confLines.join('\n'),
    };
  });

  // ============================================================================
  // BROWSER POLICIES ROUTES
  // ============================================================================
  app.get('/api/browser-policies/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    return prisma.browserPolicy.findMany({ where: { orgId: request.params.orgId }, include: { bookmarks: true } });
  });

  app.post('/api/browser-policies', async (request: any, reply) => {
    const { orgId, browser, homepage, bookmarksEnabled, proxyEnabled, certificatesEnabled, telemetryDisabled, updatesDisabled } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const existing = await prisma.browserPolicy.findFirst({ where: { orgId, browser } });
    let result;
    if (existing) {
      result = await prisma.browserPolicy.update({ where: { id: existing.id }, data: { homepage, bookmarksEnabled, proxyEnabled, certificatesEnabled, telemetryDisabled, updatesDisabled } });
    } else {
      result = await prisma.browserPolicy.create({ data: { orgId, browser, homepage, bookmarksEnabled, proxyEnabled, certificatesEnabled, telemetryDisabled, updatesDisabled } });
    }
    await prisma.auditEvent.create({ data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'browser_policies', acao: 'upsert', alvo: `${org.sigla}:${browser}` } });
    return result;
  });

  // ============================================================================
  // PRINTER PROFILES ROUTES
  // ============================================================================
  app.get('/api/printer-profiles/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    return prisma.printerProfile.findMany({ where: { orgId: request.params.orgId }, include: { queues: true } });
  });

  app.post('/api/printer-profiles', async (request: any, reply) => {
    const { orgId, name, cupsServer, defaultQueue } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const existing = await prisma.printerProfile.findFirst({ where: { orgId } });
    let result;
    if (existing) {
      result = await prisma.printerProfile.update({ where: { id: existing.id }, data: { name, cupsServer, defaultQueue } });
    } else {
      result = await prisma.printerProfile.create({ data: { orgId, name, cupsServer, defaultQueue } });
    }
    await prisma.auditEvent.create({ data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'printer_profiles', acao: 'upsert', alvo: org.sigla } });
    return result;
  });

  // ============================================================================
  // DESKTOP POLICIES ROUTES (stored as org variables)
  // ============================================================================
  app.get('/api/desktop-policies/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    const vars = await prisma.orgVariable.findMany({ where: { orgId: request.params.orgId, key: { startsWith: 'DESKTOP_' } } });
    const config: Record<string, any> = {};
    for (const v of vars) {
      if (v.key.startsWith('DESKTOP_')) {
        const field = v.key.replace('DESKTOP_', '').toLowerCase();
        if (['soundsenabled', 'notificationsenabled'].includes(field)) {
          config[field] = v.value === 'true';
        } else if (['screensavertimeout', 'powertimeout'].includes(field)) {
          config[field] = parseInt(v.value) || 0;
        } else {
          config[field] = v.value;
        }
      }
    }
    return { orgId: request.params.orgId, ...config };
  });

  app.post('/api/desktop-policies', async (request: any, reply) => {
    const { orgId, theme, iconTheme, cursorTheme, font, soundsEnabled, soundScheme, notificationsEnabled, screensaverTimeout, powerTimeout } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const entries = [
      { orgId, key: 'DESKTOP_THEME', value: theme || 'Mint-Y-Dark' },
      { orgId, key: 'DESKTOP_ICON_THEME', value: iconTheme || 'Mint-Y' },
      { orgId, key: 'DESKTOP_CURSOR_THEME', value: cursorTheme || 'default' },
      { orgId, key: 'DESKTOP_FONT', value: font || 'Cantarell 11' },
      { orgId, key: 'DESKTOP_SOUNDS_ENABLED', value: String(soundsEnabled ?? true) },
      { orgId, key: 'DESKTOP_SOUND_SCHEME', value: soundScheme || 'freedesktop' },
      { orgId, key: 'DESKTOP_NOTIFICATIONS_ENABLED', value: String(notificationsEnabled ?? true) },
      { orgId, key: 'DESKTOP_SCREENSAVER_TIMEOUT', value: String(screensaverTimeout ?? 300) },
      { orgId, key: 'DESKTOP_POWER_TIMEOUT', value: String(powerTimeout ?? 600) },
    ];
    for (const entry of entries) {
      await prisma.orgVariable.upsert({ where: { orgId_key: { orgId: entry.orgId, key: entry.key } }, create: entry, update: { value: entry.value } });
    }
    await prisma.auditEvent.create({ data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'desktop_policies', acao: 'upsert', alvo: org.sigla } });
    return { success: true };
  });

  // ============================================================================
  // OFFLINE AUTH CONFIG ROUTES (stored as org variables)
  // ============================================================================
  app.get('/api/offline-auth/:orgId', async (request: any, reply) => {
    const org = await prisma.organization.findUnique({ where: { id: request.params.orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!canAccessOrg(request.user.roles, org.sigla)) return reply.code(403).send({ error: 'Forbidden' });
    const vars = await prisma.orgVariable.findMany({ where: { orgId: request.params.orgId, key: { startsWith: 'OFFLINE_AUTH_' } } });
    const config: Record<string, any> = { orgId: request.params.orgId, enabled: false, cacheCredentials: false, offlineDays: 7, maxOfflineLogins: 10, autoSync: true, sssdConfig: '' };
    for (const v of vars) {
      const field = v.key.replace('OFFLINE_AUTH_', '').toLowerCase();
      if (['enabled', 'cachecredentials', 'autosync'].includes(field)) {
        config[field === 'cachecredentials' ? 'cacheCredentials' : field === 'autosync' ? 'autoSync' : field] = v.value === 'true';
      } else if (['offlinedays', 'maxofflinelogins'].includes(field)) {
        config[field === 'offlinedays' ? 'offlineDays' : 'maxOfflineLogins'] = parseInt(v.value) || 0;
      } else if (field === 'sssdconfig') {
        config.sssdConfig = v.value;
      }
    }
    return config;
  });

  app.post('/api/offline-auth', async (request: any, reply) => {
    const { orgId, enabled, cacheCredentials, offlineDays, maxOfflineLogins, autoSync, sssdConfig, adDomain } = request.body as any;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return reply.code(404).send({ error: 'Not found' });
    if (!isAdminGap(request.user.roles) && !request.user.roles.some((r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const entries = [
      { orgId, key: 'OFFLINE_AUTH_ENABLED', value: String(enabled ?? false) },
      { orgId, key: 'OFFLINE_AUTH_CACHE_CREDENTIALS', value: String(cacheCredentials ?? false) },
      { orgId, key: 'OFFLINE_AUTH_OFFLINE_DAYS', value: String(offlineDays ?? 7) },
      { orgId, key: 'OFFLINE_AUTH_MAX_OFFLINE_LOGINS', value: String(maxOfflineLogins ?? 10) },
      { orgId, key: 'OFFLINE_AUTH_AUTO_SYNC', value: String(autoSync ?? true) },
      { orgId, key: 'OFFLINE_AUTH_SSSD_CONFIG', value: sssdConfig || '' },
    ];
    for (const entry of entries) {
      await prisma.orgVariable.upsert({ where: { orgId_key: { orgId: entry.orgId, key: entry.key } }, create: entry, update: { value: entry.value } });
    }
    await prisma.auditEvent.create({ data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'offline_auth', acao: 'upsert', alvo: org.sigla } });
    return { success: true };
  });

  // ============================================================================
  // PROFILE IMPORT ROUTE (SeederHub)
  // ============================================================================
  app.post('/api/profiles/:id/import', async (request: any, reply) => {
    const original = await prisma.seederProfile.findUnique({ where: { id: request.params.id } });
    if (!original) return reply.code(404).send({ error: 'Not found' });
    const { targetOrgSigla } = request.body as any;
    let orgId: string | null = null;
    if (targetOrgSigla) {
      const org = await prisma.organization.findUnique({ where: { sigla: targetOrgSigla } });
      if (org) orgId = org.id;
    }
    const copy = await prisma.seederProfile.create({
      data: {
        nome: original.nome + ' (importado)',
        descricao: original.descricao,
        scriptIds: original.scriptIds,
        organizacaoOrigem: targetOrgSigla || null,
        publico: false,
        profileType: original.profileType,
      },
    });
    await prisma.auditEvent.create({ data: { atorId: request.user.userId, atorEmail: request.user.email, categoria: 'profiles', acao: 'import', alvo: original.nome, detalhes: `to ${targetOrgSigla || 'local'}` } });
    return copy;
  });

  // Graceful shutdown
  process.on('SIGINT', async () => { await prisma.$disconnect(); await app.close(); process.exit(0); });
  process.on('SIGTERM', async () => { await prisma.$disconnect(); await app.close(); process.exit(0); });

  return app;
}

async function start() {
  const app = await buildServer();
  const port = parseInt(process.env.PORT || '3001', 10);
  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 SeederLinux API running on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();