# Decisões confirmadas na auditoria do piloto

Registro das divergências entre o código do piloto e este pacote, e o que foi decidido.
Gerado depois da matriz de comparação regra a regra.

## Método

O modelo vem de um piloto que **rodou de verdade**. Quando uma regra parecer trabalhosa ou
estranha, não simplifique automaticamente — identifique, entenda que problema operacional ela
resolve, e **pergunte antes de alterar**. Comportamento presente no código antigo que este
pacote não menciona fica marcado como *não decidido*, nunca removido por parecer complicado.

## As sete decisões

| # | Tema | Decisão |
|---|---|---|
| 1 | **Rodízio** | 1 ponto por pessoa **e por dia**. O código do piloto incrementa por linha vencedora e pode somar duas vezes no mesmo dia — está errado. Divergência prioritária. |
| 2 | **Pessoa repetida na mesma cena** | Regra do código antigo **confirmada e preservada**. Não estava no pacote por omissão, não por decisão. |
| 3 | **Entidades próprias** | Personagem, Elenco, Sessão, Formação e Ocorrência são entidades com identidade e ciclo de vida. Linhas genéricas foi o que o piloto mostrou não funcionar. |
| 4 | **Conflito de personagem** | Alerta humano. **Sem bloquear publicação, sem substituição automática.** Aparece ao montar o show e ao gerar o Livro do Dia. |
| 5 | **Livro do Dia × Agenda** | Pode ser gerado sem evento prévio na Agenda. Depois de gerado, reflete os convocados na Agenda. A Agenda reflete; não autoriza. |
| 6 | **Publicação automática da Escala** | **Adiada, não cancelada.** No lançamento a Administração publica manualmente; a automação entra quando o app estiver estável. |
| 7 | **Escrita concorrente** | Mostrar as diferenças **antes** de sobrescrever e manter as duas versões no histórico. "Última alteração vence" em silêncio é o defeito, não a solução. |

## Por que a nº 1 é a mais grave

Ela corrompe o rodízio sem dar nenhum sinal. Quem faz personagem em dois shows no mesmo dia
sobe na fila duas vezes mais rápido e aparece como tendo feito mais do que fez. Ao longo de uma
temporada, o rodízio "por quem menos fez" passa a premiar quem trabalha em menos shows — o
oposto do que a regra existe para fazer. E ninguém percebe, porque o número parece plausível.

## Hospedagem — decidido

A API existente **se mantém** no primeiro lançamento; não se constrói API nova do zero. Ela já
carrega login próprio, autorização por perfil/área, motor de cobertura, rodízio, geração do
Livro do Dia, auditoria, notificações e tarefas agendadas.

Supabase entra **como banco**. Migrar parte da lógica para Supabase Functions fica como
avaliação posterior, para reduzir número de serviços — decisão técnica explícita, não suposição.

A API usa `app.listen()` e scheduler próprio: precisa de host persistente ou refatoração.

## Mobile

Sem app de loja. Mesmo endereço, layout que reflui. Além disso, **instalável na tela de início
(PWA)**: ícone, nome "My ASA", tela cheia. No iPhone a notificação push só funciona depois de
instalado — logo, instalar é passo obrigatório do primeiro acesso, e o procedimento difere
entre iPhone e Android. Entra no guia de uma página.

## Etapa de Adoção, Treinamento e Transição

Etapa formal **entre a homologação técnica e o lançamento**. O aceite do sistema não basta.

**Antes do lançamento**: explicar que problemas do piloto esta versão resolve; deixar claro o
que continua igual (equipe, vocabulário, áreas, locais, regras); apresentar primeiro à Direção,
Administração e Supervisão; escolher referências locais por área; criar e testar o acesso de
cada pessoa; demonstração curta com situações reais; guia de uma página sem linguagem técnica.

**A comunicação precisa responder**: por que mudar de novo, o que melhorou de verdade, o que
cada pessoa precisa fazer, a partir de que data o app é oficial, onde pedir ajuda, e o que
fazer se o app estiver indisponível. A justificativa **nunca** é "temos um app novo".

**Primeira semana**: suporte definido por área e horário; acompanhar quem não conseguiu entrar;
contato individual; registrar o motivo (acesso, dificuldade, resistência, falha técnica,
preferência pelo WhatsApp); corrigir rápido, sem tratar resistência como má vontade.

