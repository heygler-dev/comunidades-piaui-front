import { authApi, publicApi, getVotoToken, setVotoToken } from '../api/client.js';
import {
  copyText,
  getQueryParam,
  isValidCPF,
  showToast,
  showAlert,
  wireCPF,
  wirePasswordToggle,
  wirePhone,
  maskPhone,
} from '../lib/utils.js';
import { startupPublicPath } from '../lib/startup-url.js';
import { createSolicitacoesFlow } from './solicitacoes-flow.js';
import { downloadVoteReceiptPdf } from '../lib/voto-comprovante.js';

const $ = (id) => document.getElementById(id);

const state = {
  conviteToken: getQueryParam('convite') || '',
  conviteValid: false,
  slugInscricao: getQueryParam('inscrever') || '',
  inscricaoId: sessionStorage.getItem('premio_inscricao_id') || '',
  comunidadeLabel: '',
  linkInscricao: '',
  categorias: [],
  finalistas: [],
  votacaoAberta: false,
  lastVoteReceipt: null,
  resultadosPublicos: [],
  ataPublica: null,
  votoUser: null,
};

const BADGE_MAP = {
  'screen-landing': 'Cadastro de Participantes',
  'screen-lider-solicitacao': 'Líder · Solicitação de cadastro',
  'screen-lider-solicitacao-success': 'Líder · Solicitação enviada',
  'screen-lider-form': 'Líder · Ativação de perfil',
  'screen-lider-success': 'Líder · Perfil ativo',
  'screen-startup-sol-form': 'Startup · Solicitação · Etapa 1 de 3',
  'screen-startup-sol-step2': 'Startup · Solicitação · Etapa 2 de 3',
  'screen-startup-sol-step3': 'Startup · Solicitação · Etapa 3 de 3',
  'screen-startup-sol-success': 'Startup · Solicitação enviada',
  'screen-startup-form': 'Startup · Etapa 1 de 3',
  'screen-startup-step2': 'Startup · Etapa 2 de 3',
  'screen-startup-step3': 'Startup · Etapa 3 de 3',
  'screen-startup-success': 'Startup · Inscrição concluída',
  'screen-voto-form': 'Voto Popular · Votação aberta',
};

const VOTO_ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
};

function goTo(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const screen = $(id);
  if (!screen) return;
  screen.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const banner = $('home-banner');
  if (banner) banner.classList.toggle('visible', id === 'screen-landing');
  if (id === 'screen-startup-step3') fillReview();
  if (id === 'screen-voto-form') {
    loadVotoTotal();
    ensureVotoSession();
  }
}

function syncUrlParams() {
  state.conviteToken = getQueryParam('convite') || state.conviteToken || '';
  state.slugInscricao = getQueryParam('inscrever') || state.slugInscricao || '';
}

function setVotacaoAberta(aberta) {
  state.votacaoAberta = aberta;
}

function switchTab(tab) {
  if (tab === 'voto') {
    if (!state.votacaoAberta) return;
    goTo('screen-voto-form');
  } else {
    goTo('screen-landing');
  }
}

function goStep(n) {
  if (n === 1) goTo('screen-startup-form');
  else goTo(`screen-startup-step${n}`);
}

function comunidadeText(c) {
  return `${c.nome} — ${c.cidade}/${c.estado || 'PI'}`;
}

const solFlow = createSolicitacoesFlow({ $, goTo, comunidadeText });

async function loadConvitePrefill() {
  const el = $('lider-prefill');
  if (!state.conviteToken) {
    state.conviteValid = false;
    el.innerHTML =
      'Para ativar seu perfil de líder, acesse o <b>link de convite</b> enviado pela organização. O link já traz o código na URL (<code>?convite=token</code>).';
    return;
  }
  try {
    const data = await publicApi.getConvite(state.conviteToken);
    state.conviteValid = true;
    state.comunidadeLabel = comunidadeText(data.comunidade);
    el.innerHTML = `Convite reconhecido: <b>${state.comunidadeLabel}</b>.`;
  } catch (error) {
    state.conviteValid = false;
    const msg =
      error.status === 409
        ? 'Este convite já foi utilizado. Solicite um novo link à organização.'
        : 'Convite inválido ou expirado. Verifique o link ou solicite um novo convite.';
    el.innerHTML = msg;
  }
}

