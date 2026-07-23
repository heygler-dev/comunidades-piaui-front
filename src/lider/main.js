import { authApi, liderApi, indicacoesApi, colegioApi, publicApi, setToken, getToken } from '../api/client.js';
import { copyText, isValidCPF, showToast, wireCPF, wirePhone } from '../lib/utils.js';
import { startupPublicPath } from '../lib/startup-url.js';
import { renderTablePage, resetPage } from '../lib/pagination.js';
import {
  consumeLiderComunidadePreferida,
  renderContextoNav,
} from '../lib/contexto-nav.js';

const $ = (id) => document.getElementById(id);
const toast = (msg) => showToast('toast', msg);

const state = {
  user: null,
  comunidadeId: null,
  vinculos: [],
  categorias: [],
  lideres: [],
  inscricoes: [],
  indResultados: [],
  indMinhas: [],
  colList: [],
  colFilterStatus: null,
  colFilterComunidade: false,
  colegioSelecionados: new Set(),
  activePanel: 'dashboard',
  solicitacoesCache: [],
  podeRevisarLiderSol: false,
};

function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app-screen').classList.add('hidden');
}

function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
}

function switchPanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll('#lider-tabs .admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  document.querySelectorAll('.admin-panel').forEach((el) => {
    el.classList.toggle('hidden', el.id !== `panel-${panel}`);
  });
  if (panel === 'solicitacoes') loadSolicitacoes();
  if (panel === 'colegio') loadColegio();
}

async function handleLogin(e) {
  e.preventDefault();
  const err = $('login-error');
  err.classList.remove('show');
  err.textContent = '';
  try {
    const data = await authApi.login(
      $('login-email').value.trim(),
      $('login-senha').value,
      'lider',
    );
    setToken(data.access_token);
    state.user = data.user;
    await bootApp();
  } catch (ex) {
    err.textContent = ex.message || 'Falha no login.';
    err.classList.add('show');
  }
}

function logout() {
  setToken(null);
  state.user = null;
  state.comunidadeId = null;
  showLogin();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderVinculos() {
  const list = $('vinculos-list');
  list.innerHTML = '';
  state.vinculos.forEach((v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'vinculo-chip' + (v.comunidade.id === state.comunidadeId ? ' active' : '');
    btn.textContent = `${v.comunidade.nome} · ${v.tipoLider === 'SEMENTE' ? 'Semente' : 'Participante'}`;
    btn.addEventListener('click', () => {
      state.comunidadeId = v.comunidade.id;
      state.colegioSelecionados = new Set();
      resetPage('lider-lideres');
      resetPage('lider-inscricoes');
      resetPage('lider-apontar');
      resetPage('lider-ind-minhas');
      resetPage('lider-solicitacoes');
      renderVinculos();
      loadComunidadeData();
    });
    list.appendChild(btn);
  });

  const atual = state.vinculos.find((v) => v.comunidade.id === state.comunidadeId);
  const isSemente = atual?.tipoLider === 'SEMENTE';
  $('nomear-wrap')?.classList.toggle('hidden', !isSemente);

  renderContextoNav({
    papelAtual: 'lider',
    papeis: state.user?.papeis,
    startups: state.user?.startups || [],
    vinculosLider: state.vinculos,
    comunidadeAtivaId: state.comunidadeId,
    onSelectComunidade: (comunidadeId) => {
      if (!comunidadeId || comunidadeId === state.comunidadeId) return;
      state.comunidadeId = comunidadeId;
      resetPage('lider-startups');
      resetPage('lider-ind-busca');
      resetPage('lider-ind-minhas');
      resetPage('lider-solicitacoes');
      renderVinculos();
      loadComunidadeData();
    },
    onLogout: logout,
  });

  const edicao = state.user?.edicao || {};
  const fase = edicao.faseAtual || '';
  const indOn = fase === 'FASE_2_INDICACOES';
  const colOn = Boolean(edicao.colegioHabilitado);

  $('tab-indicacoes')?.classList.toggle('hidden', !indOn);
  $('tab-colegio')?.classList.toggle('hidden', !colOn);
  $('tab-apontar')?.classList.toggle('hidden', !(isSemente && colOn));

  if (!indOn && state.activePanel === 'indicacoes') switchPanel('dashboard');
  if (!colOn && (state.activePanel === 'colegio' || state.activePanel === 'apontar')) {
    switchPanel('dashboard');
  }

  if (state.activePanel === 'solicitacoes') loadSolicitacoes();

  $('user-label').textContent = state.user?.nome || 'Líder';
  $('comunidade-titulo').textContent = atual?.comunidade?.nome || 'Painel do líder';
}

function renderApontarColegio() {
  renderTablePage({
    tbodyId: 'apontar-colegio-list',
    pagerId: 'lider-apontar',
    items: state.lideres,
    emptyRowHtml: '<tr class="empty-row"><td colspan="3">Nenhum líder na comunidade.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((l) => {
          const on = state.colegioSelecionados.has(l.id);
          return `<tr>
            <td><div class="nome-cell">${esc(l.nome)}</div></td>
            <td><span class="type-badge lider">${l.tipoLider === 'SEMENTE' ? 'Semente' : 'Participante'}</span></td>
            <td style="text-align:right">
              <input type="checkbox" data-lider-id="${l.id}" ${on ? 'checked' : ''}>
            </td>
          </tr>`;
        })
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.addEventListener('change', () => {
          if (cb.checked) state.colegioSelecionados.add(cb.dataset.liderId);
          else state.colegioSelecionados.delete(cb.dataset.liderId);
        });
      });
    },
  });
}

