# Revisão de segurança do código — 21/10/2026 (Etapa 3)

Escrita em português simples. Para cada achado: **onde está**, **o que um mal-intencionado conseguiria** (uma frase), **como reproduzir**
e **o conserto**. Tudo foi feito só no código e no banco de teste; em produção não se tocou em nada, e nada foi enviado ao GitHub nem
promovido. Branch `codex/myasa-novo`.

Como ler as gravidades: **CRÍTICO** = dá para tirar o acesso de uma casa inteira ou ler/gravar dado pessoal de outra casa sem
nenhuma ajuda; **ALTO** = mexer ou ler dado de outra casa (ou de outra pessoa) sabendo só um código (id), ou fazer o que só a gestão
faz sem ser gestão; **MÉDIO** = exige condição extra ou só aparece se algo for religado; **BAIXO** = detalhe sem dano direto.
"Casa" é cada organização do banco (hoje há duas no mesmo banco).

## Resumo em cinco linhas

1. **Achados confirmados e já consertados no código: 2 críticos, 6 altos, 2 médios.** Todos têm teste; os de isolamento mostraram a falha **antes** do conserto (o teste viu 200/201 onde devia haver 404) em 4 casos — grupo, delegação (cancelar e criar) e restrições; nos demais o defeito foi confirmado lendo o código e o teste passou a protegê-lo.
2. O defeito era sempre o mesmo, o do Livro do Dia de 18/10: a rota procura o item só pelo código e o papel "Administração"
   passa sem olhar de que casa o item é. Depois de 18/10 quase tudo já estava certo; sobraram rotas antigas (restrições, delegações, grupos, papéis) e uma rota sem checagem de perfil (arquivar Escala).
3. O novo teste `isolamento-entre-casas` faz **277 chamadas** como Administração da casa B sobre dados da casa A (cobre **244 das 257** rotas com id) e confere que
   todas são recusadas (403/404) e que nada da casa A mudou; repete 32 ações de gestão como Elenco da própria casa. São **339 verificações** no total.
4. **Depende de você:** quatro decisões (seção "O que depende de você").
5. **Não deu para conferir** o que mora em produção (variáveis da Vercel, backup, RLS de produção): seção própria no fim.

## Achados

### CRÍTICO

**C1 — Tirar o acesso de qualquer pessoa de outra casa** · `DELETE /users/:id/roles/:roleId` · `artifacts/api-server/src/routes/roles.ts`
- *O que um mal-intencionado conseguiria:* a Administração da casa B desligava o perfil de acesso (inclusive o da Administração) de uma pessoa
  da casa A; a pessoa caía em "conta sem perfil" e não conseguia mais entrar.
- *Como reproduzir:* como Administração da casa B, `DELETE /api/users/<pessoa da casa A>/roles/<papel dela>` com um motivo. A rota achava o papel
  pelos dois códigos, nunca perguntava de que casa era a pessoa, e a trava "último administrador" contava os administradores da casa **B**.
- *Conserto:* a pessoa precisa ser da casa de quem pede, senão 404 "Usuário não encontrado". Teste: `isolamento-entre-casas` (com duas
  pessoas na Administração da casa B, para a trava do último administrador não esconder o erro).

**C2 — Restrições (inclusive de saúde) de todas as casas, e mexer nelas** · `GET` e `POST /restrictions`, `PATCH /restrictions/:id`, `POST /restrictions/:id/encerrar` · `routes/restrictions.ts`
- *O que um mal-intencionado conseguiria:* qualquer Administração **ou Supervisão** de qualquer casa listava as restrições de **todas** as casas (tipo, período, observações e nome da pessoa; há restrição de saúde) e podia criar, editar ou encerrar restrição de pessoa de outra casa. A tela dessas rotas saiu do site em 20/10, mas a API continua no ar.
- *Como reproduzir:* `GET /api/restrictions` sem filtro com qualquer conta de gestão; e, como Administração da casa B, `POST /api/restrictions/<restrição da casa A>/encerrar` (o teste viu 200 e a restrição mudar).
- *Conserto:* a pessoa dona da restrição precisa ser da casa de quem pede, e a Supervisão só enxerga e mexe em restrição de pessoas da própria área (a Administração, na casa inteira). Teste: `isolamento-entre-casas`, que também confere que a lista da casa B não traz nome nem restrição da casa A.

