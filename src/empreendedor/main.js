import {
  authApi,
  empreendedorApi,
  indicacoesApi,
  publicApi,
  getToken,
  setToken,
} from '../api/client.js';
import { copyText, showToast } from '../lib/utils.js';
import { startupPublicPath } from '../lib/startup-url.js';
import { renderTablePage, resetPage } from '../lib/pagination.js';
import {
  buildFinalistaShareText,
  downloadFinalistaCard,
} from '../lib/finalista-card.js';
import {
  getSelectedInscricaoId,
  renderContextoNav,
  setSelectedInscricaoId,
} from '../lib/contexto-nav.js';

const $ = (id) => document.getElementById(id);
const toast = (msg) => showToast('toast', msg);

const state = {
  me: null,
  comunidades: [],
  categorias: [],
  selectedBadges: new Set(),
  indResultados: [],
  indMinhas: [],
  activePanel: 'landing',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${p}`;
}

function primaryFinalistaCategoria(me) {
  const list = me?.finalistas || [];
  if (!list.length) return me?.categoria || '';
  return list[0]?.categoria || me?.categoria || '';
}

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
  document.querySelectorAll('#empreendedor-tabs .admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  document.querySelectorAll('.admin-panel').forEach((el) => {
    el.classList.toggle('hidden', el.id !== `panel-${panel}`);
  });
}

function handleLogin(e) {
  e.preventDefault();
  const err = $('login-error');
  err.classList.remove('show');
  err.textContent = '';
  authApi
    .login($('login-email').value.trim(), $('login-senha').value, 'empreendedor')
    .then(async (data) => {
      setToken(data.access_token);
      await boot();
    })
    .catch((ex) => {
      err.textContent = ex.message || 'Falha no login.';
      err.classList.add('show');
    });
}

function logout() {
  setToken(null);
  showLogin();
}

function fillForm(me) {
  const nome = me.nomeStartup || me.responsavelNome || 'Startup';
  $('user-label').textContent = nome;
  $('page-titulo').textContent = nome;
  $('comunidade-origem').textContent = me.comunidade?.nome || '—';

  $('f-nome').value = me.nomeStartup || '';
  $('f-categoria').value = me.categoria || '';
  $('f-cidade').value = me.cidadeOperacao || '';
  $('f-site').value = me.site || '';
  $('f-pitch').value = me.pitchCurto || '';
  $('f-descricao').value = me.descricao || '';
  $('f-video').value = me.videoUrl || '';
  renderLogoPreview(me.logoUrl);

  const lpPath = startupPublicPath(me.site, me.slugPublico) || me.paginaUrl;
  const lpLink = $('lp-url');
  const lpLabel = $('lp-label');
  if (lpPath) {
    lpLink.href = lpPath;
    lpLink.textContent = lpPath;
    lpLink.style.display = '';
    lpLabel.style.display = '';
  } else {
    lpLink.style.display = 'none';
    lpLabel.style.display = 'none';
  }

  const selo = $('selo-finalista');
  if (me.ehVencedor) {
    selo.textContent = 'Vencedor';
    selo.className = 'status-chip is-vencedor';
  } else if (me.ehFinalista) {
    selo.textContent = 'Finalista';
    selo.className = 'status-chip is-finalista';
  } else {
    selo.className = 'status-chip hidden';
    selo.textContent = '';
  }

  state.selectedBadges = new Set((me.badges || []).map((b) => b.id));
  renderMobilizacao(me, lpPath);
}

function renderMobilizacao(me, lpPath) {
  const empty = $('mobilizacao-empty');
  const active = $('mobilizacao-active');
  const isFinalista = Boolean(me?.ehFinalista);
  empty?.classList.toggle('hidden', isFinalista);
  active?.classList.toggle('hidden', !isFinalista);
  if (!isFinalista || !active) return;

  const paginaUrl = absoluteUrl(lpPath || me.paginaUrl || '');
  const votoUrl = absoluteUrl('/?voto=1');
  const categoria = primaryFinalistaCategoria(me);
  const edicaoLabel = me.edicaoAno
    ? `Edição ${me.edicaoAno}`
    : me.edicaoNome || 'Edição 2026';

  $('mobilizacao-titulo').textContent = me.ehVencedor
    ? 'Somos vencedores'
    : 'Sou finalista';
  $('mobilizacao-sub').textContent = me.ehVencedor
    ? 'Compartilhe o resultado e celebre com a comunidade.'
    : me.votacaoAberta
      ? 'Copie os links e baixe o card para mobilizar votos nas redes.'
      : 'A votação ainda não está aberta — prepare o material e compartilhe assim que liberar.';

  $('mob-lp-url').value = paginaUrl;
  $('mob-voto-url').value = votoUrl;
  $('mob-share-text').value = buildFinalistaShareText({
    nomeStartup: me.nomeStartup || 'Nossa startup',
    categoria,
    paginaUrl,
    votoUrl,
    ehVencedor: me.ehVencedor,
  });

  const cats = $('mob-categorias');
  cats.innerHTML = (me.finalistas || [])
    .map((f) => {
      const extra = f.vencedor ? ' · vencedor' : '';
      return `<span class="origem-chip">${esc(f.categoria)}${extra}</span>`;
    })
    .join('');
  if (!cats.innerHTML) {
    cats.innerHTML = `<span class="origem-chip">${esc(categoria || 'Finalista')}</span>`;
  }

  active.dataset.edicaoLabel = edicaoLabel;
  active.dataset.linkLabel = votoUrl.replace(/^https?:\/\//i, '');
}

function renderBadges() {
  const list = $('badges-list');
  const origemId = state.me?.comunidade?.id;
  const options = state.comunidades.filter((c) => c.id !== origemId);
  list.innerHTML = options
    .map((c) => {
      const on = state.selectedBadges.has(c.id);
      return `<button type="button" class="vinculo-chip${on ? ' active' : ''}" data-id="${c.id}">${esc(c.nome)}</button>`;
    })
    .join('');
  list.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (state.selectedBadges.has(id)) state.selectedBadges.delete(id);
      else state.selectedBadges.add(id);
      renderBadges();
    });
  });
}

function renderLogoPreview(logoUrl, fileName) {
  const preview = $('f-logo-preview');
  if (!preview) return;
  if (!logoUrl) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
    return;
  }
  const label = fileName || 'Logo atual';
  preview.classList.remove('hidden');
  preview.innerHTML = `<img src="${esc(logoUrl)}" alt="Prévia da logo"> <span>${esc(label)}</span>`;
}

async function uploadLogo(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('A logo deve ter no máximo 2 MB.');
    return;
  }
  try {
    state.me = await empreendedorApi.uploadLogo(file);
    fillForm(state.me);
    renderLogoPreview(state.me.logoUrl, file.name);
    toast('Logo enviada.');
  } catch (ex) {
    toast(ex.message || 'Não foi possível enviar a logo.');
  }
}

async function saveLp(e) {
  e.preventDefault();
  try {
    state.me = await empreendedorApi.update({
      nomeStartup: $('f-nome').value.trim(),
      categoria: $('f-categoria').value.trim(),
      cidadeOperacao: $('f-cidade').value.trim(),
      site: $('f-site').value.trim() || undefined,
      pitchCurto: $('f-pitch').value.trim() || undefined,
      descricao: $('f-descricao').value.trim(),
      videoUrl: $('f-video').value.trim() || undefined,
    });
    fillForm(state.me);
    toast('Landing page salva.');
  } catch (ex) {
    toast(ex.message || 'Erro ao salvar.');
  }
}

async function saveBadges() {
  try {
    state.me = await empreendedorApi.badges([...state.selectedBadges]);
    fillForm(state.me);
    renderBadges();
    toast('Badges atualizados.');
  } catch (ex) {
    toast(ex.message || 'Erro ao salvar badges.');
  }
}

async function loadCategorias() {
  state.categorias = await publicApi.votoCategorias();
  $('ind-categoria').innerHTML =
    '<option value="">Selecione</option>' +
    state.categorias.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
}

async function buscar() {
  const q = $('ind-q').value.trim();
  const categoriaId = $('ind-categoria').value || undefined;
  resetPage('emp-ind-resultados');
  state.indResultados = await indicacoesApi.buscar({ q, categoriaId });
  renderIndResultados();
}

function renderIndResultados() {
  renderTablePage({
    tbodyId: 'ind-resultados',
    pagerId: 'emp-ind-resultados',
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
    await loadMinhas();
  } catch (ex) {
    toast(ex.message || 'Não foi possível indicar.');
  }
}

async function loadMinhas() {
  try {
    state.indMinhas = await indicacoesApi.minhas();
    renderIndMinhas();
  } catch {
    state.indMinhas = [];
    $('ind-minhas').innerHTML =
      '<tr class="empty-row"><td colspan="3">Indicações indisponíveis no momento.</td></tr>';
    const wrap = $('ind-minhas')?.closest('.table-wrap');
    wrap?.querySelector('[data-pagination-id="emp-ind-minhas"]')?.remove();
  }
}

function renderIndMinhas() {
  renderTablePage({
    tbodyId: 'ind-minhas',
    pagerId: 'emp-ind-minhas',
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

async function handleDownloadCard() {
  const me = state.me;
  if (!me?.ehFinalista) {
    toast('Disponível apenas para finalistas.');
    return;
  }
  const btn = $('btn-download-card');
  const original = btn?.textContent;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gerando card...';
    }
    const active = $('mobilizacao-active');
    await downloadFinalistaCard({
      nomeStartup: me.nomeStartup,
      categoria: primaryFinalistaCategoria(me),
      cidadeOperacao: me.cidadeOperacao,
      pitchCurto: me.pitchCurto,
      ehVencedor: me.ehVencedor,
      edicaoLabel: active?.dataset.edicaoLabel || `Edição ${me.edicaoAno || 2026}`,
      linkLabel: active?.dataset.linkLabel || 'Vote no portal',
    });
    toast('Card baixado.');
  } catch (ex) {
    toast(ex.message || 'Não foi possível gerar o card.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || 'Baixar card “Sou finalista”';
    }
  }
}

function syncFaseTabs() {
  const indOn = state.me?.faseAtual === 'FASE_2_INDICACOES';
  const mobOn = Boolean(state.me?.votacaoAberta);

  $('tab-indicacoes')?.classList.toggle('hidden', !indOn);
  $('tab-mobilizacao')?.classList.toggle('hidden', !mobOn);

  if (!indOn && state.activePanel === 'indicacoes') switchPanel('landing');
  if (!mobOn && state.activePanel === 'mobilizacao') switchPanel('landing');
}

function syncContextoNav() {
  const me = state.me;
  if (!me) return;
  if (me.id) setSelectedInscricaoId(me.id);
  renderContextoNav({
    papelAtual: 'empreendedor',
    papeis: me.papeis,
    startups: me.startups || [],
    vinculosLider: me.vinculosLider || [],
    startupAtivaId: me.id,
    onLogout: logout,
  });
}

async function boot() {
  try {
    state.me = await empreendedorApi.me();
  } catch (ex) {
    if (getSelectedInscricaoId()) {
      setSelectedInscricaoId('');
      state.me = await empreendedorApi.me();
    } else {
      throw ex;
    }
  }
  if (state.me?.id) setSelectedInscricaoId(state.me.id);
  state.comunidades = await publicApi.comunidades();
  fillForm(state.me);
  syncContextoNav();
  renderBadges();
  syncFaseTabs();
  await loadCategorias();
  if (state.me?.faseAtual === 'FASE_2_INDICACOES') {
    await loadMinhas();
  }
  showApp();
  if (state.me?.ehFinalista && state.me?.votacaoAberta) {
    switchPanel('mobilizacao');
  } else if (
    (state.activePanel === 'indicacoes' && state.me?.faseAtual !== 'FASE_2_INDICACOES') ||
    (state.activePanel === 'mobilizacao' && !state.me?.votacaoAberta)
  ) {
    switchPanel('landing');
  }
}

async function init() {
  $('login-form').addEventListener('submit', handleLogin);
  $('btn-logout').addEventListener('click', logout);
  $('lp-form').addEventListener('submit', saveLp);
  $('f-logo-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
  });
  $('btn-save-badges').addEventListener('click', saveBadges);
  $('btn-buscar').addEventListener('click', buscar);
  $('btn-copy-lp')?.addEventListener('click', (e) => {
    const url = $('mob-lp-url')?.value;
    if (url) copyText(url, e.currentTarget);
  });
  $('btn-copy-voto')?.addEventListener('click', (e) => {
    const url = $('mob-voto-url')?.value;
    if (url) copyText(url, e.currentTarget);
  });
  $('btn-copy-share')?.addEventListener('click', (e) => {
    const text = $('mob-share-text')?.value;
    if (text) copyText(text, e.currentTarget);
  });
  $('btn-download-card')?.addEventListener('click', handleDownloadCard);
  document.querySelectorAll('#empreendedor-tabs .admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });
  if (getToken()) {
    try {
      await boot();
    } catch {
      logout();
    }
  } else showLogin();
}

init();
