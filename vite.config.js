import { resolve } from 'path';
import { defineConfig } from 'vite';

const APP_PAGES = new Set([
  '/',
  '/index.html',
  '/admin.html',
  '/lider.html',
  '/empreendedor.html',
  '/startup.html',
  '/ata.html',
  '/testemunha.html',
  '/galeria.html',
  '/regras.html',
]);

const ASSET_EXT =
  /\.(html?|css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|json|xlsx?|csv|pdf)$/i;

function shouldServeStartupLp(pathname) {
  if (!pathname || pathname === '/') return false;
  if (APP_PAGES.has(pathname)) return false;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/src') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/node_modules') ||
    pathname.startsWith('/docs')
  ) {
    return false;
  }
  if (ASSET_EXT.test(pathname)) return false;
  return true;
}

function startupLpFallback() {
  const handler = (req, _res, next) => {
    const pathname = (req.url || '/').split('?')[0];
    if (shouldServeStartupLp(pathname)) {
      const qs = (req.url || '').includes('?') ? `?${req.url.split('?')[1]}` : '';
      req.url = `/startup.html${qs}`;
    }
    next();
  };
  return {
    name: 'startup-lp-fallback',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [startupLpFallback()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        lider: resolve(__dirname, 'lider.html'),
        empreendedor: resolve(__dirname, 'empreendedor.html'),
        startup: resolve(__dirname, 'startup.html'),
        ata: resolve(__dirname, 'ata.html'),
        testemunha: resolve(__dirname, 'testemunha.html'),
        galeria: resolve(__dirname, 'galeria.html'),
        regras: resolve(__dirname, 'regras.html'),
      },
    },
  },
});
