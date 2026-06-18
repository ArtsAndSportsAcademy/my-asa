# MyASA 2.0 — Fechamento das Lacunas Críticas do Livro do Show

> **Versão:** 18/06/2026
> **Fase:** Decisão de Produto e Arquitetura Operacional — antes dos wireframes de S-13
> **Base:** Recuperação Arquitetural do Livro do Show · Arquitetura · Ciclo de Planejamento · Ciclo de Comunicação · Entidade MO · S-04 · S-05 · S-06 · D-01–D-20 · UX-01–UX-10 · WF-01–WF-10 · AU-01–AU-04
> **Natureza:** Fechamento de lacunas — não cria wireframes, não cria mockups, não cria componentes
> **Status:** 🟢 S-13 pronto para wireframe

---

## Premissa deste documento

As 5 lacunas críticas (LC-01 a LC-05) identificadas na Recuperação Arquitetural representavam decisões genuinamente ausentes — não ambiguidades ou redundâncias. Este documento as fecha com decisões formais de produto. Cada decisão é a menor decisão possível que resolve o bloqueio sem criar burocracia desnecessária.

---

## LC-01 — ALGORITMO DE RODÍZIO

---

### Pergunta central

Como o sistema calcula "de quem é a vez" em uma Linha do tipo Rodízio?

---

### Decisão oficial: Rodízio por Linha

O Rodízio é calculado **por Linha**. Cada Linha do tipo Rodízio mantém seu próprio contador de execuções, independente de outras Linhas — mesmo que sejam Linhas da mesma Posição em Blocos diferentes do mesmo Show.

**Por que por Linha e não por Show, Cena, Bloco ou Posição:**
- Por Show: agregaria execuções de papéis diferentes — dois personagens distintos no mesmo show poderiam ser contados como um
- Por Cena ou Bloco: a Cena e o Bloco são agrupadores estruturais, não a unidade de resolução
- Por Posição: uma Posição pode ter múltiplas Linhas com lógicas independentes
- Por Linha: a Linha é a unidade atômica — é o nível correto para um contador isolado

---

### Regra principal

O sistema coloca na posição o membro da rotação com o **menor número de execuções naquela Linha específica** que estiver disponível na data.

**"Disponível"** significa: sem folga aprovada + sem restrição ativa que conflite com as tags de exigência da Posição (D-18).

---

### Critério de desempate

Quando dois ou mais membros da rotação têm o mesmo número de execuções naquela Linha:

1. **Primeiro desempate:** quem foi alocado há mais tempo naquela Linha (data da última execução mais antiga)
2. **Segundo desempate:** ordem de posição configurada no Livro do Show (Rotação 1 tem preferência sobre Rotação 2, etc.)

O desempate nunca usa critério externo (por exemplo, carga total da semana ou número de shows no mês) — esses critérios são variáveis demais para resultar em comportamento previsível.

---

### Fallback quando ninguém elegível

Quando todos os membros configurados na rotação estão indisponíveis na data:

1. A Linha fica **Em Aberto**
2. O sistema gera alerta ao Supervisor com o contexto: "Rotação completa indisponível. Membros: [lista], razões: [folga/restrição para cada um]"
3. O Supervisor resolve manualmente — a resolução manual registra que foi uma exceção

---

### Como o Supervisor sobrescreve

O Supervisor pode sobrescrever a escolha automática do Rodízio no Livro do Dia. Ao sobrescrever:

1. O sistema registra que aquela execução foi **manual (exceção)**
2. O contador de execuções do membro escolhido manualmente **avança normalmente** — ele executou, independente de ter sido escolha automática ou manual
3. O contador do membro que "era a vez" **não avança** — o sistema não considera que ele "deveria ter ido"
4. O sistema **não** tenta "compensar" na próxima execução — o rodízio segue o contador como está

**Justificativa:** o contador mede execuções reais, não intenções do algoritmo. Compensações automáticas criariam comportamento opaco e difícil de auditar.

---

### Como o Histórico registra

Para cada publicação de Livro do Dia que contém uma Linha de Rodízio, o Histórico registra:

| Campo | Conteúdo |
|---|---|
| Linha | Identificação da Linha no Livro do Show |
| Data de execução | Data do show/ensaio |
| Membro executado | Quem foi alocado |
| Tipo de alocação | "Automático (Rodízio)" ou "Manual (Supervisor)" |
| Contador antes | Número de execuções do membro antes desta |
| Contador depois | Número de execuções após esta |
| Motivo manual | Preenchido apenas se alocação foi manual |

Esse registro permite que a IA responda: *"Por que a Diana foi alocada aqui se a Amanda tem menos execuções?"* — o Histórico tem a resposta.

---

### Decisão LS-D01 (nova)

