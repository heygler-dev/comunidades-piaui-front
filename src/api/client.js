const API_BASE = '/api/v1';

export function getToken() {
  return localStorage.getItem('premio_access_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('premio_access_token', token);
  else localStorage.removeItem('premio_access_token');
}

/** Sessão exclusiva do voto popular (não mistura com admin/painel). */
export function getVotoToken() {
  return localStorage.getItem('premio_voto_token');
}

export function setVotoToken(token) {
  if (token) localStorage.setItem('premio_voto_token', token);
  else localStorage.removeItem('premio_voto_token');
}

async function parseResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' ? data : null) ||
      `Erro ${res.status}`;
    const err = new Error(Array.isArray(message) ? message.join(', ') : String(message));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return parseResponse(res);
}

function withQuery(path, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') q.set(k, String(v));
  });
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

async function downloadAuth(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || path.split('/').pop() || 'backup.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { filename };
}

export const authApi = {
  login: (email, senha, papel = 'admin') =>
    api('/auth/login', { method: 'POST', body: { email, senha, papel } }),
  me: () => api('/auth/me'),
  meWithToken: (token) =>
    api('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
  switchPapel: (papel) =>
    api('/auth/switch-papel', { method: 'POST', body: { papel } }),
};

export const adminApi = {
  stats: () => api('/admin/inscricoes/stats'),
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.tipo && params.tipo !== 'todos') q.set('tipo', params.tipo);
    if (params.q) q.set('q', params.q);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api(`/admin/inscricoes${qs ? `?${qs}` : ''}`);
  },
  create: (body) => api('/admin/inscricoes', { method: 'POST', body }),
  update: (id, body) => api(`/admin/inscricoes/${id}`, { method: 'PUT', body }),
  remove: (id, tipo) => api(`/admin/inscricoes/${id}?tipo=${tipo}`, { method: 'DELETE' }),
  importStartups: (file) => {
    const fd = new FormData();
    fd.append('arquivo', file);
    return api('/admin/inscricoes/import/startups', { method: 'POST', body: fd });
  },
  importBasic: (file) => {
    const fd = new FormData();
    fd.append('arquivo', file);
    return api('/admin/inscricoes/import', { method: 'POST', body: fd });
  },
  edicao: () => api('/admin/edicao'),
  listEdicoes: () => api('/admin/edicoes'),
  clonarEdicao: (fonteEdicaoId) =>
    api('/admin/edicoes/clonar', { method: 'POST', body: { fonteEdicaoId } }),
  publicarRegulamento: () =>
    api('/admin/edicao/regulamento/publicar', { method: 'POST' }),
  updateConfig: (id, body) => api(`/admin/edicoes/${id}/config`, { method: 'PATCH', body }),
  downloadBackupInscricoes: () => downloadAuth('/admin/backup/inscricoes.csv'),
  downloadBackupVotos: () => downloadAuth('/admin/backup/votos.csv'),
  toggleVotacao: (id, aberta) =>
    api(`/admin/edicoes/${id}/votacao`, { method: 'PATCH', body: { aberta } }),
  toggleIndicacoes: (id, abertas) =>
    api(`/admin/edicoes/${id}/indicacoes`, { method: 'PATCH', body: { abertas } }),
  toggleColegio: (id, habilitado) =>
    api(`/admin/edicoes/${id}/colegio`, { method: 'PATCH', body: { habilitado } }),
  categorias: () => api('/admin/categorias'),
  createCategoria: (body) => api('/admin/categorias', { method: 'POST', body }),
  comunidades: () => api('/admin/comunidades'),
  createComunidade: (formData) =>
    api('/admin/comunidades', { method: 'POST', body: formData }),
  createLiderSemente: (body) =>
    api('/admin/comunidades/lider-semente', { method: 'POST', body }),
  createConviteLider: (comunidadeId) =>
    api('/admin/convites/lider', { method: 'POST', body: { comunidadeId } }),
  finalistas: () => api('/admin/finalistas'),
  createFinalista: (body) => api('/admin/finalistas', { method: 'POST', body }),
  anomalias: () => api('/admin/apuracao/anomalias'),
  quorum: () => api('/admin/apuracao/colegio/quorum'),
  promoverFinalistas: () =>
    api('/admin/apuracao/colegio/promover-finalistas', { method: 'POST' }),
  publicarResultados: () => api('/admin/apuracao/publicar', { method: 'POST' }),
  rankingVotos: () => api('/admin/apuracao/ranking'),
  testemunhas: () => api('/admin/apuracao/testemunhas'),
  convidarTestemunha: (body) =>
    api('/admin/apuracao/testemunhas', { method: 'POST', body }),
  auditoria: (params) => api(withQuery('/admin/auditoria', params)),
};