**Papel do WhatsApp**: segue como suporte, emergência, aviso de indisponibilidade e alcance de
quem ainda não entrou. Mas depois da data oficial, Escala, Livro do Dia e decisões operacionais
têm o app como fonte oficial. Informação importante que chegar pelo WhatsApp precisa ser
registrada no sistema por um responsável — **duas fontes oficiais concorrentes é o pior cenário**.

**Quem não migrar**: identificar o motivo, oferecer ajuda individual, verificar se é acesso,
treinamento ou sistema, registrar necessidade urgente manualmente se preciso, definir prazo
final. Depois do prazo, WhatsApp é canal auxiliar, não fonte oficial.

## Status da construção

**Onda 3 (construção) concluída em 15/09/2026.** Os quatro blocos estão aceitos e validados
contra Postgres real no Supabase de teste. Suíte completa: **168 asserts, 0 falhas.**
Migrações 0017 → 0022. As sete divergências da auditoria do piloto estão fechadas.

| Bloco | Escopo | Status |
|---|---|---|
| 1 | Correções no código existente: rodízio 1 ponto/dia, motivo obrigatório nas 6 ações, escrita concorrente com 409 + diff + histórico, regeneração em transação | **Aceito.** Migração `0017_block1_integrity.sql` aplicada em Postgres real (Supabase de teste); `block1-integrity.test.ts` — 16 asserts passando, incluindo dois shows do mesmo personagem no dia = 1 avanço e idempotência. |
| 2 | Entidades próprias: Personagem, Elenco, Sessão, Formação, Ocorrência | **Aceito.** Migrações `0018_block2_entities` / `0019_block2_backfill` / `0020_block2_legacy_key_nullable` aplicadas em Postgres real. `block2-integrity` 11 asserts + `block1-integrity` 16 asserts passando (regressão do Bloco 1 preservada sobre o schema novo). A chave textual antiga do personagem fica guardada como proveniência. |
| 3 | Detecção de conflito por horário (alerta humano, sem bloquear) | **Aceito.** Migração `0021_block3_schedule_conflicts` aplicada. `block3-integrity` 14 asserts; suíte total 155 asserts, 0 falhas. Severidade leve/grave, adjacência não conflita, escala salva com 201 mesmo em conflito, reconhecimento com motivo obrigatório cai quando o horário muda. Endpoints `GET /api/schedule-conflicts` e `POST /api/schedule-conflicts/:id/acknowledge`. |
| 4 | Biblioteca de formações | **Aceito.** Migração `0022_block4_formation_library` (`formations.active`, `show_book_roles.position_json`). `block4-integrity` 13 asserts. Busca exata por quantidade ordenada por uso, aproximada em n−1/n+1, aplicação transacional com cópia independente das posições, desativação sem exclusão. |

**Dívida conhecida (anterior ao Bloco 1) — resolvida.** Os fixtures de Operações/Livro do Dia
criavam usuários sem linha em `user_roles` e caíam em 403. Corrigidos no fim do Bloco 2: os
fixtures criam perfis ativos (ADMIN = direção/administração, SUPERVISOR_A = supervisão,
MEMBER = elenco) e os casos de rodízio usam Personagem/PersonagemElenco reais. Suíte completa
passando em Postgres real — 84 asserts, 0 falhas.

**Leitura confirmada da nº 1**: o ledger é único por **personagem + pessoa + data**. Uma pessoa
que faz o mesmo personagem em dois shows no mesmo dia soma 1 ponto; quem faz dois personagens
diferentes no mesmo dia soma 1 ponto em cada fila — correto, porque a fila é por personagem.

## Data de troca

Escolhida **pela operação**, antes da homologação final — depende do calendário real de shows.
Preferir: segunda-feira, recesso ou baixa operação, sem show importante no mesmo dia, equipe
disponível para suporte, e janela para voltar ao app antigo.

Antes da troca: backup do banco antigo · congelamento de alterações · migração final · teste de
login, Escala, Livro do Dia e Check-in · comunicação da equipe · plano de rollback.

## Critério para trocar

Contas criadas e testadas · representantes de todas as áreas usando · supervisores capazes de
ajudar suas equipes · data definida · suporte da primeira semana organizado · plano para quem
não migrar · canal de emergência · rollback técnico pronto.
