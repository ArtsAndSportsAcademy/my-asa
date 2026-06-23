---
name: Visibilidade do Livro do Dia — supervisor é ao nível do SHOW
description: Decisão de produto sobre quem vê que Livros do Dia (evitar reverter por engano)
---

# Supervisor vê só os shows de que é responsável (não toda a operação)

**Regra (decisão explícita da utilizadora/diretora):**
- ADMIN: vê tudo — é quem gere a atribuição de responsáveis.
- SUPERVISOR_A/B: veem APENAS os livros que podem operar (`canViewDailyBook`
  delega em `canOperateDailyBook`): o show de que são responsáveis, um show
  delegado por esse responsável, ou — legado — shows SEM responsável na sua
  operação. NÃO veem os shows de outro supervisor da mesma operação.
- Membro: só PUBLISHED/REPUBLISHED da sua operação.
- Capitão (MEMBER) delegado: o show delegado, mesmo em rascunho.

**Why:** numa primeira iteração assumi (a partir do plano) que supervisor via TUDO
da operação. A utilizadora corrigiu: "os supervisores veem só os livros de que são
responsáveis; o admin é que gere isso e vê tudo; eu só queria organizar por
operação". Ou seja, agrupar por operação é uma mudança de APRESENTAÇÃO (UI), não de
visibilidade. Agrupar ≠ alargar acesso.

**How to apply:** manter `canViewDailyBook` a delegar em `canOperateDailyBook` para
gestores. Não voltar a dar visibilidade ao nível da operação aos supervisores. Se o
agrupamento por operação na UI sugerir que "deviam ver tudo da operação", resistir —
é só organização visual.
