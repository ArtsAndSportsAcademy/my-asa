# MyASA 2.0 — Recuperação Arquitetural do Livro do Show

> **Versão:** 18/06/2026
> **Fase:** Recuperação e Consolidação — antes da modelagem formal de S-13
> **Base:** Arquitetura · Entidade MO · Ciclo de Planejamento · Ciclo de Comunicação · UX Integrado · Wireframes · Auditoria de Encerramento
> **Natureza:** Auditoria de recuperação — consolida o que foi decidido; não cria novas decisões
> **Status:** 🟡 Parcialmente definido — ver Parte 8

---

## Premissa desta recuperação

O Livro do Show nunca foi modelado como entidade central de um documento próprio. Ele existia como infraestrutura implícita: mencionado na arquitetura, referenciado nos ciclos, apontado como dependência nas auditorias. Mas nunca teve ciclo de vida, comportamento de geração, edição ou propagação formalizados.

Esta recuperação não inventa. Ela extrai, organiza e classifica o que o projeto já produziu — e aponta com precisão o que ainda falta.

---

## PARTE 1 — O QUE JÁ SABEMOS

---

### 1.1 Premissas confirmadas pela arquitetura

As seguintes premissas estão explicitamente documentadas no documento de arquitetura (`docs/arquitetura-myasa-2.0.md`):

**Livro do Show = template permanente**
O Livro do Show define a estrutura permanente do espetáculo: quais posições existem, quais funções cada posição exige, quais são as regras de substituição, qual é o elenco base.

**Livro do Dia = instância do Livro do Show**
Gerado automaticamente pelo sistema para uma data específica. Pode ser editado sem alterar o template.

**Dois modelos internos:**
- **Simples:** Papel → Pessoa (espetáculos sem estrutura de cenas)
- **Estruturado:** Cena → Bloco → Posição → Pessoa (espetáculos com estrutura formal)

**Regra de propagação:**
Mudanças no Livro do Show **não alteram automaticamente** Livros do Dia já gerados. Esta decisão é explícita na arquitetura e confirmada na Entidade MO.

**Audiência:**
Admin e Supervisor criam; Supervisor pode editar dentro do escopo; Membro nunca acessa o Livro do Show diretamente.

**Fluxo de geração do Livro do Dia:**
```
Supervisor escolhe a data
↓
Sistema gera proposta considerando:
  - Livro do Show
  - Folgas aprovadas
  - Restrições ativas
  - Disponibilidade dos membros
  - Regras do espetáculo
↓
Supervisor revisa
↓
Supervisor aprova
```

---

### 1.2 Premissas confirmadas pelos ciclos

As seguintes premissas estão documentadas nos ciclos produzidos:

**Motor de candidatos** (Ciclo de Planejamento):
O sistema exclui automaticamente membros com folga aprovada ou restrição ativa ao gerar candidatos para cada posição. O motor opera sobre o Livro do Show como template.

**Tags de exigência operacional** (D-18, Auditoria de Wireframe):
Cada papel no Livro do Show precisa de tags que indiquem quais exigências físicas, técnicas ou artísticas aquela posição demanda. Essas tags permitem que o motor de restrições cruze as restrições do membro com as exigências do papel e elimine candidatos incompatíveis automaticamente.

**Mudança no Livro do Show não gera MO** (Entidade MO):
Mudança estrutural no template não propaga retroativamente. A entidade Mudança Operacional não é gerada por edição do Livro do Show — apenas por edições no Livro do Dia publicado.

**Distinção visual obrigatória** (Wireframes, Auditoria):
O risco de o usuário editar o Livro do Show achando que está editando o Livro do Dia foi identificado como risco crítico. A distinção visual entre os dois precisa ser inescapável.

---

### 1.3 Premissas confirmadas pelo prompt

As seguintes premissas chegam como input do produto owner — tratadas como confirmadas:

**Estrutura hierárquica:**
Show → Cena → Bloco → Posição → Linha

**Tipos de Linha:**
1. Pessoa fixa
2. Personagem
3. Função
4. Rodízio
5. Dia da semana
6. Titular + substituto
7. Manual

**Editabilidade no Livro do Dia:**
O Supervisor pode — sem alterar o Livro do Show:
- Remover cena (para aquele dia)
- Remover bloco (para aquele dia)
- Remover posição (para aquele dia)
- Remover linha (para aquele dia)
- Adicionar linha (para aquele dia)
- Adicionar posição (para aquele dia)
- Adicionar bloco (para aquele dia)
- Reordenar elementos (para aquele dia)

