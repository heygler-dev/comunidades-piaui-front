import { publicApi } from '../api/client.js';

const root = document.getElementById('ata-doc');

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

function renderError(message) {
  root.innerHTML = `<p class="ata-error">${esc(message)}</p>`;
}

function renderAta({ resultados, ata }) {
  const publicada = formatDate(ata?.publicadaEm);
  const edicaoNome = ata?.edicao?.nome || 'Prêmio Comunitário de Startups do Piauí';
  const edicaoAno = ata?.edicao?.ano || '';
  const testemunhas = Array.isArray(ata?.testemunhas) ? ata.testemunhas : [];
  const rows = (resultados || [])
    .map((r) => {
      const cat = esc(r.categoria?.nome || '—');
      const nome = esc(r.finalista?.inscricaoStartup?.nomeStartup || '—');
      const cidade = esc(r.finalista?.inscricaoStartup?.cidadeOperacao || '');
      const votos = Number(r.totalVotos) || 0;
      return `<tr>
        <td class="cat">${cat}</td>
        <td class="nome">
          ${nome}
          ${cidade ? `<span class="cidade">${cidade}</span>` : ''}
        </td>
        <td class="votos">${votos}</td>
      </tr>`;
    })
    .join('');

  const testemunhasBlock = testemunhas.length
    ? `<div class="ata-card" style="margin-top:18px">
        <div class="ata-card-head">Testemunhas externas</div>
        <table class="ata-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Organização</th>
              <th class="votos-h">Confirmada em</th>
            </tr>
          </thead>
          <tbody>
            ${testemunhas
              .map(
                (t) => `<tr>
                  <td class="nome">${esc(t.nome)}
                    ${t.email ? `<span class="cidade">${esc(t.email)}</span>` : ''}
                  </td>
                  <td>${esc(t.organizacao || '—')}</td>
                  <td class="votos">${esc(formatDate(t.confirmadaEm))}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : '';

  root.innerHTML = `
    <header class="ata-navbar">
      <div class="ata-brand">
        <img src="/icone.piaui.png" width="36" height="36" alt="">
</div>
      <div class="ata-nav-center">
        <span class="ata-nav-pill">Cadastro</span>
        <span class="ata-nav-pill is-active">Voto Popular</span>
      </div>
      <div class="ata-badge">Ata pública</div>
    </header>

    <section class="ata-hero">
      <div class="ata-eyebrow">${esc(edicaoNome)}${edicaoAno ? ` · ${esc(String(edicaoAno))}` : ''}</div>
      <h1>Ata de apuração</h1>
      <p>Documento público com os vencedores por categoria após o encerramento da votação popular.</p>
      <div class="ata-status">Publicada em ${esc(publicada)}</div>
    </section>

    <section class="ata-content">
      <div class="ata-card">
        <div class="ata-card-head">Vencedores por categoria</div>
        <table class="ata-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Startup vencedora</th>
              <th class="votos-h">Votos</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="3">Nenhum resultado publicado.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${testemunhasBlock}
      <div class="ata-note">
        Documento gerado automaticamente pelo portal do Prêmio B-R-O-BRÓ.
        A Startup Piauí atua como juiz eleitoral: valida o pleito e publica os resultados oficiais.
        ${
          testemunhas.length
            ? ' Testemunhas externas confirmadas acompanharam a apuração de forma independente.'
            : ''
        }
        Use o botão <strong>Imprimir ata</strong> para salvar em PDF pelo navegador ou imprimir em papel.
      </div>
    </section>

    <footer class="ata-footer">
      <span>Startup Piauí · Prêmio B-R-O-BRÓ de Inovação</span>
      <span>Documento oficial de apuração</span>
    </footer>
  `;
}

async function init() {
  document.getElementById('btn-print')?.addEventListener('click', () => window.print());

  try {
    const [resultados, ata] = await Promise.all([
      publicApi.resultados(),
      publicApi.ata(),
    ]);
    const list = Array.isArray(resultados) ? resultados : [];
    if (!list.length || !ata) {
      renderError('A ata pública ainda não foi publicada.');
      return;
    }
    document.title = 'Ata pública de apuração — Prêmio B-R-O-BRÓ de Inovação';
    renderAta({ resultados: list, ata });
  } catch (error) {
    renderError(error.message || 'Não foi possível carregar a ata pública.');
  }
}

init();
