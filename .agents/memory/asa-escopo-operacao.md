---
name: ASA — escopo de operação (procura e registo de membros)
description: ASA limitava-se a UMA operação; gestores multi-operação não achavam membros e folga ia para operação errada
---

A ASA define operationId = PRIMEIRA role ativa do solicitante (limit(1) na rota /asa). Isso causava 2 bugs para gestores de várias operações:

1. **Não encontra membros de outras operações** — loadOrgMembersAndMemories filtrava membros por ctx.operationId (uma só operação). Sintoma: "consulta o nome muitas vezes e não acha" (o modelo re-tenta quando consultar_membros falha).
   Correção: ADMIN enxerga toda a organização (usersTable.organizationId); supervisores/membros enxergam TODAS as operações onde têm papel ativo (inArray dos operationIds de userRoles).

2. **Folga gravada na operação errada** — coreRegistrarAusencia inseria folgasTable.operationId = ctx.operationId (operação do gestor).
   Correção: gravar na operação do MEMBRO (lookup userRoles ativo do p.userId; fallback ctx.operationId).

**Why:** o produto tem gestores que cobrem várias operações (mesmo motivo do seletor de operação no Livro do Show). Escopo de operação única quebra silenciosamente para eles.

**How to apply:** qualquer tool da ASA que resolve/lista membros ou grava por operação deve considerar o conjunto de operações do solicitante (ou a operação do alvo), não só ctx.operationId. Exceção intencional: consultar_grupo restringe membros à operação atual para montar escala.