async function loadStartupPrefill() {
  const el = $('startup-prefill');
  if (!state.slugInscricao) {
    el.innerHTML =
      'Para inscrever sua startup, acesse o <b>link enviado pelo líder</b> da sua comunidade. O link já traz o código na URL (<code>?inscrever=slug-do-link</code>).';
    return;
  }
  try {
    const data = await publicApi.getLinkInscricao(state.slugInscricao);
    state.comunidadeLabel = comunidadeText(data.comunidade);
    el.innerHTML = `Vinculada à comunidade <b>${data.comunidade.nome}</b>, via link do seu líder.`;
  } catch {
    el.innerHTML =
      'Link de inscrição inválido. Verifique o link do seu líder ou o parâmetro <code>?inscrever=slug-do-link</code> na URL.';
  }
}

async function openStartupForm() {
  goTo('screen-startup-form');
  await loadStartupPrefill();
}

async function startStartupFlow() {
  if (state.inscricaoId) {
    try {
      const draft = await publicApi.getInscricao(state.inscricaoId);
      if (draft.status === 'RASCUNHO') {
        $('st-nome').value = draft.responsavelNome || '';
        $('st-cpf').value = draft.responsavelCpf || '';
        $('st-telefone').value = maskPhone(draft.responsavelTelefone || '');
        $('st-email').value = draft.responsavelEmail || '';
        $('st-nomeempresa').value = draft.nomeStartup || '';
        $('st-categoria').value = draft.categoria || '';
        $('st-cidade').value = draft.cidadeOperacao || '';
        $('st-site').value = draft.site || '';
        $('st-descricao').value = draft.descricao || '';
        const etapa = draft.etapaAtual || 1;
        if (etapa >= 3) goTo('screen-startup-step3');
        else if (etapa >= 2) goTo('screen-startup-step2');
        else await openStartupForm();
        return;
      }
    } catch {
      sessionStorage.removeItem('premio_inscricao_id');
      state.inscricaoId = '';
    }
  }
  await openStartupForm();
}

async function submitStartupProfile() {
  syncUrlParams();
  const nome = $('st-nome').value.trim();
  const cpfOk = isValidCPF($('st-cpf').value);
  const senha = $('st-senha')?.value || '';
  if (!state.slugInscricao) {
    showAlert('Use o link de inscrição enviado pelo seu líder. O link deve conter o código na URL (?inscrever=...).', {
      title: 'Link de inscrição necessário',
    });
    return;
  }
  if (!nome || !cpfOk || !$('st-telefone').value.trim() || !$('st-email').value.trim() || senha.length < 8) {
    if (!cpfOk) {
      $('st-cpf').classList.add('invalid');
      $('st-cpf-err').classList.add('show');
    }
    showAlert('Confira nome, CPF, telefone, e-mail e senha (mínimo de 8 caracteres) antes de continuar.', {
      title: 'Dados incompletos',
    });
    return;
  }
  try {
    const id = await ensureInscricaoId();
    await publicApi.etapa1(id, {
      responsavelNome: nome,
      cpf: $('st-cpf').value,
      telefone: $('st-telefone').value.trim(),
      email: $('st-email').value.trim(),
      senha,
    });
    goStep(2);
  } catch (error) {
    showAlert(error.message, { title: 'Não foi possível continuar', variant: 'error' });
  }
}

async function ensureInscricaoId() {
  syncUrlParams();
  if (!state.slugInscricao) {
    throw new Error('Use o link de inscrição enviado pelo líder da sua comunidade (?inscrever=... na URL).');
  }
  if (state.inscricaoId) return state.inscricaoId;
  const draft = await publicApi.createInscricao(state.slugInscricao);
  state.inscricaoId = draft.id;
  sessionStorage.setItem('premio_inscricao_id', draft.id);
  return draft.id;
}