### ALTO

**A1 — Tirar a Supervisão de um grupo de outra casa** · `DELETE /operational-groups/:id/supervisors/:userId` · `routes/groups.ts`
- *Conseguiria:* a Administração da casa B tirava a Supervisão de um grupo da casa A e deixava o grupo "sem supervisor".
- *Reproduzir:* confirmado pelo teste antes do conserto (resposta 200 e papel desativado). *Conserto:* o grupo precisa ser da casa de quem pede (`loadGroupInOrg`), senão 404.

**A2 — Cancelar a delegação de outra casa** · `PATCH /delegations/:id/cancel` · `routes/delegations.ts`
- *Conseguiria:* a Administração da casa B cancelava uma delegação de responsabilidades da casa A (a pessoa delegada recebia o aviso de cancelamento).
- *Reproduzir:* confirmado pelo teste antes do conserto (200 e `revokedAt` gravado). *Conserto:* a delegação é procurada junto com a operação, e a operação tem de ser da casa de quem pede. Também passou a responder 404 (e não 500) quando o código na URL está quebrado.

**A3 — Ligar e ler documento de outra casa pelo Livro do Show** · `POST /show-books/:id/positions/:positionId/refs` · `routes/show-book.ts`
- *Conseguiria:* quem gere um show da casa B ligava um documento da casa A (sabendo o código) a uma posição e, pela lista de referências do show,
  lia o título, o resumo e a versão dele.
- *Conserto:* o documento precisa ser da casa de quem pede, senão 404. Teste: `seguranca-revisao-etapa3`.

**A4 — Arquivar uma Escala sem ser da gestão** · `POST /scales/:id/archive` · `routes/scales.ts`
- *Conseguiria:* **qualquer pessoa logada da casa, até do Elenco**, arquivava uma Escala sabendo o código (publicar, apagar e regenerar já exigiam gestão; esta rota ficou sem a checagem).
- *Conserto:* mesma regra de publicar e apagar (Administração, ou Supervisão do local, ou quem recebeu a delegação de Escalas), senão 403 com frase. Teste: o bloco "Elenco da mesma casa" do `isolamento-entre-casas`.

**A5 — A Administração e a Supervisão liam mensagens privadas pelo registro da ASA** · `GET /asa/audit` · `routes/asa.ts`
- *Conseguiria:* quando alguém pergunta à ASA "minhas mensagens", o texto das mensagens vai na resposta, e a resposta fica guardada no registro da ASA. Esse
  endereço entregava o registro de **todas** as pessoas da casa para a Administração e para a Supervisão. Era um caminho para ler conversa de outra pessoa (a regra é: a Administração NÃO lê conversa).
- *Conserto:* linhas que envolvem mensagens saem sem pergunta nem resposta (também as antigas). Teste: `seguranca-revisao-etapa3`. **Ainda recomendo** (decisão sua, abaixo) não guardar esse texto no banco.
- Nenhuma tela do site usa esse endereço (conferi no código do site).

**A6 — Criar delegação em operação de outra casa** · `POST /delegations` · `routes/delegations.ts`
- *Conseguiria:* a Administração da casa B criava uma delegação de responsabilidades numa operação da casa A, para uma pessoa da casa A, que recebia o aviso (a Administração passava na checagem de supervisão sem que se olhasse a casa da operação, e a pessoa delegada não era conferida).
- *Reproduzir:* o teste viu resposta 201 antes do conserto. *Conserto:* operação e pessoa delegada (ativa) têm de ser da casa de quem pede, senão 404.

### MÉDIO

**M1 — Chamada de outra casa criava etapas numa tarefa da casa A** · `garantirEtapas`, usada por `POST /tasks/:id/start`, `/ready-for-approval` e `/approve`
- *Conseguiria:* escrever (criar as etapas padrão) numa tarefa de outra casa antes de a rota perceber que ela não é sua. Efeito pequeno, mas era escrita cruzada. *Conserto:* a função passou a receber a casa e só mexe em tarefa dela. Teste: `seguranca-revisao-etapa3`.

