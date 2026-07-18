import { publicApi } from '../api/client.js';

const root = document.getElementById('regras-root');
const params = new URLSearchParams(window.location.search);
const versaoParam = params.get('versao');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso);
  }
}

/** Markdown mínimo: títulos ## e listas - */
function renderMd(md) {
  const lines = String(md || '').split('\n');
  const html = [];
  let inList = false;
  const flushList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      flushList();
      html.push(`<h2>${esc(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      flushList();
      html.push(`<h3>${esc(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${esc(line.slice(2))}</li>`);
    } else if (!line.trim()) {
      flushList();
    } else {
      flushList();
      html.push(`<p>${esc(line)}</p>`);
    }
  }
  flushList();
  return html.join('') || '<p>Critérios ainda não publicados.</p>';
}

function renderError(msg) {
  root.innerHTML = `<p class="galeria-empty">${esc(msg)}</p>`;
}

function render(data) {
  const reg = data.regulamento;
  const snap = reg?.snapshot && typeof reg.snapshot === 'object' ? reg.snapshot : null;
  const src = snap || data.vigente || {};
  const categorias = Array.isArray(src.categorias) ? src.categorias : data.vigente?.categorias || [];
  const criterios = reg?.criteriosMd || data.vigente?.criteriosMd || '';
  const versaoAtual = reg?.versao;

  const hist = (data.historico || [])
    .map((h) => {
      const active = Number(h.versao) === Number(versaoAtual);
      return `<li><a class="${active ? 'is-active' : ''}" href="/regras.html?versao=${esc(String(h.versao))}">v${esc(String(h.versao))} · ${esc(formatDate(h.publicadaEm))}</a></li>`;
    })
    .join('');

  root.innerHTML = `
    <section class="regras-card">
      <h2>${esc(data.edicao?.nome || src.nome || 'Edição')}</h2>
      <div class="regras-meta">
        <div><span>Ano</span><strong>${esc(String(src.ano || data.edicao?.ano || '—'))}</strong></div>
        <div><span>Fase</span><strong>${esc(src.faseLabel || src.faseAtual || '—')}</strong></div>
        <div><span>X líderes / comunidade</span><strong>${esc(String(src.xLideresColegio ?? '—'))}</strong></div>
        <div><span>N finalistas / categoria</span><strong>${esc(String(src.nFinalistasPorCategoria ?? '—'))}</strong></div>
        <div><span>Cotas regionais</span><strong>${
          src.cotasRegionaisAtivas
            ? `Ativas · mín. capital ${esc(String(src.cotaMinCapital ?? 0))} · mín. interior ${esc(String(src.cotaMinInterior ?? 0))}`
            : 'Desativadas'
        }</strong></div>
        <div><span>Cidades capital</span><strong>${esc(src.cidadesCapital || 'Teresina')}</strong></div>
        ${
          reg
            ? `<div><span>Versão pública</span><strong>v${esc(String(reg.versao))} · ${esc(formatDate(reg.publicadaEm))}</strong></div>`
            : '<div><span>Versão pública</span><strong>Ainda não publicada — exibindo rascunho vigente</strong></div>'
        }
      </div>
      <h2 style="font-size:15px;margin-top:8px">Categorias</h2>
      <ul class="regras-cats">
        ${
          categorias.length
            ? categorias.map((c) => `<li>${esc(c.nome || c)}</li>`).join('')
            : '<li>Nenhuma categoria</li>'
        }
      </ul>
    </section>

    <section class="regras-card">
      <h2>Critérios</h2>
      <div class="regras-md">${renderMd(criterios)}</div>
      <p class="regras-note">
        A Startup Piauí organiza o prêmio e também pode ter startups aceleradas concorrentes.
        A apuração conta com ata pública e testemunha externa para reforçar a transparência.
      </p>
    </section>

    ${
      hist
        ? `<section class="regras-card">
             <h2>Histórico de versões</h2>
             <ul class="regras-versions">${hist}</ul>
           </section>`
        : ''
    }
  `;

  document.title = `Regras · ${data.edicao?.nome || 'Edição'} — Prêmio B-R-O-BRÓ`;
}

async function init() {
  try {
    const data = await publicApi.regras(
      versaoParam ? { versao: versaoParam } : {},
    );
    render(data);
  } catch (error) {
    renderError(error.message || 'Não foi possível carregar as regras.');
  }
}

init();