async function goStep3() {
  if (
    !$('st-nomeempresa').value.trim() ||
    !$('st-categoria').value ||
    !$('st-cidade').value.trim() ||
    $('st-descricao').value.trim().length < 10
  ) {
    showAlert('Preencha todos os campos obrigatórios da etapa 2.', { title: 'Dados incompletos' });
    return;
  }
  try {
    const id = await ensureInscricaoId();
    await publicApi.etapa2(id, {
      nomeStartup: $('st-nomeempresa').value.trim(),
      categoria: $('st-categoria').value,
      cidadeOperacao: $('st-cidade').value.trim(),
      site: $('st-site').value.trim() || undefined,
      descricao: $('st-descricao').value.trim(),
    });
    goStep(3);
  } catch (error) {
    showAlert(error.message, { title: 'Não foi possível continuar', variant: 'error' });
  }
}

async function saveDraft() {
  try {
    if ($('st-nome').value.trim()) {
      const id = await ensureInscricaoId();
      if (isValidCPF($('st-cpf').value)) {
        await publicApi.etapa1(id, {
          responsavelNome: $('st-nome').value.trim(),
          cpf: $('st-cpf').value,
          telefone: $('st-telefone').value.trim(),
          email: $('st-email').value.trim(),
        });
      }
      if ($('st-nomeempresa').value.trim()) {
        await publicApi.etapa2(id, {
          nomeStartup: $('st-nomeempresa').value.trim(),
          categoria: $('st-categoria').value,
          cidadeOperacao: $('st-cidade').value.trim(),
          site: $('st-site').value.trim() || undefined,
          descricao: $('st-descricao').value.trim() || 'Rascunho',
        });
      }
    }
    showAlert('Inscrição salva. Você pode voltar e continuar de onde parou.', {
      title: 'Rascunho salvo',
      variant: 'success',
    });
  } catch (error) {
    showAlert(error.message, { title: 'Não foi possível salvar', variant: 'error' });
  }
}

function fillReview() {
  $('rev-nome').textContent = $('st-nome').value || '—';
  $('rev-cpf').textContent = $('st-cpf').value || '—';
  $('rev-telefone').textContent = $('st-telefone').value || '—';
  $('rev-email').textContent = $('st-email').value || '—';
  $('rev-nomeempresa').textContent = $('st-nomeempresa').value || '—';
  $('rev-categoria').textContent = $('st-categoria').value || '—';
  $('rev-cidade').textContent = $('st-cidade').value || '—';
}

async function submitStartup() {
  if (!$('st-lgpd').checked || !$('st-unico').checked) {
    showAlert('Marque as duas declarações obrigatórias antes de confirmar a inscrição.', {
      title: 'Confirmação necessária',
    });
    return;
  }
  try {
    const id = await ensureInscricaoId();
    const result = await publicApi.confirmar(id, {
      lgpdAceito: true,
      cpfUnicoConfirmado: true,
      senha: $('st-senha')?.value || undefined,
    });
    sessionStorage.removeItem('premio_inscricao_id');
    state.inscricaoId = '';
    const preview = result.preview;
    $('lp-nome').textContent = preview.nome;
    $('lp-initial').textContent = preview.inicial || 'S';
    $('lp-categoria').textContent = `${preview.categoria} · ${preview.cidade}`;
    $('lp-descricao').textContent = preview.descricao;
    $('success-comunidade').textContent = result.comunidade || state.comunidadeLabel;
    const lpBtn = $('btn-ver-lp');
    const lpPath = result.paginaUrl || startupPublicPath(preview.site, result.slugPublico);
    if (lpBtn && lpPath) {
      lpBtn.href = lpPath;
    }
    goTo('screen-startup-success');
  } catch (error) {
    showAlert(error.message, { title: 'Não foi possível confirmar', variant: 'error' });
  }
}