**Ausência possível de cena:**
Uma cena pode existir no Livro do Show e não existir naquele dia. Exemplo: ensaio sem Ato II.

**Mobile e Web:**
O comportamento precisa funcionar igualmente nas duas plataformas.

---

## PARTE 2 — RECUPERAÇÃO DE DECISÕES

---

### CONFIRMADAS

Decisões com base documental explícita em um ou mais documentos do projeto.

| # | Decisão | Base documental |
|---|---|---|
| LS-C01 | Livro do Show é o template. Livro do Dia é a instância. São entidades distintas, não versões da mesma coisa. | Arquitetura |
| LS-C02 | Mudança no Livro do Show não propaga automaticamente para Livros do Dia já gerados. | Arquitetura · Entidade MO |
| LS-C03 | O Livro do Dia é gerado por proposta automática do sistema e aprovado pelo Supervisor. | Arquitetura · Ciclo de Planejamento |
| LS-C04 | A proposta automática considera: Livro do Show + Folgas aprovadas + Restrições ativas + Disponibilidade + Regras do espetáculo. | Arquitetura |
| LS-C05 | Mudança no Livro do Show não gera Mudança Operacional (entidade MO). | Entidade MO |
| LS-C06 | A distinção visual entre Livro do Show e Livro do Dia é inegociável — risco crítico de erro permanente se não for clara. | Wireframes · Auditoria |
| LS-C07 | Tags de exigência operacional são obrigatórias por papel no Livro do Show. São pré-requisito do motor de restrições. | D-18 · Auditoria |
| LS-C08 | Admin cria e gerencia o Livro do Show. Supervisor consulta e pode propor ajustes. Membro nunca acessa diretamente. | Arquitetura · Mapa de Superfícies |
| LS-C09 | O Supervisor pode editar o Livro do Dia (remover, adicionar, reordenar) sem alterar o Livro do Show. | Prompt — premissa confirmada |
| LS-C10 | Uma cena do Livro do Show pode não existir em um Livro do Dia específico. | Prompt — premissa confirmada |
| LS-C11 | A hierarquia é: Show → Cena → Bloco → Posição → Linha. A Linha é a menor unidade. | Prompt — premissa confirmada |
| LS-C12 | Existem 7 tipos de Linha. Cada tipo tem regra de resolução diferente no motor de geração. | Prompt — premissa confirmada |

---

### PROVÁVEIS

Decisões não documentadas explicitamente, mas logicamente exigidas pelas decisões confirmadas. Precisam de validação antes de serem tratadas como confirmadas.

| # | Decisão provável | Por que é implicada |
|---|---|---|
| LS-P01 | A Linha é a unidade de resolução do motor de geração. Para cada Linha, o sistema aplica a regra do seu tipo e determina o candidato. | LS-C11 + LS-C04: a proposta automática precisa de uma unidade de trabalho. |
| LS-P02 | Quando o motor não resolve uma Linha (nenhum candidato disponível), aquela Linha fica como "Em Aberto" no Livro do Dia gerado. | Ciclo de Planejamento: estados de cobertura incluem Em Aberto. |
| LS-P03 | Quando o motor resolve uma Linha mas o candidato tem risco (ex.: restrição próxima da expiração, única opção disponível), aquela Linha fica como "Em Risco". | Ciclo de Planejamento: estado Em Risco foi modelado. |
| LS-P04 | O Livro do Show possui versionamento. Quando é editado estruturalmente, a versão anterior é preservada como referência histórica para Livros do Dia já gerados naquela versão. | LS-C02: se mudança não propaga, o sistema precisa saber qual versão do Show foi usada para gerar cada Livro do Dia. |
| LS-P05 | Quando o Livro do Show é alterado estruturalmente, o sistema sinaliza quais Livros do Dia futuros (ainda não gerados) deverão ser gerados com a nova versão — e quais Livros já gerados podem estar desatualizados em relação ao template. | LS-C02 + Auditoria (DO-01): dependência identificada mas mecanismo não modelado. |
| LS-P06 | Linhas do tipo "Manual" geram automaticamente posição Em Aberto no Livro do Dia. O Supervisor sempre precisa resolver manualmente. | LS-C12: tipo Manual não tem regra automática de resolução. |
| LS-P07 | O Livro do Show Estruturado (Cena → Bloco → Posição → Linha) é o modelo referência. O Livro do Show Simples (Papel → Pessoa) é uma simplificação do mesmo modelo sem hierarquia de cenas. | Arquitetura: dois modelos definidos; o Estruturado tem mais níveis. |
| LS-P08 | Quando o Supervisor remove uma cena do Livro do Dia (LS-C10), todas as posições e linhas daquela cena são marcadas como "não executada neste dia" — não deletadas. O Livro do Show permanece inalterado. | LS-C09 + LS-C10 + LS-C02: a edição é local ao dia, não estrutural. |
| LS-P09 | A Linha do tipo "Titular + Substituto" define a ordem de preferência automática: titular em primeiro; substituto como fallback se titular estiver indisponível. O motor aplica isso sem intervenção do Supervisor. | LS-C04 + LS-C12: a proposta automática precisa saber a ordem de preferência. |
| LS-P10 | Cada Linha tem um campo de exigências herdado das tags de exigência da Posição (LS-C07). As tags vivem na Posição, não na Linha. A Linha herda as exigências da Posição a que pertence. | D-18: tags ficam no papel/posição — o nível mais lógico para uma exigência de habilidade. |

