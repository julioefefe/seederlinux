// SeederLinux API Client
// Replaces Supabase with direct fetch to our Fastify backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('auth_token');
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  auth?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const token = getAuthToken();
  if (auth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Clear token but DON'T redirect - let AuthProvider handle it
    clearAuthToken();
    const error = new Error('Unauthorized');
    (error as any).status = 401;
    throw error;
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  me: () => api<any>('/api/auth/me'),

  logout: () => api<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
};

// Setup API
export const setupApi = {
  status: () => api<{ completed: boolean }>('/api/setup/status', { auth: false }),

  complete: (data: {
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
    authBackend?: 'sssd' | 'winbind';
    authMethod?: 'ads' | 'ldap';
    printServer?: string;
    defaultPrinter?: string;
  }) =>
    api<{ success: boolean; token: string; user: any; organization: any }>(
      '/api/setup',
      { method: 'POST', body: data, auth: false }
    ),
};

// Users API
export const usersApi = {
  list: () => api<any[]>('/api/users'),

  create: (data: {
    email: string;
    password: string;
    displayName?: string;
    role: 'admin_gap' | 'operador_om' | 'auditor';
    orgSigla?: string;
  }) => api<any>('/api/users', { method: 'POST', body: data }),

  delete: (id: string) => api<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
};

// Organizations API
export const organizationsApi = {
  list: () => api<any[]>('/api/organizations'),

  get: (id: string) => api<any>(`/api/organizations/${id}`),

  create: (data: any) => api<any>('/api/organizations', { method: 'POST', body: data }),

  update: (id: string, data: any) =>
    api<any>(`/api/organizations/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    api<{ success: boolean }>(`/api/organizations/${id}`, { method: 'DELETE' }),
};

// Scripts API
export const scriptsApi = {
  list: () => api<any[]>('/api/scripts'),

  get: (id: string) => api<any>(`/api/scripts/${id}`),

  create: (data: any) => api<any>('/api/scripts', { method: 'POST', body: data }),

  update: (id: string, data: any) =>
    api<any>(`/api/scripts/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    api<{ success: boolean }>(`/api/scripts/${id}`, { method: 'DELETE' }),
};

// Variables API
export const variablesApi = {
  list: (orgId: string) => api<{ orgId: string; sigla: string; variables: any[] }>(`/api/variables/${orgId}`),

  set: (orgId: string, key: string, value: string) =>
    api<{ success: boolean }>('/api/variables', {
      method: 'POST',
      body: { orgId, key, value },
    }),

  delete: (orgId: string, key: string) =>
    api<{ success: boolean }>(`/api/variables/${orgId}/${key}`, { method: 'DELETE' }),

  catalog: () => api<any[]>('/api/variables/catalog/list'),
};

// Branding API
export const brandingApi = {
  get: (orgId: string) => api<any>(`/api/branding/${orgId}`),

  upsert: (data: any) => api<any>('/api/branding', { method: 'POST', body: data }),
};

// Stations API
export const stationsApi = {
  list: (orgId?: string) => api<any[]>(`/api/stations${orgId ? `?orgId=${orgId}` : ''}`),

  get: (id: string) => api<any>(`/api/stations/${id}`),

  create: (data: any) => api<any>('/api/stations', { method: 'POST', body: data }),

  update: (id: string, data: any) =>
    api<any>(`/api/stations/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    api<{ success: boolean }>(`/api/stations/${id}`, { method: 'DELETE' }),

  generateToken: (id: string) =>
    api<{ token: string }>(`/api/stations/${id}/tokens`, { method: 'POST' }),

  revokeToken: (stationId: string, tokenId: string) =>
    api<{ success: boolean }>(`/api/stations/${stationId}/tokens/${tokenId}`, { method: 'DELETE' }),

  runs: (id: string) =>
    api<any[]>(`/api/stations/${id}/runs`),
};

// Profiles API
export const profilesApi = {
  list: (orgId?: string) => api<any[]>(`/api/profiles${orgId ? `?orgId=${orgId}` : ''}`),

  get: (id: string) => api<any>(`/api/profiles/${id}`),

  create: (data: any) => api<any>('/api/profiles', { method: 'POST', body: data }),

  update: (id: string, data: any) =>
    api<any>(`/api/profiles/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    api<{ success: boolean }>(`/api/profiles/${id}`, { method: 'DELETE' }),
};

// Audit API
export const auditApi = {
  list: (query?: { categoria?: string; acao?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.categoria) params.set('categoria', query.categoria);
    if (query?.acao) params.set('acao', query.acao);
    if (query?.limit) params.set('limit', query.limit.toString());
    const qs = params.toString();
    return api<{ events: any[]; total: number }>(`/api/audit${qs ? `?${qs}` : ''}`);
  },

  stats: (days?: number) =>
    api<any>(`/api/audit/stats${days ? `?days=${days}` : ''}`),
};

// Provisioning API
export const provisioningApi = {
  preview: (data: { orgId: string; scriptIds?: string[]; profileId?: string }) =>
    api<any>('/api/provisioning/preview', { method: 'POST', body: data }),

  generate: (data: { orgId: string; scriptIds?: string[]; profileId?: string; stationId?: string }) =>
    api<{ serial: string; scripts: any[]; config: string }>('/api/provisioning/generate', { method: 'POST', body: data }),
};

// Station check-in API (public, used by agents)
export const stationPublicApi = {
  checkin: (data: {
    token: string;
    hostname: string;
    ip?: string;
    distro?: string;
    desktop?: string;
    serial?: number;
    status?: string;
    agentVersion?: string;
  }) =>
    api<{ success: boolean; stationId: string }>('/api/public/station-checkin', {
      method: 'POST',
      body: data,
      auth: false,
    }),
};