> O Rodízio é calculado por Linha. A regra é: menor número de execuções naquela Linha, com desempate por data da última execução (mais antiga tem prioridade), com segundo desempate por posição configurada na rotação. Exceções manuais avançam o contador do executado, mas não geram compensação automática para quem "deveria ter ido". Todas as execuções são registradas no Histórico com tipo (automático/manual).

---

## LC-02 — FALLBACK DE DIA DA SEMANA

---

### Pergunta central

O que acontece quando uma Linha do tipo "Dia da Semana" não tem regra para o dia atual?

---

### Cenário concreto

Livro do Show define:
- Segunda → Amanda Souza
- Terça → Beatriz Lima
- Quarta → Carlos Andrade

Hoje é quinta-feira. O show acontece.

---

### Decisão oficial: campo Padrão obrigatório

Toda Linha do tipo "Dia da Semana" **obrigatoriamente** possui um campo **Padrão** configurado no Livro do Show. O campo Padrão define o comportamento para dias sem mapeamento explícito.

---

### Opções de Padrão configuráveis

| Opção de Padrão | Comportamento | Quando usar |
|---|---|---|
| **Pessoa fixa** | O sistema coloca a pessoa configurada como Padrão | Há sempre um "coringa" disponível |
| **Rodízio entre mapeados** | O sistema aplica lógica de Rodízio entre os membros já mapeados nos outros dias | A rotação deve cobrir os dias sem regra |
| **Em Aberto** | A Linha vai para Em Aberto automaticamente | Dias sem mapeamento não têm cobertura pré-definida — Supervisor sempre decide |

O campo Padrão não pode ficar vazio. Se Admin ou Supervisor não configurar explicitamente, o sistema aplica **"Em Aberto"** como padrão de segurança — o comportamento mais conservador.

---

### Alerta obrigatório quando Padrão = Em Aberto

Quando o Padrão é "Em Aberto" (configurado ou por omissão) e o show cai em um dia sem mapeamento explícito:

1. A Linha fica Em Aberto
2. O sistema gera alerta ao Supervisor com contexto: *"Esta Linha não tem mapeamento para [dia da semana] e o Padrão é Em Aberto. Dias mapeados: [lista]. Responsável: Supervisor."*
3. O alerta diferencia entre "Em Aberto por design" (Padrão configurado como Em Aberto) e "Em Aberto por ausência de configuração" (ninguém configurou o campo Padrão)

A diferença importa para auditoria: no primeiro caso, era esperado. No segundo, é um dado de configuração incompleta do Livro do Show.

---

### Validação no Livro do Show

Ao criar ou editar uma Linha do tipo "Dia da Semana", o sistema obriga o preenchimento do campo Padrão antes de salvar. Não existe Linha do tipo "Dia da Semana" sem Padrão configurado — exceto se o Admin explicitamente escolher "Em Aberto" como Padrão.

---

### Decisão LS-D02 (nova)

> Linhas do tipo "Dia da Semana" possuem campo Padrão obrigatório com 3 opções: Pessoa fixa, Rodízio entre mapeados, ou Em Aberto. Se não configurado, o sistema aplica Em Aberto como padrão de segurança. Quando o Padrão resulta em Em Aberto, o alerta ao Supervisor inclui contexto de quais dias têm mapeamento e distingue "Em Aberto por design" de "Em Aberto por configuração ausente".

---

## LC-03 — APROVAÇÃO DE MUDANÇA ESTRUTURAL NO LIVRO DO SHOW

---

### Pergunta central

Quem pode alterar o Livro do Show? Quem aprova? O que é estrutural versus o que é configuração?

---

### Decisão oficial: dois tipos de mudança, dois níveis de autoridade

#### Tipo A — Mudança Estrutural (Admin)

Mudanças que alteram a topologia do Livro do Show — a existência e o tipo dos elementos.

| Elemento | O que é Estrutural |
|---|---|
| Show | Criação · Descontinuação · Mudança de modelo (Simples → Estruturado) |
| Cena | Adição · Remoção · Renomeação |
| Bloco | Adição · Remoção |
| Posição | Adição · Remoção · Mudança de nome |
| Linha | Adição · Remoção · **Mudança de tipo** (ex.: Pessoa fixa → Rodízio) |
| Tags | Criação de nova tag no catálogo · Remoção de tag do catálogo |

**Autoridade:** Admin exclusivo. Supervisor não pode fazer mudanças estruturais diretamente.

**Fluxo quando Supervisor identifica necessidade estrutural:**
```
Supervisor identifica necessidade de mudança estrutural
↓
Supervisor cria Solicitação Administrativa (Tipo 8 em S-06) com motivo e proposta
↓
Admin analisa e executa (ou nega com motivo)
↓
Histórico registra: "Mudança Estrutural solicitada por [Supervisor], executada por [Admin]"
```