---

### AINDA INCERTAS

Decisões que precisam ser tomadas e que impactam diretamente o design e o desenvolvimento.

| # | Questão em aberto | Impacto |
|---|---|---|
| LS-I01 | **Rodízio:** como o sistema calcula de quem é a vez? Por contador de execuções? Por calendário (semanas pares/ímpares)? Por configuração manual de sequência? | Alto — define o comportamento automático de metade dos tipos de Linha não-triviais |
| LS-I02 | **Dia da semana:** o que acontece quando uma Linha do tipo "Dia da semana" não tem regra para aquele dia específico? Gera Em Aberto ou usa fallback? | Alto — comportamento de exceção não definido |
| LS-I03 | **Aprovação de mudança estrutural no Livro do Show:** Admin pode editar livremente? Exige confirmação de Supervisor responsável? Exige aprovação do Admin de nível superior? | Alto — define quem tem autoridade real sobre o template |
| LS-I04 | **Propagação sinalizada:** quando o Livro do Show muda, o sistema sinaliza os Livros do Dia futuros que precisam ser revisados — mas com que granularidade? Avisa só os Livros afetados pelas posições alteradas, ou todos os Livros futuros daquele Show? | Alto — define o volume de alertas e o trabalho do Supervisor |
| LS-I05 | **Linhas adicionadas pelo Supervisor no Livro do Dia:** quando o Supervisor adiciona uma Linha que não existe no Livro do Show (LS-C09), essa adição é efêmera (existe só naquele dia) ou pode ser "promovida" para o Livro do Show como sugestão de estrutura? | Médio — define se o Livro do Dia pode retroalimentar o Livro do Show |
| LS-I06 | **Cenas opcionais vs. cenas obrigatórias:** existe distinção no Livro do Show entre cenas que sempre acontecem e cenas que são opcionais (ex.: bis, encerramento especial)? | Médio — se existir, a geração automática pode pré-inferir quando incluir ou excluir uma cena |
| LS-I07 | **Modelo Simples vs. Estruturado:** são duas configurações do mesmo Livro ou dois tipos distintos de Livro do Show? Um espetáculo pode migrar de Simples para Estruturado? | Médio — impacta o onboarding e a migração de dados |
| LS-I08 | **Permissão de Supervisor para editar o Livro do Show:** o Supervisor pode editar diretamente (com aprovação do Admin) ou apenas pode solicitar mudanças que o Admin executa? | Médio — define o fluxo de manutenção do template em operação |
| LS-I09 | **Tags de exigência:** são categorizadas (ex.: acrobacia, contorção, técnica vocal) ou são rótulos livres? Quem define as categorias? | Médio — impacta a precisão do motor de restrições (D-18) |
| LS-I10 | **Descontinuação de Show:** quando um espetáculo sai do repertório, o Livro do Show é arquivado? Deletado? Permanece acessível no Histórico? | Baixo para MVP — alto para operações com muitos espetáculos |

---

## PARTE 3 — ESTRUTURA DO LIVRO DO SHOW

---

### 3.1 Hierarquia completa

