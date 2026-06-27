---
name: Escopo de leitura e isolamento multi-tenant do Livro do Show
description: Regra de autorização para todos os GET de show-book (não vazar entre operações nem entre organizações)
---

# Leitura do Livro do Show: dois eixos de autorização

Todo GET que devolve conteúdo de um Livro do Show tem de aplicar DOIS filtros no
servidor — nunca confiar só na UI nem só em `requireAuth`/`requireOrganization`:

1. **Isolamento por organização (multi-tenant).** O show pertence a uma operação,
   que pertence a uma organização. Validar SEMPRE que a organização do show é a do
   ator — inclusive para ADMIN. Caso contrário, ADMIN de uma org consegue ler/listar
   shows de outra org via API direta. Usar 404 (não 403) no detalhe para não revelar
   a existência de shows alheios.

2. **Escopo de visibilidade dentro da org.** ADMIN vê tudo (da sua org); membro vê
   os shows da SUA operação em qualquer estado (espelha o tab do app); supervisor só
   os que pode operar (responsável/delegado/legado sem responsável).

**Why:** a UI já filtrava, mas os GET só tinham auth+org e deixavam um não-admin ler
shows de outra operação/supervisor, e um ADMIN ler cross-org. Revisão classificou
ambos como broken access control (o cross-org é furo multi-tenant sério).

**How to apply:** centralizar o eixo (1) no carregador único de show (verifica a org
da operação antes de devolver) para cobrir leitura E mutação de uma vez; aplicar o
eixo (2) num guard de leitura partilhado por todos os GET de detalhe; na listagem,
filtrar a org no SQL (join a operations) e depois a visibilidade. Padrão equivalente
já existe no Livro do Dia (derivar operação via join e comparar `organizationId`).