export const liderApi = {
  me: () => api('/lider/me'),
  link: (params) => api(withQuery('/lider/link', params)),
  stats: (params) => api(withQuery('/lider/stats', params)),
  lideres: (params) => api(withQuery('/lider/lideres', params)),
  inscricoes: (params) => api(withQuery('/lider/inscricoes', params)),
  aprovarInscricao: (id, params) =>
    api(withQuery(`/lider/inscricoes/${id}/aprovar`, params), { method: 'POST' }),
  rejeitarInscricao: (id, params) =>
    api(withQuery(`/lider/inscricoes/${id}/rejeitar`, params), { method: 'POST' }),
  nomear: (body, params) =>
    api(withQuery('/lider/lideres', params), { method: 'POST', body }),
  colegio: (body, params) =>
    api(withQuery('/lider/colegio', params), { method: 'PUT', body }),
  solicitacoes: (params) => api(withQuery('/lider/solicitacoes', params)),
  aprovarSolicitacao: (id, params) =>
    api(withQuery(`/lider/solicitacoes/${id}/aprovar`, params), { method: 'POST' }),
  rejeitarSolicitacao: (id, body, params) =>
    api(withQuery(`/lider/solicitacoes/${id}/rejeitar`, params), { method: 'POST', body }),
};

function inscricaoQuery(extra = {}) {
  const inscricaoId = localStorage.getItem('premio_inscricao_id');
  return inscricaoId ? { ...extra, inscricaoId } : { ...extra };
}

export const empreendedorApi = {
  me: () => api(withQuery('/empreendedor/me', inscricaoQuery())),
  update: (body) =>
    api(withQuery('/empreendedor/inscricao', inscricaoQuery()), {
      method: 'PATCH',
      body,
    }),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api(withQuery('/empreendedor/logo', inscricaoQuery()), {
      method: 'POST',
      body: fd,
    });
  },
  badges: (comunidadeIds) =>
    api(withQuery('/empreendedor/badges', inscricaoQuery()), {
      method: 'PUT',
      body: { comunidadeIds },
    }),
  senha: (senha) =>
    api(withQuery('/empreendedor/senha', inscricaoQuery()), {
      method: 'PUT',
      body: { senha },
    }),
};

export const indicacoesApi = {
  buscar: (params) => api(withQuery('/indicacoes/startups', params)),
  minhas: () => api('/indicacoes/minhas'),
  criar: (body) => {
    const inscricaoId = localStorage.getItem('premio_inscricao_id');
    return api('/indicacoes', {
      method: 'POST',
      body: inscricaoId
        ? { ...body, indicanteInscricaoId: inscricaoId }
        : body,
    });
  },
};

export const colegioApi = {
  indicadas: (params) => api(withQuery('/colegio/indicadas', params)),
  selecoes: () => api('/colegio/selecoes'),
  registrar: (body) => api('/colegio/selecoes', { method: 'POST', body }),
};

export const publicApi = {
  getConvite: (token) => api(`/public/convites/${token}`),
  getLinkInscricao: (slug) => api(`/public/inscrever/${slug}`),
  ativarLider: (body) => api('/public/lideres/ativar', { method: 'POST', body }),
  solicitarLider: (body) => api('/public/solicitacoes/lider', { method: 'POST', body }),
  solicitarStartup: (body) => api('/public/solicitacoes/startup', { method: 'POST', body }),
  createInscricao: (slug) => api('/public/inscricoes', { method: 'POST', body: { slug } }),
  getInscricao: (id) => api(`/public/inscricoes/${id}`),
  etapa1: (id, body) => api(`/public/inscricoes/${id}/etapa/1`, { method: 'PATCH', body }),
  etapa2: (id, body) => api(`/public/inscricoes/${id}/etapa/2`, { method: 'PATCH', body }),
  confirmar: (id, body) => api(`/public/inscricoes/${id}/confirmar`, { method: 'POST', body }),
  getStartup: (identifier) =>
    api(`/public/startups/${encodeURIComponent(identifier)}`),
  comunidades: () => api('/public/comunidades'),
  resultados: () => api('/public/resultados'),
  ata: () => api('/public/ata'),
  edicaoStatus: () => api('/public/edicao/status'),
  galeria: () => api('/public/galeria'),
  regras: (params) => api(withQuery('/public/regras', params || {})),
  getTestemunha: (token) => api(`/public/testemunhas/${encodeURIComponent(token)}`),
  confirmarTestemunha: (token, body = {}) =>
    api(`/public/testemunhas/${encodeURIComponent(token)}/confirmar`, {
      method: 'POST',
      body,
    }),
  votoStatus: () => api('/public/voto/status'),
  votoCategorias: () => api('/public/voto/categorias'),
  votoFinalistas: (categoria) =>
    api(`/public/voto/finalistas?categoria=${encodeURIComponent(categoria)}`),
  votoTotal: () => api('/public/voto/total'),
  registrarVoto: (body) =>
    api('/voto', {
      method: 'POST',
      body,
      headers: getVotoToken()
        ? { Authorization: `Bearer ${getVotoToken()}` }
        : {},
    }),
};