function renderLideresTable() {
  renderTablePage({
    tbodyId: 'lideres-list',
    pagerId: 'lider-lideres',
    items: state.lideres,
    emptyRowHtml: '<tr class="empty-row"><td colspan="3">Nenhum líder cadastrado.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (l) =>
            `<tr>
              <td><div class="nome-cell">${esc(l.nome)}</div><div class="sub-cell">${esc(l.email || '')}</div></td>
              <td><span class="type-badge lider">${l.tipoLider === 'SEMENTE' ? 'Semente' : 'Participante'}</span></td>
              <td><span class="status-badge ${(l.status || '').toLowerCase()}">${esc(l.status)}</span></td>
            </tr>`,
        )
        .join(''),
  });
}

function renderInscricoesTable() {
  renderTablePage({
    tbodyId: 'inscricoes-list',
    pagerId: 'lider-inscricoes',
    items: state.inscricoes,
    emptyRowHtml: '<tr class="empty-row"><td colspan="4">Nenhuma startup inscrita ainda.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((s) => {
          const lp =
            s.slugPublico || s.site
              ? `<a href="${startupPublicPath(s.site, s.slugPublico)}" target="_blank" rel="noopener">Ver LP</a>`
              : '—';
          const acao =
            s.status === 'PENDENTE'
              ? `<div class="row-actions">
                  <button type="button" class="btn btn-primary btn-insc-aprovar" data-id="${s.id}">Aceitar</button>
                  <button type="button" class="btn btn-ghost btn-insc-rejeitar" data-id="${s.id}">Recusar</button>
                </div>`
              : '<span class="muted">—</span>';
          return `<tr>
            <td><div class="nome-cell">${esc(s.nomeStartup || '—')}</div></td>
            <td><span class="status-badge ${(s.status || '').toLowerCase()}">${esc(s.status)}</span></td>
            <td>${lp}</td>
            <td style="text-align:right">${acao}</td>
          </tr>`;
        })
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('.btn-insc-aprovar').forEach((btn) => {
        btn.addEventListener('click', () => aprovarInscricao(btn.dataset.id));
      });
      tbody.querySelectorAll('.btn-insc-rejeitar').forEach((btn) => {
        btn.addEventListener('click', () => rejeitarInscricao(btn.dataset.id));
      });
    },
  });
}