---

#### Tipo B — Mudança de Configuração (Admin ou Supervisor)

Mudanças que ajustam como os elementos existentes se comportam — sem alterar a topologia.

| Elemento | O que é Configuração |
|---|---|
| Show | Ajuste de nome, duração estimada, observações |
| Bloco | Reordenação dentro de uma Cena |
| Posição | **Aplicação e edição de tags** · Reordenação dentro de um Bloco |
| Linha | Troca de pessoa em Pessoa fixa · Adição/remoção de membro de rotação (sem mudar o tipo) · Ajuste da ordem de rotação · Troca de Titular/Substituto · Adição de dias mapeados em Dia da semana · Configuração do Padrão em Dia da semana |

**Autoridade:** Admin ou Supervisor (dentro do escopo de seu Grupo Operacional).

**Fluxo:**
```
Admin ou Supervisor edita diretamente
↓
Campo "Motivo da alteração" obrigatório (D-20)
↓
Sistema salva, registra no Histórico, sinaliza Livros do Dia futuros afetados (LC-04)
```

---

### Restrição crítica: sem edição durante janela de publicação

Quando um Livro do Dia está em estado PUBLICADO e o show está a menos de 72 horas:

- **Mudanças estruturais:** bloqueadas pelo sistema (Admin precisa justificar motivo de força maior para desbloquear)
- **Mudanças de configuração:** permitidas com alerta: *"Existem Livros do Dia publicados que serão sinalizados como Versão de Template Desatualizada."*

A janela de 72 horas existe para evitar que mudanças de última hora no Livro do Show gerem cascata de revisões em Livros do Dia com show iminente.

---

### Papel de Coreógrafo / Diretor Artístico no MVP

O perfil "Coreógrafo" não existe como perfil nativo do sistema no MVP. Na prática, quem tem autoridade artística sobre a estrutura do espetáculo recebe permissão de Admin ou de Supervisor com escopo ampliado. O sistema não modela intenção artística — modela autoridade operacional.

---

### Registro obrigatório de todas as mudanças

Toda mudança no Livro do Show — estrutural ou de configuração — gera registro no Histórico com:

| Campo | Conteúdo |
|---|---|
| Tipo da mudança | Estrutural / Configuração |
| Elemento alterado | Cena, Bloco, Posição, Linha (com identificação) |
| Antes | Estado anterior |
| Depois | Estado atual |
| Autor | Quem fez |
| Motivo | Obrigatório (D-20) |
| Livros sinalizados | Quantos e quais Livros do Dia futuros foram sinalizados |

---

### Decisão LS-D03 (nova)

> Mudanças no Livro do Show são classificadas em Estrutural (Admin exclusivo, via Solicitação Administrativa quando iniciada pelo Supervisor) ou Configuração (Admin ou Supervisor com motivo obrigatório). Mudanças estruturais durante janela de 72h antes de show publicado são bloqueadas por padrão. Toda mudança gera registro no Histórico. Perfil de Coreógrafo não existe no MVP — usa Admin ou Supervisor com escopo.

---

## LC-04 — SINALIZAÇÃO DE LIVROS DO DIA FUTUROS

---

### Pergunta central

O que acontece com Livros do Dia futuros quando o Livro do Show muda?

---

### Premissa inegociável (LS-P04)

Cada Livro do Dia registra qual versão do Livro do Show o gerou. Essa relação é imutável — o Livro do Dia executado sempre sabe de qual template nasceu.

---

### Decisão oficial: modelo de versionamento e sinalização

#### Versionamento do Livro do Show

Toda mudança que altera o comportamento do motor de geração cria uma nova **versão** do Livro do Show:

```
Livro do Show v1 (criação inicial)
  → Livros do Dia gerados de v1: 14/06, 21/06, 28/06
         ↓
[Admin remove Cena 3 — Mudança Estrutural]
         ↓
Livro do Show v2
  → Livros do Dia gerados de v2: 05/07, 12/07, 19/07
```

Mudanças que **não criam nova versão** (não afetam o motor):
- Renomeação de Show, Cena ou Bloco (sem impacto no motor)
- Ajuste de observações e notas
- Reordenação de Blocos dentro de uma Cena (apenas estética)

Mudanças que **criam nova versão** (impactam o motor):
- Qualquer mudança de tipo de Linha
- Adição ou remoção de Posição, Linha, Cena, Bloco
- Qualquer alteração em tags de exigência
- Troca de pessoa em Linha do tipo Pessoa fixa
- Alteração de rotação em Linha do tipo Rodízio
- Alteração de Padrão em Linha do tipo Dia da Semana

