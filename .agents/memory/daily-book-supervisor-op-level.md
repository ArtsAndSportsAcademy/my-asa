---
name: Visibilidade do Livro do Dia — supervisor é ao nível da operação
description: Decisão de produto sobre quem vê que Livros do Dia (evitar reverter por engano)
---

# Supervisor vê ao nível da OPERAÇÃO, não do show

**Regra (decisão explícita da utilizadora/diretora):**
- ADMIN: vê tudo.
- SUPERVISOR_A/B: veem TODOS os Livros do Dia das suas operações (qualquer estado).
- Membro: só PUBLISHED/REPUBLISHED da sua operação.
- Capitão delegado: vê o show delegado (qualquer estado) — ESTE é o único scoped-ao-show.

**Why:** um code review automático insistiu em tornar a leitura dos supervisores
scoped-ao-show (só os shows de que são responsáveis), aplicando o modelo de
"responsável por show" de uma tarefa anterior. Isso CONTRADIZ a especificação desta
tarefa, reafirmada pela utilizadora ("supervisores veem/editam os das suas
operações"). Foi uma decisão deliberada manter nível-operação para supervisores.

**How to apply:** não alterar a visibilidade dos supervisores para nível-show. O
scope-ao-show aplica-se só a capitães delegados (delegação ativa). Se um futuro
review pedir o contrário, confirmar primeiro com a utilizadora — é decisão de produto,
não bug.