async function aprovarInscricao(id) {
  try {
    await liderApi.aprovarInscricao(id, { comunidadeId: state.comunidadeId });
    toast('Startup aceita na comunidade.');
    await loadComunidadeData();
  } catch (ex) {
    toast(ex.message || 'Não foi possível aprovar.');
  }
}

async function rejeitarInscricao(id) {
  if (!window.confirm('Recusar esta inscrição? Ela será cancelada.')) return;
  try {
    await liderApi.rejeitarInscricao(id, { comunidadeId: state.comunidadeId });
    toast('Inscrição recusada.');
    await loadComunidadeData();
  } catch (ex) {
    toast(ex.message || 'Não foi possível recusar.');
  }
}

async function apontarColegio() {
  try {
    await liderApi.colegio(
      { liderIds: [...state.colegioSelecionados] },
      { comunidadeId: state.comunidadeId },
    );
    toast('Apontamento do colégio salvo.');
  } catch (ex) {
    toast(ex.message || 'Não foi possível apontar o colégio.');
  }
}



function formatDateBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function renderSolicitacoesTable() {
  renderTablePage({
    tbodyId: 'solicitacoes-list',
    pagerId: 'lider-solicitacoes',
    items: state.solicitacoesCache,
    emptyRowHtml:
      '<tr class="empty-row"><td colspan="5">Nenhuma solicitação pendente.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((s) => {
          const tipo =
            s.tipo === 'LIDER'
              ? '<span class="type-badge lider">Líder</span>'
              : '<span class="type-badge startup">Startup</span>';
          const titulo =
            s.tipo === 'STARTUP'
              ? `${esc(s.nomeStartup)}<div class="muted" style="font-size:12px">${esc(s.nome)}</div>`
              : esc(s.nome);
          const contato = `${esc(s.email)}<div class="muted" style="font-size:12px">${esc(s.telefone)}</div>`;
          const pode =
            s.tipo === 'LIDER' && !state.podeRevisarLiderSol
              ? '<span class="muted">Só líder-semente</span>'
              : `<div class="row-actions">
                  <button type="button" class="btn btn-primary btn-sol-aprovar" data-id="${s.id}">Aceitar</button>
                  <button type="button" class="btn btn-ghost btn-sol-rejeitar" data-id="${s.id}">Recusar</button>
                </div>`;
          return `<tr>
            <td>${tipo}</td>
            <td><div class="nome-cell">${titulo}</div></td>
            <td>${contato}</td>
            <td>${formatDateBR(s.createdAt)}</td>
            <td style="text-align:right">${pode}</td>
          </tr>`;
        })
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('.btn-sol-aprovar').forEach((btn) => {
        btn.addEventListener('click', () => aprovarSolicitacao(btn.dataset.id));
      });
      tbody.querySelectorAll('.btn-sol-rejeitar').forEach((btn) => {
        btn.addEventListener('click', () => rejeitarSolicitacao(btn.dataset.id));
      });
    },
  });
}

