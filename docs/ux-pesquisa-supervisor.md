# MyASA 2.0 — Pesquisa UX: Jornada do Supervisor

> Versão: 17/06/2026
> Origem: Entrevista estruturada — fase pré-design
> Status: Aprovado para uso em UX e Design System

---

## Síntese em Uma Frase

> O trabalho do Supervisor não é construir operações. É proteger operações já planejadas contra exceções invisíveis.

---

## Descobertas Fundamentais

### D1 — O Supervisor começa pelo que mudou, não pelo que existe

**Resposta Operacional:**
A primeira ação do dia não é "ver a programação". É verificar se o planejamento continua válido. A pergunta central é: *"O que mudou e pode impactar a programação de hoje?"*

**Impacto Operacional:**
No-shows, folgas de última hora, restrições inesperadas e mudanças de agenda são os primeiros filtros do dia. A operação raramente começa do zero — ela começa da exceção.

**Impacto para UX:**
A tela inicial do Supervisor não pode começar com listas, menus ou cadastros. Deve começar com o status da operação e as exceções ativas.

**Impacto para Interface:**
- Primeiro elemento visível: status da operação (pronta / com alertas / com problemas críticos)
- Segundo elemento: exceções que exigem ação
- Terceiro elemento: próximos riscos previsíveis
- Quarto elemento: visão do restante do dia e da semana

**Riscos:**
Se o sistema exibir listas antes do status, o Supervisor precisará fazer o trabalho de triagem manualmente — exatamente o que o produto deve evitar.

**Oportunidade para IA:**
A IA pode executar a triagem automática ao abrir o app: *"Detectei 2 exceções desde ontem. O Musical das 12h30 está em risco."*

---

### D2 — O Supervisor resolve riscos, não pessoas

**Resposta Operacional:**
Quando surge uma exceção, o primeiro passo não é encontrar um substituto. É entender o impacto. *"Em quais atividades essa pessoa impacta hoje?"*

**Impacto Operacional:**
Uma ausência pode afetar múltiplos shows, ensaios e aulas simultaneamente. A análise de impacto precede a busca por solução.

**Impacto para UX:**
Ao clicar em uma exceção (no-show, folga aprovada, restrição nova), o sistema deve mostrar automaticamente todas as atividades afetadas — antes de qualquer ação.

**Impacto para Interface:**
- Exceção detectada → tela de impacto (quais atividades, quais horários, qual urgência)
- Só depois: opções de solução
- Nunca mostrar a lista de pessoas primeiro

**Riscos:**
Se o sistema abrir diretamente a seleção de substitutos, o Supervisor pode resolver um problema sem perceber que criou outros dois.

**Oportunidade para IA:**
*"A ausência da Carol afeta 3 atividades: Musical 12h30, Ensaio 14h00 e Aula 16h00. O maior risco é o Musical — começa em 20 minutos."*

---

### D3 — Alternativas são classificadas por risco, não por disponibilidade

**Resposta Operacional:**
O Supervisor avalia candidatos em 4 camadas eliminatórias, nessa ordem:

1. **Eliminatória:** disponível, sem folga, sem restrição, sem conflito de horário
2. **Artística/Técnica:** conhece o papel, é titular ou substituto, tem experiência suficiente
3. **Operacional:** a troca não gera novos conflitos, há tempo para preparação
4. **Segurança:** não existe risco físico, a qualidade do espetáculo é mantida

**Impacto Operacional:**
A melhor alternativa não é quem está disponível. É quem apresenta o menor risco operacional total — incluindo consequências invisíveis da substituição.

**Impacto para UX:**
A tela de substituição não pode mostrar uma lista de nomes. Deve mostrar candidatos classificados por viabilidade operacional.

**Impacto para Interface:**

```
🟢 Melhor opção — Amanda
   Conhece o papel · Disponível · Sem conflitos · Baixo risco

🟡 Opção segura — Júlia
   Conhece parcialmente · Pequeno ajuste necessário

🟠 Opção possível — Beatriz
   Requer preparação · Conflito menor resolvível

🔴 Não recomendado — Paula
   Restrição ativa · Alto risco operacional
```

**Riscos:**
Uma lista sem classificação transfere toda a análise para o Supervisor — o pior momento para isso é durante uma crise com show em 20 minutos.

