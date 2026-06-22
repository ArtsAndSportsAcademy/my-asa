---
name: Livro do Show — papéis de gestão e renomear
description: Conjunto canónico de papéis que gerem o Livro do Show e armadilha do gate isAdmin
---

# Permissão de gestão do Livro do Show (web-admin)

## Regra: o conjunto canónico de gestão é ["ADMIN","SUPERVISOR_A","SUPERVISOR_B"]
Todas as páginas de gestão (scales, daily-book, agenda, asa, show-book) devem libertar
edição para os TRÊS papéis. O backend dos PATCH/DELETE de cena/bloco/posição
(show-book.ts) NÃO restringe por papel — só exige auth + organização — por isso o gate
real é o frontend.

**Why:** o `isAdmin` do show-book.tsx era o único outlier que usava só
`ADMIN || SUPERVISOR_A`, deixando o SUPERVISOR_B a ver a página em modo leitura e sem
conseguir renomear/editar. Membros não chegam à edição porque o item não aparece no
menu deles.

**How to apply:** ao criar gates de gestão, usar sempre
`["ADMIN","SUPERVISOR_A","SUPERVISOR_B"].includes(r.role)`, nunca a dupla A-só.

## Renomear (EditableName) deve ser visível sem hover
O lápis de renomear não pode depender de `opacity-0 group-hover:opacity-100` (fica
invisível). Padrão: nome clicável (abre edição) + lápis subtil sempre visível
(`text-muted-foreground/60`).
