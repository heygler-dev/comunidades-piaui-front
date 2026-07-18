const states = new Map();

export const DEFAULT_PAGE_SIZE = 10;

export function pageState(id, pageSize = DEFAULT_PAGE_SIZE) {
  if (!states.has(id)) states.set(id, { page: 1, pageSize });
  const st = states.get(id);
  if (pageSize !== st.pageSize) {
    st.pageSize = pageSize;
    st.page = 1;
  }
  return st;
}

export function resetPage(id) {
  const st = states.get(id);
  if (st) st.page = 1;
}

export function paginateSlice(items, id) {
  const st = pageState(id);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / st.pageSize) || 1);
  if (st.page > totalPages) st.page = totalPages;
  if (st.page < 1) st.page = 1;
  const start = (st.page - 1) * st.pageSize;
  return {
    slice: items.slice(start, start + st.pageSize),
    page: st.page,
    pageSize: st.pageSize,
    total,
    totalPages,
    from: total ? start + 1 : 0,
    to: Math.min(start + st.pageSize, total),
  };
}

function paginationMarkup(id, meta) {
  if (!meta.total) return '';
  const { page, totalPages, from, to, total } = meta;
  const showNav = total > meta.pageSize;
  return `
    <div class="table-pagination" data-pagination-id="${esc(id)}">
      <span class="table-pagination-info">${from}–${to} de ${total}</span>
      ${
        showNav
          ? `<div class="table-pagination-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span class="table-pagination-pages">Página ${page} de ${totalPages}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-page="next" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
      </div>`
          : ''
      }
    </div>`;
}

function esc(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function bindPagination(wrap, id, meta, rerender) {
  const bar = wrap.querySelector(`[data-pagination-id="${esc(id)}"]`);
  if (!bar) return;
  bar.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
    const st = pageState(id);
    if (st.page > 1) {
      st.page -= 1;
      rerender();
    }
  });
  bar.querySelector('[data-page="next"]')?.addEventListener('click', () => {
    const st = pageState(id);
    if (st.page < meta.totalPages) {
      st.page += 1;
      rerender();
    }
  });
}

function mountPagination(wrap, id, meta, rerender) {
  wrap.querySelector(`[data-pagination-id="${esc(id)}"]`)?.remove();
  const html = paginationMarkup(id, meta);
  if (html) {
    wrap.insertAdjacentHTML('beforeend', html);
    bindPagination(wrap, id, meta, rerender);
  }
}

/**
 * Renderiza linhas paginadas em um tbody e controles abaixo da tabela.
 */
export function renderTablePage({ tbodyId, pagerId, items, emptyRowHtml, renderRows, onBind }) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const wrap = tbody.closest('.table-wrap') || tbody.closest('.table-card');
  const meta = paginateSlice(items, pagerId);

  const rerender = () =>
    renderTablePage({ tbodyId, pagerId, items, emptyRowHtml, renderRows, onBind });

  if (!items.length) {
    tbody.innerHTML = emptyRowHtml;
    if (wrap) mountPagination(wrap, pagerId, meta, rerender);
    return meta;
  }

  tbody.innerHTML = renderRows(meta.slice);
  onBind?.(tbody);
  if (wrap) mountPagination(wrap, pagerId, meta, rerender);
  return meta;
}
