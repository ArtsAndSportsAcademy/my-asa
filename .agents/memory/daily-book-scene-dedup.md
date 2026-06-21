---
name: Livro do Dia — pessoa única por cena (com cadeia de substitutos)
description: Regra de negócio: a mesma pessoa não ocupa 2 posições na MESMA cena; quando ocupada, puxa o próximo substituto/rodízio até esgotar
---

# Livro do Dia: pessoa única por cena, encadeando substitutos

**Regra de negócio:** ao gerar/regenerar o Livro do Dia, a mesma pessoa não pode ocupar duas posições dentro da MESMA cena (pode em cenas diferentes). Quando a pessoa preferida já está escalada noutra posição da mesma cena, o lugar tenta o PRÓXIMO da sua cadeia (titular→substituto→seguinte→…) tal como faz com indisponibilidade (folga/atestado). Só fica vazio (OPEN) quando a cadeia se esgota.

**Why:** a usuária pediu (jun/2026): primeiro "não repetir na cena", depois refinou para "encadear substitutos com consciência da cena" — quem já está noutra posição é tratado como indisponível para as posições seguintes daquela cena, puxando o próximo.

**How to apply:**
- A cadeia é responsabilidade do RESOLVER, não de uma limpeza posterior. "Já escalado nesta cena" é tratado igual a "indisponível": some-se ao conjunto de bloqueados antes de escolher o ocupante de cada linha. Tipos com cadeia (titular+substitutos, rodízio) saltam bloqueados; tipos sem alternativa (pessoa fixa, dia-da-semana) ficam OPEN se a única pessoa estiver bloqueada.
- A ocupação acumula-se na ordem determinística cena→bloco→posição→linha; por isso as queries da árvore do showbook desempatam por `order, id` (empate de `order` mudaria quem mantém o titular).
- Papéis LEGADOS/MANUAIS (escala, sem linhas/cadeia) não têm como puxar substituto: para esses mantém-se uma dedup pós-resolução que vira a 2ª ocorrência em OPEN. Invariante crítico: essa dedup pós-hoc NUNCA pode tocar papéis resolvidos por linhas (senão abriria vaga já corretamente resolvida e o contador de rodízio avançaria para quem ficou OPEN). Pré-carregar a ocupação da cena com as pessoas das linhas torna a dedup manual independente da ordem do loop.
- Aplicar nos DOIS fluxos: generate E regenerate. Esquecer um deixa a regra inconsistente.
- O contador de rodízio (rotationWinners) é colhido do resultado do resolver; como papéis de linha nunca viram OPEN depois, o contador reflete sempre quem realmente ficou escalado.
- Fora de escopo: a edição manual (PATCH de assignment) ainda permite duplicar; o preview do Livro do Show não aplica a regra (default desligado).
