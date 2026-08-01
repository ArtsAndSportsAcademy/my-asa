# MyASA — Guia de Migração: Vercel + Supabase

> **Status:** Preparação concluída. A migração em si ainda não foi executada.  
> Este documento descreve todos os passos necessários para mover o projeto do Replit para Vercel (web-admin) + Supabase (banco de dados) + Railway/Render/Fly.io (API Express).

---

## 1. Mapa de dependências do Replit

### 1.1 Removidas nesta preparação

| Dependência | Onde estava | Status |
|---|---|---|
| `@replit/vite-plugin-runtime-error-modal` | `web-admin/vite.config.ts`, `mockup-sandbox/vite.config.ts` | ✅ Removido |
| `@replit/vite-plugin-cartographer` | `web-admin/vite.config.ts`, `mockup-sandbox/vite.config.ts` | ✅ Removido |
| `@replit/vite-plugin-dev-banner` | `web-admin/vite.config.ts` | ✅ Removido |
| JWT fallback inseguro em dev | `api-server/src/lib/jwt.service.ts` | ✅ Corrigido (lança erro em produção) |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` obrigatório | `lib/integrations-anthropic-ai/src/client.ts` | ✅ Agora opcional |

### 1.2 Ainda presentes (resolvidas pela migração)

| Dependência | Onde | O que fazer |
|---|---|---|
| PostgreSQL 16 (Replit) | `.replit` linha 1: `modules = ["postgresql-16"]` | Provisionar Supabase e atualizar `DATABASE_URL` |
| `DATABASE_URL` aponta para DB Replit | Injetada automaticamente pelo Replit | Substituir pela URL do Supabase |
| Script `dev` do mobile com `REPLIT_*` | `artifacts/mobile/package.json` | Usar `dev:local` fora do Replit |
| Build script usa `REPLIT_INTERNAL_APP_DOMAIN` | `artifacts/mobile/scripts/build.js` | Definir `EXPO_PUBLIC_DOMAIN` manualmente |
| `deploymentTarget = "autoscale"` | `.replit` | Ignorar — config do Replit não afeta outros hosts |
| `SESSION_SECRET` nos secrets do Replit | Replit Secrets | **Não está em uso no código** — pode ignorar |

---

## 2. Arquitetura pós-migração

```
┌─────────────────────┐     ┌───────────────────────────┐
│  Vercel (estático)  │────▶│  Railway / Render / Fly   │
│  web-admin          │     │  API Server (Express)      │
│  dist/public/       │     │  artifacts/api-server      │
└─────────────────────┘     └──────────────┬────────────┘
                                           │ DATABASE_URL
                             ┌─────────────▼────────────┐
                             │  Supabase                  │
                             │  PostgreSQL 16             │
                             │  (conexão direta, porta    │
                             │   5432 para servidor       │
                             │   persistente)             │
                             └──────────────────────────┘
```

O **mobile** continua distribuído via Expo Go (desenvolvimento) ou EAS Build (produção na App Store / Play Store). O app aponta para a API pelo domínio configurado em `EXPO_PUBLIC_DOMAIN`.

---

## 3. Checklist de migração (em ordem)

### Passo 1 — Criar projeto no Supabase

1. Criar conta em [supabase.com](https://supabase.com) e criar um novo projeto
2. Aguardar o provisionamento do banco (1–2 min)
3. Em **Project Settings → Database**, copiar:
   - **Connection string → URI** (porta 5432) → para a API Express
   - **Connection string → Transaction pooler** (porta 6543) → para uso eventual serverless
4. Anotar: `Host`, `Database name`, `User`, `Password`

### Passo 2 — Rodar as migrations no Supabase

```bash
# Na raiz do projeto, com DATABASE_URL apontando para o Supabase:
DATABASE_URL="postgresql://postgres.[ref]:[senha]@db.[ref].supabase.co:5432/postgres" \
  pnpm --filter @workspace/db exec drizzle-kit migrate