async function submitLider() {
  syncUrlParams();
  if (!state.conviteToken) {
    showAlert('Use o link de convite enviado pela organização. O link deve conter o código na URL (?convite=...).', {
      title: 'Link de convite necessário',
    });
    return;
  }
  const nome = $('lider-nome').value.trim();
  const cpfOk = isValidCPF($('lider-cpf').value);
  const lgpd = $('lider-lgpd').checked;
  const telefone = $('lider-telefone').value.trim();
  const senha = $('lider-senha')?.value || '';
  if (!nome || !cpfOk || !lgpd || !telefone || !$('lider-email').value.trim() || senha.length < 8) {
    if (!cpfOk) {
      $('lider-cpf').classList.add('invalid');
      $('lider-cpf-err').classList.add('show');
    }
    showAlert('Preencha nome, CPF, telefone, e-mail, senha (mínimo de 8 caracteres) e aceite a LGPD.', {
      title: 'Dados incompletos',
    });
    return;
  }
  try {
    const result = await publicApi.ativarLider({
      token: state.conviteToken,
      nome,
      cpf: $('lider-cpf').value,
      telefone: $('lider-telefone').value.trim(),
      email: $('lider-email').value.trim(),
      senha: $('lider-senha').value,
      lgpdAceito: true,
    });
    $('lider-nome-echo').textContent = nome.split(' ')[0] + '.';
    state.linkInscricao = result.linkInscricao || `premiopiaui.org/inscrever/${result.slug}`;
    $('lider-link').value = state.linkInscricao;
    goTo('screen-lider-success');
  } catch (error) {
    showAlert(error.message, { title: 'Não foi possível ativar', variant: 'error' });
  }
}

async function loadVotacaoStatus() {
  try {
    const data = await publicApi.votoStatus();
    setVotacaoAberta(!!data.votacaoAberta);
  } catch {
    setVotacaoAberta(false);
  }
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadResultadosPublicos() {
  const section = $('home-resultados');
  const linkRegras = $('link-regras-edicao');
  const linkGaleria = $('link-galeria-vencedores');

  try {
    const [resultados, ata, status] = await Promise.all([
      publicApi.resultados().catch(() => []),
      publicApi.ata().catch(() => null),
      publicApi.edicaoStatus().catch(() => null),
    ]);

    const list = Array.isArray(resultados) ? resultados : [];
    const publicados =
      Boolean(status?.resultadosPublicados) || (list.length > 0 && Boolean(ata));

    linkRegras?.classList.toggle('hidden', !publicados);
    linkGaleria?.classList.toggle('hidden', !publicados);

    if (!section) return;

    if (!list.length || !ata) {
      section.classList.add('hidden');
      state.resultadosPublicos = [];
      state.ataPublica = null;
      return;
    }

    state.resultadosPublicos = list;
    state.ataPublica = ata;

    const publicada = ata.publicadaEm
      ? new Date(ata.publicadaEm).toLocaleString('pt-BR')
      : '';
    const meta = $('ata-publicada-em');
    if (meta) meta.textContent = publicada ? `Publicada em ${publicada}` : '';

    const wrap = $('resultados-vencedores');
    if (wrap) {
      wrap.innerHTML = list
        .map((r) => {
          const cat = escHtml(r.categoria?.nome || '—');
          const nome = escHtml(r.finalista?.inscricaoStartup?.nomeStartup || '—');
          const cidade = escHtml(r.finalista?.inscricaoStartup?.cidadeOperacao || '');
          const votos = Number(r.totalVotos) || 0;
          return `<div class="resultado-row">
            <div>
              <div class="resultado-cat">${cat}</div>
              <div class="resultado-nome">${nome}</div>
              ${cidade ? `<div class="resultado-cidade">${cidade}</div>` : ''}
            </div>
            <div class="resultado-votos"><strong>${votos}</strong> votos</div>
          </div>`;
        })
        .join('');
    }

    section.classList.remove('hidden');
  } catch {
    section?.classList.add('hidden');
    linkRegras?.classList.add('hidden');
    linkGaleria?.classList.add('hidden');
  }
}

async function loadCategorias() {
  try {
    state.categorias = await publicApi.votoCategorias();
    const select = $('voto-categoria');
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    state.categorias.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.nome;
      opt.textContent = c.nome;
      select.appendChild(opt);
    });
  } catch {
    /* fallback options already in HTML */
  }
}

async function renderFinalistas() {
  const categoria = $('voto-categoria').value;
  const container = $('voto-finalistas');
  if (!categoria) {
    container.innerHTML =
      '<div class="hint">Selecione uma categoria acima para ver as startups finalistas.</div>';
    return;
  }
  try {
    state.finalistas = await publicApi.votoFinalistas(categoria);
    if (!state.finalistas.length) {
      container.innerHTML = '<div class="hint">Nenhum finalista nesta categoria.</div>';
      return;
    }
    container.innerHTML = state.finalistas
      .map(
        (f, i) => `
      <label class="finalist-option" id="fi-opt-${i}">
        <input type="radio" name="finalista" value="${f.id}" data-nome="${f.nome}" onchange="window.selectFinalista(${i})">
        <div>
          <div class="fi-name">${f.nome}</div>
          <div class="fi-meta">${f.metaResumo}</div>
        </div>
      </label>`,
      )
      .join('');
  } catch (error) {
    container.innerHTML = `<div class="hint">${error.message}</div>`;
  }
}