```
SHOW
│
├── CENA 1
│   ├── BLOCO 1.1
│   │   ├── POSIÇÃO 1.1.1
│   │   │   └── LINHA (tipo: Titular + Substituto)
│   │   │       ├── Titular: Amanda Souza
│   │   │       └── Substituto: Beatriz Lima
│   │   │
│   │   └── POSIÇÃO 1.1.2
│   │       └── LINHA (tipo: Pessoa fixa)
│   │           └── Carlos Andrade
│   │
│   └── BLOCO 1.2
│       └── POSIÇÃO 1.2.1
│           └── LINHA (tipo: Rodízio)
│               ├── Rotação 1: Diana Costa
│               └── Rotação 2: Eduardo Melo
│
├── CENA 2
│   └── BLOCO 2.1
│       └── POSIÇÃO 2.1.1
│           └── LINHA (tipo: Personagem)
│               └── Astrid [qualquer membro habilitado para Astrid]
│
└── CENA 3 (opcional / eventual)
    └── BLOCO 3.1
        └── POSIÇÃO 3.1.1
            └── LINHA (tipo: Manual)
                └── [Supervisor define no dia]
```

---

### 3.2 A menor unidade: a Linha

A **Linha** é a menor unidade operacional do Livro do Show. É o átomo de resolução do motor de geração.

O que uma Linha define:
1. **Qual é o tipo de regra** (os 7 tipos)
2. **Quem pode estar nessa posição** (os candidatos elegíveis)
3. **Como o motor resolve a posição** (automático ou manual)

O que uma Linha **não** define:
- O papel em si (isso é da Posição)
- As exigências físicas/técnicas (isso é da Posição, via tags)
- O horário (isso é do Bloco)

---

### 3.3 Responsabilidades por nível hierárquico

| Nível | O que define | Quem configura |
|---|---|---|
| **Show** | Nome, tipo de espetáculo, duração total, associação com Agenda | Admin |
| **Cena** | Sequência narrativa/operacional, nome, se é opcional | Admin |
| **Bloco** | Intervalo de tempo dentro da cena, ordem de execução | Admin / Supervisor (proposta) |
| **Posição** | Nome do papel, tags de exigência, quantas linhas suporta | Admin |
| **Linha** | Tipo de resolução, candidatos específicos, ordem de preferência | Admin / Supervisor (proposta) |

---

### 3.4 Os 7 tipos de Linha — comportamento de resolução

| Tipo | Resolução automática? | Fallback quando indisponível | Estado gerado se sem resolução |
|---|---|---|---|
| **Pessoa fixa** | ✅ Sim — coloca a pessoa designada | Nenhum automático → Em Aberto | Em Aberto |
| **Personagem** | ✅ Sim — lista membros habilitados para o personagem | Próximo habilitado disponível | Em Aberto se nenhum disponível |
| **Função** | ✅ Sim — lista membros com aquela função | Próxima função compatível disponível | Em Aberto se nenhuma |
| **Rodízio** | ✅ Sim — determina de quem é a vez | Próximo da rotação disponível | Em Aberto se nenhum |
| **Dia da semana** | ✅ Sim — aplica a regra do dia | **LS-I02: não definido** | A definir |
| **Titular + Substituto** | ✅ Sim — tenta Titular; se indisponível, coloca Substituto | Se Substituto também indisponível → Em Aberto | Em Aberto |
| **Manual** | ❌ Não — sempre Em Aberto | Nenhum — o Supervisor resolve sempre | Em Aberto (por design) |

---

## PARTE 4 — GERAÇÃO DO LIVRO DO DIA

---

### 4.1 Como o Livro do Dia nasce

O Livro do Dia nasce em três fases:

---

**Fase 1 — Disparo (automático)**

O disparo da geração ocorre quando:
- O Supervisor abre o Livro do Dia para uma data e ele ainda não existe
- O sistema detecta que um evento da Agenda ainda não tem Livro gerado dentro do horizonte de planejamento

O sistema identifica:
1. Qual Show está associado ao evento daquela data
2. Qual versão do Livro do Show está ativa

---

**Fase 2 — Proposta (automático)**

O sistema gera a proposta linha a linha:

