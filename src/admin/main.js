import { authApi, adminApi, getToken, setToken } from '../api/client.js';
import { showToast, wirePhone, maskPhone, copyText, wireCPF, isValidCPF } from '../lib/utils.js';
import { renderTablePage, resetPage } from '../lib/pagination.js';

const $ = (id) => document.getElementById(id);

let registros = [];
let lastStats = null;
let comunidadesCache = [];
let categoriasCache = [];
let anomaliasCache = [];
let finalistasCache = [];
let rankingCache = [];
let testemunhasCache = [];
let auditoriaCache = [];
let auditoriaFiltros = [];
let auditoriaFilter = 'TODOS';
let auditoriaPage = 1;
let auditoriaMeta = { total: 0, totalPages: 1, limit: 10, page: 1 };
let activeFilter = 'todos';
let searchTerm = '';
let editTarget = null;
let deleteTarget = null;
let searchTimer = null;
let edicao = null;
let activePanel = 'comunidades';

const FASE_LABEL = {
  FASE_1_CADASTRO: '1 · Cadastro',
  FASE_2_INDICACOES: '2 · Indicações',
  FASE_3_COLEGIO_SELETOR: '3 · Colégio seletor',
  FASE_3_VOTO_POPULAR: '3 · Voto popular (legado)',
  FASE_4_VOTO_POPULAR: '4 · Voto popular',
  FASE_5_APURACAO: '5 · Apuração',
};

const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_DEL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app-screen').classList.add('hidden');
}

function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const senha = $('login-senha').value;
  const err = $('login-error');
  err.classList.remove('show');
  try {
    const data = await authApi.login(email, senha, 'admin');
    setToken(data.access_token);
    showApp();
    await loadPanelData();
  } catch (error) {
    err.textContent = error.message || 'Credenciais inválidas.';
    err.classList.add('show');
  }
}

function switchPanel(panel) {
  activePanel = panel;
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
  document.querySelectorAll('.admin-panel').forEach((el) => {
    el.classList.toggle('hidden', el.id !== `panel-${panel}`);
  });
  loadPanelData();
}

async function loadPanelData() {
  if (activePanel === 'inscricoes') return loadData();
  if (activePanel === 'edicao') return loadEdicao();
  if (activePanel === 'comunidades') return loadComunidades();
  if (activePanel === 'apuracao') return loadApuracao();
  if (activePanel === 'auditoria') return loadAuditoria();
}

function logout() {
  setToken(null);
  showLogin();
}

async function loadData() {
  $('tbody').innerHTML = '<tr class="empty-row"><td colspan="6" class="loading-bar">Carregando...</td></tr>';
  try {
    const [stats, list] = await Promise.all([
      adminApi.stats(),
      adminApi.list({
        tipo: activeFilter,
        q: searchTerm || undefined,
        page: 1,
        limit: 10000,
      }),
    ]);
    lastStats = stats;
    registros = list.data || [];
    renderStats(stats);
    renderFilters(stats);
    renderTable();
  } catch (error) {
    if (error.status === 401) {
      logout();
      return;
    }
    $('tbody').innerHTML = `<tr class="empty-row"><td colspan="6">Erro: ${error.message}</td></tr>`;
  }
}

function renderStats(stats) {
  $('stats').innerHTML = `
    <div class="stat-card">
      <div class="label"><span class="dot" style="background:var(--ink)"></span>Total de inscritos</div>
      <div class="num">${stats.total}</div>
      <div class="sub">${stats.periodoLabel || 'Fase 1'}</div>
    </div>
    <div class="stat-card">
      <div class="label"><span class="dot" style="background:var(--primary)"></span>Líderes comunitários</div>
      <div class="num">${stats.lideres}</div>
      <div class="sub">${stats.percentualLideres}% do total</div>
    </div>
    <div class="stat-card">
      <div class="label"><span class="dot" style="background:var(--orange)"></span>Empreendedores / Startups</div>
      <div class="num">${stats.startups}</div>
      <div class="sub">${stats.percentualStartups}% do total</div>
    </div>
    <div class="stat-card">
      <div class="label"><span class="dot" style="background:var(--ink-faint)"></span>Comunidades ativas</div>
      <div class="num">${stats.comunidadesAtivas}</div>
      <div class="sub">Com pelo menos 1 inscrito</div>
    </div>`;
}