window.selectFinalista = function (i) {
  document.querySelectorAll('.finalist-option').forEach((el) => el.classList.remove('selected'));
  const el = document.getElementById(`fi-opt-${i}`);
  if (el) el.classList.add('selected');
};

async function loadVotoTotal() {
  try {
    const data = await publicApi.votoTotal();
    const badge = $('voto-total-badge');
    if (badge) badge.textContent = `Total de votos apurados: ${data.total}`;
  } catch {
    /* ignore */
  }
}

function closeVotoModal() {
  $('voto-overlay')?.classList.remove('show');
}

function buildVoteDetailsHtml(rows) {
  return rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
}

function showVotoModal({
  title,
  message,
  variant = 'success',
  details = [],
  showReceipt = false,
  receipt = null,
}) {
  const overlay = $('voto-overlay');
  const icon = $('voto-modal-icon');
  const titleEl = $('voto-modal-title');
  const messageEl = $('voto-modal-message');
  const detailsEl = $('voto-modal-details');
  const btnReceipt = $('btn-voto-comprovante');
  if (!overlay || !titleEl || !messageEl || !detailsEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  icon.className = `alert-modal-icon ${variant}`;
  icon.innerHTML = VOTO_ICONS[variant] || VOTO_ICONS.success;
  detailsEl.innerHTML = buildVoteDetailsHtml(details);
  detailsEl.classList.toggle('hidden', !details.length);

  state.lastVoteReceipt = showReceipt ? receipt : null;
  if (btnReceipt) btnReceipt.classList.toggle('hidden', !showReceipt);

  overlay.classList.add('show');
}

async function downloadVoteReceipt() {
  const r = state.lastVoteReceipt;
  if (!r) return;
  const btn = $('btn-voto-comprovante');
  const original = btn?.textContent;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gerando PDF...';
    }
    await downloadVoteReceiptPdf(r);
    showToast('toast', 'Comprovante PDF baixado.');
  } catch (error) {
    showAlert(error.message || 'Não foi possível gerar o PDF.', {
      title: 'Erro no comprovante',
      variant: 'error',
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || 'Baixar comprovante PDF';
    }
  }
}

async function ensureVotoSession() {
  const token = getVotoToken();
  if (!token) {
    showVotoLogin();
    return;
  }
  try {
    const me = await authApi.meWithToken(token);
    if (me?.role !== 'lider' && me?.role !== 'empreendedor') {
      setVotoToken(null);
      showVotoLogin();
      return;
    }
    state.votoUser = me;
    showVotoBallot();
  } catch {
    setVotoToken(null);
    state.votoUser = null;
    showVotoLogin();
  }
}

function showVotoLogin() {
  state.votoUser = null;
  $('voto-login-card')?.classList.remove('hidden');
  $('voto-ballot-card')?.classList.add('hidden');
  const err = $('voto-login-error');
  if (err) {
    err.style.display = 'none';
    err.textContent = '';
  }
}

function showVotoBallot() {
  $('voto-login-card')?.classList.add('hidden');
  $('voto-ballot-card')?.classList.remove('hidden');
  const u = state.votoUser;
  if ($('voto-session-nome')) {
    $('voto-session-nome').textContent = u?.nome || '—';
  }
  if ($('voto-session-meta')) {
    const papel = u?.role === 'lider' ? 'Líder comunitário' : 'Empreendedor / startup';
    const cpf = u?.cpfMascarado || '';
    $('voto-session-meta').textContent = [papel, cpf].filter(Boolean).join(' · ');
  }
  loadCategorias();
}

