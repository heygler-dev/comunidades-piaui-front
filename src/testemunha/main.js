import { publicApi } from '../api/client.js';

const root = document.getElementById('testemunha-doc');
const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderError(message) {
  root.innerHTML = `
    <section class="ata-hero">
      <div class="ata-eyebrow">Testemunha externa</div>
      <h1>Convite inválido</h1>
      <p class="ata-error" style="padding:0;margin:12px 0 0">${esc(message)}</p>
    </section>
  `;
}

function renderConfirmed(data) {
  root.innerHTML = `
    <header class="ata-navbar">
      <div class="ata-brand">
        <img src="/icone.piaui.png" width="36" height="36" alt="">
</div>
      <div class="ata-badge">Testemunha</div>
    </header>
    <section class="ata-hero">
      <div class="ata-eyebrow">${esc(data.edicao?.nome || 'Edição ativa')}</div>
      <h1>Presença confirmada</h1>
      <p>Obrigado, <strong>${esc(data.nome)}</strong>. Seu nome constará na ata pública de apuração como testemunha externa.</p>
      <div class="ata-status">Status: confirmada</div>
    </section>
  `;
}

function renderForm(data) {
  root.innerHTML = `
    <header class="ata-navbar">
      <div class="ata-brand">
        <img src="/icone.piaui.png" width="36" height="36" alt="">
</div>
      <div class="ata-badge">Testemunha</div>
    </header>
    <section class="ata-hero">
      <div class="ata-eyebrow">${esc(data.edicao?.nome || 'Edição ativa')}</div>
      <h1>Confirmar presença na apuração</h1>
      <p>
        Você foi convidado(a) como testemunha externa da apuração do prêmio.
        Ao confirmar, atesta que acompanhou (ou acompanhará) o processo de forma independente.
      </p>
    </section>
    <section class="ata-content">
      <div class="testemunha-card">
        <div class="testemunha-meta">
          <div><span>Nome</span><strong>${esc(data.nome)}</strong></div>
          <div><span>E-mail</span><strong>${esc(data.email)}</strong></div>
          ${
            data.organizacao
              ? `<div><span>Organização</span><strong>${esc(data.organizacao)}</strong></div>`
              : ''
          }
        </div>
        <form id="form-confirmar" class="testemunha-form">
          <label for="observacao">Observação (opcional)</label>
          <textarea id="observacao" rows="3" placeholder="Ex.: Acompanhei a geração do ranking e a publicação da ata."></textarea>
          <button type="submit" class="btn-print" id="btn-confirmar">Confirmar presença</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById('form-confirmar')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-confirmar');
    const observacao = document.getElementById('observacao')?.value?.trim();
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Confirmando...';
      }
      const updated = await publicApi.confirmarTestemunha(token, {
        ...(observacao ? { observacao } : {}),
      });
      renderConfirmed({ ...data, ...updated, status: 'CONFIRMADA' });
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirmar presença';
      }
      alert(error.message || 'Não foi possível confirmar.');
    }
  });
}

async function init() {
  if (!token) {
    renderError('Link sem token. Use o convite enviado pela organização.');
    return;
  }
  try {
    const data = await publicApi.getTestemunha(token);
    if (data.status === 'CONFIRMADA') {
      renderConfirmed(data);
      return;
    }
    if (data.status === 'RECUSADA') {
      renderError('Este convite foi marcado como recusado.');
      return;
    }
    renderForm(data);
  } catch (error) {
    renderError(error.message || 'Convite não encontrado.');
  }
}

init();
