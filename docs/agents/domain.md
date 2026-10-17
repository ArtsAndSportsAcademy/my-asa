# Documentação de domínio

Como os skills de engenharia devem consumir a documentação de domínio deste repositório ao explorar o código.

## Antes de explorar, leia

- **`GLOSSARY.md`** na raiz do repositório, ou
- **`GLOSSARY-MAP.md`** na raiz, se existir: ele aponta um `GLOSSARY.md` por contexto. Leia cada um que tocar o assunto.
- **`docs/adr/`**: leia os ADRs que tocam a área em que você vai trabalhar. Em repositórios com vários contextos, veja também `src/<contexto>/docs/adr/` para decisões locais a um contexto.

Se algum desses arquivos não existir, **siga em silêncio**. Não avise da ausência nem sugira criá-los de antemão. O skill `/domain-modeling` (alcançado por `/grill-with-docs` e `/improve-codebase-architecture`) cria esses arquivos aos poucos, quando termos ou decisões são de fato resolvidos.

Este repositório é de **contexto único**: o `GLOSSARY.md` e o `docs/adr/` ficam na raiz. As decisões e os desenhos de tela que já existem em `docs/` (handoffs, `regras-de-folgas.md`, `empresa-de-teste.md`) continuam valendo e não são ADRs.

## Estrutura de arquivos

Repositório de contexto único (este):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Repositório com vários contextos (existe `GLOSSARY-MAP.md` na raiz):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← decisões do sistema inteiro
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← decisões deste contexto
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use o vocabulário do glossário

Quando o seu texto nomear um conceito do domínio (no título de uma issue, numa proposta de refatoração, numa hipótese, no nome de um teste), use o termo como o `GLOSSARY.md` o define. Não escorregue para sinônimos que o glossário evita de propósito.

Se o conceito de que você precisa ainda não está no glossário, isso é um sinal: ou você está inventando uma linguagem que o projeto não usa (repense), ou há uma lacuna de verdade (anote para o `/domain-modeling`).

## Avise quando houver conflito com um ADR

Se o seu texto contradiz um ADR existente, diga isso explicitamente em vez de passar por cima:

> _Contradiz o ADR-0007 (pedidos em event sourcing), mas vale reabrir porque…_
