# Colocar o My ASA no ar: Supabase (São Paulo) + Vercel

Decidido em 01/10/2026 pela dona do produto: **banco no Supabase em São Paulo; site e servidor na
Vercel, servidor também em São Paulo (região `gru1`).**

O que cada parte faz:

| Parte | Onde | O que é |
|---|---|---|
| Banco | Supabase, projeto em **São Paulo (sa-east-1)** | onde ficam pessoas, escalas, Registro… |
| Servidor (API) | Vercel, projeto com raiz `artifacts/api-server`, região `gru1` | confere permissão, grava, manda aviso |
| Site | Vercel, projeto com raiz `artifacts/web-admin` | o que abre no celular |
| Despertador | Supabase (`pg_cron`) chamando a API a cada minuto | avisos da fila, lembrete de check-in, publicação automática |

## Passo 1 — Supabase em São Paulo — FEITO (01/10/2026)

- Projeto novo em São Paulo (ref. começa com `jzzwka`), Postgres 17. A linha está em
  `.env.piloto` (`DATABASE_URL_PILOTO`).
- Migrações 0000 a 0051 aplicadas (52; RLS conferido).
  - Em 01/10 entraram a `0050`, tolerância de renovação da sessão, e a `0051`, Solicitações.
  - A `0052` (Biblioteca, Codex) ainda **não** foi aplicada em produção: precisa de autorização.
- Organização "Arts and Sports Academy", operação "Operação Principal" e primeira Administração
  Barbara Sorroche (`barbara.sorroche`). A senha provisória foi entregue no chat, não fica registrada,
  e a troca é obrigatória no primeiro login.
- Ficam sem uso, para a dona do produto decidir no painel:
  - o projeto de agosto em São Paulo ("MyASA Piloto", ref. `xgmjqr…`): organização "ASA" e um
    "Administrador ASA" genérico, sem dado real;
  - o MYASA-piloto de Oregon.
  Nenhum dos dois foi apagado.
- Atualização de 01/10: o projeto de agosto e o `myasa-test` foram apagados pela dona do produto. O
  MYASA-piloto (Oregon) virou o **banco de teste** (`.env.test`). Ficam só dois projetos: MYASA (São
  Paulo, produção) e MYASA-piloto (Oregon, testes).

O roteiro original deste passo, para referência:

1. Escolha uma das duas opções:
   - **Restaurar o "MyASA Piloto" (sa-east-1)**, que está pausado. Antes de usar, eu confiro (só
     leitura) se tem dado antigo lá dentro.
   - Ou criar um **projeto novo** com região **South America (São Paulo)**.
   - Atenção: o plano grátis tem limite de projetos ativos. Se pedir, pause o **MYASA-piloto
     (Oregon)**, que não vai ser mais usado.
2. No projeto: **Connect → Session pooler**. Copie a linha de conexão, com a senha do banco no lugar
   de `[YOUR-PASSWORD]`.
3. Cole essa linha no arquivo `.env.piloto`, no lugar do valor de `DATABASE_URL_PILOTO`.
4. Me avise. Eu faço:
   - a conferência;
   - as 50 atualizações do banco;
   - a conta da Barbara (organização "Arts and Sports Academy", operação "Operação Principal").

## Passo 2 — Vercel: o servidor (você cria o projeto; os valores eu já deixei prontos)

1. Na Vercel: **Add New → Project**, importe o repositório.
   - **Root Directory**: `artifacts/api-server`.
   - O `vercel.json` dessa pasta já diz: build com `pnpm run build`, região **gru1 (São Paulo)**,
     até 60 s por chamada.
2. **Settings → Environment Variables (Production)**: copie as linhas do arquivo **`.env.producao`**
   (na raiz do projeto, no seu computador; não vai para o repositório).
   - Já gerados: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`,
     `VAPID_PRIVATE_KEY`, `NODE_ENV`.
   - Preencher: `DATABASE_URL` (a mesma linha do Passo 1) e `VAPID_SUBJECT` (um e-mail da ASA, no
     formato `mailto:...`).
3. Faça o deploy e anote o endereço (ex.: `https://myasa-api.vercel.app`).

## Passo 3 — Vercel: o site

1. **Add New → Project**, mesmo repositório, **Root Directory**: `artifacts/web-admin`.
2. **Environment Variables**: `BASE_PATH=/` e `PORT=3000`. O build pede essas duas, mesmo sem usar a
   porta.
3. Em `artifacts/web-admin/vercel.json`, o redirecionamento de `/api` aponta hoje para
   `https://my-asa.vercel.app`. **Eu troco para o endereço do Passo 2** quando você me passar.
4. Deploy. Esse é o endereço que a equipe abre e instala no celular.

## Passo 4 — O despertador (eu rodo, com o endereço da API)

`docs/producao/agendador-supabase.sql`:
- liga `pg_cron` e `pg_net` no banco;
- guarda no cofre do Supabase o endereço da API e a `CRON_SECRET` (a mesma do `.env.producao`);
- agenda o ciclo **a cada minuto** e o lembrete diário de tarefas às **8h de São Paulo**.

Conferência no próprio script: a resposta esperada é `200 {"ok":true,...}`.

## Passo 5 — Conferir de ponta a ponta (eu + você)

- Barbara entra com a senha provisória e o app pede a troca.
- Um aviso de teste chega num Android e num iPhone, com o app instalado.
- A publicação da Escala avisa a equipe.
- O lembrete de check-in chega 30 minutos antes do primeiro bloco.

## O que já está pronto no código (para o Codex)

- `POST /api/internal/ciclo` e `POST /api/internal/tarefas-do-dia` (`routes/internal.ts`).
  - Só aceitam a chave no cabeçalho `x-myasa-cron`, comparada com a `CRON_SECRET` em tempo
    constante.
  - Sem chave: 401. Servidor sem `CRON_SECRET`: 503.
  - O ciclo usa trava do Postgres (`pg_try_advisory_lock`), então dois ciclos nunca rodam juntos.
- `rodarCicloOperacional()` (`services/operational-jobs.ts`): o mesmo trabalho do agendador local,
  uma vez por chamada.
- Teste `fase-e-ciclo` (10 verificações, com mutação). A matriz de permissões cobre as rotas novas:
  365/365 rotas protegidas, 0 falhas.
- Rodando localmente (`runtime.ts`), o agendador de 1 segundo continua igual. Na Vercel, o build usa
  `application.ts` e não liga agendador local.