---

#### O que acontece com Livros do Dia futuros gerados da versão anterior

Quando o Livro do Show avança de v1 para v2, o sistema executa uma análise de delta:

1. **Identifica quais Livros do Dia futuros** foram gerados com base em v1 (estão na frente no calendário, ainda não executados)
2. **Compara v1 vs. v2** para identificar quais elementos mudaram
3. **Para cada Livro do Dia identificado**, verifica se alguma das posições/linhas daquele Livro foi afetada pela mudança entre v1 e v2
4. **Classifica cada Livro afetado** com o estado: **TEMPLATE DESATUALIZADO**

O estado TEMPLATE DESATUALIZADO é diferente do estado DESATUALIZADO (que vem de mudança operacional — folga, restrição). Precisam ser visualmente distintos porque o contexto e a ação do Supervisor são diferentes.

---

#### O que o Supervisor vê

Para cada Livro do Dia no estado TEMPLATE DESATUALIZADO, o Supervisor vê:

- *"O Livro do Show foi atualizado para v2 em [data]. Este Livro foi gerado com v1."*
- *"Posições possivelmente afetadas pela mudança: [lista das posições que mudaram]"*
- Três opções de ação:

| Opção | O que faz |
|---|---|
| **Regenerar** | Descarta o Livro do Dia atual e gera uma nova proposta com base em v2. Mudanças manuais feitas no Livro do Dia original são perdidas. O sistema avisa antes. |
| **Manter e revisar manualmente** | Supervisor mantém o Livro do Dia como está, mas revisa manualmente as posições afetadas. O Livro sai do estado TEMPLATE DESATUALIZADO após revisão manual explícita. |
| **Manter sem revisão** | Supervisor aceita o Livro como está, sem revisar. O Livro sai do estado TEMPLATE DESATUALIZADO mas registra no Histórico: *"Aceito pelo Supervisor sem revisão após mudança de template."* |

**Regra inegociável:** o sistema nunca regenera um Livro do Dia automaticamente. A decisão é sempre do Supervisor.

---

#### Livros do Dia ainda não gerados

Livros do Dia futuros que **ainda não foram gerados** não precisam de sinalização — quando forem gerados, o sistema usará automaticamente a versão mais recente do Livro do Show. Nenhuma ação do Supervisor necessária para esses.

---

#### Livros do Dia já executados

Livros do Dia do passado são imutáveis — preservam a versão do Livro do Show com a qual foram gerados para fins históricos e de auditoria. A IA pode responder: *"Este show de 14/06 foi gerado com o Livro do Show v1, que incluía a Cena 3. Na versão atual (v2), a Cena 3 não existe mais."*

---

### Decisão LS-D04 (nova)

> Toda mudança que afeta o motor de geração cria uma nova versão numerada do Livro do Show. Cada Livro do Dia registra permanentemente qual versão o gerou. Quando o Livro do Show avança de versão, o sistema analisa o delta v_anterior → v_nova, identifica Livros do Dia futuros afetados e os sinaliza como TEMPLATE DESATUALIZADO (estado distinto de DESATUALIZADO operacional). O Supervisor decide entre Regenerar, Manter e Revisar ou Manter sem Revisão — nunca o sistema decide automaticamente. Livros executados são imutáveis.

---

## LC-05 — TAXONOMIA DE TAGS DE EXIGÊNCIA OPERACIONAL

---

### Decisão oficial: categorias pré-definidas com rótulos livres dentro de cada categoria

O sistema oferece um **catálogo de categorias pré-definidas** (fixas, definidas pelo produto). Dentro de cada categoria, o Admin pode criar **tags específicas da Operação** (rótulos livres).

**Por que não apenas rótulos livres:** rótulos livres geram inconsistência ("acrobacia", "Acrobacia", "acrobác.", "acrobacia aérea") que o motor não consegue cruzar com segurança.

**Por que não apenas categorias pré-definidas:** cada Operação tem exigências únicas que não cabem em uma lista genérica.

**Solução híbrida:** categorias predefinidas + vocabulário livre dentro de cada uma.

---

### As 11 categorias oficiais

---

#### CAT-01 — Habilidade Artística

Define quais habilidades de performance são exigidas pela posição.

| Campo | Definição |
|---|---|
| Exemplos de tags | `ballet clássico` · `patinação artística` · `acrobacia aérea` · `contorção` · `dança contemporânea` · `canto lírico` · `canto popular` · `dança de salão` · `dança do ventre` · `jazz` · `sapateado` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem valida | Motor automático (cruzamento com restrições artísticas do membro) |
| Como afeta o motor | Exclui candidatos cujas restrições ativas conflitem com a habilidade exigida |
| Como afeta restrições | Restrição do tipo Artística (ex.: "restrição de acrobacia") é cruzada com tags desta categoria |
| Como aparece na IA | "Carlos não pode ser candidato para esta posição porque tem restrição ativa de acrobacia aérea, que é exigência desta posição." |