function renderFilters(stats = lastStats) {
  const total = stats?.total ?? registros.length;
  const lideres = stats?.lideres ?? registros.filter((r) => r.tipo === 'lider').length;
  const startups =
    stats?.startups ?? registros.filter((r) => r.tipo === 'startup').length;
  const chips = [
    { key: 'todos', label: 'Todos', n: total },
    { key: 'lider', label: 'Líderes comunitários', n: lideres },
    { key: 'startup', label: 'Empreendedores / Startups', n: startups },
  ];
  $('filters').innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="chip ${activeFilter === c.key ? 'active' : ''}" data-filter="${c.key}">${c.label} <span class="n">${c.n}</span></button>`,
    )
    .join('');
  $('filters').querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      resetPage('admin-inscricoes');
      loadData();
    });
  });
}

function renderTable() {
  renderTablePage({
    tbodyId: 'tbody',
    pagerId: 'admin-inscricoes',
    items: registros,
    emptyRowHtml:
      '<tr class="empty-row"><td colspan="6">Nenhuma inscrição encontrada para esse filtro ou busca.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (r) => `
    <tr>
      <td><div class="nome-cell">${esc(r.nome)}</div><div class="sub-cell">${esc(r.email)}</div></td>
      <td><span class="type-badge ${r.tipo}">${r.tipo === 'lider' ? 'Líder comunitário' : 'Startup'}</span></td>
      <td>${esc(r.comunidade)}<div class="sub-cell">${esc(r.cidade)}</div></td>
      <td>${esc(r.data)}</td>
      <td><span class="status-badge ${r.status.toLowerCase()}">${esc(r.status)}</span></td>
      <td><div class="row-actions">
        <button type="button" class="icon-btn" title="Editar" data-edit="${r.id}" data-tipo="${r.tipo}">${ICON_EDIT}</button>
        <button type="button" class="icon-btn danger" title="Excluir" data-del="${r.id}" data-tipo="${r.tipo}" data-nome="${escAttr(r.nome)}">${ICON_DEL}</button>
      </div></td>
    </tr>`,
        )
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openEdit(btn.dataset.edit, btn.dataset.tipo));
      });
      tbody.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', () => openDelete(btn.dataset.del, btn.dataset.tipo, btn.dataset.nome));
      });
    },
  });
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

function openEdit(id, tipo) {
  const r = registros.find((x) => x.id === id);
  if (!r) return;
  editTarget = { id, tipo };
  $('edit-nome').value = r.nome;
  $('edit-tipo').value = r.tipo;
  $('edit-status').value = r.status;
  $('edit-comunidade').value = r.comunidade;
  $('edit-cidade').value = r.cidade === '—' ? '' : r.cidade;
  $('edit-email').value = r.email === '—' ? '' : r.email;
  $('edit-telefone').value = r.telefone === '—' ? '' : maskPhone(r.telefone);
  $('edit-overlay').classList.add('show');
}

function closeEdit() {
  $('edit-overlay').classList.remove('show');
  editTarget = null;
}

async function saveEdit() {
  if (!editTarget) return;
  try {
    await adminApi.update(editTarget.id, {
      tipo: editTarget.tipo,
      nome: $('edit-nome').value.trim(),
      status: $('edit-status').value,
      comunidade: $('edit-comunidade').value.trim(),
      cidade: $('edit-cidade').value.trim(),
      email: $('edit-email').value.trim(),
      telefone: $('edit-telefone').value.trim(),
    });
    closeEdit();
    showToast('toast', 'Inscrição atualizada com sucesso.');
    await loadData();
  } catch (error) {
    showToast('toast', error.message);
  }
}

function openNew() {
  ['new-nome', 'new-comunidade', 'new-cidade', 'new-email', 'new-telefone'].forEach((id) => {
    $(id).value = '';
  });
  $('new-tipo').value = 'lider';
  $('new-status').value = 'Pendente';
  $('new-overlay').classList.add('show');
}

function closeNew() {
  $('new-overlay').classList.remove('show');
}

async function saveNew() {
  const nome = $('new-nome').value.trim();
  if (!nome) {
    alert('Informe o nome completo para cadastrar.');
    return;
  }
  try {
    await adminApi.create({
      nome,
      tipo: $('new-tipo').value,
      status: $('new-status').value,
      comunidade: $('new-comunidade').value.trim() || 'Não informada',
      cidade: $('new-cidade').value.trim(),
      email: $('new-email').value.trim(),
      telefone: $('new-telefone').value.trim(),
    });
    closeNew();
    showToast('toast', 'Cadastro adicionado manualmente.');
    await loadData();
  } catch (error) {
    showToast('toast', error.message);
  }
}

function openImport() {
  $('import-summary').classList.remove('show');
  $('import-summary').innerHTML = '';
  $('import-file').value = '';
  $('import-overlay').classList.add('show');
}

function closeImport() {
  $('import-overlay').classList.remove('show');
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const summary = $('import-summary');
  summary.textContent = 'Importando...';
  summary.classList.add('show');
  try {
    const result = await adminApi.importStartups(file);
    let html = `<strong>${result.importadas}</strong> de ${result.totalLinhas} linhas importadas.`;
    if (result.erros?.length) {
      html += '<ul style="margin-top:8px;padding-left:18px;font-size:12px">';
      result.erros.slice(0, 5).forEach((e) => {
        html += `<li>Linha ${e.linha}: ${esc(e.motivo)}</li>`;
      });
      if (result.erros.length > 5) html += `<li>... e mais ${result.erros.length - 5} erros</li>`;
      html += '</ul>';
    }
    summary.innerHTML = html;
    showToast('toast', `${result.importadas} startups importadas.`);
    await loadData();
  } catch (error) {
    summary.textContent = error.message;
  }
}

function openDelete(id, tipo, nome) {
  deleteTarget = { id, tipo };
  $('delete-target').textContent = `Você está prestes a excluir a inscrição de "${nome}" (${tipo === 'lider' ? 'líder comunitário' : 'startup'}).`;
  $('delete-overlay').classList.add('show');
}

function closeDelete() {
  $('delete-overlay').classList.remove('show');
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;
  try {
    await adminApi.remove(deleteTarget.id, deleteTarget.tipo);
    closeDelete();
    showToast('toast', 'Inscrição excluída.');
    await loadData();
  } catch (error) {
    showToast('toast', error.message);
  }
}

function toDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateBR(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function indicacoesEfetivas(cfg) {
  if (!cfg?.indicacoesAbertas) return false;
  const now = new Date();
  if (cfg.indicacoesInicio && new Date(cfg.indicacoesInicio) > now) return false;
  if (cfg.indicacoesFim && new Date(cfg.indicacoesFim) < now) return false;
  return true;
}

function fillEdicaoForm(cfg) {
  edicao = cfg;
  $('edicao-nome').textContent = cfg.nome || 'Edição ativa';
  $('edicao-fase').textContent = FASE_LABEL[cfg.faseAtual] || cfg.faseAtual || '—';
  $('cfg-x-lideres').value = cfg.xLideresColegio ?? 1;
  $('cfg-n-finalistas').value = cfg.nFinalistasPorCategoria ?? 3;
  $('cfg-cotas').checked = Boolean(cfg.cotasRegionaisAtivas);
  if ($('cfg-cota-capital')) $('cfg-cota-capital').value = cfg.cotaMinCapital ?? 0;
  if ($('cfg-cota-interior')) $('cfg-cota-interior').value = cfg.cotaMinInterior ?? 0;
  if ($('cfg-cidades-capital')) {
    $('cfg-cidades-capital').value = cfg.cidadesCapital || 'Teresina';
  }
  if ($('cfg-criterios')) $('cfg-criterios').value = cfg.criteriosMd || '';
  if (cfg.faseAtual && $('cfg-fase').querySelector(`option[value="${cfg.faseAtual}"]`)) {
    $('cfg-fase').value = cfg.faseAtual;
  }
  $('cfg-ind-inicio').value = toDateInputValue(cfg.indicacoesInicio);
  $('cfg-ind-fim').value = toDateInputValue(cfg.indicacoesFim);

  const efetiva = indicacoesEfetivas(cfg);
  const toggleOn = Boolean(cfg.indicacoesAbertas);
  setStatusPill('ind-status', efetiva, 'Abertas', toggleOn ? 'Fora do período' : 'Fechadas');
  const periodoEl = $('ind-periodo');
  if (periodoEl) {
    const inicio = formatDateBR(cfg.indicacoesInicio);
    const fim = formatDateBR(cfg.indicacoesFim);
    if (inicio || fim) {
      periodoEl.textContent = `Período: ${inicio || '—'} a ${fim || '—'}${
        toggleOn && !efetiva ? ' · aguardando ou encerrado' : ''
      }`;
    } else {
      periodoEl.textContent = 'Defina as datas de início e fim do período de indicações.';
    }
  }

  setStatusPill('col-status', cfg.colegioHabilitado, 'Habilitado', 'Desabilitado');
  setStatusPill('vot-status', cfg.votacaoAberta, 'Aberta', 'Fechada');

  const btnInd = $('btn-toggle-ind');
  if (btnInd) btnInd.textContent = toggleOn ? 'Desativar' : 'Ativar';
  const btnCol = $('btn-toggle-col');
  if (btnCol) btnCol.textContent = cfg.colegioHabilitado ? 'Desativar' : 'Ativar';
  const btnVot = $('btn-toggle-vot');
  if (btnVot) btnVot.textContent = cfg.votacaoAberta ? 'Desativar' : 'Ativar';
}

function setStatusPill(id, on, labelOn, labelOff) {
  const el = $(id);
  if (!el) return;
  el.textContent = on ? labelOn : labelOff;
  el.className = 'status-pill ' + (on ? 'on' : 'off');
}

async function loadEdicao() {
  try {
    const [cfg, categorias, edicoes] = await Promise.all([
      adminApi.edicao(),
      adminApi.categorias(),
      adminApi.listEdicoes().catch(() => []),
    ]);
    fillEdicaoForm(cfg);
    categoriasCache = categorias;
    renderCategoriasTable();
    fillClonarSelect(Array.isArray(edicoes) ? edicoes : [], cfg?.id);
  } catch (error) {
    if (error.status === 401) return logout();
    showToast('toast', error.message);
  }
}

function fillClonarSelect(edicoes, ativaId) {
  const sel = $('clonar-fonte');
  if (!sel) return;
  const opts = edicoes.filter((e) => e.id !== ativaId);
  if (!opts.length) {
    sel.innerHTML = '<option value="">Nenhuma outra edição disponível</option>';
    return;
  }
  sel.innerHTML = opts
    .map(
      (e) =>
        `<option value="${escAttr(e.id)}">${esc(e.nome || `Edição ${e.ano}`)} (${e.ano})${e.ativa ? ' · ativa' : ''}</option>`,
    )
    .join('');
}

function renderCategoriasTable() {
  renderTablePage({
    tbodyId: 'categorias-list',
    pagerId: 'admin-categorias',
    items: categoriasCache,
    emptyRowHtml: '<tr class="empty-row"><td colspan="2">Nenhuma categoria cadastrada.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (c) =>
            `<tr>
              <td><div class="nome-cell">${esc(c.nome)}</div></td>
              <td>${esc(String(c.ordem ?? 0))}</td>
            </tr>`,
        )
        .join(''),
  });
}

async function saveConfig(e) {
  e.preventDefault();
  if (!edicao?.id) return;
  try {
    const updated = await adminApi.updateConfig(edicao.id, {
      xLideresColegio: Number($('cfg-x-lideres').value),
      nFinalistasPorCategoria: Number($('cfg-n-finalistas').value),
      cotasRegionaisAtivas: $('cfg-cotas').checked,
      cotaMinCapital: Number($('cfg-cota-capital')?.value || 0),
      cotaMinInterior: Number($('cfg-cota-interior')?.value || 0),
      cidadesCapital: $('cfg-cidades-capital')?.value?.trim() || 'Teresina',
      criteriosMd: $('cfg-criterios')?.value || null,
      faseAtual: $('cfg-fase').value,
    });
    fillEdicaoForm({ ...edicao, ...updated });
    showToast('toast', 'Configuração salva.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function publicarRegulamento() {
  try {
    const reg = await adminApi.publicarRegulamento();
    showToast(
      'toast',
      reg?.versao
        ? `Regras públicas publicadas (versão ${reg.versao}).`
        : 'Regras públicas publicadas.',
    );
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function clonarEdicao() {
  const fonteEdicaoId = $('clonar-fonte')?.value;
  if (!fonteEdicaoId) {
    showToast('toast', 'Selecione uma edição de origem.');
    return;
  }
  if (!confirm('Isso atualiza X, N, cotas, critérios e inclui categorias ausentes na edição ativa. Continuar?')) {
    return;
  }
  try {
    const result = await adminApi.clonarEdicao(fonteEdicaoId);
    showToast('toast', result?.message || 'Configuração clonada.');
    await loadEdicao();
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function downloadBackup(kind) {
  try {
    if (kind === 'votos') await adminApi.downloadBackupVotos();
    else await adminApi.downloadBackupInscricoes();
    showToast('toast', 'Download iniciado.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function saveIndicacoesPeriodo() {
  if (!edicao?.id) return;
  const inicio = $('cfg-ind-inicio').value;
  const fim = $('cfg-ind-fim').value;
  if (inicio && fim && inicio > fim) {
    showToast('toast', 'A data de fim deve ser igual ou posterior ao início.');
    return;
  }
  try {
    const updated = await adminApi.updateConfig(edicao.id, {
      indicacoesInicio: inicio || null,
      indicacoesFim: fim || null,
    });
    fillEdicaoForm({ ...edicao, ...updated });
    showToast('toast', 'Período de indicações salvo.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function toggleIndicacoes() {
  if (!edicao?.id) return;
  try {
    const updated = await adminApi.toggleIndicacoes(edicao.id, !edicao.indicacoesAbertas);
    fillEdicaoForm({ ...edicao, ...updated });
    showToast('toast', 'Janela de indicações atualizada.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function toggleColegio() {
  if (!edicao?.id) return;
  try {
    const updated = await adminApi.toggleColegio(edicao.id, !edicao.colegioHabilitado);
    fillEdicaoForm({ ...edicao, ...updated });
    showToast('toast', 'Colégio seletor atualizado.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function toggleVotacao() {
  if (!edicao?.id) return;
  try {
    const updated = await adminApi.toggleVotacao(edicao.id, !edicao.votacaoAberta);
    fillEdicaoForm({ ...edicao, ...updated });
    showToast('toast', 'Voto popular atualizado.');
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function createCategoria(e) {
  e.preventDefault();
  const nome = $('cat-nome').value.trim();
  if (!nome) return;
  try {
    await adminApi.createCategoria({ nome });
    $('cat-nome').value = '';
    showToast('toast', 'Categoria criada.');
    await loadEdicao();
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function loadComunidades() {
  try {
    const list = await adminApi.comunidades();
    comunidadesCache = list;
    fillSementeComunidadeSelect(list);
    renderComunidadesTable();
  } catch (error) {
    if (error.status === 401) return logout();
    showToast('toast', error.message);
  }
}

function renderComunidadesTable() {
  renderTablePage({
    tbodyId: 'comunidades-list',
    pagerId: 'admin-comunidades',
    items: comunidadesCache,
    emptyRowHtml: '<tr class="empty-row"><td colspan="5">Nenhuma comunidade ainda.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((c) => {
          const semente = (c.lideres || [])[0];
          return `<tr>
            <td>
              <div class="nome-with-logo">
                ${
                  c.logoUrl
                    ? `<img class="comunidade-logo" src="${escAttr(c.logoUrl)}" alt="">`
                    : '<span class="comunidade-logo placeholder">—</span>'
                }
                <div>
                  <div class="nome-cell">${esc(c.nome)}</div>
                  <div class="sub-cell">${c.cidadesAtuacao ? esc(c.cidadesAtuacao) : '—'}</div>
                </div>
              </div>
            </td>
            <td>${esc(c.cidade)}/${esc(c.estado || 'PI')}</td>
            <td><span class="status-badge ${c.institucional ? 'ativo' : 'pendente'}">${
              c.institucional ? 'Institucional' : 'Comunitária'
            }</span></td>
            <td>${
              semente
                ? `<div class="nome-cell">${esc(semente.nome)}</div><div class="sub-cell">${esc(semente.email)}</div>`
                : '<span class="sub-cell">Sem semente</span>'
            }</td>
            <td>
              <div class="row-actions">
                ${
                  semente
                    ? ''
                    : `<button type="button" class="btn btn-ghost btn-pick-semente" data-id="${c.id}">Semente</button>`
                }
                <button type="button" class="btn btn-ghost btn-convite" data-id="${c.id}">Convite</button>
              </div>
            </td>
          </tr>`;
        })
        .join(''),
    onBind: (tbody) => {
      tbody.querySelectorAll('.btn-convite').forEach((btn) => {
        btn.addEventListener('click', () => gerarConvite(btn.dataset.id));
      });
      tbody.querySelectorAll('.btn-pick-semente').forEach((btn) => {
        btn.addEventListener('click', () => {
          const card = $('semente-card');
          if (card) card.open = true;
          $('semente-comunidade').value = btn.dataset.id;
          card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    },
  });
}

function fillSementeComunidadeSelect(list) {
  const sel = $('semente-comunidade');
  if (!sel) return;
  const current = sel.value;
  const semSemente = list.filter((c) => !(c.lideres || []).length);
  sel.innerHTML =
    '<option value="">Selecione a comunidade</option>' +
    list
      .map((c) => {
        const has = (c.lideres || []).length > 0;
        return `<option value="${c.id}" ${has ? 'disabled' : ''}>${esc(c.nome)}${has ? ' (já tem semente)' : ''}</option>`;
      })
      .join('');
  if (current && semSemente.some((c) => c.id === current)) sel.value = current;
}

async function createComunidade(e) {
  e.preventDefault();
  try {
    const fd = new FormData();
    fd.append('nome', $('com-nome').value.trim());
    fd.append('descricao', $('com-descricao').value.trim());
    fd.append('institucional', $('com-institucional').value === 's' ? 'true' : 'false');
    fd.append('cidade', $('com-cidade').value.trim());
    fd.append('estado', $('com-estado').value.trim() || 'PI');
    fd.append('cidadesAtuacao', $('com-cidades-atuacao').value.trim());
    const logoFile = $('com-logo')?.files?.[0];
    if (logoFile) fd.append('logo', logoFile);

    const created = await adminApi.createComunidade(fd);
    e.target.reset();
    $('com-estado').value = 'PI';
    $('com-institucional').value = 'n';
    clearLogoPreview();
    showToast('toast', 'Comunidade criada. Cadastre o líder-semente.');
    await loadComunidades();
    if (created?.id) {
      const card = $('semente-card');
      if (card) card.open = true;
      $('semente-comunidade').value = created.id;
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    showToast('toast', error.message);
  }
}

function clearLogoPreview() {
  const preview = $('com-logo-preview');
  if (!preview) return;
  preview.classList.add('hidden');
  preview.innerHTML = '';
}

function wireLogoPreview() {
  const input = $('com-logo');
  const preview = $('com-logo-preview');
  if (!input || !preview) return;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      clearLogoPreview();
      return;
    }
    const url = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    preview.innerHTML = `<img src="${url}" alt="Prévia da logo"> <span>${file.name}</span>`;
  });
}

async function createLiderSemente(e) {
  e.preventDefault();
  const cpf = $('semente-cpf').value;
  if (!isValidCPF(cpf)) {
    showToast('toast', 'CPF inválido.');
    return;
  }
  try {
    await adminApi.createLiderSemente({
      comunidadeId: $('semente-comunidade').value,
      nome: $('semente-nome').value.trim(),
      cpf,
      email: $('semente-email').value.trim(),
      telefone: $('semente-telefone').value.trim(),
      senha: $('semente-senha').value,
    });
    e.target.reset();
    showToast('toast', 'Líder-semente cadastrado.');
    await loadComunidades();
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function gerarConvite(comunidadeId) {
  try {
    const convite = await adminApi.createConviteLider(comunidadeId);
    const url = `${window.location.origin}/?convite=${encodeURIComponent(convite.token)}`;
    const box = $('convite-result');
    box.classList.remove('hidden');
    box.classList.add('show');
    box.innerHTML = `Convite para <b>${esc(convite.comunidade?.nome || 'comunidade')}</b>:<br><a href="${url}">${url}</a>
      <div style="margin-top:8px"><button type="button" class="btn btn-ghost" id="btn-copy-convite">Copiar link</button></div>`;
    $('btn-copy-convite')?.addEventListener('click', () => {
      copyText(url, $('btn-copy-convite'));
      showToast('toast', 'Link de convite copiado.');
    });
  } catch (error) {
    showToast('toast', error.message);
  }
}

function normalizeAnomalias(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const rows = [];
  const picos = Array.isArray(payload.picos) ? payload.picos : [];
  for (const p of picos) {
    const hora = p.hora ? `${p.hora}:00` : 'hora desconhecida';
    rows.push({
      motivo: `Pico de votos (≥20/hora)`,
      detalhe: `${p.total} votos em ${hora} UTC`,
    });
  }

  const semElig = Number(payload.votosSemElegibilidade) || 0;
  if (semElig > 0) {
    rows.push({
      motivo: 'Votos sem vínculo de elegibilidade',
      detalhe: `${semElig} voto(s) sem líder/startup vinculado`,
    });
  }

  if (!rows.length && Number(payload.totalVotos) > 0) {
    rows.push({
      motivo: 'Sem anomalias críticas',
      detalhe: `${payload.totalVotos} voto(s) apurados — nenhum pico ≥20/hora`,
    });
  }

  return rows;
}

async function loadApuracao() {
  try {
    const [quorum, anomalias, finalistas, ranking, testemunhas] = await Promise.all([
      adminApi.quorum(),
      adminApi.anomalias(),
      adminApi.finalistas(),
      adminApi.rankingVotos().catch(() => []),
      adminApi.testemunhas().catch(() => []),
    ]);
    renderQuorum(quorum);
    anomaliasCache = normalizeAnomalias(anomalias);
    finalistasCache = Array.isArray(finalistas) ? finalistas : finalistas?.data || [];
    rankingCache = Array.isArray(ranking) ? ranking : ranking?.data || [];
    testemunhasCache = Array.isArray(testemunhas) ? testemunhas : testemunhas?.data || [];
    renderAnomaliasTable();
    renderFinalistasTable();
    renderRankingTable();
    renderTestemunhasTable();
  } catch (error) {
    if (error.status === 401) return logout();
    showToast('toast', error.message);
  }
}

function renderQuorum(q) {
  const box = $('quorum-box');
  if (!box) return;
  if (!q || typeof q !== 'object') {
    box.innerHTML = '<p class="quorum-empty">Sem dados de quórum.</p>';
    return;
  }

  const esperado = Number(q.esperado) || 0;
  const membros = Number(q.membrosAtivos) || 0;
  const pct = esperado > 0 ? Math.min(100, Math.round((membros / esperado) * 100)) : 0;
  const selecionaram = Number(q.membrosQueSelecionaram) || 0;
  const representadas = Number(q.comunidadesRepresentadas) || 0;
  const comunidades = Number(q.comunidades) || 0;
  const x = Number(q.xLideresColegio) || 0;

  box.innerHTML = `
    <div class="quorum-summary">
      <div class="quorum-summary-title">Participação do colégio</div>
      <span class="status-pill ${pct >= 100 ? 'on' : 'off'}">${pct}% do esperado</span>
    </div>
    <div class="quorum-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
    <div class="quorum-grid">
      <div class="quorum-stat">
        <div class="label">Membros ativos</div>
        <div class="num">${membros}</div>
        <div class="hint">de ${esperado} esperados</div>
      </div>
      <div class="quorum-stat">
        <div class="label">Comunidades representadas</div>
        <div class="num">${representadas}</div>
        <div class="hint">de ${comunidades} comunidades</div>
      </div>
      <div class="quorum-stat">
        <div class="label">Já selecionaram</div>
        <div class="num">${selecionaram}</div>
        <div class="hint">membros com voto no colégio</div>
      </div>
      <div class="quorum-stat">
        <div class="label">X por comunidade</div>
        <div class="num">${x}</div>
        <div class="hint">líderes apontados no parâmetro</div>
      </div>
      <div class="quorum-stat">
        <div class="label">Comunidades</div>
        <div class="num">${comunidades}</div>
        <div class="hint">na edição ativa</div>
      </div>
      <div class="quorum-stat">
        <div class="label">Esperado total</div>
        <div class="num">${esperado}</div>
        <div class="hint">comunidades × X</div>
      </div>
    </div>
  `;
}

function renderAnomaliasTable() {
  renderTablePage({
    tbodyId: 'anomalias-list',
    pagerId: 'admin-anomalias',
    items: anomaliasCache,
    emptyRowHtml: '<tr class="empty-row"><td colspan="2">Nenhuma anomalia detectada.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map(
          (a) =>
            `<tr>
              <td><div class="nome-cell">${esc(a.motivo || a.tipo || 'Anomalia')}</div></td>
              <td><div class="sub-cell">${esc(a.cpf || a.detalhe || '—')}</div></td>
            </tr>`,
        )
        .join(''),
  });
}

function renderFinalistasTable() {
  renderTablePage({
    tbodyId: 'finalistas-list',
    pagerId: 'admin-finalistas',
    items: finalistasCache,
    emptyRowHtml: '<tr class="empty-row"><td colspan="2">Nenhum finalista ainda.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((f) => {
          const startup = f.inscricaoStartup?.nomeStartup || f.nome || '—';
          const categoria =
            (typeof f.categoria === 'object' && f.categoria?.nome) ||
            (typeof f.categoria === 'string' ? f.categoria : '') ||
            '—';
          const cidade = f.inscricaoStartup?.cidadeOperacao;
          return `<tr>
              <td>
                <div class="nome-cell">${esc(startup)}</div>
                ${cidade ? `<div class="sub-cell">${esc(cidade)}</div>` : ''}
              </td>
              <td>${esc(categoria)}</td>
            </tr>`;
        })
        .join(''),
  });
}

function renderRankingTable() {
  renderTablePage({
    tbodyId: 'ranking-list',
    pagerId: 'admin-ranking',
    items: rankingCache,
    emptyRowHtml:
      '<tr class="empty-row"><td colspan="4">Nenhum voto apurado ainda. Publique os resultados após a votação.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((r) => {
          const pos = r.posicao ?? '—';
          const nome = r.nomeStartup || '—';
          const categoria = r.categoria || '—';
          const votos = Number(r.totalVotos) || 0;
          const cidade = r.cidade;
          return `<tr>
              <td><div class="nome-cell">${esc(pos)}</div></td>
              <td>
                <div class="nome-cell">${esc(nome)}</div>
                ${cidade ? `<div class="sub-cell">${esc(cidade)}</div>` : ''}
              </td>
              <td>${esc(categoria)}</td>
              <td style="text-align:right"><div class="nome-cell">${votos}</div></td>
            </tr>`;
        })
        .join(''),
  });
}

function statusTestemunhaLabel(status) {
  if (status === 'CONFIRMADA') return 'Confirmada';
  if (status === 'RECUSADA') return 'Recusada';
  return 'Convite pendente';
}

function renderTestemunhasTable() {
  renderTablePage({
    tbodyId: 'testemunhas-list',
    pagerId: 'admin-testemunhas',
    items: testemunhasCache,
    emptyRowHtml:
      '<tr class="empty-row"><td colspan="3">Nenhuma testemunha convidada.</td></tr>',
    renderRows: (pageItems) =>
      pageItems
        .map((t) => {
          const link = t.token
            ? `${window.location.origin}/testemunha.html?token=${encodeURIComponent(t.token)}`
            : '—';
          const org = t.organizacao ? `<div class="sub-cell">${esc(t.organizacao)}</div>` : '';
          return `<tr>
              <td>
                <div class="nome-cell">${esc(t.nome || '—')}</div>
                <div class="sub-cell">${esc(t.email || '')}</div>
                ${org}
              </td>
              <td><div class="nome-cell">${esc(statusTestemunhaLabel(t.status))}</div></td>
              <td>
                ${
                  t.token
                    ? `<div class="sub-cell" style="word-break:break-all">${esc(link)}</div>
                       <button type="button" class="btn btn-ghost btn-copy-testemunha" data-link="${escAttr(link)}">Copiar link</button>`
                    : '—'
                }
              </td>
            </tr>`;
        })
        .join(''),
  });

  const tbody = $('testemunhas-list');
  tbody?.querySelectorAll('.btn-copy-testemunha').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const link = btn.dataset.link || '';
      try {
        await navigator.clipboard.writeText(link);
        showToast('toast', 'Link de confirmação copiado.');
      } catch {
        showToast('toast', 'Não foi possível copiar o link.');
      }
    });
  });
}

async function convidarTestemunha(e) {
  e?.preventDefault?.();
  const nome = $('testemunha-nome')?.value?.trim();
  const email = $('testemunha-email')?.value?.trim();
  const organizacao = $('testemunha-org')?.value?.trim();
  if (!nome || !email) {
    showToast('toast', 'Informe nome e e-mail da testemunha.');
    return;
  }
  try {
    const criada = await adminApi.convidarTestemunha({
      nome,
      email,
      ...(organizacao ? { organizacao } : {}),
    });
    const link = criada?.token
      ? `${window.location.origin}/testemunha.html?token=${encodeURIComponent(criada.token)}`
      : criada?.confirmaUrl || '';
    showToast('toast', link ? 'Testemunha convidada. Copie o link na lista.' : 'Testemunha convidada.');
    if ($('testemunha-form')) $('testemunha-form').reset();
    await loadApuracao();
  } catch (error) {
    showToast('toast', error.message);
  }
}

const PAPEL_AUDITORIA_LABEL = {
  ADMIN: 'Admin',
  LIDER: 'Líder',
  EMPREENDEDOR: 'Empreendedor',
  SISTEMA: 'Sistema',
};

async function loadAuditoria() {
  const tbody = $('auditoria-list');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="5" class="loading-bar">Carregando logs...</td></tr>';
  }
  try {
    const result = await adminApi.auditoria({
      tipo: auditoriaFilter === 'TODOS' ? undefined : auditoriaFilter,
      page: auditoriaPage,
      limit: 10,
    });
    auditoriaCache = Array.isArray(result?.data) ? result.data : [];
    auditoriaFiltros = Array.isArray(result?.filtros) ? result.filtros : [];
    auditoriaMeta = {
      total: Number(result?.total) || 0,
      totalPages: Number(result?.totalPages) || 1,
      limit: Number(result?.limit) || 10,
      page: Number(result?.page) || 1,
    };
    auditoriaPage = auditoriaMeta.page;
    renderAuditoriaFilters();
    renderAuditoriaTable();
  } catch (error) {
    if (error.status === 401) return logout();
    if (tbody) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${esc(error.message)}</td></tr>`;
    }
    showToast('toast', error.message);
  }
}

