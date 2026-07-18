import { publicApi } from '../api/client.js';
import { getStartupPageIdentifier } from '../lib/startup-url.js';

const root = document.getElementById('lp-root');

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSite(url) {
  if (!url) return '';
  const href = url.startsWith('http') ? url : `https://${url}`;
  const label = url.replace(/^https?:\/\//, '');
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

function parseMetricas(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

function categoryTag(categoria) {
  if (!categoria) return 'STARTUP · PIAUÍ';
  return esc(categoria).toUpperCase();
}

function heroPitch(s) {
  if (s.pitchCurto) return esc(s.pitchCurto);
  if (s.descricao) {
    const first = s.descricao.split('\n').find((l) => l.trim());
    if (first && first.length <= 160) return esc(first.trim());
  }
  return 'Conheça esta startup do ecossistema piauiense.';
}

function aboutTitle(s, metricas) {
  if (metricas.sobreTitulo) return esc(metricas.sobreTitulo);
  if (s.pitchCurto) return esc(s.pitchCurto);
  return `Conheça ${esc(s.nomeStartup || 'esta startup')}`;
}

function aboutBody(s) {
  if (!s.descricao) return '';
  return esc(s.descricao.trim());
}

function renderStats(metricas) {
  const stats = Array.isArray(metricas.stats) ? metricas.stats : [];
  if (!stats.length) return '';
  const cards = stats
    .slice(0, 4)
    .map(
      (st) => `
      <div class="lp-stat-card">
        <div class="val">${esc(st.value ?? st.valor ?? '—')}</div>
        <div class="lbl">${esc(st.label ?? st.rotulo ?? '')}</div>
      </div>`,
    )
    .join('');
  return `<div class="lp-stats">${cards}</div>`;
}

function renderSolucoes(metricas, descricao) {
  const items = Array.isArray(metricas.solucoes) ? metricas.solucoes : [];
  if (!items.length) return '';

  const cards = items
    .slice(0, 6)
    .map(
      (item) => `
      <div class="lp-card">
        <h3>${esc(item.titulo ?? item.title ?? 'Solução')}</h3>
        <p>${esc(item.descricao ?? item.description ?? '')}</p>
      </div>`,
    )
    .join('');

  return `
    <section class="lp-section">
      <p class="lp-label">O que eles fazem</p>
      <h2>Soluções</h2>
      <div class="lp-cards">${cards}</div>
    </section>`;
}

function renderDiferenciais(metricas) {
  const items = Array.isArray(metricas.diferenciais) ? metricas.diferenciais : [];
  if (!items.length) return '';

  const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';
  const list = items
    .slice(0, 6)
    .map((text) => {
      const t = typeof text === 'string' ? text : text?.texto ?? text?.text ?? '';
      return `
      <li class="lp-check-item">
        <span class="lp-check-icon" aria-hidden="true">${checkSvg}</span>
        <p>${esc(t)}</p>
      </li>`;
    })
    .join('');

  return `
    <section class="lp-section">
      <p class="lp-label">Diferenciais</p>
      <h2>Por que essa startup se destaca</h2>
      <ul class="lp-checklist">${list}</ul>
    </section>`;
}

function renderContato(s, metricas) {
  const c = metricas.contato && typeof metricas.contato === 'object' ? metricas.contato : {};
  const items = [];

  if (c.email) items.push(`<li>${esc(c.email)}</li>`);
  if (c.telefone) items.push(`<li>${esc(c.telefone)}</li>`);
  if (c.endereco) items.push(`<li>${esc(c.endereco)}</li>`);
  if (c.social) items.push(`<li>${esc(c.social)}</li>`);
  if (s.site) items.push(`<li>${formatSite(s.site)}</li>`);
  if (s.cidadeOperacao) {
    items.push(`<li>${esc(s.cidadeOperacao)} — Piauí, Brasil</li>`);
  }

  if (!items.length) {
    items.push('<li>Contato disponível mediante inscrição no prêmio.</li>');
  }

  return items.join('');
}

function renderVideo(videoUrl) {
  if (!videoUrl) return '';
  let src = videoUrl;
  if (videoUrl.includes('youtube.com/watch')) {
    const id = new URL(videoUrl).searchParams.get('v');
    if (id) src = `https://www.youtube.com/embed/${id}`;
  } else if (videoUrl.includes('youtu.be/')) {
    const id = videoUrl.split('youtu.be/')[1]?.split(/[?#]/)[0];
    if (id) src = `https://www.youtube.com/embed/${id}`;
  }
  return `
    <div class="lp-video-wrap">
      <iframe src="${esc(src)}" allowfullscreen loading="lazy" title="Vídeo da startup"></iframe>
    </div>`;
}

function renderPage(s) {
  const metricas = parseMetricas(s.metricas);
  const cidade = s.cidadeOperacao ? `${esc(s.cidadeOperacao)} — Piauí` : 'Piauí';
  const comunidade = s.comunidade?.nome
    ? `Comunidade ${esc(s.comunidade.nome)}`
    : 'Comunidade do ecossistema';
  const badges = (s.badges || [])
    .map((b) => `<span class="lp-pill">${esc(b.nome)}</span>`)
    .join('');
  const aboutText = aboutBody(s);
  const statsHtml = renderStats(metricas);
  const solucoesHtml = renderSolucoes(metricas, s.descricao);
  const diferenciaisHtml = renderDiferenciais(metricas);

  const statusSeal = s.ehVencedor
    ? '<span class="lp-status-seal is-vencedor">Vencedor</span>'
    : s.ehFinalista
      ? '<span class="lp-status-seal is-finalista">Finalista</span>'
      : '';
  const catExtra = (s.categoriasFinalista || []).length
    ? ` · ${(s.categoriasFinalista || []).map(esc).join(' · ')}`
    : '';

  const pinSvg =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  root.innerHTML = `
    <section class="lp-hero">
      <div class="lp-hero-inner">
        <div class="lp-hero-top">
          <a class="lp-edit-link" href="/empreendedor.html">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Editar página (admin)
          </a>
        </div>
        ${statusSeal}
        ${
          s.logoUrl
            ? `<img class="lp-startup-logo" src="${esc(s.logoUrl)}" alt="Logo de ${esc(s.nomeStartup || 'startup')}">`
            : ''
        }
        <span class="lp-cat-tag">${categoryTag(s.categoria)}${catExtra}</span>
        <h1>${esc(s.nomeStartup || 'Startup')}</h1>
        <p class="lp-hero-pitch">${heroPitch(s)}</p>
        <div class="lp-hero-pills">
          <span class="lp-pill">${pinSvg} ${cidade}</span>
          <span class="lp-pill">${comunidade}</span>
          ${badges}
        </div>
        <a class="lp-vote-btn" href="/?voto=1">${s.ehFinalista ? 'Votar nesta startup' : 'Votar — Essa tem meu voto'}</a>
      </div>
    </section>

    <section class="lp-section">
      <p class="lp-label">Sobre a startup</p>
      <h2>${aboutTitle(s, metricas)}</h2>
      ${aboutText ? `<div class="lp-body-text">${aboutText}</div>` : '<p class="lp-body-text">Em breve mais informações sobre esta startup.</p>'}
      ${statsHtml}
      ${renderVideo(s.videoUrl)}
    </section>

    ${solucoesHtml}
    ${diferenciaisHtml}

    <footer class="lp-footer">
      <div class="lp-footer-inner">
        <div>
          <h3>Contato</h3>
          <ul>${renderContato(s, metricas)}</ul>
        </div>
        <div>
          <h3>Sobre esta página</h3>
          <p class="lp-footer-note">Página pública gerada automaticamente ao concluir a inscrição — Fase 1.</p>
        </div>
      </div>
      <div class="lp-footer-brand">Prêmio Comunitário de Startups do Piauí — 2026</div>
    </footer>
  `;
}

async function init() {
  const identifier = getStartupPageIdentifier();
  if (!identifier) {
    root.innerHTML = '<p class="lp-error">URL da startup inválida.</p>';
    return;
  }
  try {
    const s = await publicApi.getStartup(identifier);
    document.title = `${s.nomeStartup || 'Startup'} — Prêmio B-R-O-BRÓ de Inovação`;
    renderPage(s);
  } catch (ex) {
    root.innerHTML = `<p class="lp-error">Não foi possível carregar a página: ${esc(ex.message)}</p>`;
  }
}

init();