function updateSolBadge(count) {
  const badge = $('sol-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function loadSolicitacoes() {
  if (!state.comunidadeId) return;
  const tipo = $('sol-filtro-tipo')?.value || undefined;
  const data = await liderApi.solicitacoes({ comunidadeId: state.comunidadeId, tipo });
  state.solicitacoesCache = data.items || [];
  state.podeRevisarLiderSol = Boolean(data.podeRevisarLider);
  const total = (data.pendentes?.startup || 0) + (data.pendentes?.lider || 0);
  updateSolBadge(total);
  renderSolicitacoesTable();
}

async function aprovarSolicitacao(id) {
  try {
    await liderApi.aprovarSolicitacao(id, { comunidadeId: state.comunidadeId });
    toast('Solicitação aceita.');
    await loadComunidadeData();
  } catch (ex) {
    toast(ex.message || 'Não foi possível aprovar.');
  }
}

async function rejeitarSolicitacao(id) {
  const motivo = window.prompt('Motivo da recusa (opcional):') || '';
  try {
    await liderApi.rejeitarSolicitacao(id, { motivo }, { comunidadeId: state.comunidadeId });
    toast('Solicitação recusada.');
    await loadSolicitacoes();
  } catch (ex) {
    toast(ex.message || 'Não foi possível recusar.');
  }
}

async function loadComunidadeData() {
  if (!state.comunidadeId) return;
  const q = { comunidadeId: state.comunidadeId };
  const [link, stats, lideres, inscricoes] = await Promise.all([
    liderApi.link(q),
    liderApi.stats(q),
    liderApi.lideres(q),
    liderApi.inscricoes(q),
  ]);

  const origin = window.location.origin;
  $('lider-link').value = `${origin}/?inscrever=${link.slug}`;

  const porStatus = stats.porStatus || {};
  const ativas = Number(porStatus.ATIVO || 0);
  const pendentes =
    Number(porStatus.PENDENTE || 0) + Number(porStatus.RASCUNHO || 0);

  $('stat-total').textContent = String(stats.total ?? 0);
  $('stat-ativas').textContent = String(ativas);
  $('stat-pendentes').textContent = String(pendentes);
  $('stat-lideres').textContent = String(lideres.length);

  state.lideres = lideres;
  state.inscricoes = inscricoes;
  renderLideresTable();
  await loadSolicitacoes();
  renderApontarColegio();
  renderInscricoesTable();

  await loadMinhasIndicacoes();
}

async function loadCategorias() {
  state.categorias = await publicApi.votoCategorias();
  const opts =
    '<option value="">Selecione</option>' +
    state.categorias.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
  if ($('ind-categoria')) $('ind-categoria').innerHTML = opts;
  if ($('col-categoria')) {
    const prev = $('col-categoria').value;
    $('col-categoria').innerHTML = opts;
    if (prev && [...$('col-categoria').options].some((o) => o.value === prev)) {
      $('col-categoria').value = prev;
    }
  }
}

async function buscarIndicacoes() {
  const q = $('ind-q').value.trim();
  const categoriaId = $('ind-categoria').value || undefined;
  resetPage('lider-ind-resultados');
  state.indResultados = await indicacoesApi.buscar({ q, categoriaId });
  renderIndResultadosTable();
}

function renderIndResultadosTable() {
  renderTablePage({
    tbodyId: 'ind-resultados',
    pagerId: 'lider-ind-resultados',
    items: state.indResultados,
    emptyRowHtml: '<tr class="empty-row"><td colspan="2">Nenhuma startup encontrada.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (s) => `<tr>
            <td>
              <div class="nome-cell">${esc(s.nomeStartup)}</div>
              <div class="sub-cell">${esc(s.comunidade?.nome || '')}</div>
            </td>
            <td style="text-align:right">
              <button type="button" class="btn btn-ghost btn-indicar" data-id="${s.id}">Indicar</button>
            </td>
          </tr>`,
        )
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('.btn-indicar').forEach((btn) => {
        btn.addEventListener('click', () => indicar(btn.dataset.id));
      });
    },
  });
}

async function indicar(inscricaoStartupId) {
  const categoriaId = $('ind-categoria').value;
  if (!categoriaId) {
    toast('Selecione a categoria.');
    return;
  }
  const justificativa = ($('ind-justificativa')?.value || '').trim();
  if (justificativa && justificativa.length < 5) {
    toast('A justificativa precisa ter pelo menos 5 caracteres.');
    return;
  }
  try {
    await indicacoesApi.criar({
      inscricaoStartupId,
      categoriaId,
      ...(justificativa ? { justificativa } : {}),
    });
    toast('Indicação registrada.');
    if ($('ind-justificativa')) $('ind-justificativa').value = '';
    await loadMinhasIndicacoes();
  } catch (ex) {
    toast(ex.message || 'Não foi possível indicar.');
  }
}

async function loadMinhasIndicacoes() {
  try {
    state.indMinhas = await indicacoesApi.minhas();
    renderIndMinhasTable();
  } catch {
    state.indMinhas = [];
    $('ind-minhas').innerHTML =
      '<tr class="empty-row"><td colspan="3">Indicações indisponíveis no momento.</td></tr>';
    const wrap = $('ind-minhas')?.closest('.table-wrap');
    wrap?.querySelector('[data-pagination-id="lider-ind-minhas"]')?.remove();
  }
}

function renderIndMinhasTable() {
  renderTablePage({
    tbodyId: 'ind-minhas',
    pagerId: 'lider-ind-minhas',
    items: state.indMinhas,
    emptyRowHtml: '<tr class="empty-row"><td colspan="3">Nenhuma indicação ainda.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (i) =>
            `<tr>
              <td><div class="nome-cell">${esc(i.inscricaoStartup?.nomeStartup)}</div></td>
              <td>${esc(i.categoria?.nome)}</td>
              <td class="sub-cell">${esc(i.justificativa || '—')}</td>
            </tr>`,
        )
        .join(''),
  });
}

async function loadColegio() {
  const rawCategoria = $('col-categoria')?.value?.trim() || '';
  // "Selecione" (valor vazio) → todas as indicadas
  const params = rawCategoria ? { categoriaId: rawCategoria } : {};
  try {
    resetPage('lider-colegio');
    const data = await colegioApi.indicadas(params);
    state.colList = Array.isArray(data) ? data : [];
    renderColegioTable();
  } catch (ex) {
    hideColegioFeedback();
    state.colList = [];
    $('col-list').innerHTML = `<tr class="empty-row"><td colspan="4">${esc(ex.message || 'Colégio indisponível.')}</td></tr>`;
    const wrap = $('col-list')?.closest('.table-wrap');
    wrap?.querySelector('[data-pagination-id="lider-colegio"]')?.remove();
  }
}

function colegioStatusMeta(status) {
  const map = {
    AVANCADA: { label: 'Avançada', cls: 'col-avancada' },
    REJEITADA: { label: 'Rejeitada', cls: 'col-rejeitada' },
    ABSTENCAO: { label: 'Abstenção', cls: 'col-abstencao' },
    EM_ANALISE: { label: 'Pendente', cls: 'col-pendente' },
  };
  return map[status] || { label: 'Pendente', cls: 'col-pendente' };
}

function colegioItemStatusKey(item) {
  const status = item?.minhaSelecao?.status;
  if (!status || status === 'EM_ANALISE') return 'PENDENTE';
  return status;
}

function filteredColegioList() {
  const list = Array.isArray(state.colList) ? state.colList : [];
  return list.filter((item) => {
    if (state.colFilterComunidade && !item.mesmaComunidade) return false;
    if (!state.colFilterStatus) return true;
    return colegioItemStatusKey(item) === state.colFilterStatus;
  });
}

function syncColegioFilterChips() {
  document.querySelectorAll('[data-col-status]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.colStatus === state.colFilterStatus);
  });
  document.querySelectorAll('[data-col-comunidade]').forEach((btn) => {
    btn.classList.toggle('is-active', state.colFilterComunidade);
  });
}

function showColegioFeedback({ title, detail, variant = 'avancada' }) {
  const box = $('col-feedback');
  if (!box) return;
  box.className = `colegio-feedback is-${variant}`;
  box.innerHTML = `
    <svg class="colegio-feedback-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke="currentColor" stroke-width="1.6"/>
      <path d="M6.5 10.2l2.3 2.3 4.7-4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="colegio-feedback-body">
      <strong>${esc(title)}</strong>
      ${detail ? `<span>${esc(detail)}</span>` : ''}
    </div>`;
}

function hideColegioFeedback() {
  const box = $('col-feedback');
  if (!box) return;
  box.className = 'colegio-feedback hidden';
  box.innerHTML = '';
}

function renderColegioTable() {
  syncColegioFilterChips();
  const items = filteredColegioList();
  const total = Array.isArray(state.colList) ? state.colList.length : 0;
  const emptyRowHtml =
    total > 0 && items.length === 0
      ? '<tr class="empty-row"><td colspan="4">Nenhuma indicação com os filtros atuais. Desmarque Status / Sua comunidade.</td></tr>'
      : '<tr class="empty-row"><td colspan="4">Nenhuma indicação nesta categoria (ou você não está no colégio).</td></tr>';
  renderTablePage({
    tbodyId: 'col-list',
    pagerId: 'lider-colegio',
    items,
    emptyRowHtml,
    renderRows: (pageItems) =>
      pageItems
        .map((r) => {
          const status = r.minhaSelecao?.status || null;
          const meta = colegioStatusMeta(status);
          const mesma = Boolean(r.mesmaComunidade);
          const rowCls = [
            status ? `col-row-${meta.cls.replace('col-', '')}` : '',
            mesma ? 'col-row-mesma' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const comunidadeNome = r.inscricaoStartup?.comunidade?.nome || '';
          const tags = [
            mesma
              ? '<span class="colegio-meta-tag">Sua comunidade</span>'
              : '',
            r.minhaSelecao?.conflitoInteresse
              ? '<span class="colegio-meta-tag">Conflito</span>'
              : '',
          ]
            .filter(Boolean)
            .join('');

          let actions = '';
          if (mesma) {
            actions = `
              <button type="button" class="btn btn-ghost btn-abster" data-cat="${r.categoriaId}" data-id="${r.inscricaoStartupId}">
                Registrar abstenção
              </button>`;
          } else {
            actions = `
              <button type="button" class="btn btn-ghost btn-avancar" data-cat="${r.categoriaId}" data-id="${r.inscricaoStartupId}">
                Avançar
              </button>
              <button type="button" class="btn btn-ghost btn-rejeitar" data-cat="${r.categoriaId}" data-id="${r.inscricaoStartupId}">
                Rejeitar
              </button>`;
          }

          return `<tr class="${rowCls}">
            <td>
              <div class="nome-cell">${esc(r.inscricaoStartup?.nomeStartup)}</div>
              <div class="sub-cell">${esc(comunidadeNome)}</div>
              ${tags ? `<div class="startup-tags">${tags}</div>` : ''}
            </td>
            <td>${esc(r.categoria?.nome)}</td>
            <td><span class="status-badge ${meta.cls}">${esc(meta.label)}</span></td>
            <td style="text-align:right"><div class="row-actions">${actions}</div></td>
          </tr>`;
        })
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('.btn-avancar').forEach((btn) => {
        btn.addEventListener('click', () =>
          registrarSelecao(btn.dataset.cat, btn.dataset.id, 'AVANCADA'),
        );
      });
      tbody.querySelectorAll('.btn-rejeitar').forEach((btn) => {
        btn.addEventListener('click', () =>
          registrarSelecao(btn.dataset.cat, btn.dataset.id, 'REJEITADA'),
        );
      });
      tbody.querySelectorAll('.btn-abster').forEach((btn) => {
        btn.addEventListener('click', () =>
          registrarSelecao(btn.dataset.cat, btn.dataset.id, 'ABSTENCAO', true),
        );
      });
    },
  });
}

async function registrarSelecao(
  categoriaId,
  inscricaoStartupId,
  status,
  conflitoInteresse = false,
) {
  const item = state.colList.find(
    (r) =>
      r.categoriaId === categoriaId &&
      r.inscricaoStartupId === inscricaoStartupId,
  );
  const nome = item?.inscricaoStartup?.nomeStartup || 'Startup';

  try {
    const result = await colegioApi.registrar({
      categoriaId,
      inscricaoStartupId,
      status,
      ...(conflitoInteresse || item?.mesmaComunidade
        ? { conflitoInteresse: true }
        : {}),
    });
    const finalStatus = result?.status || status;
    const meta = colegioStatusMeta(finalStatus);
    const messages = {
      AVANCADA: {
        title: `${nome} avançou`,
        detail: 'Esta startup segue para a etapa de votação popular nesta categoria.',
        variant: 'avancada',
      },
      REJEITADA: {
        title: `${nome} foi rejeitada`,
        detail: 'Ela não avança no seu voto do colégio nesta categoria.',
        variant: 'rejeitada',
      },
      ABSTENCAO: {
        title: `Abstenção registrada para ${nome}`,
        detail: item?.mesmaComunidade
          ? 'Startup da sua comunidade: conflito de interesse, abstenção automática.'
          : 'Sua abstenção foi registrada nesta categoria.',
        variant: 'abstencao',
      },
    };
    const fb = messages[finalStatus] || {
      title: `Seleção atualizada: ${meta.label}`,
      detail: nome,
      variant: 'avancada',
    };
    showColegioFeedback(fb);
    toast(fb.title);
    await loadColegio();
  } catch (ex) {
    showColegioFeedback({
      title: 'Não foi possível registrar a seleção',
      detail: ex.message || 'Tente novamente.',
      variant: 'erro',
    });
    toast(ex.message || 'Falha ao registrar seleção.');
  }
}

async function bootApp() {
  const me = await liderApi.me();
  state.user = me;
  state.vinculos = me.vinculosLider || [];
  if (!state.vinculos.length) {
    toast('Nenhum vínculo de líder encontrado.');
    logout();
    return;
  }
  const preferida = consumeLiderComunidadePreferida();
  const preferidaOk = state.vinculos.some((v) => v.comunidade.id === preferida);
  state.comunidadeId = preferidaOk
    ? preferida
    : state.vinculos[0].comunidade.id;
  showApp();
  switchPanel('dashboard');
  renderVinculos();
  await loadCategorias();
  await loadComunidadeData();
}

async function handleNomear(e) {
  e.preventDefault();
  const cpf = $('nomear-cpf').value;
  if (!isValidCPF(cpf)) {
    toast('CPF inválido.');
    return;
  }
  try {
    await liderApi.nomear(
      {
        nome: $('nomear-nome').value.trim(),
        cpf,
        email: $('nomear-email').value.trim(),
        telefone: $('nomear-telefone').value.trim(),
        senha: $('nomear-senha').value,
      },
      { comunidadeId: state.comunidadeId },
    );
    toast('Líder nomeado.');
    e.target.reset();
    await loadComunidadeData();
  } catch (ex) {
    toast(ex.message || 'Não foi possível nomear.');
  }
}

async function init() {
  wireCPF('nomear-cpf');
  wirePhone('nomear-telefone');
  $('login-form').addEventListener('submit', handleLogin);
  $('btn-logout').addEventListener('click', logout);
  $('btn-copy-link').addEventListener('click', () => {
    copyText($('lider-link').value, $('btn-copy-link'));
    toast('Link copiado.');
  });
  $('nomear-form')?.addEventListener('submit', handleNomear);
  $('btn-buscar-ind')?.addEventListener('click', buscarIndicacoes);
  $('ind-q')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarIndicacoes();
    }
  });
  $('btn-col-load')?.addEventListener('click', loadColegio);
  $('col-categoria')?.addEventListener('change', loadColegio);
  document.querySelector('.colegio-filter-chips')?.addEventListener('click', (e) => {
    const statusBtn = e.target.closest('[data-col-status]');
    if (statusBtn) {
      const next = statusBtn.dataset.colStatus;
      state.colFilterStatus = state.colFilterStatus === next ? null : next;
      resetPage('lider-colegio');
      renderColegioTable();
      return;
    }
    const comunidadeBtn = e.target.closest('[data-col-comunidade]');
    if (comunidadeBtn) {
      state.colFilterComunidade = !state.colFilterComunidade;
      resetPage('lider-colegio');
      renderColegioTable();
    }
  });
  $('btn-apontar-colegio')?.addEventListener('click', apontarColegio);
  $('btn-sol-reload')?.addEventListener('click', loadSolicitacoes);
  $('sol-filtro-tipo')?.addEventListener('change', loadSolicitacoes);

  $('lider-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel]');
    if (btn && !btn.classList.contains('hidden')) switchPanel(btn.dataset.panel);
  });

  if (getToken()) {
    try {
      await bootApp();
    } catch {
      logout();
    }
  } else {
    showLogin();
  }
}

init();
