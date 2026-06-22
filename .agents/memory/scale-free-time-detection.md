---
name: Tempo livre na escala (deteção de buracos)
description: Como/onde se deteta "tempo livre" por pessoa na escala e porquê é frontend-only
---

A deteção de "tempo livre" (buracos) por pessoa/dia na escala é **read-time no frontend**, sem schema novo e sem backend novo.

**Regra:** tempo livre = complemento dos blocos com hora dentro de uma janela de dia padrão (constantes em scales.tsx: início/fim/gap mínimo). Preenche-se reutilizando o POST de entrada manual (status MANUAL_OVERRIDE) com as horas do buraco; sugere ADM ou tarefa pendente (GET /tasks por operationId+status, agrupada por assigneeId).

**Why:** não existe conceito de jornada/working hours no esquema; adicionar coluna seria possível (aditivo é prod-safe) mas a constante é mais simples e igualmente prod-safe. O objetivo era não partir a app publicada.

**How to apply:**
- Se um bloco do dia não tiver horário, NÃO sugerir tempo livre (bail-out devolvendo lista vazia) — senão a UI sugere um buraco grande mesmo havendo ocupação real não-horária.
- Só mostrar slots a gestores, em pessoa sem folga, e escala não ARQUIVADA.
- Para mudar a janela do dia, é só editar as constantes (não há migração).