---

#### CAT-02 — Habilidade Técnica

Define habilidades operacionais/técnicas específicas do espetáculo ou da instalação.

| Campo | Definição |
|---|---|
| Exemplos de tags | `palco giratório` · `microfone lapela` · `rigging` · `maquinaria de cena` · `direção de cena` · `contrarregra` · `sonoplastia ao vivo` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem valida | Motor automático |
| Como afeta o motor | Exclui candidatos sem a habilidade técnica documentada |
| Como afeta restrições | Restrição Técnica é cruzada com tags desta categoria |
| Como aparece na IA | "Diana não está na lista de membros habilitados para operar maquinaria de cena." |

---

#### CAT-03 — Exigência Física

Define demandas físicas objetivas da posição.

| Campo | Definição |
|---|---|
| Exemplos de tags | `impacto em joelhos` · `levantamento acima de 15kg` · `extensão lombar extrema` · `carga cardiovascular alta` · `suspensão invertida` · `corrida contínua acima de 10min` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem valida | Motor automático (cruzamento com restrições físicas do membro) |
| Como afeta o motor | Exclui candidatos com restrição física que conflite diretamente com a tag |
| Como afeta restrições | Restrição Física (ex.: "restrição de impacto em joelhos") é cruzada com esta categoria |
| Como aparece na IA | "Eduardo tem restrição física de joelho registrada até 30/06. Esta posição exige impacto em joelhos." |

---

#### CAT-04 — Exigência Médica

Define exigências médicas documentadas para a posição.

| Campo | Definição |
|---|---|
| Exemplos de tags | `sem restrição lombar ativa` · `apto para atividade cardiovascular intensa` · `sem restrição respiratória` · `liberação médica para acrobacia` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin exclusivo (dados médicos exigem autoridade máxima) |
| Quem valida | Motor automático (cruzamento com restrições médicas do membro) |
| Como afeta o motor | Exclui candidatos com restrição médica que conflite com a exigência |
| Como afeta restrições | Restrição Médica é a mais forte — exclui candidato sem possibilidade de sobrescrever pelo Supervisor |
| Como aparece na IA | "Amanda tem Restrição Médica ativa. Esta posição exige liberação médica para acrobacia. A exclusão não pode ser sobrescrita manualmente." |

**Regra especial:** restrições da categoria Médica são invioláveis pelo motor. O Supervisor não pode sobrescrever um candidato excluído por restrição Médica diretamente — precisa de Admin para remover ou pausar a restrição com motivo documentado.

---

#### CAT-05 — Segurança

Define exigências de segurança operacional e certificações de segurança.

| Campo | Definição |
|---|---|
| Exemplos de tags | `treinamento de evacuação` · `certificação de trabalho em altura` · `treinamento de PPCI` · `primeiros socorros` · `operador de maquinaria pesada` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin exclusivo |
| Quem valida | Motor automático + alerta adicional quando segurança está em risco |
| Como afeta o motor | Exclui candidatos sem a certificação de segurança exigida. Gera alerta de "posição com exigência de segurança Em Aberto" — distinguido visualmente de outros Em Abertos |
| Como aparece na IA | "Esta posição exige certificação de trabalho em altura. Nenhum candidato disponível possui essa certificação. Posição sinalizada como Em Aberto por Segurança — requer atenção prioritária." |

---

#### CAT-06 — Certificação Profissional

Define certificações profissionais ou regulatórias (distintas de segurança).

| Campo | Definição |
|---|---|
| Exemplos de tags | `habilitado para condução de menores` · `registro profissional ativo` · `certificação de instrutor` · `alvará específico` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin exclusivo |
| Quem valida | Motor automático |
| Como afeta o motor | Exclui candidatos sem a certificação documentada |

---

#### CAT-07 — Personagem

Define quais membros estão habilitados para interpretar aquele personagem ou papel.

| Campo | Definição |
|---|---|
| Exemplos de tags | `habilitado para Astrid` · `habilitado para Rainha` · `habilitado para Mensageira` · `habilitado para Cavaleiro` |
| Quem cria tags | Admin (cria o rótulo do personagem) |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem aplica ao Membro | Admin · Supervisor (ao habilitar o membro para o personagem) |
| Quem valida | Motor automático (lista de habilitados por personagem) |
| Como afeta o motor | Para Linhas do tipo Personagem: apenas membros com tag de habilitação para aquele personagem são candidatos |
| Como aparece na IA | "Candidatos habilitados para Astrid nesta data: Beatriz Lima e Amanda Souza. Amanda está de folga. Candidato resolvido: Beatriz Lima." |

