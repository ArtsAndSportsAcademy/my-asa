# MyASA 2.0 — Mapeamento de Jornadas

> Versão: 17/06/2026
> Origem: Arquitetura validada + Pesquisas dos três perfis
> Status: Aprovado para uso em UX e Design System

---

## Sumário

- [Perfil do Supervisor](#perfil-supervisor)
- [Jornadas do Supervisor](#jornadas-supervisor)
- [Perfil do Membro](#perfil-membro)
- [Jornadas do Membro](#jornadas-membro)
- [Perfil do Admin](#perfil-admin)
- [Jornadas do Admin](#jornadas-admin)
- [Mapa Consolidado](#mapa-consolidado)

---

<a name="perfil-supervisor"></a>
## PERFIL — Supervisor

### 1. Objetivo principal
Proteger a operação planejada contra exceções. Garantir que todas as atividades do dia — shows, ensaios, aulas — aconteçam com a cobertura correta, mesmo quando o plano original muda.

### 2. Pergunta central
*"A operação de hoje ainda está protegida?"*

### 3. Estado mental
- Alerta preventivo constante: procura exceções antes que virem crises
- Alta tolerância à mudança; baixa tolerância à surpresa
- Resolve riscos, não pessoas — o foco é operacional, não pessoal
- Pensa em cascata: cada decisão abre consequências em outras partes

### 4. Início do ciclo
O ciclo começa quando o Supervisor abre o produto pela primeira vez no dia — ou quando recebe uma notificação crítica que interrompe a rotina. Não existe um horário fixo: o ciclo pode se reiniciar a qualquer momento com uma nova exceção.

### 5. Ações frequentes
- Verificar exceções ativas ao abrir o app
- Analisar impacto de ausências, folgas e restrições
- Gerar e revisar o Livro do Dia
- Aprovar ou negar solicitações de folga com análise de impacto
- Publicar a Escala após validação
- Comunicar alterações e monitorar confirmação
- Buscar substitutos usando classificação por risco

### 6. Decisões principais
- Aprovar ou negar uma folga considerando o impacto operacional completo
- Escolher o substituto com menor risco total (incluindo cascata)
- Decidir se publica a Escala com alertas pendentes
- Decidir se cancela ou mantém uma atividade com cobertura insuficiente
- Priorizar qual exceção resolver primeiro quando existem múltiplas

### 7. Informações necessárias em cada momento
- Status atual da operação (pronta / alertas / crítico)
- Lista de exceções ativas e seu impacto por atividade
- Disponibilidade de cada membro com restrições visíveis
- Alternativas de substituição classificadas por risco
- Efeito cascata de cada decisão de substituição
- Status de confirmação pós-comunicação
- Visão multi-horizonte (hoje, amanhã, semana)

### 8. Riscos e ansiedades
- Não perceber uma exceção antes que ela afete a execução
- Resolver um problema e criar dois outros invisíveis (cascata)
- Aprovar folgas separadamente sem ver o impacto acumulado
- Comunicar uma mudança e não ter certeza se todos confirmaram
- Perder a visão do todo ao se aprofundar em um problema específico

### 9. Momentos de comunicação
- Após publicar Escala: notificação automática para membros afetados
- Após substituição: confirmação direcionada ao membro afetado
- Aviso operacional geral: quando existe mudança que afeta o grupo inteiro
- Mensagem direta: quando a situação exige contexto ou conversa
- Monitoramento de confirmação: quem ainda não confirmou a mudança

### 10. Uso da IA
- Triagem automática de exceções ao abrir o app
- Análise de impacto de uma ausência em todas as atividades do dia
- Classificação de alternativas de substituição por risco (4 camadas)
- Simulação de efeito cascata antes de confirmar substituição
- Geração da proposta do Livro do Dia
- Identificação de riscos futuros (planejamento semanal)
- Monitoramento proativo de confirmações pendentes

### 11. Estados de sucesso
- Todas as atividades do dia estão cobertas
- Exceções foram resolvidas antes de afetar a execução
- Todos os membros afetados confirmaram as mudanças
- Livro do Dia aprovado sem posições críticas em aberto
- Escala publicada sem alertas críticos pendentes

### 12. Estados de falha
- Exceção descoberta após o início da atividade
- Substituição gera novo conflito não percebido
- Comunicação enviada mas membro não confirmou — execução comprometida
- Múltiplas folgas aprovadas separadamente que juntas descobrem uma função crítica
- Livro do Dia publicado com erro de cobertura

### 13. Exceções comuns
- No-show (membro não aparece sem aviso prévio)
- Restrição emergencial (lesão, problema de saúde)
- Cancelamento de show de última hora
- Múltiplos membros ausentes no mesmo dia
- Conflito de horário descoberto após publicação
- Supervisor de outro grupo entra em conflito de alocação

### 14. Pontos de contato com outros perfis
- Membro: recebe notificação de mudança → confirma ou não confirma
- Membro: cria Solicitação → Supervisor analisa
- Admin: Supervisor escalona problema que não consegue resolver sozinho
- Admin: Admin cria Avisos que afetam o grupo do Supervisor
- Admin: Admin configura Grupos que definem o escopo do Supervisor

### 15. O que o sistema precisa garantir
- Exceções sempre aparecem antes que o Supervisor precise procurar
- Impacto de cada decisão é visível antes da confirmação
- Alternativas são classificadas — nunca apresentadas como lista plana
- Cascata é visível antes de confirmar substituição
- Confirmação de comunicação é acompanhável em tempo real
- Multi-horizonte disponível sem troca de tela
- IA entende linguagem natural e contexto operacional — não exige comandos formais

---

<a name="jornadas-supervisor"></a>
## JORNADAS — Supervisor

---

### JS-01 — JORNADA PRINCIPAL: Início do Dia Operacional

**Tipo:** Principal — acontece todos os dias, múltiplas vezes ao dia

**Gatilho:** Supervisor abre o aplicativo pela primeira vez no dia (ou após notificação crítica)

**Contexto:** O Supervisor está se preparando para o dia. Pode estar em qualquer lugar — backstage, área de trabalho, caminho para a operação. Precisa entender rapidamente o estado da operação antes de agir.

**Passo a passo:**

1. **Abertura** → O sistema exibe imediatamente o status da operação
   - Informação necessária: status geral (pronta / alertas / crítico), número de exceções ativas, próxima atividade em risco
   - Decisão: precisa agir agora ou pode acompanhar?

2. **Se status = pronta** → Supervisor vê visão do dia e da semana
   - Informação necessária: atividades do dia, cobertura geral, riscos previsíveis nas próximas 48h
   - Decisão: existe algo que precisa preparar antecipadamente?

3. **Se status = alertas** → Sistema exibe lista de exceções por prioridade
   - Informação necessária: qual exceção tem maior impacto, quais atividades afeta, qual a urgência de cada uma
   - Decisão: qual exceção resolver primeiro?

4. **Se status = crítico** → Sistema exibe a exceção crítica em destaque com impacto imediato
   - Informação necessária: qual atividade está em risco, em quanto tempo começa, alternativas disponíveis
   - Decisão: age imediatamente (entra em JS-03) ou avalia se existe tempo

5. **Revisão do multi-horizonte** → Após resolver ou registrar exceções imediatas
   - Informação necessária: riscos dos próximos 3 dias, folgas aprovadas com impacto, coberturas frágeis
   - Decisão: precisa agir agora ou pode planejar?

**Possíveis falhas:**
- Sistema mostra lista de atividades em vez de status → Supervisor precisa fazer triagem manual
- Exceção não aparece porque não foi registrada a tempo
- Multi-horizonte exige troca de tela → Supervisor perde o fio da meada

**Como o MyASA reduz risco:**
- Status sempre é o primeiro elemento visível
- Triagem de exceções por impacto e urgência — não por ordem de criação
- Multi-horizonte disponível na mesma superfície sem navegação adicional

**Como a IA pode ajudar:**
*"Bom dia. Detectei 2 exceções desde ontem. Amanda solicitou folga para hoje e ainda não foi analisada. O Musical das 12h30 está em risco de cobertura."*

**Resultado esperado:** Supervisor sabe exatamente o estado da operação e qual é a próxima ação necessária em menos de 30 segundos.

**Critério de sucesso:** Nenhuma exceção impacta a execução sem que o Supervisor tenha tido oportunidade de agir.

---

### JS-02 — JORNADA SECUNDÁRIA: Análise e Decisão de Folga Solicitada

**Tipo:** Secundária — acontece múltiplas vezes por semana

**Gatilho:** Membro cria uma Solicitação de folga / Supervisor recebe notificação de nova solicitação

**Contexto:** O Supervisor precisa analisar a solicitação antes de qualquer decisão. A análise não é sobre a pessoa — é sobre o impacto operacional daquela ausência.

**Passo a passo:**

1. **Recebimento da solicitação** → Sistema exibe a solicitação com contexto automático
   - Informação necessária: quem solicitou, para qual data, qual o motivo declarado
   - Decisão: —

2. **Análise de impacto automática** → Sistema calcula impacto antes de mostrar opções de decisão
   - Informação necessária: quais atividades essa pessoa cobre naquela data, quais papéis são exclusivos, quais têm alternativa
   - Decisão: o impacto é gerenciável ou crítico?

3. **Verificação de cobertura** → Sistema mostra alternativas disponíveis para cada papel afetado
   - Informação necessária: quem pode cobrir cada papel, com qual nível de risco, se existem outros pedidos de folga para a mesma data
   - Decisão: existe cobertura suficiente para aprovar?

4. **Verificação de acumulação** → Sistema mostra folgas já aprovadas para a mesma data no grupo
   - Informação necessária: quantas pessoas já estão de folga, qual o percentual de cobertura do grupo, se existe risco acumulado
   - Decisão: essa folga individualmente gerenciável causa problema quando somada às anteriores?

5. **Decisão: Aprovar / Negar / Negociar**
   - Aprovar → Sistema registra, atualiza Escala automaticamente, notifica membro
   - Negar → Supervisor informa motivo (obrigatório) → membro recebe notificação com contexto
   - Negociar → Supervisor propõe data alternativa → membro recebe proposta

6. **Pós-decisão: confirmação do membro**
   - Informação necessária: o membro confirmou? Existe alguma dúvida?

**Possíveis falhas:**
- Supervisor aprova sem ver o acumulado de folgas → descoberta crítica de cobertura
- Motivo da negativa não é comunicado → membro sente decisão injusta e perde confiança
- Análise de impacto não inclui todas as atividades → Supervisor decide com informação incompleta

**Como o MyASA reduz risco:**
- Análise de impacto automática — o sistema faz antes de mostrar "Aprovar/Negar"
- Acumulado de folgas visível na mesma tela — não exige navegação adicional
- Motivo da negativa obrigatório para envio — sistema não permite negar sem explicação

**Como a IA pode ajudar:**
*"Amanda solicitou folga no sábado 21. Ela é titular de Astrid no Musical das 14h e única disponível para o Bloco 3 do ensaio das 16h. Cobertura disponível: Júlia pode cobrir Astrid (baixo risco). Bloco 3 ficaria descoberto. Recomendo negociar data alternativa ou cobrir o ensaio com reposição."*

**Resultado esperado:** Decisão tomada com visibilidade total do impacto. Membro recebe resposta com contexto.

**Critério de sucesso:** A operação da data solicitada continua coberta após a decisão, ou o membro entende claramente por que a folga foi negada.

---

### JS-03 — JORNADA CRÍTICA: Substituição por Ausência (No-Show / Exceção Emergencial)

**Tipo:** Crítica — acontece com frequência variável, sempre com urgência alta

**Gatilho:** Membro não aparece / Restrição emergencial registrada / Notificação de ausência inesperada

**Contexto:** Situação de urgência. Pode acontecer minutos antes de um show, durante um ensaio, ou horas antes. O tempo disponível determina a estratégia. O Supervisor está provavelmente em movimento, não sentado.

**Passo a passo:**

1. **Detecção da exceção** → Sistema alerta com status crítico
   - Informação necessária: quem está ausente, quais atividades impacta, qual é a atividade mais urgente (a que começa mais cedo)
   - Decisão: qual atividade tem prioridade máxima?

2. **Análise de impacto da ausência** → Sistema lista todas as atividades afetadas com horários
   - Informação necessária: para cada atividade — horário de início, nível de risco (mostra em 20min, em 2h), se existe alguma cobertura já definida
   - Decisão: resolver tudo agora ou priorizar pelo tempo?

3. **Busca de alternativas para a atividade prioritária** → Sistema apresenta candidatos classificados por risco (4 camadas)
   - Informação necessária:
     - Camada 1 (eliminatória): disponível, sem folga, sem restrição, sem conflito de horário
     - Camada 2 (artística): conhece o papel, é titular ou substituto habitual
     - Camada 3 (operacional): a troca não gera novos conflitos
     - Camada 4 (segurança): sem risco físico, qualidade mantida
   - Decisão: qual candidato escolher?

4. **Simulação de cascata** → Sistema mostra o que acontece em outras atividades se esse candidato for movido
   - Informação necessária: quais posições esse candidato já ocupa, quais ficam descobertas com o movimento
   - Decisão: o benefício de mover esse candidato supera o risco criado em outras posições?

5. **Confirmação da substituição** → Supervisor confirma → Sistema atualiza Escala e Livro do Dia automaticamente
   - Informação necessária: resumo do que mudou, quem é afetado, o que será comunicado
   - Decisão: —

6. **Comunicação direcionada** → Sistema envia notificação ao membro substituído e ao membro substituto
   - Informação necessária: o que mudou, onde, quando, o que cada um precisa fazer
   - Decisão: aviso é suficiente ou precisa de confirmação explícita?

7. **Monitoramento de confirmação** → Sistema mostra quem confirmou e quem não confirmou
   - Informação necessária: há quanto tempo a notificação foi enviada, quanto tempo falta para a atividade começar
   - Decisão: renotificar / contato direto / ação de contingência?

8. **Resolver próxima atividade afetada** → Repete o ciclo para cada atividade ainda descoberta

**Possíveis falhas:**
- Substituição cria cascata não percebida → nova crise ao lado da anterior
- Candidato selecionado não tem preparo artístico suficiente → risco de qualidade ou segurança
- Membro não confirma e o sistema não alerta antes do início da atividade
- Supervisor perde o fio entre múltiplas substituições simultâneas

**Como o MyASA reduz risco:**
- Candidatos nunca apresentados como lista plana — sempre classificados por risco total
- Cascata sempre visível antes da confirmação
- Monitoramento de confirmação com alerta progressivo por proximidade do horário
- Sistema resolve o problema de análise; Supervisor decide

**Como a IA pode ajudar:**
*"A ausência da Carol afeta 3 atividades. O Musical das 12h30 começa em 18 minutos — prioridade máxima. Recomendo Amanda: única com Astrid disponível e sem conflitos. Isso deixa o Ensaio das 14h sem bloco 3 — Beatriz pode cobrir com ajuste menor."*

**Resultado esperado:** Todas as atividades afetadas têm cobertura definida. Todos os envolvidos confirmaram.

**Critério de sucesso:** Nenhuma atividade começa sem cobertura confirmada pelo responsável.

---

### JS-04 — JORNADA SECUNDÁRIA: Geração e Publicação do Livro do Dia

**Tipo:** Secundária — acontece diariamente ou na véspera

**Gatilho:** Supervisor decide preparar o Livro do Dia para uma data (hoje ou futura)

**Contexto:** O Supervisor está em modo de planejamento. Não é urgência — é preparação. Pode acontecer no dia anterior, na manhã do dia, ou com vários dias de antecedência para datas críticas.

**Passo a passo:**

1. **Seleção da data** → Supervisor escolhe a data para gerar o Livro
   - Informação necessária: datas com shows confirmados na Agenda, datas com folgas já aprovadas, datas com restrições ativas
   - Decisão: qual data priorizar?

2. **Geração automática pelo sistema** → Sistema propõe o Livro do Dia considerando:
   - Livro do Show (estrutura base)
   - Folgas aprovadas para a data
   - Restrições ativas de cada membro
   - Disponibilidade geral
   - Regras do espetáculo
   - Informação necessária: a proposta gerada (posições cobertas, posições com risco, posições em aberto)
   - Decisão: —

3. **Revisão pelo Supervisor** → Sistema apresenta o Livro com status por posição
   - Informação necessária:
     - Posições 100% cobertas (não exigem ação)
     - Posições com risco (cobertura disponível mas não ideal)
     - Posições em aberto (sem cobertura definida — exigem ação imediata)
   - Decisão: quais posições ajustar?

4. **Ajuste de posições problemáticas** → Para cada posição em aberto, o Supervisor usa o fluxo de substituição (similar ao JS-03 sem urgência)
   - Informação necessária: candidatos disponíveis para aquela posição e data, riscos associados
   - Decisão: quem aloca?

5. **Aprovação do Livro do Dia** → Supervisor aprova após revisar todas as posições
   - Informação necessária: resumo do Livro — cobertura total, posições ajustadas, alertas restantes
   - Decisão: aprova com alertas ou resolve todos antes?

6. **Publicação da Escala** → Supervisor decide publicar (pode ser momento diferente da aprovação do Livro)
   - Informação necessária: validações do sistema (conflitos de horário, pendências abertas, membros não alocados), alertas restantes
   - Decisão: publicar mesmo com alertas ou resolver primeiro?

7. **Pós-publicação** → Sistema atualiza Meu Dia de todos os membros afetados e envia notificações

**Possíveis falhas:**
- Livro gerado com dados desatualizados (restrição registrada depois da geração)
- Supervisor aprova Livro com posição crítica em aberto sem perceber
- Publicação acontece sem que todos os afetados sejam notificados
- Mudança no Livro do Show não é percebida antes da geração

**Como o MyASA reduz risco:**
- Proposta gerada automaticamente — Supervisor revisa, não constrói
- Status por posição (coberta / risco / aberto) é imediato e visual
- Validações obrigatórias antes da publicação — não como bloqueio mas como visibilidade
- Notificações automáticas pós-publicação

**Como a IA pode ajudar:**
*"O Livro do Dia de sábado está 85% pronto. Uma posição em aberto: Astrid no Musical das 14h. Amanda está disponível e é a titular — recomendo. Atenção: 3 folgas aprovadas nessa data. A cobertura do Grupo B está no limite mínimo."*

**Resultado esperado:** Livro do Dia aprovado com todas as posições cobertas. Escala publicada. Todos os membros notificados.

**Critério de sucesso:** Zero posições críticas em aberto no Livro do Dia no momento da publicação.

---

### JS-05 — JORNADA SECUNDÁRIA: Comunicação Pós-Alteração Operacional

**Tipo:** Secundária — acontece sempre que existe uma alteração que afeta membros

**Gatilho:** Qualquer alteração na Escala ou Livro do Dia que afeta a programação de um ou mais membros

**Contexto:** A operação mudou. O Supervisor precisa garantir que todos os afetados sabem o que mudou e estão prontos para executar. A pergunta não é "avisei?" — é "eles sabem o que precisam fazer?"

**Passo a passo:**

1. **Sistema gera lista de afetados** → Automático após qualquer alteração publicada
   - Informação necessária: quem foi afetado, o que mudou para cada um, qual o nível de criticidade da mudança
   - Decisão: —

2. **Envio de notificações** → Automático para todos os afetados com o nível correto (Informativo / Importante / Crítico)
   - Informação necessária: canal escolhido (push + in-app), nível de urgência
   - Decisão: a notificação automática é suficiente ou precisa de mensagem personalizada?

3. **Monitoramento de confirmação** → Sistema mostra em tempo real quem confirmou
   - Informação necessária:
     - Confirmados (visualizaram e confirmaram)
     - Visualizaram mas não confirmaram
     - Ainda não visualizaram
     - Quanto tempo falta para a atividade começar
   - Decisão: renotificar? Contato direto?

4. **Se membro não confirma próximo ao horário** → Sistema alerta proativamente
   - Informação necessária: membro X não confirmou, atividade começa em Y minutos
   - Decisão: renotificar via app / contato direto / acionar contingência?

5. **Fechamento do ciclo** → Todos confirmaram ou atividade já iniciou

**Possíveis falhas:**
- Membro não recebe notificação (push desativado, sem conexão)
- Membro vê notificação mas não lê o conteúdo da mudança
- Supervisor assume que "notificado = ciente" sem verificar confirmação
- Mudança crítica enviada como nível informativo — não chama atenção adequada

**Como o MyASA reduz risco:**
- Monitoramento de confirmação em tempo real — não apenas "enviado"
- Mudanças críticas com confirmação de leitura obrigatória
- Alerta proativo por proximidade de horário — "Carlos não confirmou, show em 15 minutos"
- Mudanças operacionais persistem no Meu Dia do membro até confirmação

**Como a IA pode ajudar:**
*"Alteração publicada para o show das 12h30. 2 membros ainda não confirmaram: Carlos (20 min sem resposta) e Beatriz (5 min). Quer renotificar Carlos agora? A atividade começa em 12 minutos."*

**Resultado esperado:** 100% dos afetados confirmaram a mudança antes do início da atividade.

**Critério de sucesso:** Zero membros iniciam uma atividade sem ter confirmado a programação correta.

---

### JS-06 — JORNADA EVENTUAL: Planejamento Semanal

**Tipo:** Eventual — acontece uma vez por semana ou antes de períodos críticos

**Gatilho:** Supervisor decide revisar a semana / sistema alerta sobre riscos futuros identificados

**Contexto:** Modo de planejamento preventivo. Sem urgência imediata. O objetivo é identificar riscos antes que virem crises — a semana ainda pode ser reorganizada.

**Passo a passo:**

1. **Visão da semana** → Supervisor acessa horizonte de 7 dias
   - Informação necessária: atividades da semana, folgas aprovadas por dia, coberturas frágeis por dia, concentração de riscos

2. **Identificação de dias críticos** → Sistema destaca dias com maior risco
   - Informação necessária: dias com mais de X% do grupo de folga, dias com posições críticas sem cobertura confirmada, dias com eventos especiais ou shows importantes

3. **Ação preventiva por dia crítico** → Para cada dia identificado:
   - Informação necessária: o que pode ser feito agora para reduzir o risco?
   - Decisão: antecipar substituições, negociar trocas, solicitar confirmações?

4. **Registro de riscos** → Supervisor registra decisões e planos preventivos

**Como a IA pode ajudar:**
*"Na sexta existe risco elevado: 3 folgas aprovadas e função Astrid com apenas 1 substituto disponível. Recomendo confirmar a disponibilidade de Júlia com antecedência."*

---

### JS-07 — JORNADA EVENTUAL: Criação de Entrega para Membro

**Tipo:** Eventual — acontece periodicamente conforme necessidades artísticas e operacionais

**Gatilho:** Supervisor identifica necessidade de tarefa específica para um ou mais membros

**Contexto:** O Supervisor não está em modo de urgência. Está estruturando uma expectativa formal para que o membro saiba exatamente o que precisa entregar, quando e como será avaliado.

**Passo a passo:**

1. **Criação da Entrega** → Supervisor define:
   - Tipo (Tarefa simples / Projeto / Entrega digital / Avaliação presencial)
   - Objetivo claro (o que é esperado)
   - Critério de avaliação (como será avaliado)
   - Prazo com data e horário exatos
   - Destinatário(s)

2. **Envio** → Sistema notifica o(s) membro(s) com todos os detalhes
   - Informação necessária: membro recebeu e visualizou?

3. **Acompanhamento** → Supervisor monitora status das entregas do grupo
   - Informação necessária: quantas pendentes, quantas em análise, quais perto do prazo sem envio

4. **Revisão e feedback** → Supervisor recebe entrega, analisa, decide:
   - Aprovar → ciclo encerrado
   - Solicitar ajuste → Supervisor descreve o que precisa ser corrigido → membro reenvia
   - Negar → motivo obrigatório

**Possíveis falhas:**
- Objetivo mal definido → membro entrega algo diferente do esperado
- Prazo sem horário específico → interpretações diferentes
- Feedback genérico → membro não sabe o que corrigir
- Supervisor não acompanha → prazo passa sem revisão

**Como o MyASA reduz risco:**
- Campos obrigatórios para objetivo, critério e prazo na criação
- Prazo exige data e horário — não aceita "sexta" sem horário
- Status de entrega sempre visível para o Supervisor

---

### JS-08 — JORNADA CRÍTICA: Múltiplas Exceções Simultâneas

**Tipo:** Crítica — acontece raramente, mas com alto impacto

**Gatilho:** Dois ou mais membros ausentes no mesmo dia / Conjunto de folgas + restrições + no-show simultâneos

**Contexto:** A operação está sob pressão múltipla. O Supervisor precisa fazer triagem de prioridades antes de tentar resolver qualquer coisa. Resolver a exceção errada primeiro pode piorar a situação geral.

**Passo a passo:**

1. **Triagem por impacto e urgência** → Sistema prioriza automaticamente as exceções
   - Informação necessária: qual atividade está em maior risco, qual começa mais cedo, qual tem menos cobertura disponível
   - Decisão: resolver exceção A antes de B ou é possível resolver em paralelo?

2. **Análise de cobertura global** → Sistema mostra o estado geral após todas as ausências
   - Informação necessária: quais posições estão descobertas considerando todas as ausências simultaneamente (não individualmente)
   - Decisão: é possível cobrir tudo ou existe atividade que precisa ser cancelada/adaptada?

3. **Resolução sequencial ou delegada** → Supervisor resolve a exceção mais crítica primeiro
   - Repete JS-03 para cada exceção, considerando que os candidatos disponíveis para a primeira afetam os disponíveis para as seguintes

4. **Comunicação consolidada** → Após resolver todas, comunicação pode ser consolidada ou individual por atividade

**Possíveis falhas:**
- Resolver exceções isoladamente sem ver o impacto cruzado
- Usar o mesmo candidato para múltiplas coberturas sem perceber a sobrecarga
- Ficar preso na primeira exceção sem perceber que a segunda é mais urgente

**Como o MyASA reduz risco:**
- Visão global de todas as exceções antes de resolver qualquer uma
- Candidatos já marcados como "alocado" em outra exceção não aparecem como disponíveis
- Triagem automática por impacto e urgência — não por ordem de chegada

---

### JS-09 — JORNADA CRÍTICA: Cancelamento de Show

**Tipo:** Crítica — rara, com impacto máximo

**Gatilho:** Decisão de cancelar um show (por condições técnicas, por problema operacional, por força maior)

**Contexto:** O cancelamento é um evento extremo que precisa de documentação cuidadosa. O Supervisor (ou Admin) toma a decisão. O sistema precisa perguntar se o impacto na Escala deve ser propagado.

**Passo a passo:**

1. **Registro do cancelamento** → Sistema pergunta: "Impactar Escala?"
   - Se sim: remove atividade, recalcula disponibilidade, atualiza Meu Dia, envia notificação crítica para todos os afetados
   - Se não: registra apenas no histórico operacional sem alterar Escala

2. **Comunicação crítica** → Notificação de nível Crítico para todos os membros da atividade
   - Confirmação de leitura obrigatória para todos

3. **Monitoramento de confirmação** → Idêntico ao JS-05 mas com urgência máxima

4. **Registro no histórico** → Toda alteração registrada automaticamente com quem, quando e motivo

---

<a name="perfil-membro"></a>
## PERFIL — Membro

### 1. Objetivo principal
Executar corretamente sua parte na operação. Para isso, precisa de clareza constante sobre o que deve fazer, quando, como, e se algo mudou desde a última vez que verificou.

### 2. Pergunta central
*"O que eu preciso fazer hoje — e mudou alguma coisa?"*

### 3. Estado mental
- Busca confirmação, não novidades
- Existe sempre uma dúvida silenciosa: *"será que mudou alguma coisa?"*
- Alta sensibilidade a mudanças não comunicadas a tempo
- Confiança construída pela previsibilidade do sistema, não pela velocidade
- Ansiedade gerada pelo silêncio sem significado — não saber o que está acontecendo com suas solicitações e entregas

### 4. Início do ciclo
O ciclo começa quando o Membro abre o produto para verificar o dia. Pode acontecer pela manhã antes de sair de casa, no caminho para o trabalho, ou no backstage. O ciclo secundário começa quando o Membro cria uma solicitação, recebe uma entrega, ou descobre uma mudança inesperada.

### 5. Ações frequentes
- Abrir Meu Dia para verificar programação e mudanças
- Confirmar leitura de alterações recebidas
- Criar solicitações (folga, restrição, troca, ajuste)
- Acompanhar status de solicitações em aberto
- Receber e executar entregas
- Enviar entregas e aguardar feedback
- Consultar dúvidas rápidas (personagem, horário, prazo)

### 6. Decisões principais
- Confirmar ou questionar uma mudança recebida
- Criar ou não criar uma solicitação formal
- Quando e como reportar uma restrição
- Priorizar qual entrega pendente resolver primeiro
- Quando consultar a IA vs. perguntar para uma pessoa

### 7. Informações necessárias em cada momento
- Próximo compromisso (show, ensaio, aula, reunião)
- O que mudou desde a última vez que abriu o app
- Status das solicitações em aberto
- Status das entregas em andamento
- Avisos não lidos relevantes para ele
- Respostas rápidas a dúvidas operacionais do dia

### 8. Riscos e ansiedades
- Chegar com figurino errado por não saber que o personagem mudou
- Perder um ensaio por não ter recebido a confirmação de criação
- Não saber o que aconteceu com uma solicitação enviada há dias
- Não entender o que é esperado em uma entrega
- Ser responsabilizado por algo que não sabia
- Ter que perguntar várias vezes a mesma coisa (gera vergonha e incomoda o Supervisor)

### 9. Momentos de comunicação
- Confirmação de alterações recebidas no Meu Dia
- Mensagem direta ao Supervisor quando precisa de contexto adicional
- Criação de Solicitação (forma estruturada de pedido)
- Envio de Entrega com possível comentário
- Pergunta à IA antes de incomodar o Supervisor

### 10. Uso da IA
- *"O que mudou hoje?"*
- *"Que personagem faço no show das 14h?"*
- *"Preciso chegar mais cedo?"*
- *"Qual o status da minha solicitação de folga?"*
- *"O que é esperado nesta entrega?"*
- *"Existe alguma novidade que preciso saber antes de ir?"*
- *"Existe algum aviso importante que não li?"*

### 11. Estados de sucesso
- Abre o Meu Dia e sabe exatamente o que fazer no dia sem perguntar a ninguém
- Mudanças chegam antes que afetem a execução
- Solicitações têm estado visível — sabe em que fase está
- Entregas têm expectativa clara — não existe dúvida sobre o que é "fazer certo"
- Feedbacks chegam com clareza suficiente para agir

### 12. Estados de falha
- Chegar ao trabalho sem saber de uma mudança
- Solicitação enviada sem resposta por dias — sem saber se foi lida
- Entrega feita "do jeito que achou certo" — e estar errado
- Receber um "não" sem entender o motivo
- Precisar perguntar para três pessoas para descobrir um fato simples

### 13. Exceções comuns
- Mudança de personagem de última hora
- Ensaio extra adicionado sem aviso antecipado suficiente
- Solicitação negada sem contexto
- Entrega com prazo ambíguo
- Aviso importante enterrado entre outros avisos menos urgentes
- Substituição emergencial que afeta o Membro sem notificação clara

### 14. Pontos de contato com outros perfis
- Supervisor: recebe alterações de escala → confirma
- Supervisor: cria solicitações → Supervisor analisa e decide
- Supervisor: recebe entregas do Supervisor → executa → Supervisor avalia
- Admin: pode receber Avisos do Admin diretamente (escopo multi-operação)
- Admin: solicitações podem ser aprovadas pelo Admin se Supervisor não responder

### 15. O que o sistema precisa garantir
- Meu Dia sempre reflete a versão mais atual da programação
- Alterações persistem visíveis até confirmação explícita
- Estado de todas as solicitações e entregas sempre visível sem precisar abrir cada item
- Motivo de negativas sempre presente
- Dúvidas rápidas respondíveis sem precisar incomodar pessoas
- Notificações críticas nunca perdem-se entre notificações informativas

---

<a name="jornadas-membro"></a>
## JORNADAS — Membro

---

### JM-01 — JORNADA PRINCIPAL: Abertura do Dia (Meu Dia)

**Tipo:** Principal — acontece todos os dias, geralmente 1-3 vezes ao dia

**Gatilho:** Membro abre o aplicativo para verificar o dia

**Contexto:** Membro está se preparando para o trabalho. Pode estar em casa, no caminho, no camarim. Precisa de clareza imediata — sem procurar, sem comparar, sem perguntar.

**Passo a passo:**

1. **Abertura** → Sistema exibe Meu Próximo Compromisso imediatamente
   - Informação necessária: qual é a próxima atividade, horário, local, função, personagem
   - Decisão: preciso agir já ou tenho tempo?

2. **Verificação de alterações** → Sistema destaca o que mudou desde a última abertura
   - Informação necessária:
     - Mudanças de horário
     - Mudanças de personagem / função
     - Novas atividades adicionadas
     - Atividades canceladas ou removidas
     - Avisos importantes ainda não confirmados
   - Decisão: existe algo que muda minha preparação para hoje?

3. **Se existem alterações** → Membro lê cada alteração e confirma
   - Informação necessária: o que mudou exatamente, desde quando, quem solicitou a mudança
   - Decisão: confirmar / questionar via mensagem?

4. **Se não existem alterações** → Sistema confirma: *"Nenhuma alteração desde [hora]"*
   - Informação necessária: quando foi a última publicação
   - Decisão: — (confirmação de estabilidade é uma informação valiosa)

5. **Visão do dia completo** → Membro pode acessar a linha do tempo completa do dia sob demanda
   - Informação necessária: todas as atividades do dia em ordem, com horários, locais e funções

**Possíveis falhas:**
- Membro abre o app mas a programação não está atualizada (publicação não feita)
- Alteração existe mas não está visualmente destacada — passa despercebida
- Confirmação de "sem alterações" não existe — Membro não sabe se verificou a versão mais recente

**Como o MyASA reduz risco:**
- Meu Dia sempre mostra a versão mais atual — publicação dispara atualização automática
- Alterações destacadas visualmente — não apenas disponíveis
- Confirmação explícita de "sem alterações desde X" quando não existe novidade
- Alterações críticas persistem até confirmação — não desaparecem como notificações

**Como a IA pode ajudar:**
*"Bom dia. Hoje você tem Musical às 12h30 como Astrid e Show de Patinação às 14h00. Houve uma alteração: seu horário de chegada foi antecipado para 11h30."*

**Resultado esperado:** Membro sabe exatamente o que fazer no dia e está ciente de todas as mudanças antes de sair de casa.

**Critério de sucesso:** Nenhuma mudança que afeta a execução do Membro passa despercebida antes da atividade começar.

---

### JM-02 — JORNADA CRÍTICA: Descoberta de Mudança de Última Hora

**Tipo:** Crítica — acontece com frequência variável, sempre com impacto alto

**Gatilho:** Publicação de alteração operacional que afeta o Membro / Notificação de nível Importante ou Crítico

**Contexto:** O Membro está se preparando, a caminho, ou já no trabalho. Uma mudança aconteceu depois da última vez que verificou. O tempo para reagir pode ser muito curto.

**Passo a passo:**

1. **Notificação recebida** → Push mobile ou alerta in-app
   - Informação necessária: o que mudou (resumo imediato), qual atividade, qual é a urgência
   - Decisão: preciso agir agora?

2. **Abertura do detalhe** → Membro vê a mudança completa no contexto do Meu Dia
   - Informação necessária: o que era antes, o que é agora, desde quando, precisa de alguma preparação diferente?
   - Decisão: consigo executar com essa mudança? Preciso pedir algo?

3. **Confirmação de leitura** → Membro confirma que leu e entendeu
   - Informação necessária: —
   - Decisão: confirmar e se preparar / ou perguntar algo ao Supervisor?

4. **Se existe dúvida** → Membro envia Mensagem direta ao Supervisor
   - Informação necessária: o que precisa esclarecer
   - Decisão: qual canal (Mensagem direta ou pergunta à IA primeiro?)

5. **Preparação para nova realidade** → Membro ajusta o que for necessário (figurino, coreografia, horário de chegada)

**Possíveis falhas:**
- Notificação é recebida mas não é aberta a tempo (push ignorado)
- Mudança não gera notificação porque não foi classificada como relevante para esse Membro
- Membro confirma leitura mas não entendeu — executa errado
- Dúvida não é respondida a tempo (Supervisor não viu a mensagem)

**Como o MyASA reduz risco:**
- Alterações críticas não podem ser dismissadas sem leitura explícita
- A mudança persiste no Meu Dia como item destacado até confirmação — não depende apenas do push
- IA pode responder dúvidas imediatas sem esperar o Supervisor

**Como a IA pode ajudar:**
*"Você recebeu uma mudança: no show das 14h você fará Mensageira em vez de Astrid. Precisa de informações sobre a coreografia de Mensageira?"*

**Resultado esperado:** Membro chega preparado para a nova realidade operacional, mesmo quando a mudança foi de última hora.

**Critério de sucesso:** Membro confirma a mudança antes do início da atividade alterada.

---

### JM-03 — JORNADA SECUNDÁRIA: Criação e Acompanhamento de Solicitação

**Tipo:** Secundária — acontece semanalmente ou sob demanda

**Gatilho:** Membro precisa pedir algo — folga, troca, ajuste de escala, reportar restrição, saída antecipada, chegada tardia

**Contexto:** O pedido surge naturalmente como necessidade. O Membro quer formalizar sem burocracia, e principalmente quer saber o que acontece depois que envia.

**Passo a passo — Criação:**

1. **Iniciação da solicitação** → Membro seleciona o tipo mais próximo de sua necessidade
   - Informação necessária: quais tipos existem (sem jargão técnico)
   - Decisão: qual tipo melhor representa o que precisa?

2. **Preenchimento** → Campos mínimos necessários para o Supervisor analisar
   - Informação necessária: data / período, motivo breve, impacto percebido pelo próprio Membro (opcional)
   - Decisão: precisa de contexto adicional ou é autoexplicativo?

3. **Envio** → Sistema confirma recebimento imediato
   - Estado: "Enviada e aguardando análise"
   - Informação necessária: data/hora do envio, para quem foi encaminhada

**Passo a passo — Acompanhamento:**

4. **Verificação de estado** → Membro abre a área de Solicitações
   - Informação necessária para cada solicitação em aberto:
     - Estado atual: aguardando análise / em análise / aguardando informação / decidida
     - Há quanto tempo está nesse estado
     - Existe alguma ação necessária do Membro?
   - Decisão: precisa fazer algo ou apenas aguardar?

5. **Recebimento de decisão** → Membro recebe notificação de decisão
   - Aprovada: o que muda na sua Escala? Quando começa a valer?
   - Negada: motivo obrigatório visível — o que impediu a aprovação?
   - Proposta alternativa: Supervisor sugeriu outra data ou condição — Membro aceita ou negocia?

6. **Pós-decisão** → Se aprovada, mudança reflete no Meu Dia automaticamente

**Possíveis falhas:**
- Tipo de solicitação errado → revisão desnecessária pelo Supervisor
- Membro não sabe distinguir uma Solicitação de Folga de uma Solicitação Excepcional
- Decisão chega sem motivo → Membro sente injustiça
- Membro envia solicitação duplicada por não saber que a primeira já estava em análise
- Solicitação fica em limbo por dias sem nenhum estado visível

**Como o MyASA reduz risco:**
- Estado sempre visível — "Enviada / Em análise / Decidida" sem precisar abrir o item
- Motivo de negativa sempre presente — sistema não permite negar sem explicação
- Solicitação duplicada detectável pelo próprio Membro antes de enviar (outra similar já existe?)

**Como a IA pode ajudar:**
*"Sua solicitação de folga para o dia 21 está em análise pelo Supervisor desde ontem às 14h."*
*"Por que minha solicitação foi negada?"* → *"A folga foi negada porque você é a única titular de Astrid disponível naquela data."*

**Resultado esperado:** Membro sabe em todo momento o que está acontecendo com sua solicitação. Quando a decisão chega, entende o motivo — seja qual for.

**Critério de sucesso:** Zero solicitações ficam em limbo sem estado visível por mais de 24h.

---

### JM-04 — JORNADA SECUNDÁRIA: Ciclo de Entrega

**Tipo:** Secundária — acontece periodicamente conforme demanda do Supervisor

**Gatilho:** Membro recebe notificação de nova Entrega atribuída

**Contexto:** Uma nova expectativa foi criada para o Membro. Ele precisa entender o que é esperado antes de agir — não apenas o que fazer, mas como, para quando, e o que será avaliado.

**Passo a passo:**

1. **Recebimento da Entrega** → Membro recebe notificação e abre o item
   - Informação necessária:
     - Objetivo (o que é esperado)
     - Tipo (tarefa simples / digital / projeto / avaliação presencial)
     - Prazo exato (data e horário)
     - Critério de avaliação (como será avaliado — o que significa "feito certo")
     - Quem irá avaliar
   - Decisão: tenho tudo que preciso para começar? Tenho dúvidas?

2. **Se existe dúvida antes de começar** → Membro pergunta à IA ou envia mensagem contextual dentro da Entrega
   - Informação necessária: qual dúvida precisa responder antes de iniciar
   - Decisão: a IA responde ou precisa do Supervisor?

3. **Execução** → Membro realiza a tarefa externamente ao sistema (gravação, escrita, preparação)

4. **Envio da entrega** → Membro envia o arquivo / resultado / confirmação de conclusão
   - Estado: "Enviada — aguardando avaliação"
   - Informação necessária: confirmação de envio

5. **Acompanhamento** → Estado visível sem precisar abrir o item
   - Estados possíveis: Aguardando avaliação / Em análise / Aprovada / Ajuste solicitado

6. **Recebimento de feedback** → Notificação de avaliação
   - Aprovada → ciclo encerrado
   - Ajuste solicitado → Membro recebe comentários específicos sobre o que corrigir → reenvia (volta ao passo 4)
   - Negada → motivo visível

7. **Encerramento** → Entrega concluída e registrada no histórico

**Possíveis falhas:**
- Objetivo vago → Membro entrega algo diferente do esperado
- Prazo sem horário → Membro entrega em horário que já não é útil
- Feedback genérico ("pode melhorar") → Membro não sabe o que mudar
- Membro não sabe em que estado está a entrega → não sabe se precisa agir
- Ciclo de ajustes não documentado → perda de contexto entre iterações

**Como o MyASA reduz risco:**
- Campos de objetivo e critério obrigatórios na criação da Entrega pelo Supervisor
- Estado sempre visível — sem precisar abrir cada entrega individualmente
- Histórico de iterações preservado — todas as versões e feedbacks acessíveis
- IA pode responder dúvidas sobre a expectativa antes do envio

**Como a IA pode ajudar:**
*"O que exatamente esperam desta entrega?"* → *"O vídeo deve ter entre 30 e 60 segundos, filmado verticalmente, mostrando a sequência de braços da introdução do Musical. Prazo: sexta às 18h."*

**Resultado esperado:** Membro entrega o que foi pedido, no prazo, sem dúvidas sobre o que era esperado.

**Critério de sucesso:** Entrega aprovada em no máximo 2 ciclos de revisão.

---

### JM-05 — JORNADA EVENTUAL: Consulta à IA para Dúvida Rápida

**Tipo:** Eventual — acontece antes de perguntar para uma pessoa

**Gatilho:** Membro tem uma dúvida operacional rápida (personagem, horário, prazo, status)

**Contexto:** Dúvida surge enquanto o Membro está se preparando ou já na operação. A alternativa sem sistema seria perguntar para um colega ou para o Supervisor — o que gera interrupção e nem sempre gera resposta confiável.

**Passo a passo:**

1. **Pergunta natural** → Membro digita ou fala normalmente
   - *"Que personagem faço no show das 14h?"*
   - *"Qual o status da minha solicitação?"*
   - *"Tenho ensaio hoje?"*
   - *"Existe alguma alteração desde ontem?"*

2. **Resposta contextualizada** → IA responde em linguagem pessoal com base na Escala, Livros, Solicitações e Entregas do Membro
   - Informação necessária: resposta clara, em linguagem pessoal, sem dados operacionais irrelevantes para o Membro

3. **Se IA não souber / não tiver certeza** → IA indica para perguntar ao Supervisor ou apontar onde encontrar a informação

**Como a IA pode ajudar:**
*"No show das 14h você faz Mensageira. A mudança foi publicada às 10h37 de hoje."*

**Resultado esperado:** Membro obtém resposta confiável em segundos sem interromper ninguém.

**Critério de sucesso:** Membro resolve a dúvida sem precisar perguntar para outra pessoa.

---

### JM-06 — JORNADA CRÍTICA: Solicitação Negada Sem Contexto Suficiente

**Tipo:** Crítica — acontece eventualmente, mas com alto impacto emocional

**Gatilho:** Membro recebe notificação de solicitação negada

**Contexto:** O Membro esperava aprovação ou pelo menos uma negativa explicada. Se o motivo não é claro, o produto não resolveu o problema — apenas mudou de canal.

**Passo a passo:**

1. **Recebimento da notificação de negativa**
   - Informação necessária (obrigatória): qual o motivo operacional da negativa
   - Decisão: entendeu o motivo? Quer questionar?

2. **Se o motivo foi fornecido** → Membro decide aceitar ou negociar
   - Negociar → Mensagem direta ao Supervisor com proposta alternativa

3. **Se o motivo não foi fornecido** → O sistema não deveria permitir esse estado
   - Fallback: Membro pode perguntar à IA pelo contexto da decisão

**Como o MyASA reduz risco:**
- Motivo de negativa obrigatório — sistema bloqueia o envio da decisão sem preenchimento
- IA pode explicar o contexto operacional que levou à negativa

**Critério de sucesso:** Membro entende o motivo da negativa mesmo quando discorda.

---

<a name="perfil-admin"></a>
## PERFIL — Admin

### 1. Objetivo principal
Garantir que o ecossistema que sustenta todas as operações continue saudável, resiliente e capaz de absorver problemas sem entrar em crise.

### 2. Pergunta central
*"O ecossistema está saudável? Existe algo que precisa da minha atenção?"*

### 3. Estado mental
- Olha para tendências, não para eventos isolados
- Alta sensibilidade a padrões que se repetem
- Pensa em estruturas, não em pessoas individuais
- Medo das consequências invisíveis de mudanças estruturais
- Satisfação quando a estrutura resolve problemas sem precisar de sua intervenção

### 4. Início do ciclo
O ciclo do Admin é menos previsível que os outros dois. Pode ser acionado pela abertura proativa do produto (verificação de saúde), por uma escalada de um Supervisor, por um indicador que disparou alerta, ou por necessidade periódica de configuração estrutural.

### 5. Ações frequentes
- Verificar saúde geral das operações
- Investigar problemas que ultrapassaram a camada operacional
- Gerenciar mudanças estruturais (Grupos, Supervisores, Funções)
- Revisar indicadores de tendência
- Criar e gerenciar usuários e permissões
- Enviar Avisos para múltiplas operações
- Auditar decisões e reconstruir histórico de eventos

### 6. Decisões principais
- Intervir ou deixar o Supervisor resolver
- Aprovar mudanças estruturais com impacto organizacional
- Responder solicitações que ultrapassaram o Supervisor
- Reclassificar um problema de individual para sistêmico (e agir estruturalmente)
- Priorizar qual operação em atenção exige intervenção primeiro

### 7. Informações necessárias em cada momento
- Estado de saúde de cada operação (saudável / atenção / crítico)
- Padrões de reincidência por operação e por grupo
- Itens sem responsável definido
- Idade das pendências em aberto
- Frequência de escaladas para o Admin
- Mudanças estruturais recentes e seus impactos
- Histórico narrativo de eventos para investigação

### 8. Riscos e ansiedades
- Não perceber uma tendência antes que vire crise sistêmica
- Alterar estrutura sem ver consequências completas
- Investigar um problema sem ter o contexto completo dos eventos
- Intervir onde não é necessário (substituindo o papel do Supervisor)
- Não intervir onde é necessário (deixando um problema crescer)
- Ter responsabilidades sem responsáveis definidos

### 9. Momentos de comunicação
- Aviso para múltiplas operações (escopo cruzado)
- Escalada recebida do Supervisor com contexto do que foi tentado
- Feedback ao Supervisor após investigação de problema recorrente
- Configuração de novos usuários e comunicação de acesso
- Comunicação de mudança estrutural que afeta Supervisores e Membros

### 10. Uso da IA
- *"Existe alguma operação em risco esta semana?"*
- *"Quais são os principais gargalos de solicitações sem resposta?"*
- *"Existem grupos com excesso de carga?"*
- *"O que aconteceu com esta solicitação?"*
- *"Quais problemas estamos repetindo?"*
- *"Resuma os eventos que levaram a este conflito."*
- *"Se eu mover este Supervisor, quais impactos existirão?"*
- *"Quais funções têm menos de 2 pessoas habilitadas?"*

### 11. Estados de sucesso
- Todas as operações em status saudável
- Problemas sendo resolvidos pelos Supervisores sem precisar escalar
- Padrões de reincidência em queda
- Estrutura organizacional consistente e sem ambiguidades de responsabilidade
- Qualquer decisão passada é reconstituível sem depender de memória de pessoas

### 12. Estados de falha
- Problema recorrente não identificado como padrão — repetido indefinidamente
- Mudança estrutural gera impactos não previstos que aparecem semanas depois
- Investigação de evento impossível porque o histórico não conta a história
- Operação sem Supervisor efetivo por falta de gestão de continuidade
- Admin sobrecarregado com problemas que deveriam ser resolvidos pelo Supervisor

### 13. Exceções comuns
- Supervisor sai da organização — quem assume o Grupo?
- Novo show cria funções que não existem na estrutura
- Conflito entre dois Supervisores sobre alocação de membro compartilhado
- Solicitações acumuladas em determinado Supervisor por dias
- Operação começa a apresentar excesso de correções pós-publicação

### 14. Pontos de contato com outros perfis
- Supervisor: escalada de problemas que ultrapassaram o escopo operacional
- Supervisor: Admin configura Grupos que definem o escopo do Supervisor
- Supervisor: Admin pode aprovar Solicitações que o Supervisor não respondeu
- Membro: Admin pode enviar Avisos que afetam membros diretamente
- Membro: Admin pode criar Entregas de escopo organizacional

### 15. O que o sistema precisa garantir
- Visão de saúde de todas as operações em uma única tela sem precisar mergulhar em cada uma
- Indicadores mostram tendências, não apenas estados atuais
- Mudanças estruturais sempre mostram impacto antes da confirmação
- Histórico é reconstituível como narrativa, não apenas como lista de registros
- Padrões de reincidência são detectáveis pelo sistema — não exigem análise manual
- Admin não precisa navegar por múltiplas telas para entender o estado geral

---

<a name="jornadas-admin"></a>
## JORNADAS — Admin

---

### JA-01 — JORNADA PRINCIPAL: Verificação de Saúde do Ecossistema

**Tipo:** Principal — acontece diariamente ou conforme necessidade

**Gatilho:** Admin abre o aplicativo / período de verificação rotineira / alerta automático de saúde

**Contexto:** Admin quer saber, em poucos segundos, se existe algo que exige sua atenção. Se tudo está saudável, não precisa de nenhuma ação. Se existe algo em atenção ou crítico, precisa decidir se age agora ou agenda para depois.

**Passo a passo:**

1. **Abertura** → Sistema exibe estado de saúde geral do ecossistema
   - Informação necessária: quantas operações saudáveis / em atenção / críticas
   - Decisão: existe algo que exige ação agora?

2. **Se existem operações em atenção ou críticas** → Admin vê o diagnóstico por operação
   - Informação necessária para cada operação: por que está em atenção? Qual o sinal? Há quanto tempo? Está crescendo?
   - Decisão: intervir agora ou acompanhar?

3. **Revisão de tendências** → Admin verifica indicadores em movimento
   - Informação necessária: solicitações acumuladas crescendo? Correções pós-publicação aumentando? Escaladas para o Admin aumentando?
   - Decisão: existe alguma tendência que precisa de investigação?

4. **Verificação de itens sem responsável** → Admin revisa pendências sem dono
   - Informação necessária: quais itens existem sem responsável definido (solicitações, grupos, funções)
   - Decisão: atribuir responsabilidade agora?

5. **Se tudo está saudável** → Admin confirma estado e não precisa agir

**Possíveis falhas:**
- Dashboard mostra números sem contexto — Admin não sabe o que o número significa
- Estado de "atenção" sem indicação do motivo — Admin precisa investigar manualmente
- Operação silenciosa parece saudável mas está escondendo tensão

**Como o MyASA reduz risco:**
- Saúde apresentada como diagnóstico, não como estatística — "em atenção porque solicitações acumularam 3x na semana"
- Tendências visíveis junto ao estado atual
- Itens sem responsável destacados automaticamente

**Como a IA pode ajudar:**
*"Bom dia. 2 de 3 operações estão saudáveis. Snowland está em atenção: solicitações sem resposta aumentaram 60% esta semana e existem 3 posições com apenas 1 pessoa habilitada."*

**Resultado esperado:** Admin sabe em menos de 1 minuto se precisa agir e onde.

**Critério de sucesso:** Nenhum problema sistêmico cresce sem ser identificado pelo Admin antes de virar crise.

---

### JA-02 — JORNADA SECUNDÁRIA: Investigação de Problema Operacional

**Tipo:** Secundária — acontece quando um problema escalou ou quando Admin percebe padrão de reincidência

**Gatilho:** Escalada do Supervisor / Padrão detectado / Admin decide investigar evento específico

**Contexto:** Algo deu errado ou está se repetindo. O Admin precisa entender o que aconteceu — não para culpar, mas para identificar a causa raiz e tomar decisão estrutural.

**Passo a passo:**

1. **Acesso ao evento ou padrão** → Admin seleciona o item a investigar
   - Informação necessária: o que aconteceu (resumo), quando, quem estava envolvido

2. **Linha do tempo do evento** → Sistema exibe narrativa cronológica
   - Informação necessária em ordem cronológica:
     - Criação do item
     - Alterações feitas
     - Aprovações e negativas
     - Comunicações enviadas
     - Confirmações recebidas ou ausentes
     - Reversões
     - Ações da IA (se houver)
   - Decisão: onde na sequência o problema se originou?

3. **Análise de causa raiz** → Admin identifica se o problema foi:
   - Falta de informação (alguém não sabia)
   - Falta de processo (ninguém seguiu o fluxo)
   - Falha estrutural (a estrutura não permite o fluxo correto)
   - Decisão equivocada (alguém tinha as informações e decidiu errado)
   - Decisão: qual é a causa e qual é o tipo de intervenção necessária?

4. **Verificação de reincidência** → Sistema mostra se o mesmo tipo de problema ocorreu antes
   - Informação necessária: frequência, operações, grupos, funções envolvidas
   - Decisão: problema isolado (ação pontual) ou padrão (ação estrutural)?

5. **Ação** → Dependendo da causa raiz:
   - Problema de informação → Aviso, treinamento, atualização de Biblioteca
   - Problema de processo → Revisão com Supervisores, atualização de diretrizes
   - Falha estrutural → Mudança na configuração de Grupos, Funções ou Permissões (entra em JA-03)
   - Decisão equivocada → Conversa com o Supervisor envolvido

**Possíveis falhas:**
- Histórico existe mas não é narrativo — Admin precisa reconstruir manualmente
- Reincidência não é detectável porque eventos similares não estão conectados
- Causa raiz mal identificada → solução endereça o sintoma, não o problema

**Como o MyASA reduz risco:**
- Histórico narrativo por entidade — linha do tempo com atores e contexto
- Detecção automática de padrões de reincidência pelo sistema
- IA como investigadora: transforma registros em narrativa compreensível

**Como a IA pode ajudar:**
*"Resuma o que aconteceu com esta solicitação."* → *"A solicitação foi criada em 14/06. O Supervisor responsável visualizou no mesmo dia mas não tomou ação. Ficou em análise por 5 dias. O Membro enviou mensagem de acompanhamento em 16/06. Decisão final: negada em 19/06 sem motivo registrado. Este é o 3º caso similar com este Supervisor nas últimas 4 semanas."*

**Resultado esperado:** Admin entende o que aconteceu, por que aconteceu, e se é padrão ou exceção.

**Critério de sucesso:** Admin toma decisão baseada em evidência, não em memória ou versões conflitantes.

---

### JA-03 — JORNADA SECUNDÁRIA: Mudança Estrutural

**Tipo:** Secundária — acontece periodicamente (novo show, reorganização, entrada/saída de Supervisor)

**Gatilho:** Necessidade de criar, modificar ou reorganizar Grupos, Funções, Supervisores ou Operações

**Contexto:** Mudança estrutural com impacto duradouro. Admin pensa em camadas — a estrutura persiste quando as pessoas mudam. Antes de agir, precisa entender as consequências.

**Passo a passo:**

1. **Identificação da mudança necessária** → O que precisa mudar e por quê
   - Informação necessária: contexto da mudança (novo show, saída de Supervisor, reorganização de grupos)
   - Decisão: a mudança é urgente ou pode ser planejada?

2. **Análise de impacto antes de executar** → Sistema calcula o que muda com essa alteração
   - Informação necessária:
     - Quem perde acesso ou muda de escopo
     - Quais itens em andamento são afetados
     - Quais responsabilidades ficam sem dono
     - Qual é o estado atual que será alterado
   - Decisão: está pronto para executar? Existe algum impacto não esperado?

3. **Execução da mudança** → Admin confirma após revisar o impacto
   - Sistema registra no histórico estrutural: o que mudou, quando, por quem, com que motivo

4. **Comunicação para afetados** → Supervisores e Membros afetados recebem notificação
   - Informação necessária: o que mudou, quando começa a valer, o que precisam fazer (se algo)

5. **Monitoramento pós-mudança** → Admin acompanha se a mudança gerou novos problemas inesperados
   - Informação necessária: existem novos erros de permissão? Existem itens órfãos (sem responsável)?

**Exemplos críticos desta jornada:**
- **Supervisor sai:** quem assume o Grupo? O sistema deve alertar se um Grupo fica sem Supervisor ativo.
- **Nova função criada:** essa função precisa de pelo menos X pessoas habilitadas antes de entrar em produção.
- **Dois grupos se unem:** as responsabilidades, Livros e históricos são preservados?

**Possíveis falhas:**
- Mudança executada sem ver impacto → consequências aparecem semanas depois
- Grupo fica sem Supervisor e ninguém percebe imediatamente
- Nova função criada mas sem membros habilitados → cobertura zero desde o início

**Como o MyASA reduz risco:**
- Impacto sempre visível antes da confirmação — não como bloqueio, mas como visibilidade
- Alerta automático de Grupo sem Supervisor após mudança
- Histórico estrutural separado do histórico operacional

**Como a IA pode ajudar:**
*"Se você desativar este Grupo, 12 membros ficam sem grupo associado e 3 Solicitações em andamento ficam sem responsável. Deseja atribuir antes de desativar?"*

---

### JA-04 — JORNADA EVENTUAL: Monitoramento de Indicadores e Tendências

**Tipo:** Eventual — acontece periodicamente (semanal, quinzenal) ou quando existe alerta

**Gatilho:** Admin decide fazer revisão periódica / Sistema alerta sobre indicador crescente

**Contexto:** Não existe crise imediata. Admin está em modo de governança preventiva — olha para o que está mudando ao longo do tempo.

**Passo a passo:**

1. **Acesso a indicadores de tendência** → Admin seleciona período de análise (última semana, último mês)
   - Informação necessária por operação:
     - Tempo médio de resposta em Solicitações (crescendo ou estável?)
     - Frequência de correções pós-publicação (crescendo ou estável?)
     - Número de escaladas para Admin (crescendo ou estável?)
     - Coberturas frágeis (funções com 1 pessoa habilitada)
     - Reincidências por tipo

2. **Identificação de sinais de atenção** → Admin filtra o que está piorando
   - Decisão: isso exige investigação (JA-02) ou é suficiente uma conversa com o Supervisor?

3. **Ação preventiva** → Admin age antes que o sinal vire crise
   - Pode ser: conversa com Supervisor, mudança estrutural preventiva, criação de Aviso de alinhamento

**Como a IA pode ajudar:**
*"Nas últimas 3 semanas, a Operação Snowland apresentou aumento de 40% em correções pós-publicação. As correções se concentram no Grupo de Patinação. Outros indicadores desta operação estão estáveis."*

---

### JA-05 — JORNADA EVENTUAL: Setup de Nova Operação

**Tipo:** Eventual — acontece raramente mas com complexidade alta

**Gatilho:** Nova empresa, novo projeto ou nova unidade decide usar o MyASA

**Contexto:** O Admin está construindo a estrutura do zero. A ordem importa: estrutura antes de pessoas.

**Passo a passo:**

1. **Criação da Operação** → Nome, tipo, configurações básicas

2. **Criação dos Grupos Operacionais** → Quais agrupamentos existem dentro desta operação?
   - Decisão: quantos grupos? Com que propósito cada um?

3. **Criação das Funções** → Quais funções artísticas e operacionais existem?
   - Informação necessária: funções do Livro do Show, funções de apoio operacional

4. **Criação do Livro do Show** → Estrutura base dos espetáculos (se aplicável)

5. **Cadastro de usuários** → Membros, Supervisores, outros Admins
   - Ordem: Supervisores primeiro (precisam existir antes de serem atribuídos a Grupos)

6. **Atribuição de Supervisores a Grupos** → Quem gerencia o quê?

7. **Atribuição de Membros a Grupos e Funções** → Quem faz o quê?

8. **Validação estrutural** → Sistema verifica: existe algum Grupo sem Supervisor? Alguma função crítica sem membro habilitado? Alguma inconsistência?

9. **Ativação** → Operação ativa para uso

**Possíveis falhas:**
- Funções criadas mas sem membros habilitados
- Membros cadastrados sem associação a Grupos
- Livro do Show criado antes das funções estarem definidas

**Como o MyASA reduz risco:**
- Checklist de completude antes da ativação
- Alertas de inconsistência estrutural (Grupo sem Supervisor, função sem membros)

---

### JA-06 — JORNADA CRÍTICA: Conflito entre Supervisores

**Tipo:** Crítica — rara mas com alto impacto organizacional

**Gatilho:** Dois Supervisores reivindicam o mesmo membro para atividades simultâneas / Conflito de autoridade sobre um Grupo

**Contexto:** O problema ultrapassou a camada operacional. Nenhum dos Supervisores pode resolvê-lo sozinho. A questão não é operacional — é estrutural ou de autoridade.

**Passo a passo:**

1. **Recebimento da escalada** → Admin recebe o contexto do que foi tentado por cada Supervisor
   - Informação necessária: qual é o conflito, o que cada Supervisor afirma, o que o sistema registra como verdade
   - Decisão: é conflito de dados (sistema tem resposta) ou conflito de autoridade (Admin precisa decidir)?

2. **Se conflito de dados** → Sistema mostra a versão oficial (Escala única, sem ambiguidade)
   - Decisão: Escala já define quem tem razão?

3. **Se conflito de autoridade** → Admin investiga a estrutura dos Grupos envolvidos
   - Informação necessária: os escopos dos dois Supervisores se sobrepõem? Existe ambiguidade de responsabilidade?
   - Decisão: resolver o caso específico ou ajustar a estrutura para evitar recorrência?

4. **Comunicação da decisão** → Admin informa ambos os Supervisores com clareza e contexto
   - Informação necessária: qual é a decisão, qual é o motivo, o que muda daqui para frente

5. **Se problema estrutural** → Entra em JA-03

---

<a name="mapa-consolidado"></a>
## MAPA CONSOLIDADO

---

### Dependências entre Jornadas

| Jornada origem | Dispara | Jornada destino |
|---|---|---|
| JM-03 (Membro cria Solicitação) | → | JS-02 (Supervisor analisa Folga) |
| JS-02 (Decisão de Folga) | → | JM-03 passo 5 (Membro recebe decisão) |
| JS-03 (Supervisor faz substituição) | → | JM-02 (Membro recebe mudança crítica) |
| JS-04 (Publicação da Escala) | → | JM-01 (Meu Dia atualizado) |
| JS-07 (Supervisor cria Entrega) | → | JM-04 (Membro recebe Entrega) |
| JM-04 (Membro envia Entrega) | → | JS-07 passo 4 (Supervisor revisa) |
| JS-02 / JS-03 sem resolução | → | JA-02 (Admin investiga) |
| JA-02 detecta padrão estrutural | → | JA-03 (Mudança estrutural) |
| JA-03 muda Grupos/Supervisores | → | JS-01 (novo escopo para Supervisor) |

---

### Pontos de Contato entre os Três Perfis

**Evento: Publicação de Escala**
- Supervisor publica → Membro recebe atualização no Meu Dia → Admin monitora frequência de correções pós-publicação

**Evento: Solicitação de Folga**
- Membro cria Solicitação → Supervisor recebe para análise → Admin monitora tempo médio de resposta e age se houver acúmulo

**Evento: Substituição de Membro**
- Supervisor decide substituição → Membro substituído e substituto recebem notificação → Admin registra no histórico e monitora reincidência

**Evento: Entrega**
- Supervisor cria Entrega → Membro recebe, executa, envia → Supervisor revisa e dá feedback → Admin monitora como indicador de atividade e uso

**Evento: Problema escalado**
- Supervisor não resolve → escalada para Admin → Admin investiga e decide → Supervisor recebe orientação ou o problema é resolvido estruturalmente

**Evento: Alteração crítica (cancelamento de show)**
- Admin ou Supervisor cancela → todos os membros afetados recebem notificação crítica → confirmação monitorada por Supervisor → Admin registra no histórico

---

### Eventos que Conectam os Três Perfis Simultaneamente

1. **Publicação da Escala** — Supervisor age, Membro recebe, Admin monitora
2. **Substituição emergencial** — Supervisor decide, Membro executa nova função, Admin vê no histórico
3. **Aprovação/negativa de Folga** — Membro solicita, Supervisor analisa, Admin acompanha como indicador de saúde
4. **Cancelamento de Show** — Supervisor ou Admin decide, todos os membros recebem, histórico registra

---

### Momentos Mais Frequentes do Produto

Por ordem de frequência de uso:

1. **JM-01** — Membro abre Meu Dia (diário, múltiplas vezes)
2. **JS-01** — Supervisor verifica estado da operação (diário, múltiplas vezes)
3. **JM-02** — Membro recebe e confirma alteração (diário)
4. **JS-05** — Supervisor monitora confirmações pós-comunicação (diário)
5. **JS-04** — Supervisor gera/revisa Livro do Dia (diário ou na véspera)
6. **JM-03** — Membro acompanha solicitações (semanal)
7. **JS-02** — Supervisor analisa solicitações de folga (semanal)
8. **JM-04** — Membro ciclo de Entrega (periódico)
9. **JM-05** — Membro consulta IA (diário, informal)
10. **JA-01** — Admin verifica saúde do ecossistema (diário ou semanal)

---

### Momentos Mais Críticos do Produto

Por nível de risco operacional:

1. **JS-03** — Substituição por no-show (urgência máxima, impacto direto no show)
2. **JS-09** — Cancelamento de show (impacto máximo, todos afetados)
3. **JS-08** — Múltiplas exceções simultâneas (complexidade máxima)
4. **JM-02** — Mudança de última hora (quando o tempo é curto demais)
5. **JA-06** — Conflito entre Supervisores (impacto organizacional)
6. **JA-03** — Mudança estrutural com consequências invisíveis (impacto latente)
7. **JM-06** — Negativa de solicitação sem contexto (impacto emocional e de confiança)

---

### Jornadas que Representam 80% do Uso Real

Estas jornadas são o núcleo do produto. O design dessas jornadas precisa ser impecável antes de qualquer outra coisa:

| Jornada | Perfil | Frequência | Criticidade |
|---|---|---|---|
| JM-01 Abertura do Meu Dia | Membro | Diária | Alta |
| JS-01 Início do dia operacional | Supervisor | Diária | Alta |
| JM-02 Descoberta de mudança | Membro | Diária | Crítica |
| JS-05 Comunicação pós-alteração | Supervisor | Diária | Alta |
| JS-04 Geração/publicação do Livro | Supervisor | Diária | Alta |
| JM-03 Solicitação — acompanhamento | Membro | Semanal | Média |
| JS-02 Análise de folga | Supervisor | Semanal | Alta |
| JS-03 Substituição emergencial | Supervisor | Frequente | Crítica |
| JA-01 Verificação de saúde | Admin | Diária/semanal | Alta |
| JM-05 Consulta à IA | Membro | Diária (informal) | Média |

---

### Jornadas que Podem Ser Deixadas para Depois (V2 ou Pós-MVP)

Estas jornadas são reais mas de frequência menor, menor impacto imediato, ou dependentes de funcionalidades que ainda precisam de validação adicional:

| Jornada | Motivo para adiar |
|---|---|
| JA-05 Setup de nova Operação | Acontece uma vez; pode ser feito com suporte de onboarding humano no início |
| JA-04 Indicadores e tendências avançados | Requer dados históricos acumulados para ser útil |
| JS-06 Planejamento semanal avançado | Pode ser endereçado como extensão natural da Home do Supervisor |
| JA-06 Conflito entre Supervisores | Raro; pode ser tratado via Mensagem + Manual enquanto o produto amadurece |
| JM-04 Ciclo completo de Entregas com múltiplas revisões | Core funcionará com 1 ciclo; múltiplas iterações podem ser V2 |

---

### Princípios que Emergem do Mapa Completo

**1. O produto tem três camadas de tempo simultâneas:**
- Membro opera no imediato (hoje, agora)
- Supervisor opera no curto prazo (hoje e próximos dias)
- Admin opera no médio prazo (semanas e tendências)

**2. Toda jornada tem um momento de silêncio perigoso:**
- Para o Membro: depois de enviar uma Solicitação ou Entrega
- Para o Supervisor: depois de comunicar uma mudança sem confirmação
- Para o Admin: quando um problema cresce sem ser detectado

**O MyASA é bem-sucedido quando elimina esses silêncios.**

**3. A IA tem três papéis radicalmente diferentes:**
- Para o Supervisor: analisa e recomenda antes de qualquer ação
- Para o Membro: traduz e responde sem exigir navegação
- Para o Admin: detecta padrões e conta histórias sobre o que aconteceu

**4. Confirmação é uma jornada, não um botão:**
- Notificar não é comunicar
- Comunicar não é confirmar
- O ciclo só fecha quando todos os afetados confirmaram

**5. O pior momento para um usuário:**
- Supervisor: quando resolve um problema e cria dois outros sem perceber
- Membro: quando é responsabilizado por algo que não sabia
- Admin: quando investiga um problema e não consegue entender o que aconteceu