**M7 — Criar solicitação em operação de outra casa** · `POST /requests` · `routes/requests.ts`
- *Conseguiria:* mandar o código de uma operação de outra casa e colocar uma solicitação (com o texto do motivo) na fila de lá; um tipo inválido virava erro 500. *Conserto:* a operação precisa ser da casa de quem pede; o tipo é conferido contra a lista (400 com as opções). Teste: `isolamento-entre-casas`.

**M2 — Código antigo da ASA com consultas sem filtro de casa (não alcançável hoje)** · `routes/asa.ts`, função `executeTool`
- Mais de 100 "ferramentas" antigas (tendências, padrões, riscos, `analisar_conversa`, `resumir_conversa`…) montam consultas assim: "se há operação, filtre por ela; se não, `sql\`true\``", ou seja, sem filtrar a casa; e `fetchMsgs` lê mensagens de **qualquer conversa**, sem checar se a pessoa participa (e, se a casa não tem conversa nenhuma, até de outras casas).
- **Por que não é alcançável hoje:** o chat da ASA só roda as 29 consultas `consultar_*` que o motor de comandos sabe montar, e cada uma ou escolhe uma operação autorizada antes ou filtra pela casa e pela própria pessoa (conferi as de pessoas, locais, solicitações, folgas, entregas, avisos, mural, responsabilidades e mensagens). `executeTool` só é chamado em um lugar (`asa.ts`, no chat). O assistente de hoje também **não chama nenhuma IA** (não há chave nem biblioteca de IA no servidor): por isso a pergunta "uma instrução escondida num documento faz a ASA gravar algo?" não se aplica — não há modelo lendo texto. Toda gravação (30 tipos de proposta) passa por `/asa/actions/:id/confirm`, que confere de novo a casa, o perfil e a pessoa que pediu.
- **Risco:** quem religar a IA ou criar um comando novo que use uma dessas ferramentas leria dado de outra casa e conversa alheia. *Proposta:* tirar essas ferramentas do código (como as 114 telas mortas); mexe em um arquivo grande e em testes, por isso **não fiz**: depende de você.

**M3 — Qualquer pessoa pode pausar a conta de outra por 15 minutos** · `lib/tentativas-de-acesso.ts`
- A pausa conta erros **por nome de usuário** (de propósito, para não revelar quem existe). Quem sabe o login de alguém digita 8 senhas erradas e a pessoa fica sem entrar por 15 minutos (inclusive no dia do show). Para a Direção/Administração isso é um risco real. Decisão de negócio (ver abaixo); não mexi.

**M4 — Formações "da biblioteca" (sem casa) podem ser editadas e desativadas por qualquer casa** · `services/formation-library.ts` (`updateFormation`)
- A conferência aceita `organizationId = a casa de quem pede` **ou nulo**. Formação sem casa é a biblioteca comum; a Administração de qualquer casa pode editar ou desativar uma. Provavelmente é de propósito (biblioteca compartilhada), mas hoje uma casa muda o que a outra vê. Decisão sua.

**M5 — Sem cabeçalho de proteção contra script injetado no site (CSP) e sem limite geral de chamadas** · `artifacts/web-admin/vercel.json`, `application.ts`
- O site tem `nosniff`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`, mas **não tem Content-Security-Policy**; os tokens de acesso ficam no `localStorage` do navegador. Não achei `dangerouslySetInnerHTML` nem HTML montado à mão (bom), então hoje não há por onde injetar script; a CSP seria a segunda trava. A API não tem limite geral de chamadas (só o de senha): `POST /api/auth/esqueci-senha` sem limite por origem deixa alguém encher o sino da Administração de "Pedido de senha nova" (1 aviso por pessoa a cada 30 min, mas para todas as pessoas, uma a uma). Proposta: CSP em modo "só relatar" primeiro; limite por origem no `esqueci-senha`. Muda cabeçalho do site e a promoção: **depende de você**.

**M6 — Segredos de desenvolvimento se `NODE_ENV` não for `production`** · `lib/jwt.service.ts`
- Se a API subir sem `NODE_ENV=production` e sem `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, assina com segredos escritos no código (públicos). A trava existe, mas depende dessa variável. Não consigo conferir a Vercel daqui (ver "Não deu para conferir").

### BAIXO