async function handleVotoLogin(e) {
  e?.preventDefault?.();
  const email = $('voto-login-email')?.value?.trim();
  const senha = $('voto-login-senha')?.value;
  const papel = $('voto-login-papel')?.value || 'lider';
  const err = $('voto-login-error');
  const btn = $('btn-voto-login');
  if (!email || !senha) {
    if (err) {
      err.style.display = 'block';
      err.textContent = 'Informe e-mail e senha.';
    }
    return;
  }
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Entrando...';
    }
    if (err) err.style.display = 'none';
    const data = await authApi.login(email, senha, papel);
    setVotoToken(data.access_token);
    state.votoUser = {
      role: data.role,
      ...(data.user || {}),
    };
    // Completa máscara de CPF via /me
    try {
      const me = await authApi.meWithToken(data.access_token);
      state.votoUser = me;
    } catch {
      /* usa user do login */
    }
    if ($('voto-login-form')) $('voto-login-form').reset();
    showVotoBallot();
  } catch (error) {
    setVotoToken(null);
    if (err) {
      err.style.display = 'block';
      err.textContent = error.message || 'Não foi possível entrar.';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Entrar e continuar';
    }
  }
}

function logoutVoto() {
  setVotoToken(null);
  state.votoUser = null;
  showVotoLogin();
}

async function submitVoto() {
  if (!getVotoToken() || !state.votoUser) {
    showAlert('Entre com sua conta de líder ou empreendedor para votar.', {
      title: 'Login necessário',
    });
    showVotoLogin();
    return;
  }

  const categoria = $('voto-categoria').value;
  const finalistaEl = document.querySelector('input[name="finalista"]:checked');
  const lgpd = $('voto-lgpd').checked;
  const nome = state.votoUser.nome || 'Participante';
  const cpfMascarado = state.votoUser.cpfMascarado || '***.***.***-**';

  if (!categoria || !finalistaEl || !lgpd) {
    showAlert('Selecione categoria, startup finalista e aceite a LGPD.', {
      title: 'Dados incompletos',
    });
    return;
  }

  const dataHora = new Date().toLocaleString('pt-BR');

  try {
    const result = await publicApi.registrarVoto({
      categoria,
      finalistaId: finalistaEl.value,
      lgpdAceito: true,
    });
    if ($('voto-total-badge')) {
      $('voto-total-badge').textContent = `Total de votos apurados: ${result.totalVotos}`;
    }
    showVotoModal({
      title: `Voto registrado, ${String(nome).split(' ')[0]}`,
      message:
        'Seu voto foi contabilizado. Cada CPF vota uma única vez nesta edição.',
      variant: 'success',
      details: [
        ['Nome', nome],
        ['CPF', cpfMascarado],
        ['Categoria', result.categoria],
        ['Startup', result.startup],
        ['Data', dataHora],
      ],
      showReceipt: true,
      receipt: {
        nome,
        cpfMascarado,
        categoria: result.categoria,
        startup: result.startup,
        dataHora,
        totalVotos: result.totalVotos,
      },
    });
  } catch (error) {
    if (error.status === 401) {
      logoutVoto();
      showAlert('Sessão expirada. Entre novamente para votar.', {
        title: 'Login necessário',
        variant: 'error',
      });
      return;
    }
    if (error.status === 409) {
      showVotoModal({
        title: 'Este CPF já votou',
        message:
          'Sua conta já registrou um voto nesta edição. Cada pessoa vota uma única vez, mesmo participando de mais de uma comunidade.',
        variant: 'error',
        details: [
          ['Nome', nome || '—'],
          ['CPF', cpfMascarado],
          ['Status', 'Voto já existente nesta edição'],
        ],
        showReceipt: false,
      });
    } else {
      showAlert(error.message, {
        title: 'Não foi possível registrar o voto',
        variant: 'error',
      });
    }
  }
}

function copyLeaderLink(btn) {
  copyText($('lider-link').value, btn);
}

wireCPF('lider-cpf', 'lider-cpf-err');
wireCPF('st-cpf', 'st-cpf-err');
wireCPF('sol-lider-cpf', 'sol-lider-cpf-err');
wireCPF('sol-st-cpf', 'sol-st-cpf-err');
wirePhone('lider-telefone');
wirePhone('st-telefone');
wirePhone('sol-lider-telefone');
wirePhone('sol-st-telefone');
wirePasswordToggle('lider-senha');
wirePasswordToggle('st-senha');
wirePasswordToggle('sol-lider-senha');
wirePasswordToggle('sol-st-senha');