```
PARA CADA Linha no Livro do Show:
  1. Verificar se a Cena daquela Linha existe naquele dia
     → Se não existe: marcar toda a Cena como "Não executada neste dia"
     → Se existe: continuar

  2. Aplicar a regra do tipo da Linha:
     → Pessoa fixa: verificar disponibilidade da pessoa designada
     → Personagem: listar membros habilitados, excluir indisponíveis
     → Função: listar membros com a função, excluir indisponíveis
     → Rodízio: determinar de quem é a vez (LS-I01)
     → Dia da semana: aplicar regra do dia (LS-I02)
     → Titular + Substituto: verificar Titular primeiro, depois Substituto
     → Manual: marcar como Em Aberto imediatamente

  3. Cruzar candidatos restantes com restrições ativas:
     → Verificar tags de exigência da Posição (D-18)
     → Eliminar candidatos cujas restrições ativas conflitem com as exigências
     → Se nenhum candidato restou: Em Aberto
     → Se apenas um candidato restou mas com sinal de risco: Em Risco
     → Se um ou mais candidatos disponíveis: resolver (melhor candidato ou regra de prioridade)

  4. Registrar o resultado para aquela Linha:
     → Pessoa resolvida: Cobert
     → Em Risco: sinalizado com candidato e risco
     → Em Aberto: sem candidato
```

---

**Fase 3 — Revisão e aprovação (manual)**

O Supervisor:
1. Recebe a proposta gerada
2. Vê o resumo de cobertura: X/Y posições cobertas, Z Em Risco, W Em Aberto
3. Intervém nas posições Em Aberto e Em Risco
4. Faz ajustes (usando as ações de LS-C09)
5. Aprova → Livro do Dia publicado
6. Sistema gera Avisos automáticos para todos os membros alocados

---

### 4.2 O que é automático

| Ação | Automático? |
|---|---|
| Disparo da geração quando data ainda não tem Livro | ✅ |
| Aplicação das regras de cada tipo de Linha | ✅ |
| Cruzamento com folgas aprovadas | ✅ |
| Cruzamento com restrições ativas + tags de exigência (D-18) | ✅ |
| Identificação de posições Em Aberto e Em Risco | ✅ |
| Envio de Avisos após publicação | ✅ |
| Atualização do Meu Dia após publicação | ✅ |
| Registro no Histórico | ✅ |

---

### 4.3 O que é manual

| Ação | Manual |
|---|---|
| Revisão da proposta pelo Supervisor | ✅ |
| Resolução de posições Em Aberto | ✅ |
| Ajuste de posições Em Risco | ✅ |
| Aprovação e publicação do Livro | ✅ |
| Adição/remoção/reordenação de elementos (LS-C09) | ✅ |
| Resolução de Linhas do tipo Manual | ✅ (sempre) |
| Republicação após alteração pós-publicação | ✅ |

---

### 4.4 O que gera alertas

| Situação | Alerta gerado | Para quem |
|---|---|---|
| Posição Em Aberto na proposta | Alerta ao Supervisor ao abrir o Livro | Supervisor |
| Posição Em Risco na proposta | Sinalização amarela na posição | Supervisor |
| Única opção disponível para uma posição | Sinalização de fragilidade | Supervisor |
| Livro gerado mas não publicado 48h antes do evento | Lembrete de publicação | Supervisor |
| Candidato resolvido tem restrição que expira antes do evento | Alerta de validade | Supervisor |
| Rodízio com todos os membros da rotação indisponíveis | Alerta crítico | Supervisor |

---

### 4.5 O que gera revisão

| Situação | Gera revisão no Livro do Dia? |
|---|---|
| Folga aprovada após Livro publicado | ✅ Sim — Livro marcado como Desatualizado |
| Restrição registrada que afeta posição do Livro publicado | ✅ Sim — Livro marcado como Desatualizado |
| Substituição confirmada pelo Supervisor (no-show) | ✅ Sim — Livro marcado para republicação |
| Mudança no Livro do Show após Livro do Dia já gerado | ❌ Não automática — sistema sinaliza, Supervisor decide regenerar ou não |
| Cancelamento do evento | ✅ Sim — Livro marcado como Cancelado (estado especial) |
| Membro confirma que não pode comparecer via Mensagem | ❌ Não automático — Supervisor recebe a informação e age manualmente |

---

## PARTE 5 — EDIÇÃO OPERACIONAL

---

### 5.1 Alterações que podem ser feitas apenas no Livro do Dia

Estas alterações são locais — afetam apenas o dia em questão. O Livro do Show permanece inalterado.

