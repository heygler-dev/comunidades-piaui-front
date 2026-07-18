export function maskPhone(v) {
  const digits = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (!digits.length) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function wirePhone(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const apply = () => {
    input.value = maskPhone(input.value);
  };
  input.addEventListener('input', apply);
  if (input.value) apply();
}

export function maskCPF(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return v;
}

/** CPF parcialmente oculto para exibição/comprovante (LGPD). */
export function maskCpfLgpd(cpf) {
  const digits = String(cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function isValidCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export function wireCPF(inputId, errId) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = maskCPF(input.value);
  });
  input.addEventListener('blur', () => {
    if (input.value.replace(/\D/g, '').length === 0) {
      input.classList.remove('invalid');
      err?.classList.remove('show');
      return;
    }
    const ok = isValidCPF(input.value);
    input.classList.toggle('invalid', !ok);
    err?.classList.toggle('show', !ok);
  });
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export function showToast(id, msg, duration = 2400) {
  const t = document.getElementById(id);
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

const ALERT_SVGS = {
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
};

let alertBound = false;

export function showAlert(message, options = {}) {
  const {
    title = 'Atenção',
    variant = 'info',
    buttonLabel = 'Entendi',
  } = options;

  const overlay = document.getElementById('alert-overlay');
  const titleEl = document.getElementById('alert-title');
  const messageEl = document.getElementById('alert-message');
  const iconEl = document.getElementById('alert-icon');
  const okBtn = document.getElementById('alert-ok');

  if (!overlay || !titleEl || !messageEl || !iconEl || !okBtn) {
    window.alert(message);
    return Promise.resolve();
  }

  titleEl.textContent = title;
  messageEl.textContent = message;
  iconEl.className = `alert-modal-icon ${variant}`;
  iconEl.innerHTML = ALERT_SVGS[variant] || ALERT_SVGS.info;
  okBtn.textContent = buttonLabel;

  return new Promise((resolve) => {
    const close = () => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      overlay._closeAlert = null;
      resolve();
    };

    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') close();
    };

    okBtn.onclick = close;
    overlay._closeAlert = close;

    if (!alertBound) {
      alertBound = true;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && overlay._closeAlert) overlay._closeAlert();
      });
    }

    overlay.classList.add('show');
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

export function copyText(text, btn) {
  navigator.clipboard?.writeText(text);
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Copiado!';
    setTimeout(() => {
      btn.textContent = original;
    }, 1600);
  }
}

export function wirePasswordToggle(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrap = input.closest('.password-field');
  const btn = wrap?.querySelector('.password-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    btn.setAttribute('aria-pressed', String(!visible));
    btn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
    btn.classList.toggle('is-visible', !visible);
  });
}
