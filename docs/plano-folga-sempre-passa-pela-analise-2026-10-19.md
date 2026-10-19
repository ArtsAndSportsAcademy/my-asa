# Todo pedido de folga passa pela análise (decisão de 19/10/2026)

Este arquivo guarda a decisão e traz o prompt pronto para colar numa sessão nova.

## A decisão

Até 18/10 valia a regra do áudio da Administração de 16/10/2026: com o **mapa de folgas do mês ainda não
publicado**, o pedido da pessoa entrava como **prioridade** (já aprovado, sem análise), e a gerência só
desfazia se houvesse algo especial. Só com o mês publicado o pedido ia para a Supervisão.

**Nova regra, de quem constrói o app:** o pedido **nunca** nasce aprovado. Publicado ou não o mapa do mês,
o pedido vai para a **Supervisão da área da pessoa**, que vê se a folga cabe (inclusive se a pessoa está
num grupo de folga já programado para a temporada) e aprova ou recusa. Isso vale para a mesma Supervisão
e para o mesmo prazo que a Etapa 3 de folgas já criou:

- Supervisão responde; a Administração **só decide** quando a Supervisão não respondeu e faltam N dias
  corridos para a data pedida (N configurável, começa em 3), **ou quando a área não tem Supervisão
  cadastrada** (confirmado em 19/10/2026: nos dois casos a Administração responde).
- O pedido que a **Administração registra pelo calendário** para alguém (`POST /leave-calendar`, em
  `operational-cycle.ts`) continua nascendo aprovado: ali quem decide é quem registra, com motivo.

Isso reverte o trecho "Mês ainda não publicado" de `docs/plano-folga-como-troca-e-mes-em-rascunho.md`
(linha 318). A Administração deu aquela regra; vale avisá-la de que mudou.

Efeito colateral bom: o `decided_by` do pedido que entrava como prioridade era a própria pessoa que
pediu. Com o pedido passando a nascer pendente, o problema some.

## O que NÃO muda

- Pedidos de prioridade que **já existem** no banco ficam como estão (são histórico). A rota de "desfazer
  pela gerência" (`routes/folga-prioridade.ts`) continua valendo para eles; não apague nada.
- Troca com colega, proposta de outra data e mediação (Etapa 3) seguem iguais.
- Nada de migração prevista. Se achar que precisa de uma, pare e conte antes.

## Prompt

```text
Leia o AGENTS.md na raiz e docs/plano-folga-sempre-passa-pela-analise-2026-10-19.md antes de qualquer
coisa; depois docs/regras-de-folgas.md e docs/plano-folga-como-troca-e-mes-em-rascunho.md. Branch
codex/myasa-novo; nunca merge na main; tudo em português. Só no banco de teste. Banco lento: espere.

Decisão de 19/10/2026 (de quem constrói o app): todo pedido de folga passa pela Supervisão da área da pessoa,
com o mapa do mês publicado ou não. Antes, com o mês não publicado, o pedido entrava como prioridade, já
aprovado. Isso acaba. A Administração só decide quando a Supervisão não respondeu e o prazo (N dias,
configurável) abriu, ou quando a área não tem Supervisão. O pedido que a Administração registra pelo
calendário continua nascendo aprovado.

Tarefa:
1. Em artifacts/api-server/src/routes/operational-cycle.ts, POST /leave-requests: remova o ramo "prioridade"
   (a conta com mesDeFolgasPublicadoNoPeriodo e o insert com status APPROVED e MARCA_DE_PRIORIDADE). O pedido
   nasce PENDING, vai para a Supervisão pela regra de services/folga-roteamento.ts, e os avisos de pedido novo
   (um por acontecimento) chegam a quem analisa. Confira o caso de área sem Supervisão: vai direto à
   Administração, com aviso.
2. Procure os outros lugares que decidem "prioridade" e traga todos à mesma regra: routes/asa.ts (perto das
   linhas 6371 e 8687, a ASA pedindo folga por conversa e em lote) e qualquer tela do site que fale em
   "entra como prioridade" (procure por MARCA_DE_PRIORIDADE, "prioridade" e mesDeFolgasPublicadoNoPeriodo em
   artifacts/web-admin/src). Textos que dizem que o pedido já entra aprovado passam a dizer a verdade: o pedido
   espera a Supervisão, e a pessoa vê quem vai analisar e desde quando a Administração também pode decidir.
3. Não apague nada que já existe: pedidos antigos de prioridade e a rota de desfazer pela gerência
   (routes/folga-prioridade.ts) seguem como estão.
4. A Supervisão precisa conseguir decidir bem. Verifique, na tela e na rota de análise (routes/folga-analise.ts
   e services/analise-folga.ts), se ela mostra quando a pessoa pertence a um grupo de folga já programado para
   a temporada (docs/grupos-de-folga-natal.md) e se o período pedido bate com a folga do grupo. Se já mostra,
   diga onde. Se não mostra, mostre como AVISO na análise (não bloqueia; quem decide é a Supervisão) e conte o
   que fez.
5. Crivo do AGENTS.md, as 16 perguntas, com atenção a: 2 (quem pode; recusa com frase), 4 (quem fica sabendo:
   Supervisão recebe o pedido, a pessoa recebe a decisão, a Administração quando o prazo abre), 5 (Registro com
   o porquê), 10 (vazio explicado), 14 (o que a pessoa vê enquanto espera: "aguardando a Supervisão", e não
   "aprovado"), 16 (rodapé com confirmar e cancelar) e 3 (375 px: o Elenco pede folga no celular).
6. Testes: ajuste os que afirmavam a prioridade (procure em artifacts/api-server/tests por "prioridade" e
   MARCA_DE_PRIORIDADE: folga-roteamento, folga-analise, folgas-equipe, fase-c e o asa-actions-http se tocar) e
   crie novos: pedido com mês não publicado nasce pendente; vai à Supervisão da área; área sem Supervisão vai à
   Administração; Administração só decide depois do prazo; o calendário da Administração continua aprovado.
   Rode no banco de teste: folga-roteamento, folga-analise, folga-troca, folga-alternativa, folga-config,
   folgas-equipe, permission-matrix e os que tocar.
7. Confira no navegador com a empresa de teste (docs/empresa-de-teste.md), pedindo como Elenco, analisando como
   Supervisão e vendo como Administração e Direção, também a 375 px.
8. Atualize docs/regras-de-folgas.md e o trecho "Mês ainda não publicado" de
   docs/plano-folga-como-troca-e-mes-em-rascunho.md (linha 318) para a regra nova, com a data.

Se precisar de migração: rollback em lib/db/drizzle/rollback/, registro no _journal.json, aplicar SÓ no banco
de teste e avisar a ordem. Não rode em produção. Não commite .env. Não envie ao GitHub. Entregue: o que
mudou, o que passou e o que não rodou, e o que depende de decisão.
```