- **Login diferencia "inativo" de "senha errada" e é mais rápido para usuário que não existe** (`auth.service.ts`): dá para descobrir logins válidos medindo o tempo ou a frase (403 "inativo" antes de conferir a senha). Dano pequeno; sugestão: comparar a senha com um hash falso quando o usuário não existe, e conferir a senha antes de dizer "inativo".
- **Renovação de sessão sem detecção de roubo**: reapresentar um token já trocado (depois de 30 s) só recusa; não derruba a sessão inteira. Hoje o desenho prioriza não derrubar quem tem o app fechado no meio da troca (decisão de 20/10).
- **CORS aberto (`*`) e API sem cabeçalhos de proteção** (`application.ts:40`): como a API usa token no cabeçalho (não cookie), outro site não consegue agir como a pessoa; fica só o detalhe de qualquer origem poder chamar.
- **`req.ip` sem `trust proxy`**: o registro de segurança guarda o IP do proxy da Vercel, não o da pessoa (`auth.ts`). O alerta crítico do `proxy-addr` do `pnpm audit` não se aplica porque o app não liga `trust proxy`.
- **Id quebrado na URL ainda dá 500 em vários roteadores** (só 9 de 39 arquivos chamam `exigirUuidNosParametros`; vários validam à mão). Não vaza nada. Conserto feito só no de delegações.
- **`PATCH /messages/threads/:id/read` responde 200 para quem não está na conversa** (não grava nada: o filtro inclui a própria pessoa). Cosmético.
- **PDF da Biblioteca servido sem `X-Content-Type-Options: nosniff`** e `decodeURIComponent` do nome do arquivo estoura 500 com texto quebrado (`library.ts:430`, `:523`).
- **Mural/Registro**: o evento `ref_added` do Livro do Show é gravado sem a casa (`orgId`); aparece pelo ator, então não vaza nem some.
- **Senha provisória** (`senhaProvisoria`, ~30 bits): aceitável **porque** o limite de 8 erros por 15 min existe; se o limite for tirado, vira fraca.

## O que ficou limpo (conferido)

- **Isolamento**: Livro do Dia, Livro do Show (e as rotas filhas), Tarefas (e etapas), Biblioteca (documentos, arquivo PDF, categorias), Pedidos/Solicitações/Folgas (inclusive troca com colega), Mensagens (só participante), Mural/Avisos, Agenda, Escalas, Responsabilidades (pedidos, lista fixa), Pessoas (cadastro, perfil, senha), Operações, Áreas, Locais, Personagens, Sessões, Ocorrências, Restrições, Foto de perfil, Notificações e Desfazer: todos respondem 404/403 para a Administração de outra casa.
- **SQL**: nenhum SQL montado com texto do cliente (todas as consultas usam parâmetros; os `LIKE` escapam `%` e `_`).
- **Upload**: PDF só com `%PDF-` e até 15 MB; foto só JPG/PNG/WebP até 1 MB, servida com o tipo gravado e `nosniff`.
- **Web Push**: o endereço da inscrição só aceita FCM, Mozilla, Apple e Windows, https, sem porta.
- **Link do Drive** (`tasks/check-link`): só `drive.google.com` e `docs.google.com`, https, sem porta nem usuário (não vira porta para o servidor chamar qualquer endereço).
- **`/internal/ciclo` e `/internal/tarefas-do-dia`**: chave `x-myasa-cron` comparada em tempo constante, mínimo de 24 letras, 401 sem chave e 503 sem configuração (não revela). Só reportado, sem alteração, como pedido.
- **Logs**: `req` guarda só método, caminho sem consulta e código; senha, token e `authorization` são cortados; erro do banco tem os valores trocados por `[ocultos]`; erro para o cliente nunca leva a pilha.
- **Sessão**: renovação em transação com a linha travada; "Sair" revoga a cadeia; senha redefinida e desligamento encerram as sessões; token de acesso dura 15 min e **toda** chamada confere de novo se a conta está ativa e qual é o perfil.
- **"Esqueci minha senha"**: resposta igual exista ou não o usuário.
- **Privacidade de contato**: telefone e e-mail "só gestão" somem para colegas (`colleaguePerson`); `adminNotes`, aniversário e silêncio não saem para a Supervisão.
- **Banco**: nas 118 tabelas do banco de teste, RLS ligado, **zero políticas**, nenhum privilégio para `anon`, e a migração 0029 também tira `authenticated`. O `migration-runner` confere `anon` e RLS; ele **não** confere `authenticated` (hoje está tudo certo por causa da 0029 e do `ALTER DEFAULT PRIVILEGES`; vale estender a checagem — ver "Depende de você").
- **`pnpm audit --prod`** (só relatado): 87 avisos (3 críticos, 58 altos). Nos pacotes que o servidor e o site usam de verdade: `proxy-addr` (crítico, mas só vale com `trust proxy`, que o app não liga), `body-parser` (baixo), `brace-expansion`/`browserslist` via `@sentry/node` (negação de serviço em ferramenta de build, sem entrada de usuário). Os outros críticos (`tar`, `shell-quote`) estão só no aplicativo de celular (`artifacts/mobile`/`expo`). Nada exige correção urgente; atualizar `express`/`body-parser` quando for conveniente.