**Nota importante:** a habilitação de um membro para um personagem não é uma restrição — é uma qualificação positiva. O motor, para Linhas do tipo Personagem, trabalha com lista de habilitados (quem pode) em vez de lista de excluídos (quem não pode).

---

#### CAT-08 — Figurino

Define exigências de figurino que afetam a intercambiabilidade de membros.

| Campo | Definição |
|---|---|
| Exemplos de tags | `figurino tamanho P` · `altura mínima 1.65m` · `altura máxima 1.75m` · `figurino personalizado exclusivo` · `sem substituição por incompatibilidade de figurino` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem valida | Motor automático (cruzamento com dados físicos do membro, se cadastrados) |
| Como afeta o motor | Exclui candidatos com incompatibilidade de figurino documentada |
| Como aparece na IA | "Carlos não é candidato para esta posição: figurino exclusivo personalizado para Amanda. Substituição impossível por incompatibilidade de figurino." |

---

#### CAT-09 — Equipamento

Define exigências de proficiência em equipamentos específicos.

| Campo | Definição |
|---|---|
| Exemplos de tags | `patins inline` · `patins quádruplo` · `patins de gelo` · `trapézio` · `lira` · `tecido acrobático` · `roda-cyr` · `bicicleta acrobática` |
| Quem cria tags | Admin |
| Quem aplica à Posição | Admin · Supervisor (Tipo B) |
| Quem aplica ao Membro | Admin · Supervisor (ao registrar proficiência) |
| Quem valida | Motor automático |
| Como afeta o motor | Exclui candidatos sem proficiência no equipamento exigido |
| Como aparece na IA | "Eduardo é proficiente em patins quádruplo e patins inline. Esta posição exige patins quádruplo. Eduardo é candidato elegível." |

---

#### CAT-10 — Substituição

Define regras de substituição específicas que não se enquadram nas outras categorias.

| Campo | Definição |
|---|---|
| Exemplos de tags | `nunca substituir por membro do Grupo A` · `substituição apenas por aprovação do Admin` · `exige par específico (com [membro])` · `posição protegida — não rotacionar` |
| Quem cria tags | Admin exclusivo |
| Quem aplica à Posição | Admin exclusivo |
| Quem valida | Motor automático + alerta quando regra de substituição é ativada |
| Como afeta o motor | Aplica regra de exclusão ou de pré-condição conforme configurado |
| Como aparece na IA | "Esta posição tem regra: 'exige par com Beatriz Lima'. Beatriz está indisponível. A posição não pode ser resolvida automaticamente." |

---

#### CAT-11 — Cobertura Crítica

Indica que esta posição é operacionalmente crítica — não pode permanecer Em Aberto.

| Campo | Definição |
|---|---|
| Tag única | `cobertura crítica` |
| O que muda | O estado Em Aberto desta posição eleva automaticamente para alerta CRÍTICO (vermelho) — diferente de Em Aberto normal (âmbar) |
| Quem aplica | Admin exclusivo |
| Como afeta o motor | O motor tenta mais agressivamente (inclui candidatos Em Risco, expande a busca por perfil) e sinaliza ao Supervisor com prioridade máxima |
| Como aparece na IA | "ATENÇÃO: posição de Cobertura Crítica sem candidato. Esta posição não pode ficar Em Aberto. Candidatos com risco disponíveis: [lista]. Supervisor precisa decidir agora." |

---

### Tabela-resumo de governança das Tags

| Categoria | Quem cria a tag | Quem aplica à Posição | Violável pelo Supervisor? |
|---|---|---|---|
| CAT-01 Habilidade Artística | Admin | Admin · Supervisor | Sim, com motivo |
| CAT-02 Habilidade Técnica | Admin | Admin · Supervisor | Sim, com motivo |
| CAT-03 Exigência Física | Admin | Admin · Supervisor | Sim, com motivo |
| CAT-04 Exigência Médica | Admin | Admin exclusivo | **Não — requer Admin** |
| CAT-05 Segurança | Admin | Admin exclusivo | **Não — requer Admin** |
| CAT-06 Certificação | Admin | Admin exclusivo | **Não — requer Admin** |
| CAT-07 Personagem | Admin (rótulo) | Admin · Supervisor | Sim, com motivo |
| CAT-08 Figurino | Admin | Admin · Supervisor | Sim, com motivo |
| CAT-09 Equipamento | Admin | Admin · Supervisor | Sim, com motivo |
| CAT-10 Substituição | Admin exclusivo | Admin exclusivo | **Não — requer Admin** |
| CAT-11 Cobertura Crítica | Admin exclusivo | Admin exclusivo | N/A — é sinalização, não exclusão |

