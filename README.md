# Prêmio Comunitário de Startups do Piauí — Frontend

Portal público e painel administrativo em **HTML + CSS + JavaScript**, com [Vite](https://vitejs.dev/) para desenvolvimento e build.

## Pré-requisitos

- Node.js 18+
- Backend rodando em `http://localhost:3000` (veja `premio-back/README.md`)

## Como rodar

```bash
cd premio-front
npm install
npm run dev
```

| Página | URL |
|--------|-----|
| Portal público | http://localhost:5173/ |
| Painel admin | http://localhost:5173/admin.html |

O Vite faz proxy de `/api` para `http://localhost:3000`.

### Docker (HTML + CSS + JS)

Com a API do `premio-back` rodando em `http://localhost:3000`:

```bash
cd premio-front
docker compose up -d --build
```

| Serviço | URL |
|---------|-----|
| Portal | http://localhost:8080/ |
| Admin | http://localhost:8080/admin.html |
| API (proxy) | http://localhost:8080/api/v1/... |

O Nginx serve o build estático e encaminha `/api` e `/uploads` para o backend.

### Erro `ENOSPC` ao rodar `npm run dev`

No Linux, isso significa que o limite de *file watchers* do sistema foi atingido (comum com vários projetos abertos no IDE).

O `vite.config.js` já usa `usePolling` para contornar isso. Se ainda falhar, aumente o limite do sistema (requer senha de admin):

```bash
sudo sysctl -w fs.inotify.max_user_watches=524288
```

Para tornar permanente, adicione em `/etc/sysctl.conf`:

```
fs.inotify.max_user_watches=524288
```

## Fluxos do portal

Parâmetros na URL:

| Parâmetro | Exemplo | Fluxo |
|-----------|---------|-------|
| `?convite=` | `?convite=a91f` | Ativação de líder comunitário |
| `?inscrever=` | `?inscrever=cerrado-vivo-a91f` | Inscrição de startup (3 etapas) |
| `?voto=` | `?voto=1` | Voto popular (só funciona quando a votação estiver aberta no backend) |

O botão **Voto Popular** fica desabilitado enquanto `votacaoAberta` for `false` na edição ativa. Para abrir a votação:

```http
PATCH /api/v1/admin/edicoes/{edicao_id}/votacao
{ "aberta": true }
```

Sem parâmetros, a landing permite escolher o perfil (líder ou startup).

## Painel admin

Credenciais de desenvolvimento (seed do backend):

- **E-mail:** `admin@premiopiaui.org`
- **Senha:** `admin123`

Funcionalidades: login JWT, estatísticas, listagem com filtros, CRUD manual, importação de startups via planilha.

## Build para produção

```bash
npm run build
npm run preview
```

Os arquivos estáticos ficam em `dist/`. Configure o servidor para servir `index.html` e `admin.html` e repasse `/api` para o backend.

## Estrutura

```
premio-front/
├── index.html          # Portal público
├── admin.html          # Painel administrativo
├── src/
│   ├── api/client.js   # Cliente HTTP da API
│   ├── lib/utils.js    # CPF, toast, query params
│   ├── admin/main.js
│   ├── public/main.js
│   └── styles/         # tokens, base, admin, portal
└── vite.config.js
```
