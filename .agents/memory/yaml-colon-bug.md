---
name: YAML plain scalar colon bug
description: Summary strings em openapi.yaml com ": " causam falha silenciosa no orval codegen
---

## Regra
Qualquer campo `summary:` ou `description:` em YAML que contenha `: ` (colon + espaço) dentro do valor deve ser obrigatoriamente colocado entre aspas duplas.

## Exemplo errado
```yaml
summary: List users (Admin: all in org; Supervisor: members of their groups)
```

## Exemplo correto
```yaml
summary: "List users (Admin only: all in org; Supervisor only: scoped to groups)"
```

## Por quê
Em YAML, o colon seguido de espaço dentro de um plain scalar é ambíguo — alguns parsers (incluindo o usado internamente pelo orval) o interpretam como indicador de mapeamento aninhado, causando `Failed to resolve input` sem mensagem de erro útil.

## Como detectar
```bash
grep -n "summary:.*: " openapi.yaml | grep -v '"'
```

## Como aplicar
- Sempre que escrever ou revisar openapi.yaml, verificar que summaries com `:` em qualquer posição do valor estejam entre aspas duplas.
- O orval vai falhar com `"Failed to resolve input: Please provide a valid string value"` — esse erro indica YAML malformado, não problema de paths ou schemas.
