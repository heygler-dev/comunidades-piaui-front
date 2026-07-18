/** Comprovante de voto em PDF com visual da marca. */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.onload = () => {
      s.dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF.'));
    document.head.appendChild(s);
  });
}

function brandIconImg() {
  return `<img class="brand-icon" src="/icone.piaui.png" width="36" height="36" alt="">`;
}

function buildReceiptMarkup(r) {
  const nome = escapeHtml(r.nome);
  const cpf = escapeHtml(r.cpfMascarado);
  const categoria = escapeHtml(r.categoria);
  const startup = escapeHtml(r.startup);
  const dataHora = escapeHtml(r.dataHora);
  const total = escapeHtml(r.totalVotos ?? '—');

  return `
  <div class="cv-sheet" id="comprovante-root">
    <header class="cv-navbar">
      <div class="cv-brand">
        ${brandIconImg()}
</div>
      <div class="cv-nav-center">
        <span class="cv-nav-pill">Cadastro</span>
        <span class="cv-nav-pill is-active">Voto Popular</span>
      </div>
      <div class="cv-badge">Comprovante de voto</div>
    </header>

    <section class="cv-hero">
      <div class="cv-eyebrow">Prêmio Comunitário de Startups do Piauí · 2026</div>
      <h1>Comprovante de voto</h1>
      <p>Este documento confirma o registro do seu voto único nesta edição do prêmio.</p>
      <div class="cv-status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M20 6 9 17l-5-5"/></svg>
        Voto registrado com sucesso
      </div>
    </section>

    <section class="cv-content">
      <div class="cv-card">
        <div class="cv-card-head">Dados do voto</div>
        <div class="cv-rows">
          <div class="cv-row"><div class="cv-label">Nome</div><div class="cv-value">${nome}</div></div>
          <div class="cv-row"><div class="cv-label">CPF</div><div class="cv-value">${cpf}</div></div>
          <div class="cv-row"><div class="cv-label">Categoria</div><div class="cv-value">${categoria}</div></div>
          <div class="cv-row"><div class="cv-label">Startup</div><div class="cv-value">${startup}</div></div>
          <div class="cv-row"><div class="cv-label">Data / hora</div><div class="cv-value">${dataHora}</div></div>
          <div class="cv-row"><div class="cv-label">Total na edição</div><div class="cv-value">${total} votos apurados</div></div>
        </div>
      </div>

      <div class="cv-note">
        <strong>LGPD:</strong> o CPF foi parcialmente ocultado neste comprovante
        (<strong style="font-family:Inter,monospace">${cpf}</strong>
        para proteção de dados pessoais. Este CPF não poderá votar novamente nesta edição.
      </div>
    </section>

    <footer class="cv-footer">
      <span>Startup Piauí · Prêmio B-R-O-BRÓ de Inovação</span>
      <span>Documento gerado automaticamente pelo portal</span>
    </footer>
  </div>`;
}

function ensureReceiptStyles() {
  if (document.getElementById('voto-comprovante-styles')) return;
  const style = document.createElement('style');
  style.id = 'voto-comprovante-styles';
  style.textContent = `
    #voto-comprovante-mount {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 794px;
      pointer-events: none;
      z-index: -1;
    }
    .cv-sheet {
      width: 794px;
      min-height: 1040px;
      background: #ffffff;
      color: #1a1f1c;
      font-family: Inter, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cv-navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 28px;
      border-bottom: 1px solid #cdd8c8;
      background: #ffffff;
    }
    .cv-brand { display: flex; align-items: center; gap: 10px; }
    .cv-brand .brand-icon, .cv-brand .rocket { width: 36px; height: 36px; display: block; flex-shrink: 0; }
    .cv-brand-name {
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1.15;
      color: #1a1f1c;
    }
    .cv-nav-center {
      display: flex;
      gap: 4px;
      background: #edf5f0;
      padding: 4px;
      border-radius: 100px;
    }
    .cv-nav-pill {
      font-size: 13px;
      font-weight: 600;
      padding: 8px 18px;
      border-radius: 100px;
      color: #1f6e4f;
      background: transparent;
      border: none;
    }
    .cv-nav-pill.is-active {
      background: #1a1f1c;
      color: #ffffff;
    }
    .cv-badge {
      font-size: 11px;
      font-weight: 600;
      color: #1f6e4f;
      background: #edf5f0;
      border: 1px solid #d9ebe2;
      padding: 6px 12px;
      border-radius: 100px;
      white-space: nowrap;
    }
    .cv-hero {
      padding: 36px 40px 22px;
      background: linear-gradient(135deg, #edf5f0 0%, #ffffff 55%, #fff0e5 100%);
      border-bottom: 1px solid #cdd8c8;
    }
    .cv-eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #1f6e4f;
      margin-bottom: 8px;
    }
    .cv-hero h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 800;
      color: #1a1f1c;
      line-height: 1.2;
    }
    .cv-hero p {
      margin: 0;
      font-size: 14px;
      color: #4a554f;
      max-width: 52ch;
      line-height: 1.5;
    }
    .cv-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 18px;
      background: #1f6e4f;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 100px;
    }
    .cv-content { padding: 28px 40px 32px; flex: 1; }
    .cv-card {
      border: 1px solid #cdd8c8;
      border-radius: 16px;
      overflow: hidden;
      background: #ffffff;
    }
    .cv-card-head {
      padding: 14px 18px;
      background: #edf5f0;
      border-bottom: 1px solid #cdd8c8;
      font-size: 13px;
      font-weight: 700;
      color: #165a3f;
    }
    .cv-row {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 12px;
      padding: 12px 18px;
      border-bottom: 1px solid #e8ede3;
    }
    .cv-row:last-child { border-bottom: none; }
    .cv-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #7a857f;
      padding-top: 3px;
    }
    .cv-value {
      font-size: 15px;
      font-weight: 600;
      color: #1a1f1c;
      word-break: break-word;
    }
    .cv-note {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid #cdd8c8;
      background: #f4f7f1;
      font-size: 12.5px;
      color: #4a554f;
      line-height: 1.5;
    }
    .cv-note strong { color: #1a1f1c; }
    .cv-footer {
      margin-top: auto;
      padding: 16px 40px 24px;
      border-top: 1px solid #cdd8c8;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 11px;
      color: #7a857f;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Gera e baixa o comprovante em PDF.
 * @param {object} receipt
 */
export async function downloadVoteReceiptPdf(receipt) {
  if (!receipt) throw new Error('Comprovante indisponível.');

  ensureReceiptStyles();

  let mount = document.getElementById('voto-comprovante-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'voto-comprovante-mount';
    document.body.appendChild(mount);
  }
  mount.innerHTML = buildReceiptMarkup(receipt);

  const root = document.getElementById('comprovante-root');
  if (!root) throw new Error('Falha ao montar o comprovante.');

  await loadScriptOnce(
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  );

  if (typeof window.html2pdf !== 'function') {
    throw new Error('Gerador de PDF indisponível.');
  }

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `comprovante-voto-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  try {
    await window.html2pdf().set(opt).from(root).save();
  } finally {
    mount.innerHTML = '';
  }
}
