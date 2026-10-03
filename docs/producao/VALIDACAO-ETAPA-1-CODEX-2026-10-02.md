# Etapa 1 — validação iniciada em 02/10 e fechamento em 03/10/2026

Branch: `codex/myasa-novo`. Este registro complementa o handoff do Claude; não declara as etapas 2–7 concluídas.

## Estado

- Typechecks do banco, API e web: passaram.
- Builds locais da API e web: passaram; a checagem do build web não encontrou os 51 nomes de elenco verificados pelo projeto.
- Testes puros da ASA: 8/8 arquivos passaram.
- Comunicação, execução isolada: 124 verificações passaram, incluindo os novos casos PEOPLE pela ASA.
- Perfil e senha, execução isolada: 42 verificações passaram, incluindo quatro pedidos simultâneos de recuperação.
- Suíte completa no banco de teste: 41/42 arquivos passaram na execução integral. O único arquivo com falha foi `asa-actions-http`, por duas expectativas antigas ainda presentes no bundle daquela execução.
- Reexecução integral de `asa-actions-http` após as correções das expectativas: **314 verificações passaram, zero falhas**. Assim, os 42 arquivos têm resultado aprovado considerando a execução completa e a reexecução corretiva; não se trata de uma única execução integral com 42/42.
- Entrega autorizada: commit e push somente em `codex/myasa-novo`; hash informado na conversa. Sem merge na `main`.
- Produção: 0052 e 0053 aplicadas em 03/10/2026, nessa ordem, após autorização explícita na conversa. Promoção Vercel não realizada pelo Codex; permanece com a dona do produto.

## Ajustes sobre o handoff

- ASA recebe `id` e `authorId` nas projeções usadas para autorizar leitura e ciente do Mural; `authorId` não é exposto no retorno da consulta.
- Testes PEOPLE cobrem destinatário, autoria, pessoa de fora, confirmação e perda de acesso entre prévia e confirmação.
- Conversas e mensagens continuam protegidas por `requireAuth`. Papel revogado retorna 403 `ACCOUNT_UNCONFIGURED`, inclusive com token antigo.
- O reconhecimento de preferências da ASA não intercepta alterações de tarefa. A leitura de prazo não captura comandos de responsabilidade, título ou requisitos. Prévia de evidências usa os rótulos em português.
- Consulta das próprias propostas de Agenda recebe o contexto de operação. Administração pode preparar reunião sem área/local sem cair na regra do Elenco.
- Corrigidos cenários de teste que dependiam de capitalização/artigo/texto da mensagem e que tentavam cancelar uma troca de responsabilidade para o vínculo já existente; a ausência de alteração também ganhou verificação. A audiência do rascunho de aviso é conferida pelos IDs exatos das cinco pessoas ativas da organização, incluindo a pessoa com papéis distintos entre operações, sem duplicatas nem vínculo estrangeiro residual.
- Pedidos simultâneos de senha são serializados por conta na mesma transação do Registro e das notificações, respeitando a janela de 30 minutos.
- Rollback 0053 recusa avisos PEOPLE, inclusive cancelados, antes de remover destinatários. Testado com tabelas temporárias (`search_path = pg_temp`) no banco de teste; o esquema real não foi revertido.

**Limite da ASA:** o comando existente de rascunho de aviso trabalha com `notices` da operação, não publica `announcements` do Mural. Os ajustes PEOPLE desta etapa abrangem leitura e ciente; não foi anunciado um novo comando de publicação no Mural.

## Conferência visual

Referências `.dc.html` foram usadas para comparar intenção, organização e comportamento, não copiadas como código. App local em modo amostra, desktop 1440×900 e celular 375×812.

Os arquivos 01, 10, 13, 22 e Estrutura do repositório têm o mesmo SHA-256 dos arquivos enviados em Downloads. O conteúdo da Estrutura também é idêntico ao arquivo do zip de navegação atualizado.

| Tela | Conferido | Limites / pendências |
|---|---|---|
| Shell | Quatro perfis; grupos e nomes do menu; navegação unificada Folgas/Solicitações; abas móveis; data e sino | Pílula de contexto e refinamentos de “Mais” seguem no plano. Sino sem sessão exibe orientação de login; lista real de notificações não foi validada visualmente. |
| Shows | Quatro perfis, desktop/celular; cartões, local, responsável e descrição; favorito alterna; Elenco sem filtro de rascunhos nem criação | Data de atualização não consta nos cartões da amostra; revisar com dados reais. |
| Tarefas | Quatro perfis, desktop/celular; Hoje, Em aberto, Vencidas, Feitas, Minhas; Elenco implicitamente pessoal; sem transbordamento da página | Amostra sem tarefas/responsabilidades preenchidas: validação visual dos cartões populados permanece pendente. |
| Mural | Quatro perfis, desktop/celular; destinos casa/área/local/pessoas; seleção de destinatários; janela cabe em 375 px; cancelamento exige motivo; Elenco sem publicação/cancelamento de aviso | Não houve publicação/cancelamento real pela interface. Progresso de ciente e lista de quem falta continuam na etapa 4. |
| Folgas/Solicitações | Abas e menu unificados; calendário da amostra; página de Solicitações acessível | Solicitações depende de sessão/API e mostrou estado de erro, não uma lista populada. Grade mensal de Folgas permanece na etapa 3. |
| Entrada | Login desktop/celular; mostrar senha; tela Esqueci minha senha; validação de usuário vazio | Primeiro acesso, conta desativada e recuperação com sessão real ainda precisam de conferência visual. Regra de senha/recuperação também tem testes HTTP. |

Nenhuma dessas verificações de amostra equivale a validação em produção. Não houve teste de recebimento real de push em aparelho.

## Evidências locais

Logs ficam em `output/`, fora do commit. Principal: `qa-etapa1-suite-completa-20261002.log`. Reexecuções isoladas da ASA ficam em arquivos `qa-etapa1-asa-http-*` e `qa-etapa1-asa-confirmacao-final-20261002.log`; resultados intermediários com falhas não são aprovação final. O teste HTTP da ASA agora informa progresso a cada 50 verificações bem-sucedidas.

## Produção — autorização e aplicação em 03/10/2026

Código entregue no commit `5490a6f1289485453925d1fb3f833a3fb4f8984a`, com push confirmado em `codex/myasa-novo`.

- Autorização explícita recebida: "sim autorizo", em resposta à pergunta sobre 0052 e 0053 em São Paulo.
- Destino conferido pela conexão de `.env.piloto`: projeto com prefixo `jzzwka`, região `sa-east-1`. Nenhuma credencial registrada neste documento.
- Antes: 52 migrações, última `0051_solicitacoes`; somente `0052_library_page_citations` e `0053_mural_pessoas` pendentes.
- Aplicação pelo `lib/db/src/migrate.ts`, sem pular arquivos, concluída com saída 0.
- Depois: 54 migrações, última `0053_mural_pessoas`, nenhuma pendente. Hashes de 0051, 0052 e 0053 conferem com os arquivos versionados.
- Enum `announcement_scope` contém `PEOPLE`.
- `library_document_page_citations` e `announcement_recipients` existem, com RLS habilitada e sem acesso para `anon`, `authenticated` ou `PUBLIC`.
- Nenhum rollback, merge na `main` ou promoção Vercel foi realizado.

A promoção dos dois projetos Vercel (`my-asa-web` e `my-asa`) continua com a dona do produto. A conferência funcional do deploy novo em produção depende dessa promoção e de sessão autenticada. A etapa 2 seguinte é Check-in por turno; etapas 2–7 não foram implementadas nesta rodada.
