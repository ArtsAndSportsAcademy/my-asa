# Promoção das Etapas 1 e 3 (21/10/2026) — ordem e conferências

Em passos simples. **Quem faz é quem constrói o app**: o "pode enviar" é seu, e o assistente não toca em produção. O que está local hoje são **22 commits** em `codex/myasa-novo`:
a Etapa 1 (vigia do relógio, verificador de fora, alerta de erros) e a Etapa 3 (segurança). Nada foi enviado ao GitHub.
Resultado dos testes: bateria completa **82 de 82** no banco de teste (21/10, depois de tudo). Detalhes em `docs/handoff-2026-10-21-etapa-1.md` e `docs/seguranca-2026-10-21.md`.

**Só há uma migração: a 0076** (Etapa 1, tabela do vigia do relógio). A Etapa 3 não tem migração.

## A. Antes de mexer em qualquer coisa (só olhar)

1. **Backup do banco** no Supabase: confirme que existe um recente. A única coisa sem volta desta promoção é a limpeza do passo F; o resto desfaz pelo deploy anterior.
2. **Rodar a bateria de novo?** Só se mexerem em código antes de enviar. Se não, vale o 82 de 82 de hoje.
3. **Auditoria do banco de produção (só lê)**, na pasta `lib/db`:
   ```powershell
   node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs src/audit-rls.ts
   ```
   Procure: nenhuma tabela com `rls_enabled: false`, nenhuma com permissão para `anon`. Esta etapa passou a recusar também permissão para `authenticated` e qualquer política; se aparecer alguma, **me avise antes de migrar** (o próximo `migrar-producao` terminaria com erro depois de aplicar).
4. **Formações sem casa** (só lê, no SQL do Supabase): `select count(*) from formations where organization_id is null;`. Se der 0, a decisão 3 não afeta ninguém; se der mais que 0, essas formações passam a ser só de leitura/uso.
5. **Variáveis na Vercel** (projeto da API, `my-asa`) — só conferir que existem e não estão vazias: `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` (24 letras ou mais). Se `NODE_ENV` faltar, a API usaria segredos de desenvolvimento conhecidos: **corrija antes de promover**.
6. **Opcional, só se já tiver as contas** (Etapa 1): `SENTRY_DSN` na API e `VITE_SENTRY_DSN` no site (esta precisa refazer o envio do site). Sem elas nada quebra; o alerta de erros fica desligado. Passo a passo: `docs/alerta-de-erros-sentry.md`.
7. **Nada novo é obrigatório** para a Etapa 3: as variáveis `MYASA_LIMITE_DE_SENHA_POR_ORIGEM` (padrão 30) e `MYASA_LIMITE_DE_ESQUECI_POR_ORIGEM` (padrão 10) só existem para mudar ou desligar (`0`) se precisar.

## B. Migração (primeiro, e antes do código)

Na pasta `lib/db`, primeiro o ensaio (só lê) e depois aplicar só a 0076:
```powershell
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/migrar-producao.ts
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/migrar-producao.ts --aplicar --so=0076_relogio_do_sistema
```
Esperado: "a tabela existe e está protegida (RLS ligado)". Aplicar antes do código é seguro (a API no ar não usa a tabela). Desfazer: `lib/db/drizzle/rollback/0076_relogio_do_sistema.down.sql`, **antes** de voltar a API.

## C. Enviar e promover (nesta ordem)

1. **Enviar ao GitHub** a branch `codex/myasa-novo` (nunca `main`).
2. **API** (`my-asa`) primeiro.
3. **Site** (`my-asa-web`) depois. Antes, na pasta do site: `node scripts/verificar-nomes-build.mjs` (regra D1; já passou).

## D. Conferir logo depois (uns 10 minutos)

1. `https://my-asa.vercel.app/api/saude` deve mostrar `"situacao":"em_dia"`. Se ficar `"sem_registro"` por mais de 2 minutos, o agendador do Supabase não está chamando a API (guia da Etapa 1, passo 3).
2. **Entrar com uma conta de cada tipo** (Administração, Direção, Supervisão, Elenco) e abrir: Meu Dia, Escalas, Livro do Dia, Folgas, Mural, Mensagens, Biblioteca, Perfil. Sem frase de erro.
3. **O IP chega certo?** (a conferência mais importante da Etapa 3). Depois de 2 ou 3 pessoas entrarem de aparelhos diferentes, no SQL do Supabase:
   `select ip_address, count(*) from security_audit_log where action = 'LOGIN' and created_at > now() - interval '1 hour' group by 1;`
   Tem que aparecer **IPs diferentes** para pessoas diferentes. Se aparecer **um IP só** (ou o do servidor), o limite por conexão trataria todo mundo como uma conexão: ponha `MYASA_LIMITE_DE_SENHA_POR_ORIGEM=0` e `MYASA_LIMITE_DE_ESQUECI_POR_ORIGEM=0` na API, refaça o envio e me avise.
4. **Não teste o bloqueio de senha com conta de pessoa real** (ela ficaria pausada por 15 minutos). Se quiser ver, use uma conta criada para isso.
5. **Relatório de CSP**: abra o site com o console do navegador aberto; deve haver avisos "Content Security Policy" em modo **Report-Only** (não bloqueia nada), e o Drive embutido, as fontes e o app têm que funcionar normalmente. Se algo deixar de funcionar, não é a CSP (ela não bloqueia): me avise.
6. **Arquivar Escala pelo Elenco**: com uma conta de Elenco, a ação de arquivar não existe na tela; nada a conferir, a recusa é na API.
7. **ASA**: com a sua conta, pergunte "minhas mensagens não lidas": a resposta aparece normalmente para você.

## E. Depois de uma semana de uso

1. **Ler os relatórios de CSP**: no log da API na Vercel, procure por `Relatório de CSP`. Cada linha diz a regra, o que foi bloqueado e a página.
2. Se aparecer só coisa que você conhece (Drive, fontes, Sentry), ajuste o texto da política em `artifacts/web-admin/vercel.json` e troque o nome do cabeçalho de `Content-Security-Policy-Report-Only` para `Content-Security-Policy`. **Não troque sem ler os relatórios.**

## F. Limpeza do texto de mensagens no registro da ASA (por último, e só depois de a API nova estar no ar)

Arquivo: `lib/db/scripts/limpar-texto-de-mensagens-no-registro-da-asa.sql`, no SQL do Supabase.
1. Rode **só o PASSO 1** (conta linhas). Se o número fizer sentido, rode o PASSO 2. **Não tem volta**; faça depois do backup do passo A.1.
2. Se ainda não rodou, o script mais antigo (`limpar-texto-de-mensagens-no-registro.sql`, do Registro) segue pendente da decisão de 14/10.

## G. Se der errado

- **API ou site com problema:** na Vercel, volte ao deploy anterior (Deployments → o anterior → Promote). Não há migração da Etapa 3 para desfazer.
- **Todo mundo sem conseguir entrar (limite por conexão):** ponha `MYASA_LIMITE_DE_SENHA_POR_ORIGEM=0` e refaça o envio da API; as contas pausadas liberam em 15 minutos, ou a Administração redefine a senha.
- **Migração 0076:** rollback do passo B, antes de voltar a API.
- **O que não desfaz:** o passo F (limpeza). Por isso é o último.

## H. Pendências que continuam suas

- Contas do verificador de fora e do Sentry (Etapa 1).
- Conferir o backup e medir o tempo das telas em produção (do handoff de 20/10).