| Alteração | Efeito |
|---|---|
| Remover uma Cena para este dia | A cena não é executada; as posições somem do Livro do Dia; o Livro do Show permanece com a cena |
| Remover um Bloco para este dia | As posições daquele bloco somem do Livro do Dia |
| Remover uma Posição para este dia | Aquela posição não precisa de cobertura neste dia |
| Remover uma Linha para este dia | Aquela linha específica não é executada |
| Adicionar uma Linha para este dia | Linha existe apenas neste Livro do Dia; não cria estrutura no Livro do Show |
| Adicionar uma Posição para este dia | Posição existe apenas neste Livro do Dia |
| Adicionar um Bloco para este dia | Bloco existe apenas neste Livro do Dia |
| Reordenar Cenas, Blocos ou Posições para este dia | Ordem local; não altera a ordem canônica do Livro do Show |
| Substituir a pessoa de uma Linha por outra | Gera Mudança Operacional (tipo Mudança de Pessoa) se o Livro já estava publicado |
| Mudar o papel de uma Linha por outro papel | Gera Mudança Operacional (tipo Mudança de Papel) se o Livro já estava publicado |

---

### 5.2 Alterações que obrigam mudança no Livro do Show

Estas alterações são estruturais — impactam todos os shows futuros.

| Alteração | Por que exige Livro do Show |
|---|---|
| Adicionar uma nova Cena permanente | A cena precisa existir no template para ser gerada automaticamente |
| Adicionar uma nova Posição permanente | A posição precisa de tags, tipo de linha e candidatos configurados no template |
| Mudar o tipo de uma Linha de forma permanente | A regra de resolução é definida no template |
| Adicionar um novo membro como Titular de uma Posição permanente | A configuração de quem é o Titular fica no template |
| Mudar as tags de exigência de uma Posição | As tags são da Posição no Livro do Show; mudar para um dia afeta a avaliação do motor |
| Adicionar ou remover Substitutos de uma Linha permanentemente | A lista de substitutos está no template |
| Alterar a sequência canônica de Blocos em uma Cena | A sequência padrão é definida no template |

---

### 5.3 Alterações que nunca podem ser feitas diretamente

| Alteração proibida | Por que |
|---|---|
| Editar o Livro do Show enquanto um Livro do Dia está publicado | Risco de divergência sem vínculo entre versões. A edição do Show deve gerar sinalização explícita de quais Livros futuros precisam ser revisados. |
| Alterar a alocação de um Livro do Dia já Executado | O Livro Executado é somente leitura — é registro histórico permanente |
| Criar uma Linha no Livro do Dia com tipo diferente do tipo definido no Livro do Show para aquela Posição | O tipo da Linha é regra estrutural, não configuração por dia |
| Membro editar o Livro do Dia ou o Livro do Show | O Membro nunca tem acesso de escrita a nenhum Livro |
| Alterar qualquer campo do Livro do Show sem registro no Histórico | Toda edição de template precisa de autoria, timestamp e motivo |

---

## PARTE 6 — RELAÇÃO COM AS OUTRAS ENTIDADES

---

### Livro do Show ↔ Escala

**Relação:** indireta. O Livro do Show não lê a Escala — ele define a estrutura. A Escala contém a alocação real por data. O Livro do Dia é o ponto de encontro entre os dois.

```
Escala (quem está disponível em qual data)
         +
Livro do Show (estrutura do espetáculo)
         =
Livro do Dia (instância resolvida para esta data)
```

**Dependência crítica:** a Escala precisa ter o evento do show registrado antes de o Livro do Dia poder ser gerado. Evento na Escala = existe a necessidade de cobertura. Livro do Show = como cobrir essa necessidade.

---

### Livro do Show ↔ Mudança Operacional

**Relação:** separada — por decisão explícita (Entidade MO).

Mudança no Livro do Show:
- Não gera MO
- Não notifica membros automaticamente
- Registra no Histórico como "edição de template"
- Sinaliza Livros do Dia futuros potencialmente afetados (LS-P05)

Mudança no Livro do Dia publicado:
- Gera MO (tipo Mudança de Pessoa, Mudança de Papel ou Mudança de Livro do Dia)
- Notifica membros afetados
- Exige confirmação

**Regra de fronteira:** a MO nasce no Livro do Dia. O Livro do Show é upstream — mudanças nele chegam ao Livro do Dia na próxima geração, não automaticamente.

---

### Livro do Show ↔ Solicitações

**Relação:** indireta. Uma Solicitação de Ajuste de Escala pode eventualmente levar o Supervisor a identificar que a mudança precisa ser feita no Livro do Show — não apenas no Livro do Dia.

