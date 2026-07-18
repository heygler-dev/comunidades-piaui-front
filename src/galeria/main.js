import { publicApi } from '../api/client.js';
import { startupPublicPath } from '../lib/startup-url.js';

const root = document.getElementById('galeria-root');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return String(iso);
  }
}

function renderEmpty(message) {
  root.innerHTML = `<p class="galeria-empty">${esc(message)}</p>`;
}

function renderGaleria(edicoes) {
  if (!edicoes.length) {
    renderEmpty('Ainda não há edições com resultados publicados.');
    return;
  }

  root.innerHTML = edicoes
    .map((ed) => {
      const winners = (ed.vencedores || [])
        .map((v) => {
          const href = v.slugPublico ? startupPublicPath(null, v.slugPublico) : null;
          const nome = esc(v.startup || '—');
          const title = href
            ? `<a class="galeria-startup" href="${esc(href)}">${nome}</a>`
            : `<span class="galeria-startup">${nome}</span>`;
          return `<li>
            <div class="galeria-cat">${esc(v.categoria || '—')}</div>
            ${title}
            <div class="galeria-meta">
              ${v.cidade ? `${esc(v.cidade)} · ` : ''}${Number(v.totalVotos) || 0} votos
              ${v.publicadoEm ? ` · ${esc(formatDate(v.publicadoEm))}` : ''}
            </div>
          </li>`;
        })
        .join('');

      const testemunhas = (ed.testemunhas || [])
        .map(
          (t) =>
            `<li>${esc(t.nome)}${t.organizacao ? ` <span>(${esc(t.organizacao)})</span>` : ''}</li>`,
        )
        .join('');

      return `
        <section class="galeria-edicao${ed.ativa ? ' is-ativa' : ''}">
          <header class="galeria-edicao-head">
            <div>
              <h2>${esc(ed.nome || `Edição ${ed.ano}`)}</h2>
              <p>${esc(String(ed.ano || ''))}${ed.ativa ? ' · edição atual' : ''}</p>
            </div>
          </header>
          <ul class="galeria-winners">${winners}</ul>
          ${
            testemunhas
              ? `<div class="galeria-testemunhas">
                   <h3>Testemunhas externas</h3>
                   <ul>${testemunhas}</ul>
                 </div>`
              : ''
          }
        </section>
      `;
    })
    .join('');
}

async function init() {
  try {
    const data = await publicApi.galeria();
    const list = Array.isArray(data) ? data : [];
    renderGaleria(list);
  } catch (error) {
    renderEmpty(error.message || 'Não foi possível carregar a galeria.');
  }
}

init();