## O que o teste de isolamento cobre (e o que não)

- Rotas declaradas com id na API: **257** (`router.get|post|patch|put|delete` com `:parâmetro`, lidas dos arquivos, como na matriz de permissões).
- O teste `isolamento-entre-casas.test.ts` exercita **244 das 257** como Administração da casa B sobre recursos reais da casa A (277 chamadas, contando as de criação) e afirma 403/404 (na criação também vale um 400 que diga "não é desta casa", e um 409 na geração de Escala), e confere que 27 recursos da casa A e os papéis das pessoas não mudaram. Mais 32 ações da gestão feitas como Elenco da mesma casa, e 31 criações em que o corpo traz o código de algo da casa A.
- Está no `tests/run-tests.mjs`. O arquivo `seguranca-revisao-etapa3.test.ts` guarda as regressões que precisam de estado especial.
- **Limite honesto:** nas rotas filhas (`/x/:id/y/:filhoId`) o código do filho é inventado, então a recusa prova que o **pai** é conferido, não o filho. Os filhos foram lidos no código (todos amarrados ao pai por `eq(...showBookId, id)` ou equivalente).
- **Fora do teste (13 rotas, todas lidas no código):** da ASA, `GET /asa/conversations/:id/messages`, `POST /asa/chat/:id/messages`, `POST /asa/actions/:id/confirm` e `/cancel`, `PATCH` e `DELETE /asa/memories/:id` (sempre presas à pessoa e à casa de quem pede); `POST /actions/:id/undo` e `DELETE /web-push/subscriptions/:id` (presos à pessoa); `PUT /characters/:id/cast-order`, `PATCH` e `DELETE /characters/:id/cast/:castId`, `GET /characters/:id/resolve` (passam por `characterInOrg`); `PUT /library/documents/:id/file` (exige PDF de verdade; a rota confere a casa do documento).
- Também não coberto: a Supervisão/Direção de outra casa (o teste usa só a Administração, que é onde o "passa sem olhar a casa" acontece), rotas sem id (listagens: conferidas por leitura e pela matriz de permissões), e rotas que dependem de IA.

## O que depende de você (decisões)

1. **ASA antiga (M2) — FEITA em 21/10 (ver "Decisão 1" no fim).** Original: apagar as mais de 100 ferramentas que o chat não alcança (recomendado) e **não guardar** o texto das mensagens em `asa_audit_log` (A5: o conserto atual esconde na leitura, mas o texto continua no banco).
2. **Pausa de senha (M3):** manter por usuário (hoje), ou somar um limite por origem (IP) para que uma pessoa de fora não pause a conta de outra. Recomendo somar o limite por origem, sem trocar o por usuário.
3. **Formações da biblioteca comum (M4):** a Administração de qualquer casa pode editá-las: manter (biblioteca compartilhada) ou travar para só a Administração da "casa dona".
4. **Cabeçalhos e limites (M5):** CSP em modo "só relatar" no site; limite por origem no `esqueci-senha`; estender o `migration-runner` para também recusar privilégio de `authenticated`.

## Commits desta etapa

Fora o teste e os documentos, um commit por assunto (todos em `codex/myasa-novo`, nada enviado):