function renderAuditoriaFilters() {
  const box = $('auditoria-filters');
  if (!box) return;
  const totalAll = auditoriaFiltros.reduce((acc, f) => acc + (Number(f.total) || 0), 0);
  const chips = [
    { key: 'TODOS', label: 'Todos', n: totalAll },
    ...auditoriaFiltros.map((f) => ({
      key: f.tipo,
      label: f.label || f.tipo,
      n: Number(f.total) || 0,
    })),
  ];
  box.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="chip ${auditoriaFilter === c.key ? 'active' : ''}" data-auditoria-filter="${c.key}">${esc(c.label)} <span class="n">${c.n}</span></button>`,
    )
    .join('');
  box.querySelectorAll('[data-auditoria-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      auditoriaFilter = btn.dataset.auditoriaFilter || 'TODOS';
      auditoriaPage = 1;
      loadAuditoria();
    });
  });
}

function formatAuditoriaDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso);
  }
}

function renderAuditoriaTable() {
  const tbody = $('auditoria-list');
  if (!tbody) return;
  const wrap = tbody.closest('.table-wrap') || tbody.closest('.table-card');
  wrap?.querySelector('[data-pagination-id="admin-auditoria"]')?.remove();

  if (!auditoriaCache.length) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhum evento de auditoria neste filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = auditoriaCache
    .map((ev) => {
      const papel = PAPEL_AUDITORIA_LABEL[ev.atorPapel] || ev.atorPapel || '—';
      const detalhe =
        ev.payload && typeof ev.payload === 'object' && Object.keys(ev.payload).length
          ? `<div class="sub-cell">${esc(JSON.stringify(ev.payload))}</div>`
          : '';
      return `<tr>
        <td><div class="nome-cell">${esc(formatAuditoriaDate(ev.createdAt))}</div></td>
        <td><div class="nome-cell">${esc(ev.tipoLabel || ev.tipo || '—')}</div></td>
        <td>
          <div class="nome-cell">${esc(papel)}</div>
          ${ev.atorId ? `<div class="sub-cell">${esc(ev.atorId)}</div>` : ''}
        </td>
        <td>
          <div class="nome-cell">${esc(ev.resumo || '—')}</div>
          ${detalhe}
        </td>
        <td><div class="sub-cell">${esc(ev.cpfHashPrefix || '—')}</div></td>
      </tr>`;
    })
    .join('');

  if (!wrap) return;
  const { total, totalPages, page, limit } = auditoriaMeta;
  if (!total) return;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const showNav = total > limit;
  wrap.insertAdjacentHTML(
    'beforeend',
    `<div class="table-pagination" data-pagination-id="admin-auditoria">
      <span class="table-pagination-info">${from}–${to} de ${total}</span>
      ${
        showNav
          ? `<div class="table-pagination-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
              <span class="table-pagination-pages">Página ${page} de ${totalPages}</span>
              <button type="button" class="btn btn-ghost btn-sm" data-page="next" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
            </div>`
          : ''
      }
    </div>`,
  );
  wrap.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
    if (auditoriaPage > 1) {
      auditoriaPage -= 1;
      loadAuditoria();
    }
  });
  wrap.querySelector('[data-page="next"]')?.addEventListener('click', () => {
    if (auditoriaPage < totalPages) {
      auditoriaPage += 1;
      loadAuditoria();
    }
  });
}

async function promoverFinalistas() {
  try {
    const result = await adminApi.promoverFinalistas();
    showToast('toast', result?.message || 'Finalistas promovidos.');
    await loadApuracao();
  } catch (error) {
    showToast('toast', error.message);
  }
}

async function publicarResultados() {
  const btn = $('btn-publicar');
  const original = btn?.textContent;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Publicando...';
    }
    const result = await adminApi.publicarResultados();
    rankingCache = Array.isArray(result?.ranking) ? result.ranking : [];
    renderRankingTable();
    const total = rankingCache.length;
    showToast(
      'toast',
      total
        ? `Resultados publicados. Top ${total} exibido abaixo.`
        : 'Resultados publicados.',
    );
    document.getElementById('card-ranking-resultados')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  } catch (error) {
    showToast('toast', error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || 'Publicar resultados';
    }
  }
}

document.querySelectorAll('.overlay').forEach((o) => {
  o.addEventListener('click', (e) => {
    if (e.target === o) o.classList.remove('show');
  });
});

$('login-form').addEventListener('submit', handleLogin);
$('btn-logout').addEventListener('click', logout);
$('btn-new').addEventListener('click', openNew);
$('btn-import').addEventListener('click', openImport);
$('btn-save-edit').addEventListener('click', saveEdit);
$('btn-close-edit').addEventListener('click', closeEdit);
$('btn-save-new').addEventListener('click', saveNew);
$('btn-close-new').addEventListener('click', closeNew);
$('btn-close-import').addEventListener('click', closeImport);
$('btn-confirm-delete').addEventListener('click', confirmDelete);
$('btn-close-delete').addEventListener('click', closeDelete);
$('import-file').addEventListener('change', handleImportFile);

$('admin-tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-panel]');
  if (btn) switchPanel(btn.dataset.panel);
});
$('config-form')?.addEventListener('submit', saveConfig);
$('btn-publicar-regulamento')?.addEventListener('click', publicarRegulamento);
$('btn-clonar-edicao')?.addEventListener('click', clonarEdicao);
$('btn-backup-inscricoes')?.addEventListener('click', () => downloadBackup('inscricoes'));
$('btn-backup-votos')?.addEventListener('click', () => downloadBackup('votos'));
$('btn-toggle-ind')?.addEventListener('click', toggleIndicacoes);
$('btn-save-ind-period')?.addEventListener('click', saveIndicacoesPeriodo);
$('btn-toggle-col')?.addEventListener('click', toggleColegio);
$('btn-toggle-vot')?.addEventListener('click', toggleVotacao);
$('cat-form')?.addEventListener('submit', createCategoria);
$('com-form')?.addEventListener('submit', createComunidade);
$('semente-form')?.addEventListener('submit', createLiderSemente);
$('btn-promover')?.addEventListener('click', promoverFinalistas);
$('btn-publicar')?.addEventListener('click', publicarResultados);
$('btn-reload-apuracao')?.addEventListener('click', loadApuracao);
$('testemunha-form')?.addEventListener('submit', convidarTestemunha);
$('btn-reload-auditoria')?.addEventListener('click', () => loadAuditoria());

wirePhone('edit-telefone');
wirePhone('new-telefone');
wirePhone('semente-telefone');
wireCPF('semente-cpf');
wireLogoPreview();

$('search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    resetPage('admin-inscricoes');
    loadData();
  }, 350);
});

async function init() {
  if (getToken()) {
    try {
      await authApi.me();
      showApp();
      await loadPanelData();
      return;
    } catch {
      setToken(null);
    }
  }
  showLogin();
}

init();