**"Violável pelo Supervisor"** significa que o Supervisor pode manualmente alocar um candidato que o motor excluiu por aquela categoria, com preenchimento obrigatório de motivo. O registro no Histórico deixa claro que foi uma exceção manual.

---

### Decisão LS-D05 (nova)

> Tags de exigência são organizadas em 11 categorias pré-definidas pelo produto. Dentro de cada categoria, o Admin cria tags específicas da Operação. CAT-04 (Médica), CAT-05 (Segurança), CAT-06 (Certificação), CAT-10 (Substituição) e CAT-11 (Cobertura Crítica) são de autoridade exclusiva do Admin — o Supervisor não pode aplicar nem sobrescrever. As demais categorias permitem aplicação pelo Supervisor (Tipo B) e sobrescrita manual com motivo obrigatório. Toda exclusão por tag gera contexto na IA explicando por que o candidato foi eliminado.

---

## AUDITORIA FINAL

---

### 1. O motor de geração do Livro do Dia está completo?

**Sim.** O motor tem definição suficiente para ser especificado para desenvolvimento:

- Algoritmo linha a linha documentado (Recuperação Arquitetural, Parte 4)
- Regra de cada tipo de Linha com fallback e estado gerado (Parte 3.4 da Recuperação)
- Algoritmo de Rodízio fechado (LC-01 → LS-D01)
- Comportamento de Dia da Semana sem regra fechado (LC-02 → LS-D02)
- Cruzamento com tags de exigência operacional fechado (LC-05 → LS-D05)
- Cruzamento com folgas e restrições já modelado no Ciclo de Planejamento

**O motor não é uma caixa preta** — cada decisão de exclusão ou seleção pode ser explicada pelo Histórico e pela IA.

---

### 2. O motor de restrições consegue operar com segurança?

**Sim.** O motor de restrições opera em duas camadas:

**Camada 1 — Exclusão por disponibilidade:**
- Folga aprovada → exclui o membro para aquela data
- Restrição ativa (qualquer tipo) → exclui se houver tag de exigência conflitante

**Camada 2 — Exclusão por incompatibilidade de exigência:**
- Cruzamento de CAT-01 a CAT-10 com o perfil do membro
- Exclusões das CAT-04, CAT-05, CAT-06, CAT-10 são invioláveis
- Exclusões das demais categorias podem ser sobrescritas pelo Supervisor com motivo

A segurança do motor está garantida pela inviolabilidade das 4 categorias críticas: nenhum Supervisor pode alocar manualmente um membro com restrição médica ativa, sem certificação de segurança exigida, sem certificação profissional exigida, ou violando regra de substituição crítica — sem aprovação do Admin.

---

### 3. A IA tem dados suficientes para explicar escolhas?

**Sim.** Para cada Linha resolvida, a IA tem acesso a:

- Por que cada candidato foi excluído (qual tag ou qual folga/restrição causou a exclusão)
- Por que o candidato resolvido foi escolhido (qual regra do tipo de Linha determinou a escolha)
- Se foi automático ou manual (e se manual, qual foi o motivo registrado)
- Histórico de execuções anteriores daquela Linha (para contexto de Rodízio)
- Versão do Livro do Show usada (para contexto de investigação histórica)

A IA consegue responder qualquer pergunta do Supervisor ou Admin sobre o Livro do Dia sem que o usuário precise abrir planilhas, registros externos ou fazer cálculos manualmente.

---

### 4. O Supervisor consegue entender por que uma linha ficou Em Aberto?

**Sim.** Toda Linha Em Aberto apresenta contexto inline:

| Tipo de Linha | Contexto mostrado |
|---|---|
| Pessoa fixa | "[Nome] está indisponível. Razão: [folga/restrição]. Nenhum fallback configurado." |
| Personagem | "Membros habilitados para [Personagem]: [lista]. Todos indisponíveis. Razões: [lista]." |
| Função | "Membros com [Função]: [lista]. Todos indisponíveis ou com conflito de tag." |
| Rodízio | "Rotação completa indisponível. Membros da rotação: [lista]. Razões: [folga/restrição para cada um]." |
| Dia da semana | "[Dia] sem mapeamento. Padrão configurado: [Em Aberto]. Dias mapeados: [lista]." |
| Titular + Substituto | "Titular [nome] indisponível: [razão]. Substituto [nome] indisponível: [razão]. Sem mais fallback." |
| Manual | "Linha tipo Manual — sempre Em Aberto. Supervisor resolve." |

O Supervisor nunca vê um Em Aberto sem explicação.

---

### 5. Mudanças futuras no Livro do Show são rastreáveis?

