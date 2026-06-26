import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const setVariableSchema = z.object({
  orgId: z.string(),
  key: z.string().min(1),
  value: z.string(),
});

function isAdminGap(roles: any[]) {
  return roles.some((r: any) => r.role === 'admin_gap');
}

export default async function variablesRoutes(app: FastifyInstance) {
  // List variables for an organization
  app.get('/:orgId', async (request, reply) => {
    const user = (request as any).user;
    const { orgId } = request.params as { orgId: string };

    const org = await app.prisma.organization.findUnique({ where: { id: orgId } });
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

    const variables = await app.prisma.orgVariable.findMany({
      where: { orgId },
      orderBy: { key: 'asc' },
    });

    return { orgId, sigla: org.sigla, variables };
  });

  // Set variable
  app.post('/', async (request, reply) => {
    const user = (request as any).user;
    const body = setVariableSchema.parse(request.body);

    const org = await app.prisma.organization.findUnique({
      where: { id: body.orgId },
    });
    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    // Check permission (admin or operador for this org)
    const isAdmin = isAdminGap(user.roles);
    const isOperador = user.roles.some(
      (r: any) => r.role === 'operador_om' && r.orgSigla === org.sigla
    );

    if (!isAdmin && !isOperador) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await app.prisma.orgVariable.upsert({
      where: { orgId_key: { orgId: body.orgId, key: body.key } },
      update: { value: body.value },
      create: { orgId: body.orgId, key: body.key, value: body.value },
    });

    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'variables',
        acao: 'set',
        alvo: `${org.sigla}/${body.key}`,
        detalhes: `value: ${body.value.substring(0, 50)}...`,
      },
    });

    return { success: true };
  });

  // Delete variable
  app.delete('/:orgId/:key', async (request, reply) => {
    const user = (request as any).user;
    const { orgId, key } = request.params as { orgId: string; key: string };

    const org = await app.prisma.organization.findUnique({ where: { id: orgId } });
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

    await app.prisma.orgVariable.delete({
      where: { orgId_key: { orgId, key } },
    });

    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'variables',
        acao: 'delete',
        alvo: `${org.sigla}/${key}`,
      },
    });

    return { success: true };
  });

  // List variable catalog
  app.get('/catalog', async () => {
    const catalog = await app.prisma.variableCatalog.findMany({
      orderBy: { key: 'asc' },
    });
    return catalog;
  });

  // Add to catalog (admin_gap only)
  app.post('/catalog', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdminGap(user.roles)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const body = z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      descricao: z.string().optional(),
      tipo: z.enum(['string', 'number', 'boolean', 'url', 'email']).optional(),
      escopo: z.enum(['core', 'custom']).optional(),
      obrigatoria: z.boolean().optional(),
      exemplo: z.string().optional(),
      defaultValue: z.string().optional(),
    }).parse(request.body);

    const entry = await app.prisma.variableCatalog.upsert({
      where: { key: body.key },
      update: body,
      create: {
        key: body.key,
        label: body.label,
        descricao: body.descricao || '',
        tipo: body.tipo || 'string',
        escopo: body.escopo || 'custom',
        obrigatoria: body.obrigatoria || false,
        exemplo: body.exemplo,
        defaultValue: body.defaultValue,
      },
    });

    return entry;
  });

  // Delete from catalog (admin_gap only)
  app.delete('/catalog/:key', async (request, reply) => {
    const user = (request as any).user;
    if (!isAdminGap(user.roles)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { key } = request.params as { key: string };
    await app.prisma.variableCatalog.delete({ where: { key } });
    await app.prisma.auditEvent.create({
      data: {
        atorId: user.userId,
        atorEmail: user.email,
        categoria: 'variables',
        acao: 'catalog_delete',
        alvo: key,
      },
    });
    return { success: true };
  });
}