**Fluxo:**
```
Membro solicita ajuste de escala (S-06)
         ↓
Supervisor analisa
         ↓
Se a mudança é permanente: Supervisor edita Livro do Show
Se a mudança é pontual: Supervisor edita o Livro do Dia daquele dia
```

Não existe Solicitação específica de "mudança no Livro do Show" pelo Membro. O Membro não sabe que o Livro do Show existe.

---

### Livro do Show ↔ Avisos

**Relação:** indireta. O Livro do Show nunca gera Avisos. Os Avisos são gerados pela publicação do Livro do Dia — que é gerado a partir do Livro do Show.

**Exceção a verificar (LS-I05):** se uma Linha adicionada pelo Supervisor no Livro do Dia for "promovida" ao Livro do Show, isso poderia eventualmente gerar sinalização para futuros membros — mas esse comportamento não está definido.

---

### Livro do Show ↔ Meu Dia

**Relação:** invisível para o Membro. O Membro nunca vê o Livro do Show — vê apenas o resultado dele: a fatia do Livro do Dia que lhe diz seu papel, seu bloco, seu horário de entrada.

**Implicação de design:** o Livro do Show é infraestrutura. O Membro não precisa — e não deve — ter consciência de que o Livro do Show existe como entidade separada.

---

## PARTE 7 — LACUNAS

---

### Críticas

Lacunas que bloqueiam o desenvolvimento do motor de geração do Livro do Dia e a modelagem de S-13.

**LC-01 — Algoritmo de Rodízio (LS-I01)**
O tipo de Linha "Rodízio" é não-trivial. Sem definir como o sistema calcula de quem é a vez, o motor de geração não pode ser desenvolvido para esse tipo. Opções a decidir: (a) contador de execuções passadas por membro, (b) calendário com regra de semana par/ímpar, (c) sequência configurada manualmente no Livro do Show.

**LC-02 — Fallback de Linha "Dia da semana" (LS-I02)**
O tipo "Dia da semana" tem regra para dias específicos. O que acontece quando o show ocorre em um dia que não tem regra definida? Sem resposta, o motor não sabe o que fazer — e pode gerar comportamento silenciosamente errado.

**LC-03 — Aprovação de mudança estrutural no Livro do Show (LS-I03)**
Sem definir quem pode editar o Livro do Show (Admin livremente? Supervisor com aprovação?), o fluxo de manutenção do template não pode ser modelado. Essa lacuna afeta diretamente o wireframe de S-13.

**LC-04 — Mecanismo de sinalização de Livros futuros (LS-P05 / LS-I04)**
Quando o Livro do Show muda, o sistema precisa sinalizar quais Livros do Dia futuros foram afetados. Sem definir a granularidade (todos os futuros? apenas os das posições alteradas?), o Supervisor pode ter carga de trabalho inesperada ou perder mudanças que o afetam.

**LC-05 — Tags de exigência: taxonomia e responsável (LS-I09)**
As tags são o coração do motor de restrições (D-18). Sem saber se são categorias pré-definidas ou rótulos livres, e sem saber quem define as categorias, o campo não pode ser projetado no wireframe de S-13 nem implementado no motor.

---

### Importantes

Lacunas que impactam comportamentos relevantes mas não bloqueiam a modelagem inicial.

**LI-01 — Promoção de Linha do Livro do Dia ao Livro do Show (LS-I05)**
Quando o Supervisor adiciona uma Linha nova no Livro do Dia, ela é apenas local ou pode ser sugerida como estrutura permanente? Sem isso, o fluxo de retroalimentação entre Livro do Dia e Livro do Show não está definido.

**LI-02 — Cenas opcionais vs. obrigatórias (LS-I06)**
Se existir a distinção entre cenas que sempre acontecem e cenas que são opcionais, o motor pode pré-inferir quando incluir/excluir sem intervenção do Supervisor. Sem isso, o Supervisor precisa excluir manualmente cenas opcionais em cada Livro do Dia.

**LI-03 — Migração de Livro Simples para Estruturado (LS-I07)**
Se um espetáculo começa com modelo Simples e precisa migrar para Estruturado (ou vice-versa), o sistema precisa de um mecanismo de migração. Sem isso, operações em transição ficam presas em um modelo inadequado.

**LI-04 — Permissão do Supervisor para editar Livro do Show (LS-I08)**
Sem saber se o Supervisor edita diretamente ou apenas propõe, o wireframe de S-13 para o perfil Supervisor não pode ser feito com precisão.

---

### Desejáveis

