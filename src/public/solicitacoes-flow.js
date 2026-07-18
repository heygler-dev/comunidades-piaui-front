import { publicApi } from '../api/client.js';
import { isValidCPF, showAlert } from '../lib/utils.js';

export function createSolicitacoesFlow({ $, goTo, comunidadeText }) {
  let comunidadesCache = [];

  function comunidadeLabelById(id) {
    const c = comunidadesCache.find((x) => x.id === id);
    return c ? comunidadeText(c) : '—';
  }

  async function loadComunidadesSelect(selectId) {
    const sel = $(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando comunidades...</option>';
    try {
      comunidadesCache = await publicApi.comunidades();
      sel.innerHTML = '<option value="">Selecione uma comunidade</option>';
      comunidadesCache.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = comunidadeText(c);
        sel.appendChild(opt);
      });
    } catch {
      sel.innerHTML = '<option value="">Não foi possível carregar as comunidades</option>';
    }
  }

  async function openLiderSolicitacao() {
    goTo('screen-lider-solicitacao');
    await loadComunidadesSelect('sol-lider-comunidade');
  }

  async function submitSolLider() {
    const comunidadeId = $('sol-lider-comunidade')?.value;
    const nome = $('sol-lider-nome')?.value.trim();
    const cpfOk = isValidCPF($('sol-lider-cpf')?.value);
    const lgpd = $('sol-lider-lgpd')?.checked;
    const telefone = $('sol-lider-telefone')?.value.trim();
    const email = $('sol-lider-email')?.value.trim();
    const senha = $('sol-lider-senha')?.value || '';

    if (!comunidadeId) {
      showAlert('Selecione a comunidade para a qual deseja solicitar participação.', {
        title: 'Comunidade obrigatória',
      });
      return;
    }
    if (!nome || !cpfOk || !lgpd || !telefone || !email || senha.length < 8) {
      if (!cpfOk) {
        $('sol-lider-cpf')?.classList.add('invalid');
        $('sol-lider-cpf-err')?.classList.add('show');
      }
      showAlert('Preencha todos os campos, senha (mín. 8) e aceite a LGPD.', {
        title: 'Dados incompletos',
      });
      return;
    }

    try {
      await publicApi.solicitarLider({
        comunidadeId,
        nome,
        cpf: $('sol-lider-cpf').value,
        telefone,
        email,
        senha,
        lgpdAceito: true,
      });
      $('sol-lider-comunidade-echo').textContent = comunidadeLabelById(comunidadeId);
      goTo('screen-lider-solicitacao-success');
    } catch (error) {
      showAlert(error.message, { title: 'Não foi possível enviar', variant: 'error' });
    }
  }

  async function openStartupSolicitacao() {
    goTo('screen-startup-sol-form');
    await loadComunidadesSelect('sol-st-comunidade');
  }

  function goSolStep(n) {
    if (n === 1) goTo('screen-startup-sol-form');
    else goTo(`screen-startup-sol-step${n}`);
  }

  function submitSolStartupProfile() {
    const comunidadeId = $('sol-st-comunidade')?.value;
    const nome = $('sol-st-nome')?.value.trim();
    const cpfOk = isValidCPF($('sol-st-cpf')?.value);
    const senha = $('sol-st-senha')?.value || '';

    if (!comunidadeId) {
      showAlert('Selecione a comunidade de destino.', { title: 'Comunidade obrigatória' });
      return;
    }
    if (!nome || !cpfOk || !$('sol-st-telefone')?.value.trim() || !$('sol-st-email')?.value.trim() || senha.length < 8) {
      if (!cpfOk) {
        $('sol-st-cpf')?.classList.add('invalid');
        $('sol-st-cpf-err')?.classList.add('show');
      }
      showAlert('Confira nome, CPF, telefone, e-mail e senha (mínimo de 8 caracteres).', {
        title: 'Dados incompletos',
      });
      return;
    }
    goSolStep(2);
  }

  function goSolStep3() {
    if (
      !$('sol-st-nomeempresa')?.value.trim() ||
      !$('sol-st-categoria')?.value ||
      !$('sol-st-cidade')?.value.trim() ||
      ($('sol-st-descricao')?.value.trim().length || 0) < 10
    ) {
      showAlert('Preencha todos os campos obrigatórios da etapa 2.', { title: 'Dados incompletos' });
      return;
    }
    fillSolReview();
    goSolStep(3);
  }

  function fillSolReview() {
    const comunidadeId = $('sol-st-comunidade')?.value;
    $('sol-rev-comunidade').textContent = comunidadeLabelById(comunidadeId);
    $('sol-rev-nome').textContent = $('sol-st-nome')?.value || '—';
    $('sol-rev-cpf').textContent = $('sol-st-cpf')?.value || '—';
    $('sol-rev-telefone').textContent = $('sol-st-telefone')?.value || '—';
    $('sol-rev-email').textContent = $('sol-st-email')?.value || '—';
    $('sol-rev-nomeempresa').textContent = $('sol-st-nomeempresa')?.value || '—';
    $('sol-rev-categoria').textContent = $('sol-st-categoria')?.value || '—';
    $('sol-rev-cidade').textContent = $('sol-st-cidade')?.value || '—';
  }

  async function submitSolStartup() {
    if (!$('sol-st-lgpd')?.checked || !$('sol-st-unico')?.checked) {
      showAlert('Marque as duas declarações obrigatórias antes de enviar.', {
        title: 'Confirmação necessária',
      });
      return;
    }

    const comunidadeId = $('sol-st-comunidade')?.value;
    try {
      const result = await publicApi.solicitarStartup({
        comunidadeId,
        responsavelNome: $('sol-st-nome').value.trim(),
        cpf: $('sol-st-cpf').value,
        telefone: $('sol-st-telefone').value.trim(),
        email: $('sol-st-email').value.trim(),
        senha: $('sol-st-senha').value,
        nomeStartup: $('sol-st-nomeempresa').value.trim(),
        categoria: $('sol-st-categoria').value,
        cidadeOperacao: $('sol-st-cidade').value.trim(),
        site: $('sol-st-site')?.value.trim() || undefined,
        descricao: $('sol-st-descricao').value.trim(),
        lgpdAceito: true,
        cpfUnicoConfirmado: true,
      });
      $('sol-st-success-nome').textContent = $('sol-st-nomeempresa').value.trim();
      $('sol-st-success-comunidade').textContent =
        result.comunidade?.nome || comunidadeLabelById(comunidadeId);
      goTo('screen-startup-sol-success');
    } catch (error) {
      showAlert(error.message, { title: 'Não foi possível enviar', variant: 'error' });
    }
  }

  return {
    openLiderSolicitacao,
    submitSolLider,
    openStartupSolicitacao,
    submitSolStartupProfile,
    goSolStep,
    goSolStep3,
    fillSolReview,
    submitSolStartup,
  };
}