**Oportunidade para IA:**
A IA executa as 4 camadas de análise automaticamente e apresenta candidatos classificados com justificativa visível.

---

### D4 — O planejamento é operação-primeiro, pessoas-depois

**Resposta Operacional:**
O Supervisor não começa perguntando "quem eu tenho?". Começa perguntando "o que precisa acontecer?". A necessidade operacional precede a alocação de pessoas.

Ordem mental de construção:
1. Shows (prioridade máxima — horários fixos, papéis obrigatórios)
2. Ensaios
3. Aulas
4. Eventos especiais
5. Atividades de apoio
6. Distribuição das pessoas

**Impacto Operacional:**
O sistema que distribui pessoas sem estruturar primeiro as necessidades operacionais está invertendo a lógica do Supervisor. O Livro do Show existe exatamente para codificar essa lógica.

**Impacto para UX:**
O Livro do Dia deve ser gerado a partir das necessidades do espetáculo — não a partir da lista de pessoas disponíveis. O Supervisor valida e ajusta; não constrói do zero.

**Impacto para Interface:**
A geração do Livro do Dia deve mostrar: "O espetáculo precisa de X posições. Com as folgas e restrições de hoje, Y estão cobertas e Z precisam de atenção."

**Riscos:**
Um sistema que começa pela lista de pessoas convida o Supervisor a pensar em quem alocar — em vez de pensar em quais necessidades operacionais cobrir.

**Oportunidade para IA:**
A IA gera a proposta do Livro do Dia considerando automaticamente todas as variáveis. O Supervisor revisa — não constrói.

---

### D5 — Uma substituição raramente afeta apenas uma pessoa

**Resposta Operacional:**
Efeito cascata é a norma, não a exceção. Ao mover uma pessoa de uma posição, ela deixa um vazio em outra. Esse vazio gera uma nova necessidade de substituição, que pode gerar outra.

**Impacto Operacional:**
A primeira solução encontrada frequentemente não é a melhor. O Supervisor precisa avaliar: *"Vale a pena fazer essa troca? O risco diminui ou aumenta?"*

**Impacto para UX:**
Antes de confirmar qualquer substituição, o sistema deve mostrar o impacto cascata da decisão. Não apenas o benefício imediato.

**Impacto para Interface:**
```
Você está movendo Amanda para o Musical das 12h30.

Impacto desta decisão:
✅ Musical das 12h30 — coberto
⚠️ Ensaio das 14h00 — Amanda sai → sem substituto definido
⚠️ Aula das 16h00 — Amanda sai → 1 substituto disponível
```

**Riscos:**
Sem visibilidade do efeito cascata, o Supervisor resolve um problema e cria dois outros sem perceber.

**Oportunidade para IA:**
A IA simula o impacto cascata antes da confirmação e sugere a sequência completa de substituições necessárias para equilibrar toda a operação.

---

### D6 — Comunicar não é informar — é garantir execução

**Resposta Operacional:**
A pergunta que o Supervisor quer responder não é *"eu avisei?"* — é *"eles sabem o que precisam fazer?"*

Sem confirmação, o Supervisor entra em segundo ciclo manual: nova mensagem → ligação → contato presencial → confirmação.

**Impacto Operacional:**
Uma decisão correta com comunicação falha gera o mesmo problema operacional que uma decisão errada. A comunicação é parte da solução, não um passo posterior a ela.

**Impacto para UX:**
Após qualquer alteração operacional, o sistema deve mostrar claramente: quem foi impactado, quem foi notificado, quem visualizou, quem ainda não confirmou.

**Impacto para Interface:**
```
Alteração publicada — Show das 12h30

✅ Amanda — visualizou às 10h43
✅ Júlia — visualizou às 10h44
⏳ Carlos — notificado · sem confirmação
⏳ Beatriz — notificado · sem confirmação

2 pessoas ainda não confirmaram
→ Renotificar | Ver detalhes
```

**Riscos:**
Se o sistema mostrar apenas "notificação enviada", o Supervisor acredita que o problema está resolvido — quando ainda pode estar em risco.

**Oportunidade para IA:**
A IA monitora confirmações e alerta proativamente: *"Carlos ainda não confirmou a mudança do show das 12h30. Faltam 15 minutos."*

---

### D7 — Folga é uma variável operacional, não um evento administrativo