| Commit | Assunto | Achado |
|---|---|---|
| `8422cb7` | Tirar o perfil de uma pessoa só vale para pessoa da própria casa | C1 |
| `cc11d65` | Restrições (inclusive saúde) só da própria casa e, para a Supervisão, da própria área | C2 |
| `159105e` | Tirar a Supervisão de um grupo só vale para grupo da própria casa | A1 |
| `a038de7` | Cancelar delegação só vale para delegação da própria casa | A2 |
| `6ffc0f5` | Documento ligado a uma posição do Livro do Show tem de ser da própria casa | A3 |
| `2afc38a` | Arquivar uma Escala passa a exigir gestão | A4 |
| `951e967` | O registro da ASA não entrega mais o texto de conversas | A5 |
| `9aa905d` | Criar delegação confere a operação e a pessoa delegada | A6 |
| `797feda` | Mexer numa tarefa de outra casa não cria mais etapas nela | M1 |
| `674e590` | Criar solicitação só em operação da própria casa | M7 |
| `7904a07` | Testes: isolamento entre casas e regressões da revisão | — |

## Testes rodados depois dos consertos (um arquivo por vez, banco de teste)

`isolamento-entre-casas` (339 verificações), `seguranca-revisao-etapa3`, `permission-matrix`, `daily-book-fill`, `tarefas-revisao`, `logical-removal`, `block7-integrity`, `tarefas-etapas` e `asa-actions-http`: **todos passaram**. A bateria completa (77 arquivos) **não** foi rodada nesta etapa; rode-a antes da promoção. Tipos da API (`tsc`): limpos.

## O que NÃO deu para conferir

- **Produção** (não toquei): se `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `CRON_SECRET` estão definidos e fortes na Vercel; se o RLS e os privilégios de produção batem com o teste (rode `src/audit-rls.ts` com a URL de produção, é só leitura); o backup do banco.
- **Dois navegadores / aparelhos**: nada foi visto em tela; esta etapa é de API.
- **O assistente com IA**: não existe chamada de IA no código atual (conferido), então não há como testar instrução escondida.
- **Rotas de IA e de envio real** (push de verdade, e-mail): fora do alcance do banco de teste.
- **Rotas com id fora do teste** (lista acima) e o **mobile** (`artifacts/mobile`): não revisado.
- **Concorrência**: dois pedidos simultâneos entre casas não foram simulados.

## Decisão 1 — feita (21/10/2026)

- **Ferramentas antigas da ASA apagadas:** 72 ferramentas que o chat não alcançava saíram de `executeTool` (`routes/asa.ts` foi de 9.950 para cerca de 6.600 linhas), junto com os auxiliares que só elas usavam. Ficaram as 30 consultas `consultar_*` que o motor de comandos monta, e todas as gravações (que passam por `/asa/actions/:id/confirm`, intactas). Isso fecha o M2: não existe mais consulta sem filtro de casa nem leitura de conversa alheia no código da ASA.
- **Texto de mensagens fora do registro:** a resposta de "mensagens não lidas" deixou de ser gravada em `asa_audit_log`; o texto continua no chat da própria pessoa. A leitura em `GET /asa/audit` continua escondendo as linhas antigas. Para apagar o que já está gravado: `lib/db/scripts/limpar-texto-de-mensagens-no-registro-da-asa.sql` (rodado só no banco de teste: 2 linhas limpas; **em produção é de quem constrói o app**, primeiro o passo 1, que só conta).
- **O que não mudou:** o rascunho de mensagem que a pessoa pede à ASA para enviar fica na linha da proposta enquanto espera o "sim" (é o texto dela, e é necessário para enviar); depois de enviado, o texto vive na própria conversa, como sempre.
- **Testes:** `seguranca-revisao-etapa3` ganhou o caso do chat (a pessoa vê as mensagens, o registro não guarda); passaram também `asa-actions-http`, `asa-capabilities`, `asa-command-engine`, `asa-memory-http`, `asa-proposal-state`, `asa-suggestion-contract`, `asa-library-gaps`, `asa-library-citations`, `asa-datas`, `tarefas-asa-etapas` e `block7-integrity` (que perdeu só a linha que removia membro de grupo pela ferramenta apagada). Tipos limpos, sem import ou variável sem uso em `asa.ts`.