Lacunas que enriqueceriam o produto mas não bloqueiam o MVP.

**LD-01 — Descontinuação de Show (LS-I10)**
Quando um espetáculo sai do repertório: arquivado, acessível no Histórico, vinculado aos Livros do Dia históricos. Importante para operações com muitos espetáculos (ex.: repertório rotativo), mas não crítico para o MVP de um único espetáculo.

**LD-02 — Estatísticas de cobertura por Livro do Show**
Com o tempo, o Livro do Show acumula dados: quais posições historicamente ficaram mais Em Aberto, quais rodízios mais falharam, quais personagens têm menor banco de substitutos. Essas informações poderiam alimentar a IA do Admin (Analista Organizacional). Desejável, não crítico para o MVP.

**LD-03 — Múltiplos Livros do Show por Show**
Um espetáculo pode ter variações de escala (temporada completa vs. edição simplificada). Modelar se o sistema suporta múltiplos Livros do Show para o mesmo espetáculo (com contextos diferentes) é relevante para operações grandes.

---

## PARTE 8 — VEREDITO

---

### Quanto já estava implicitamente definido?

O Livro do Show estava **significativamente mais definido do que aparecia** nos documentos do projeto. A maioria das definições não existia como um documento próprio — estava distribuída como premissa da arquitetura, como regra dos ciclos, como decisão de audit. Este documento apenas as consolidou num único lugar.

---

### Quanto realmente precisava ser modelado do zero?

Precisava ser modelado do zero:
- O algoritmo linha a linha do motor de geração
- As responsabilidades de cada nível hierárquico
- O comportamento de resolução de cada tipo de Linha
- O mapa completo de o que pode e o que não pode ser editado por nível
- As lacunas LC-01 a LC-05 (críticas) — essas genuinamente não existiam como decisão em nenhum lugar

---

### Classificação

## 🟡 Parcialmente definido

**O que estava sólido (≈ 65% do total):**
- A distinção conceitual Livro do Show vs. Livro do Dia
- A hierarquia estrutural (Show → Cena → Bloco → Posição → Linha)
- Os 7 tipos de Linha (premissa confirmada)
- A regra de não-propagação automática
- A audiência e as permissões de alto nível
- A relação com os outros ciclos (MO, Planejamento, Comunicação)
- O fluxo geral de geração (proposta automática → revisão → aprovação)

**O que precisava ser construído (≈ 35% do total):**
- O algoritmo de resolução linha a linha (Fases 1/2/3 desta Parte 4)
- O comportamento de fallback por tipo de Linha
- As lacunas LC-01 a LC-05 — críticas e sem decisão em nenhum documento anterior
- O mapa completo de editabilidade (o que pode no Livro do Dia vs. no Livro do Show)
- O mecanismo de sinalização de Livros futuros quando o Show muda

---

### Próximos passos recomendados

| Prioridade | Ação | Antes de |
|---|---|---|
| 1 | Responder LC-01 (Algoritmo de Rodízio) | Wireframe de S-13 |
| 2 | Responder LC-02 (Fallback de Dia da semana) | Wireframe de S-13 |
| 3 | Responder LC-03 (Aprovação de mudança estrutural) | Wireframe de S-13 |
| 4 | Responder LC-04 (Sinalização de Livros futuros) | Wireframe de S-13 |
| 5 | Responder LC-05 (Taxonomia de tags) | Wireframe de S-13 |
| 6 | Validar LS-P01 a LS-P10 (decisões prováveis) | Desenvolvimento do motor |
| 7 | Modelagem formal de S-13 (wireframes estruturais) | Mockups de S-13 |

---

### Inventário de decisões formalizadas neste documento

| # | Tipo | Decisão |
|---|---|---|
| LS-C01 a LS-C12 | Confirmadas | 12 decisões consolidadas de fontes existentes |
| LS-P01 a LS-P10 | Prováveis | 10 decisões inferidas que precisam de validação |
| LS-I01 a LS-I10 | Incertas | 10 questões em aberto que precisam de decisão |
| LC-01 a LC-05 | Lacunas críticas | 5 lacunas que bloqueiam modelagem e desenvolvimento |
| LI-01 a LI-04 | Lacunas importantes | 4 lacunas relevantes não bloqueantes |
| LD-01 a LD-03 | Lacunas desejáveis | 3 lacunas para V2 |

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Recuperação realizada em 18/06/2026*
*Base: todos os documentos do núcleo operacional produzidos anteriormente*