**Resposta Operacional:**
Existem três tipos de folga: planejada (conhecida antecipadamente), solicitada (pelo membro), operacional (definida pela operação).

A pergunta ao analisar uma folga não é *"posso liberar?"* — é *"se eu liberar, a operação continua funcionando?"*

O risco mais comum: aprovar folgas separadamente sem ver a soma. Cinco folgas individualmente administráveis podem criar um problema operacional crítico.

**Impacto Operacional:**
Folgas afetam Shows, Ensaios, Aulas, cobertura de papéis e distribuição de carga — tudo ao mesmo tempo. Uma única folga pode gerar efeito cascata em múltiplas atividades.

**Impacto para UX:**
Ao receber uma solicitação de folga, o sistema deve mostrar automaticamente o impacto antes de mostrar "aprovar ou negar".

**Impacto para Interface:**
```
Amanda solicitou folga — Sábado, 21 de junho

Impacto desta folga:
⚠️ Musical das 14h00 — Amanda é titular de Astrid
⚠️ Ensaio das 16h00 — Amanda é a única disponível para bloco 3
✅ Aula das 10h00 — coberta por Júlia

Cobertura disponível para Astrid:
🟢 Júlia — disponível e apta
🟡 Beatriz — disponível, ajuste necessário

→ Aprovar  |  Negar  |  Negociar outra data
```

**Riscos:**
Um sistema que mostra "Aprovar/Negar" sem contexto operacional força o Supervisor a fazer a análise de impacto na cabeça — exatamente o que aumenta a chance de erro.

**Oportunidade para IA:**
A IA analisa automaticamente a folga solicitada e apresenta cobertura, risco e alternativas antes de qualquer ação do Supervisor.

---

### D8 — Os Livros são conhecimento operacional, não formulários

**Resposta Operacional:**
O Livro do Show é a representação de como o espetáculo funciona — cenas, blocos, posições, regras de substituição, titulares, rodízios. É um documento vivo que muda com novos membros, novas coreografias e evolução artística.

O Livro do Dia não é uma cópia do Livro do Show. É a operação possível para uma data específica, considerando as restrições reais daquele dia.

**Impacto Operacional:**
O Supervisor não reconstrói o Livro do Dia manualmente. Ele valida e ajusta a proposta gerada automaticamente. O trabalho é de revisão, não de construção.

**Impacto para UX:**
A experiência dos Livros deve começar pela compreensão, não pela edição. O Supervisor abre o Livro do Dia e vê primeiro: está coberto? Existem riscos? Onde estão os problemas?

**Impacto para Interface:**
- Primeira camada: status geral (coberto, com alertas, com problemas)
- Segunda camada: posições com risco ou sem cobertura destacadas
- Terceira camada: edição e ajustes — nunca como ponto de entrada

**Riscos:**
Um Livro que se abre como uma planilha ou formulário de preenchimento vai contra toda a filosofia do produto. O Supervisor abandona o sistema e gerencia no WhatsApp.

**Oportunidade para IA:**
*"O Livro do Dia está 90% pronto. Existe uma posição sem cobertura: Astrid no Musical das 12h30. Recomendo Amanda."*

---

### D9 — O Supervisor opera em múltiplos horizontes simultâneos

**Resposta Operacional:**
O Supervisor precisa enxergar ao mesmo tempo:
- **Agora:** o que está acontecendo
- **Próximas horas:** o que está prestes a acontecer
- **Amanhã:** o que precisa ser preparado
- **Próxima semana:** o que pode se tornar um problema

Supervisores experientes se destacam não pela velocidade de apagar incêndios, mas pela capacidade de identificar incêndios antes que comecem.

**Impacto Operacional:**
Planejamento não substitui supervisão. Planejamento melhora a qualidade da supervisão. Um bom planejamento semanal reduz o número de decisões urgentes durante a execução.

**Impacto para UX:**
O sistema não pode separar artificialmente "planejamento" e "execução". O Supervisor transita entre horizontes o tempo todo — a interface deve permitir essa transição naturalmente.

**Impacto para Interface:**
A Home do Supervisor opera em três camadas visíveis simultaneamente, sem exigir troca de tela:

```
Camada 1 — HOJE
Status da operação · Exceções ativas · Ações urgentes

Camada 2 — PRÓXIMOS DIAS
Riscos previsíveis · Folgas críticas · Coberturas frágeis

Camada 3 — ESTA SEMANA
Dias críticos · Eventos importantes · Tendências de risco
```

**Riscos:**
Uma interface com apenas a visão de hoje força o Supervisor a navegar por múltiplas telas para montar mentalmente a visão da semana — aumentando a carga cognitiva no pior momento possível.

**Oportunidade para IA:**
*"Na sexta-feira existe risco elevado de cobertura. Apenas um substituto disponível para função crítica. Recomendo revisar já."*

---

### D10 — A IA deve falar como um colega que entende a operação

**Resposta Operacional:**
Em momento de crise, o Supervisor não usa comandos formais. Ele fala como falaria no WhatsApp: *"Quem pode cobrir a Astrid?"* ou *"O que acontece se eu tirar Amanda daqui?"*

A IA precisa entender perguntas incompletas e responder com o contexto operacional correto — sem pedir informações adicionais que o Supervisor não tem tempo de fornecer.

**Impacto Operacional:**
A IA tem dois modos de operação:
- **Crise:** rápida, objetiva, recomendação primeiro
- **Planejamento:** analítica, preventiva, identifica riscos futuros

**Impacto para UX:**
A IA não pode ser um chatbot genérico. Deve parecer um copiloto que conhece os shows, os livros, as folgas, as restrições e a escala — e usa esse conhecimento para interpretar perguntas curtas.

**Impacto para Interface:**
A resposta da IA segue hierarquia visual clara:
```
🟣 Problema identificado
🟢 Recomendação + motivos
🟡 Alternativas disponíveis
⚠️ Riscos desta decisão
📋 Impactos em outras atividades
```
Primeiro a decisão. Depois a justificativa. Detalhes sob demanda.

O que NÃO fazer:
- IA burocrática: *"Informe operação, espetáculo, data e horário"* → abandono imediato
- IA autoritária: *"Troca realizada"* sem explicar → perda de confiança

**Riscos:**
A confiança na IA nasce quando ela mostra seu raciocínio: *"Recomendo Amanda porque... Descartei Júlia porque... Existe risco de..."* O Supervisor precisa entender, não apenas concordar.

**Oportunidade para IA:**
Transformar perguntas incompletas em decisões completas. O Supervisor não precisa saber exatamente o que perguntar. A IA precisa saber como ajudar.

---

## Mapa Mental do Supervisor

```
INÍCIO DO DIA
"O que mudou?"
     ↓
Nenhuma exceção → Acompanha execução
     ↓
Exceção detectada → Análise de impacto
     ↓
"Quais atividades são afetadas?"
     ↓
Busca de alternativas → Classificação por risco (4 camadas)
     ↓
Simulação de efeito cascata
     ↓
Decisão → Atualização da operação
     ↓
Comunicação → Monitoramento de confirmação
     ↓
Execução alinhada
```

---

## Hierarquia de Valores do Supervisor

| Prioridade | O que importa |
|---|---|
| 1 | Visibilidade do todo — enxergar consequências invisíveis |
| 2 | Velocidade de decisão — não de execução |
| 3 | Confiança operacional — certeza de que o time sabe o que fazer |
| 4 | Antecipação de riscos — ver problemas antes que virem crises |
| 5 | Redução de carga mental — o sistema faz a análise, o Supervisor decide |

---

## O Maior Inimigo do Supervisor

Não é a falta de pessoas.

É perder a visão do todo.

> O papel do MyASA é transformar caos operacional em clareza de decisão.

---

## Princípios de UX derivados desta pesquisa

1. **Status antes de conteúdo.** O Supervisor precisa saber se há problema antes de ver qualquer lista.
2. **Impacto antes de ação.** Toda decisão deve mostrar consequências antes de pedir confirmação.
3. **Recomendação antes de opções.** O sistema orienta, o Supervisor decide.
4. **Cascata visível.** Toda substituição mostra os vazios que cria.
5. **Confirmação visível.** Toda comunicação mostra quem confirmou e quem não confirmou.
6. **Multi-horizonte sem troca de tela.** Hoje, amanhã e semana convivem na mesma superfície.
7. **IA contextual.** Entende perguntas curtas sem precisar de comandos formais.
8. **Complexidade escondida.** A operação é complexa. A interface não pode ser.
