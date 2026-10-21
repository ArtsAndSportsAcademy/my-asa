# Handoff — Etapa 3: revisão de segurança (21/10/2026)

Quem lê só este arquivo deve conseguir continuar. O relato completo, em português simples, está em `docs/seguranca-2026-10-21.md`.
Branch `codex/myasa-novo`. Só banco de teste; nada enviado ao GitHub, nada promovido, produção intocada.

## Em uma frase

Li o código atrás de "a Administração de uma casa mexe no que é de outra" e de rotas sem checagem de perfil, achei **2 críticos, 6 altos e 2 médios**
(todos consertados no código, com teste), escrevi o teste de isolamento entre casas (277 chamadas, 244 das 257 rotas com id) e deixei **4 decisões** para você.

## O que mudou

| Assunto | Arquivo | Achado |
|---|---|---|
| Tirar o perfil de uma pessoa: só da própria casa | `routes/roles.ts` | C1 |
| Restrições (saúde inclusive): casa e, para a Supervisão, área | `routes/restrictions.ts` | C2 |
| Tirar Supervisão de grupo: só grupo da própria casa | `routes/groups.ts` | A1 |
| Cancelar delegação: só da própria casa | `routes/delegations.ts` | A2 |
| Documento ligado ao Livro do Show: só da própria casa | `routes/show-book.ts` | A3 |
| Arquivar Escala exige gestão | `routes/scales.ts` | A4 |
| Registro da ASA sem texto de conversa | `routes/asa.ts` (`semConteudoDeMensagem`) | A5 |
| Criar delegação: operação e pessoa da própria casa | `routes/delegations.ts` | A6 |
| Etapas da tarefa só na casa de quem pede | `routes/tasks.ts`, `services/task-steps.ts` | M1 |
| Criar solicitação: operação da própria casa e tipo válido | `routes/requests.ts` | M7 |

Testes novos (já na lista de `tests/run-tests.mjs`): `isolamento-entre-casas.test.ts` e `seguranca-revisao-etapa3.test.ts`.

## Como rodar

```powershell
# em artifacts/api-server; um arquivo por vez; o isolamento leva uns 6 minutos (cada chamada ~1 s no banco de teste)
$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="isolamento-entre-casas.test.ts"
node --env-file=../../.env.test ./tests/run-tests.mjs
```

Ao criar uma rota nova com id: carregue o item **junto com a casa** (join com `operations` ou coluna de organização) e acrescente a rota ao teste de
isolamento. Rota que escreve: confira o perfil (`requireRole` ou a função de escopo da área).

## Estado das verificações

- `isolamento-entre-casas`: **339 verificações, passou** (277 chamadas). Antes dos consertos o teste viu 200/201 em: tirar supervisor de grupo, cancelar e criar
  delegação, encerrar restrição.
- `seguranca-revisao-etapa3`: passou. Também rodados depois dos consertos (um arquivo por vez): ver `docs/seguranca-2026-10-21.md` ("Testes rodados").
- Tipos da API: limpos.
- `pnpm audit --prod` (só relatado): 87 avisos, nenhum urgente para a API/site (detalhe no relatório).

## O que depende de você

1. ASA antiga: apagar as mais de 100 ferramentas que o chat não alcança e **não guardar** o texto de mensagens em `asa_audit_log`.
2. Pausa de senha por usuário: somar limite por origem (IP)?
3. Formações da biblioteca comum (sem casa) editáveis por qualquer casa: manter ou travar?
4. CSP no site (primeiro em modo "só relatar"), limite no `esqueci-senha` e estender o `migration-runner` para também recusar privilégio de `authenticated`.

## Não deu para conferir

Variáveis e segredos da Vercel (`NODE_ENV`, `JWT_*`, `CRON_SECRET`), RLS/privilégios do banco **de produção** (rode `lib/db/src/audit-rls.ts` com a URL
de produção: é só leitura), backup, e nada foi visto em tela (a etapa é de API). O código novo precisa de "pode enviar" seu para ir a produção; a ordem é
a de sempre: API depois site (não há migração nesta etapa).

## Coordenação com a Etapa 1

Não toquei em `routes/internal.ts`, `routes/health.ts`, `services/operational-jobs.ts` nem no Painel. Só **reportei**: `/saude` é público e consulta o banco a
cada chamada (amplifica pedidos de fora; baixo), e `/internal/ciclo` está certo (comparação em tempo constante, mínimo de 24 letras, 401 sem chave, 503 sem configuração).
