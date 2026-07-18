/** Path público da LP: site cadastrado ou slug (sempre via startup.html). */
export function startupPublicPath(site, slugPublico) {
  const siteKey = normalizeSiteKey(site);
  const slug = slugPublico?.trim() || '';
  const key = siteKey || slug;
  if (!key) return '';
  return `/startup.html?slug=${encodeURIComponent(key)}`;
}

export function normalizeSiteKey(site) {
  if (!site?.trim()) return '';
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\/+$/, '');
}

/** Identificador na URL: ?slug= ou path (ex. /www.startup.com.br). */
export function getStartupPageIdentifier() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('slug');
  if (fromQuery) return fromQuery.trim();

  let path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path || path === 'startup.html') return '';
  return decodeURIComponent(path);
}