```

Verifique o resultado em **Supabase Dashboard → Table Editor** — todas as tabelas devem aparecer.

> **Atenção:** Se o banco de dados de desenvolvimento tiver dados que você quer migrar (produção atual no Replit), exporte com `pg_dump` antes e importe com `psql` no Supabase.

### Passo 3 — Configurar as variáveis de ambiente da API

Crie as seguintes variáveis no painel do seu host (Railway/Render/Fly.io):

```
DATABASE_URL=postgresql://postgres.[ref]:[senha]@db.[ref].supabase.co:5432/postgres
NODE_ENV=production
PORT=3000  # ou a porta definida pelo host
JWT_ACCESS_SECRET=<64 bytes hex aleatório>
JWT_REFRESH_SECRET=<64 bytes hex aleatório>
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
# AI_INTEGRATIONS_ANTHROPIC_BASE_URL=  (deixar em branco para usar api.anthropic.com)
```

Gere os secrets JWT:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Passo 4 — Deploy da API no Railway (recomendado)

```bash
# Instalar CLI do Railway
npm install -g @railway/cli
railway login
railway init  # na pasta raiz do projeto
```

Configurar em `railway.json` (criar na raiz):
```json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "pnpm install && pnpm --filter @workspace/api-server build"
  },
  "deploy": {
    "startCommand": "pnpm --filter @workspace/api-server start",
    "healthcheckPath": "/api/health"
  }
}
```

Alternativas equivalentes: **Render** (Web Service), **Fly.io** (`fly launch`).

### Passo 5 — Deploy do web-admin no Vercel

O web-admin é um site estático (saída em `artifacts/web-admin/dist/public`).

**Configuração no Vercel Dashboard:**

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | `artifacts/web-admin` |
| Build Command | `cd ../.. && pnpm install && pnpm --filter @workspace/api-client-react run build && cd artifacts/web-admin && pnpm exec vite build` |
| Output Directory | `dist/public` |

**Variáveis de ambiente no Vercel (build-time):**

```
PORT=3000
BASE_PATH=/
NODE_ENV=production
```

> **Por que PORT e BASE_PATH?** O `vite.config.ts` lança erro se não estiverem definidas. Em deploy raiz no Vercel, `PORT=3000` (não usada no output estático) e `BASE_PATH=/`.

**Configurar apontamento da API** — no código do web-admin, a URL da API vem de `import.meta.env.VITE_API_URL` (ou similar). Adicionar no Vercel:
```
VITE_API_URL=https://sua-api.railway.app
```

> Verificar como o web-admin constrói a URL base da API em `lib/api-client-react` — pode estar via `BASE_PATH` do workspace.

### Passo 6 — Atualizar app mobile (Expo EAS)

Para distribuição via App Store / Play Store, use Expo EAS:

```bash
cd artifacts/mobile
pnpm exec eas build:configure  # cria eas.json
```

Configurar `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_DOMAIN": "https://sua-api.railway.app"
      }
    }
  }
}
```

Build:
```bash
pnpm exec eas build --platform all --profile production
```

Para desenvolvimento local sem Replit:
```bash
cd artifacts/mobile
EXPO_PUBLIC_DOMAIN=https://sua-api.railway.app pnpm run dev:local
```

### Passo 7 — Primeiro boot em produção (bootstrap)

Na primeira inicialização após o deploy, para criar o admin inicial:

1. Definir temporariamente no host:
   ```
   RESET_PROD_DB=1
   BOOTSTRAP_ADMIN_PASSWORD=senha-forte-unica
   ```
2. Fazer o deploy e aguardar o boot
3. **Remover imediatamente** `RESET_PROD_DB` e `BOOTSTRAP_ADMIN_PASSWORD` após o primeiro boot
4. O `_bootstrap_log` garante que o reset só executa uma vez mesmo que as vars fiquem acidentalmente presentes

### Passo 8 — Verificar push notifications (Expo)

As push notifications usam o servidor Expo (FCM via Expo) — nenhuma configuração extra de servidor é necessária. Após o deploy da API, verificar que `EXPO_PUBLIC_DOMAIN` nos builds mobile aponta para o novo host da API.

---

## 4. Configuração do Supabase — detalhes importantes

### Connection string para servidor Express persistente

Use a **conexão direta** (porta 5432), não o pooler, para a API Express:
```
postgresql://postgres.[ref]:[senha]@db.[ref].supabase.co:5432/postgres
```

O Drizzle + node-postgres gerencia seu próprio pool de conexões internamente. Usar o Transaction Pooler (PgBouncer) com pool interno causa conflito.

### Se usar Transaction Pooler (serverless futuro)

Adicionar `?pgbouncer=true` à URL e configurar o Drizzle:
```typescript
// lib/db/src/index.ts — modificação necessária apenas para serverless
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// O Drizzle precisa de { prepare: false } com PgBouncer em Transaction mode
```

### Row Level Security (RLS)

O Supabase habilita RLS por padrão em tabelas novas. A API usa autenticação JWT própria (não o Auth do Supabase), então o RLS deve ser **desabilitado** ou configurado com uma policy que permita acesso total via role `postgres`:

```sql
-- Para cada tabela (executar no Supabase SQL Editor):
ALTER TABLE nome_da_tabela DISABLE ROW LEVEL SECURITY;
```

Ou criar uma policy permissiva via service role.

---

## 5. Variáveis de ambiente — referência completa

Ver `.env.example` na raiz para descrição detalhada de cada variável.

| Variável | API | web-admin (build) | Mobile | Obrigatória em prod |
|---|:---:|:---:|:---:|:---:|
| `DATABASE_URL` | ✅ | — | — | ✅ |
| `JWT_ACCESS_SECRET` | ✅ | — | — | ✅ |
| `JWT_REFRESH_SECRET` | ✅ | — | — | ✅ |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | ✅ | — | — | ✅ |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | opcional | — | — | ❌ |
| `PORT` | ✅ | ✅ (build) | ✅ (dev) | ✅ |
| `BASE_PATH` | ✅ | ✅ (build) | — | ✅ |
| `NODE_ENV` | ✅ | ✅ (build) | — | ✅ |
| `EXPO_PUBLIC_DOMAIN` | — | — | ✅ | ✅ |
| `RESET_PROD_DB` | uma vez | — | — | ❌ |
| `BOOTSTRAP_ADMIN_PASSWORD` | uma vez | — | — | ❌ |

---

## 6. Estimativa de custos mensais

| Serviço | Plano | Custo estimado |
|---|---|---|
| **Supabase** (PostgreSQL) | Free tier (500 MB, 2 CPU) | $0/mês |
| **Supabase** (crescimento) | Pro ($25/mês, 8 GB) | $25/mês |
| **Railway** (API Express) | Starter ($5 crédito/mês, ~$5–15 uso) | $0–15/mês |
| **Render** (alternativa) | Starter (512 MB) | $7/mês |
| **Fly.io** (alternativa) | shared-cpu-1x 256 MB | ~$2–5/mês |
| **Vercel** (web-admin estático) | Hobby (ilimitado para sites estáticos) | $0/mês |
| **Anthropic** (ASA — Claude 3.5 Haiku) | Pay-per-use (~$0.80/M tokens input) | variável |
| **Expo Push** | Free tier (1M mensagens/mês) | $0/mês |
| **Total infra fixa (cenário econômico)** | Supabase Free + Railway Starter + Vercel Hobby | **$0–5/mês** |
| **Total infra fixa (cenário confortável)** | Supabase Pro + Railway + Vercel | **~$30–40/mês** |

---

## 7. Arquivos-chave para a migração

```
lib/db/
  drizzle/          # 11 migration files (0000–0011)
  drizzle.config.ts # configuração do drizzle-kit
  src/index.ts      # Pool + db instance (DATABASE_URL)

artifacts/api-server/
  src/lib/jwt.service.ts          # JWT (lança erro em produção se secrets ausentes)
  src/lib/bootstrap.ts            # reset único do banco

lib/integrations-anthropic-ai/
  src/client.ts                   # AI_INTEGRATIONS_ANTHROPIC_BASE_URL agora opcional

artifacts/web-admin/
  vite.config.ts                  # sem mais plugins @replit/*
  dist/public/                    # output do build (deploy no Vercel)

artifacts/mobile/
  package.json                    # script dev:local para uso sem Replit
  scripts/build.js                # usa EXPO_PUBLIC_DOMAIN como fallback
```