$('btn-lider-start').addEventListener('click', async () => {
  syncUrlParams();
  if (state.conviteToken) {
    goTo('screen-lider-form');
    await loadConvitePrefill();
  } else {
    await solFlow.openLiderSolicitacao();
  }
});
$('btn-startup-start').addEventListener('click', async () => {
  syncUrlParams();
  if (state.slugInscricao) {
    await startStartupFlow();
  } else {
    await solFlow.openStartupSolicitacao();
  }
});
$('btn-sol-lider-back')?.addEventListener('click', () => goTo('screen-landing'));
$('btn-sol-lider-submit')?.addEventListener('click', () => solFlow.submitSolLider());
$('btn-sol-lider-landing')?.addEventListener('click', () => goTo('screen-landing'));
$('btn-sol-st-prof-back')?.addEventListener('click', () => goTo('screen-landing'));
$('btn-sol-st-prof-submit')?.addEventListener('click', () => solFlow.submitSolStartupProfile());
$('btn-sol-st-back1')?.addEventListener('click', () => solFlow.goSolStep(1));
$('btn-sol-st-step3')?.addEventListener('click', () => solFlow.goSolStep3());
$('btn-sol-st-back2')?.addEventListener('click', () => solFlow.goSolStep(2));
$('btn-sol-rev-edit1')?.addEventListener('click', () => solFlow.goSolStep(1));
$('btn-sol-rev-edit2')?.addEventListener('click', () => solFlow.goSolStep(2));
$('btn-sol-st-submit')?.addEventListener('click', () => solFlow.submitSolStartup());
$('btn-sol-st-landing')?.addEventListener('click', () => goTo('screen-landing'));
$('btn-lider-back').addEventListener('click', () => goTo('screen-landing'));
$('btn-lider-submit').addEventListener('click', submitLider);
$('btn-copy-link').addEventListener('click', (e) => copyLeaderLink(e.target));
if ($('btn-lider-landing')) {
  $('btn-lider-landing').addEventListener('click', () => goTo('screen-landing'));
}
$('btn-st-prof-back').addEventListener('click', () => goTo('screen-landing'));
$('btn-st-prof-submit').addEventListener('click', submitStartupProfile);
$('btn-st-back1').addEventListener('click', () => goTo('screen-startup-form'));
$('btn-st-step3').addEventListener('click', goStep3);
$('btn-st-back2').addEventListener('click', () => goStep(2));
$('btn-st-draft').addEventListener('click', saveDraft);
$('btn-st-submit').addEventListener('click', submitStartup);
$('btn-rev-edit1').addEventListener('click', () => goTo('screen-startup-form'));
$('btn-rev-edit2').addEventListener('click', () => goStep(2));
$('btn-landing1')?.addEventListener('click', () => goTo('screen-landing'));
$('voto-categoria')?.addEventListener('change', renderFinalistas);
$('btn-voto-submit')?.addEventListener('click', submitVoto);
$('btn-voto-back')?.addEventListener('click', () => goTo('screen-landing'));
$('btn-voto-back-2')?.addEventListener('click', () => goTo('screen-landing'));
$('voto-login-form')?.addEventListener('submit', handleVotoLogin);
$('btn-voto-logout')?.addEventListener('click', logoutVoto);
$('btn-voto-modal-close')?.addEventListener('click', closeVotoModal);
$('btn-voto-comprovante')?.addEventListener('click', downloadVoteReceipt);
$('voto-overlay')?.addEventListener('click', (e) => {
  if (e.target === $('voto-overlay')) closeVotoModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('voto-overlay')?.classList.contains('show')) {
    closeVotoModal();
  }
});

async function init() {
  syncUrlParams();
  await Promise.all([
    loadCategorias(),
    loadVotacaoStatus(),
    loadResultadosPublicos(),
  ]);
  if (getQueryParam('convite')) {
    await loadConvitePrefill();
    goTo('screen-lider-form');
  } else if (getQueryParam('inscrever')) {
    await startStartupFlow();
  } else if (getQueryParam('voto')) {
    if (state.votacaoAberta) goTo('screen-voto-form');
    else showToast('toast', 'A votação popular ainda não foi aberta.');
  }
}

init();