**Sim.** O mecanismo de rastreabilidade é completo:

- Versionamento numerado do Livro do Show (LS-D04)
- Cada Livro do Dia registra a versão do Show que o gerou
- Delta entre versões é comparável pelo sistema
- Livros do Dia futuros afetados são sinalizados como TEMPLATE DESATUALIZADO
- Cada edição do Livro do Show tem autoria, motivo e timestamp (LS-D03)
- A IA consegue cruzar versão histórica do Show com Livros do Dia do passado

---

### 6. Existe algum risco estrutural restante?

**Dois riscos residuais identificados — de baixa criticidade para o MVP:**

---

**Risco Residual R-01 — Algoritmo de Rodízio em estreia**

Na primeira execução de uma Linha de Rodízio (contador = 0 para todos), o desempate usa a posição configurada na rotação. Isso significa que a Rotação 1 sempre executa primeiro. Isso pode gerar percepção de favoritismo se o Supervisor não comunicar que é a configuração inicial.

**Mitigação:** o sistema permite que Admin configure a posição inicial do rodízio manualmente antes do primeiro show. Se não configurado, Rotação 1 é o padrão — com documentação clara no onboarding.

---

**Risco Residual R-02 — Tags de Figurino sem dados físicos do membro**

A CAT-08 (Figurino) funciona melhor quando os dados físicos do membro (altura, tamanho de figurino) estão cadastrados no sistema. Se não estiverem, o motor não consegue cruzar automaticamente — a exclusão por figurino só funciona se houver dado cadastrado.

**Mitigação:** para MVP, o motor de CAT-08 é semi-automático: o Admin configura explicitamente quais membros são incompatíveis com aquela posição por figurino (lista de exclusão por nome), em vez de cruzar por dado físico. A automação por dado físico é V2.

---

## INVENTÁRIO DAS DECISÕES PRODUZIDAS

| # | Decisão | Lacuna fechada |
|---|---|---|
| LS-D01 | Rodízio por Linha · menor contador · desempate por data/posição · exceção manual avança contador sem compensação | LC-01 |
| LS-D02 | Dia da Semana exige campo Padrão obrigatório · 3 opções · padrão de segurança = Em Aberto · alerta contextual distingue "por design" de "por omissão" | LC-02 |
| LS-D03 | Dois tipos de mudança no Livro do Show · Estrutural (Admin) e Configuração (Admin ou Supervisor) · motivo obrigatório · bloqueio em janela de 72h antes de show publicado · sem papel de Coreógrafo no MVP | LC-03 |
| LS-D04 | Versionamento numerado do Livro do Show · estado TEMPLATE DESATUALIZADO (distinto de DESATUALIZADO operacional) · três opções para o Supervisor · sistema nunca regenera automaticamente · Livros executados são imutáveis | LC-04 |
| LS-D05 | 11 categorias pré-definidas · tags livres dentro de cada categoria · 4 categorias de autoridade exclusiva Admin (Médica, Segurança, Certificação, Substituição, Cobertura Crítica) · toda exclusão gera contexto na IA | LC-05 |

---

## 🟢 S-13 Pronto para Wireframe

As 5 lacunas críticas estão fechadas. O Livro do Show tem:

- Motor de geração completo e auditável (Recuperação Arquitetural + LC-01 + LC-02)
- Modelo de governança de mudanças (LC-03)
- Versionamento e rastreabilidade de templates (LC-04)
- Sistema de exigências operacionais com taxonomia formal (LC-05)
- Motor de restrições com exclusões invioláveis e sobrescritas controladas

O wireframe de S-13 pode ser iniciado com base neste conjunto de decisões sem risco de revisão estrutural.

---

### Total acumulado de decisões formais do MyASA 2.0

| Série | Decisões | Documento |
|---|---|---|
| D-01 a D-10 | Ciclo de Planejamento Operacional | ciclo-planejamento-operacional |
| D-11 a D-20 | Ciclo de Comunicação Operacional | ciclo-comunicacao-operacional |
| UX-01 a UX-10 | UX Integrado | ux-integrado-ciclo-comunicacao |
| WF-01 a WF-10 | Wireframes Estruturais | wireframes-ciclo-comunicacao |
| AU-01 a AU-04 | Auditoria de Encerramento | auditoria-encerramento-nucleo-operacional |
| LS-C01 a LS-C12 | Confirmadas na Recuperação | livro-do-show-recuperacao-arquitetural |
| LS-D01 a LS-D05 | Lacunas fechadas | **este documento** |
| **Total: 61 decisões formais** | | |

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Decisões produzidas em 18/06/2026*
*Base: todos os documentos do núcleo operacional + Recuperação Arquitetural do Livro do Show*
