import { authApi, setToken } from '../api/client.js';

const INSCRICAO_KEY = 'premio_inscricao_id';

export function getSelectedInscricaoId() {
  return localStorage.getItem(INSCRICAO_KEY) || '';
}

export function setSelectedInscricaoId(id) {
  if (id) localStorage.setItem(INSCRICAO_KEY, id);
  else localStorage.removeItem(INSCRICAO_KEY);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let outsideBound = false;

function setStandaloneLogoutVisible(visible) {
  const btn = document.getElementById('btn-logout');
  if (!btn) return;
  btn.classList.toggle('hidden', !visible);
}

/**
 * @param {object} opts
 * @param {'lider'|'empreendedor'} opts.papelAtual
 * @param {{ lider?: boolean, empreendedor?: boolean }} opts.papeis
 * @param {Array} opts.startups
 * @param {Array} opts.vinculosLider
 * @param {string|null} [opts.startupAtivaId]
 * @param {string|null} [opts.comunidadeAtivaId]
 * @param {(comunidadeId: string) => void} [opts.onSelectComunidade]
 * @param {() => void} [opts.onLogout]
 */
export function renderContextoNav(opts) {
  const root = document.getElementById('contexto-nav');
  if (!root) return;

  const startups = opts.startups || [];
  const vinculos = opts.vinculosLider || [];
  const papeis = opts.papeis || {};
  const dual = Boolean(papeis.lider && papeis.empreendedor);
  const multiStartups = startups.length > 1;
  const show =
    dual ||
    multiStartups ||
    (opts.papelAtual === 'lider' && startups.length > 0) ||
    (opts.papelAtual === 'empreendedor' && vinculos.length > 0);

  if (!show) {
    root.classList.add('hidden');
    root.innerHTML = '';
    setStandaloneLogoutVisible(true);
    return;
  }

  root.classList.remove('hidden');
  setStandaloneLogoutVisible(false);

  const items = [];

  if (vinculos.length) {
    items.push('<div class="contexto-group">Área do líder</div>');
    vinculos.forEach((v) => {
      const id = v.comunidade?.id;
      const nome = v.comunidade?.nome || 'Comunidade';
      const tipo = v.tipoLider === 'SEMENTE' ? 'Semente' : 'Participante';
      const active =
        opts.papelAtual === 'lider' && id === opts.comunidadeAtivaId
          ? ' is-active'
          : '';
      items.push(
        `<button type="button" class="contexto-item${active}" data-kind="lider" data-comunidade-id="${esc(id)}">
          <span class="contexto-item-title">${esc(nome)}</span>
          <span class="contexto-item-meta">Líder · ${esc(tipo)}</span>
        </button>`,
      );
    });
  }

  if (startups.length) {
    items.push('<div class="contexto-group">Minhas startups</div>');
    startups.forEach((s) => {
      const active =
        opts.papelAtual === 'empreendedor' && s.id === opts.startupAtivaId
          ? ' is-active'
          : '';
      const com = s.comunidade?.nome || '';
      items.push(
        `<button type="button" class="contexto-item${active}" data-kind="startup" data-inscricao-id="${esc(s.id)}">
          <span class="contexto-item-title">${esc(s.nomeStartup || 'Startup')}</span>
          <span class="contexto-item-meta">${esc(com)}${s.status === 'PENDENTE' ? ' · Pendente' : ''}</span>
        </button>`,
      );
    });
  }

  items.push('<div class="contexto-menu-divider" role="separator"></div>');
  items.push(
    `<button type="button" class="contexto-item contexto-item-sair" data-kind="logout">
      <span class="contexto-item-title">Sair</span>
    </button>`,
  );

  root.innerHTML = `
    <div class="contexto-dropdown">
      <button type="button" class="btn btn-ghost contexto-trigger" id="contexto-trigger" aria-expanded="false" aria-haspopup="true">
        Meus painéis
        <span class="contexto-chevron" aria-hidden="true"></span>
      </button>
      <div class="contexto-menu hidden" id="contexto-menu" role="menu">
        ${items.join('')}
      </div>
    </div>
  `;

  const trigger = root.querySelector('#contexto-trigger');
  const menu = root.querySelector('#contexto-menu');

  const close = () => {
    menu?.classList.add('hidden');
    trigger?.setAttribute('aria-expanded', 'false');
  };

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu?.classList.toggle('hidden') === false;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  menu?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-kind]');
    if (!btn) return;
    close();
    const kind = btn.dataset.kind;
    try {
      if (kind === 'logout') {
        opts.onLogout?.();
        return;
      }
      if (kind === 'lider') {
        const comunidadeId = btn.dataset.comunidadeId;
        if (opts.papelAtual === 'lider') {
          opts.onSelectComunidade?.(comunidadeId);
          return;
        }
        const data = await authApi.switchPapel('lider');
        setToken(data.access_token);
        if (comunidadeId) {
          sessionStorage.setItem('premio_lider_comunidade_id', comunidadeId);
        }
        window.location.href = '/lider.html';
        return;
      }
      if (kind === 'startup') {
        const inscricaoId = btn.dataset.inscricaoId;
        setSelectedInscricaoId(inscricaoId);
        if (opts.papelAtual === 'empreendedor') {
          if (inscricaoId === opts.startupAtivaId) return;
          window.location.href = '/empreendedor.html';
          return;
        }
        const data = await authApi.switchPapel('empreendedor');
        setToken(data.access_token);
        window.location.href = '/empreendedor.html';
      }
    } catch (ex) {
      const toastEl = document.getElementById('toast');
      if (toastEl) {
        toastEl.textContent = ex.message || 'Não foi possível trocar de contexto.';
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 3200);
      } else {
        alert(ex.message || 'Não foi possível trocar de contexto.');
      }
    }
  });

  if (!outsideBound) {
    outsideBound = true;
    document.addEventListener('click', (e) => {
      const nav = document.getElementById('contexto-nav');
      const m = document.getElementById('contexto-menu');
      const t = document.getElementById('contexto-trigger');
      if (!nav || !m || nav.contains(e.target)) return;
      m.classList.add('hidden');
      t?.setAttribute('aria-expanded', 'false');
    });
  }
}

export function consumeLiderComunidadePreferida() {
  const id = sessionStorage.getItem('premio_lider_comunidade_id');
  if (id) sessionStorage.removeItem('premio_lider_comunidade_id');
  return id || null;
}
