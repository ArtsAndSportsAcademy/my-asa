---
name: ASA — parsing do input das tools no streaming Anthropic
description: input_json_delta vem em fragmentos; parsear cada fragmento isolado deixa o input vazio e a IA chama tools com args ""
---

No loop do agente ASA (artifacts/api-server/src/routes/asa.ts, anthropic.messages.stream), os eventos `input_json_delta` entregam o input das ferramentas em FRAGMENTOS de string (ex.: `{"qu`, `ery":`, `"Aman`, `da"}`). É obrigatório CONCATENAR todos os fragmentos por bloco e fazer `JSON.parse` UMA só vez no `content_block_stop`.

**Bug que existiu:** o código fazia `JSON.parse(event.delta.partial_json)` em cada fragmento dentro de try/catch. Cada fragmento isolado é JSON inválido → catch engolia o erro → `input` ficava `{}`. Resultado: `consultar_membros` (e outras tools) recebiam `query=""` → erro "query é obrigatória" → o modelo repetia a chamada em loop e "nunca achava" o membro, mesmo existindo. Inputs curtos que calhavam vir num único delta funcionavam — daí parecer intermitente.

**Correção:** acumular `partial_json` num buffer por `event.index`; no `content_block_stop` parsear o buffer completo; montar assistantContent ordenado por index.

**Why:** o streaming da Anthropic SEMPRE fragmenta JSON de tools maiores; nunca confiar que um delta é JSON completo.

**How to apply:** qualquer loop que consuma `anthropic.messages.stream` e use tools deve bufferizar input_json_delta por bloco e parsear no stop — não por delta.
