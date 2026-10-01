# Modelo de dados

Relacional. Nomes em português para casar com o vocabulário da operação.

## Pessoa
| campo | tipo | nota |
|---|---|---|
| id | uuid | |
| nome_completo | texto | nome e sobrenome, como a Administração cadastra |
| nome_de_exibicao | texto | **como a pessoa quer ser chamada no app** — ela escolhe no Perfil |
| usuario | texto único | login |
| senha_hash | texto | nunca em texto puro |
| area_id | fk Area | |
| local_padrao_id | fk Local | onde trabalha normalmente |
| perfil | enum | DIR, ADM, SUP, MEM |
| ativa | booleano | desligar = false, não apagar |
| menor_de_idade | booleano | exige autorização registrada |
| criada_em / desligada_em | timestamp | |

Sem CPF, sem endereço, sem dado de saúde. Só o que a operação usa.

**Dois nomes, de propósito.** A Administração cadastra o **nome completo** — é o registro formal
da pessoa na operação. A própria pessoa escolhe depois, no Perfil, o **nome de exibição**: é
como ela aparece na escala, no Livro do Dia e para os colegas. A casa fala Carol, Dani, Daia,
Victor M. — esse é o nome que vai na tela, e é escolha de quem é chamado, não de quem cadastra.

Regras:

- `nome_de_exibicao` nasce preenchido a partir do primeiro nome, e a pessoa ajusta se quiser.
  Ninguém fica sem nome na tela esperando configurar o Perfil.
- **A tela mostra o nome de exibição; a busca acha pelos dois.** Buscar "Victor Massalai" ou
  "Victor M." tem que achar a mesma pessoa (ver `30 Busca global`).
- Dois nomes de exibição iguais são permitidos — há duas Marielas possíveis numa casa de
  quarenta. É a segunda linha de contexto (área · local) que desempata, não o nome.
- No Registro de auditoria, grave o **nome completo**: é o documento de quem fez o quê.
- Trocar o próprio nome de exibição não exige motivo — é dado da pessoa sobre si mesma.

## Area
`id`, `nome` (Patinadores, Bailarinos, Produção), `supervisor_id` fk Pessoa.
Uma área pode ter supervisores diferentes por local (Bailarinos: Victor em Snowland,
Stephani em Acquamotion) — modele como `AreaLocalSupervisor(area_id, local_id, pessoa_id)`.

## Local
`id`, `nome` (Snowland, Acquamotion, Hotelaria), `tipo` (parque | hotelaria),
`encerrado` booleano, `encerrado_motivo` texto.

## Show (Livro do Show)
O padrão ideal: como o show funciona com todo mundo presente. **Nunca muda por causa de um dia.**

`id`, `nome`, `local_id`, `usa_personagens` booleano, `tipo` enum
(completo | so_personagens | simples), `publicado` booleano.

### Sessao
`id`, `show_id`, `inicio` hora, `fim` hora, `horario_chamada` hora **opcional**.
Um show pode ter várias sessões no dia (ex.: 10:00–11:00 e 16:00–17:00).

### Cena
`id`, `show_id`, `ordem`, `nome`, `formacao_id` fk Formacao (opcional).

### ShowPersonagem
Liga show a personagem: `show_id`, `personagem_id`.

## Personagem
`id`, `nome` (Astrid, Guardião, Chocolato, Igno, Mensageiro, Mensageira, Rainha, Yeti, Nanook),
`local_id`, `modo` enum (titular | rodizio).

### PersonagemElenco
`personagem_id`, `pessoa_id`, `ordem` (posição na fila de substitutos),
`vezes_feitas` inteiro (contador do rodízio).

**Titular**: o de `ordem` 0; se falta, cai para o próximo da fila.
**Rodízio**: entra quem tem menor `vezes_feitas`; empate desempata pela `ordem`.

**O contador soma 1 por pessoa e por dia** — não por sessão, não por show, não por linha
vencedora. Quem faz Astrid no musical das 12:30 e Astrid no Show Patinação das 14:00 no mesmo
dia soma 1. Incrementar mais de uma vez no mesmo dia corrompe o rodízio ao longo da temporada:
quem faz personagem em dois shows sobe na fila duas vezes mais rápido. Modele o incremento
como único por `(personagem_id, pessoa_id, data)`.

## Formacao
Biblioteca de disposições de palco, mora dentro do módulo Livro do Dia.

`id`, `nome`, `quantidade_pessoas` inteiro, `posicoes` json, `show_id` (opcional),
`vezes_usada`, `ultima_vez_em`.

**Indexada por quantidade de pessoas** — é assim que se busca: "preciso de uma formação para 7".
Não são sempre as mesmas pessoas.

## LivroDoDia
A cópia editável do Livro do Show numa data. **Nasce 80% resolvido.**

`id`, `show_id`, `data`, `local_id`, `estado` enum (rascunho | publicado | executado | cancelado),
`gerado_em`, `publicado_em`, `publicado_por`.

### LivroDoDiaCena
`livro_id`, `cena_id`, `formacao_id`, `resolvida` booleano.

Uma pessoa **não pode ocupar duas posições na mesma cena**. Sem alternativa elegível, a lacuna
fica em branco e sinalizada — nunca duplicada em silêncio.
Lacuna sem solução fica **em branco e sinalizada** — o app avisa que precisa resolver e
pode sugerir formações passadas com a mesma quantidade. Nunca preenche sozinho.

### LivroDoDiaPersonagem
`livro_id`, `personagem_id`, `pessoa_id`.
A mesma pessoa precisa aparecer em todos os livros do dia que usam aquele personagem.

## Escala
`id`, `data`, `local_id`, `estado` (rascunho | publicada), `publicada_em`.

### EscalaBloco
`escala_id`, `pessoa_id`, `inicio`, `fim`, `atividade` texto (o vocabulário em 06),
`show_id` opcional.

## Folga
`id`, `pessoa_id`, `data`, `tipo` (turma | pedido), `turma_id` opcional,
`estado` (pendente | aprovada | negada), `motivo_negativa` texto **obrigatório se negada**.

### Turma
Turmas **livres**, não fixas. `id`, `nome`, `mes`, `pessoas[]`.
Precisa do botão "repetir a configuração do mês anterior".

## CheckIn
`id`, `pessoa_id`, `data`, `turno`, `resposta` enum (pronto | atraso | falta),
`respondido_em`, `previsao_chegada` hora, `chegou_em`, `motivo` enum, `detalhe` texto.

**Sem fila offline.** Sem internet o app instrui avisar a supervisão por fora. Se ficasse na
fila, a supervisão veria a pessoa como quem não respondeu.

## Ocorrencia
Entidade própria, com estado — não um status escondido no check-in.
`id`, `pessoa_id`, `data`, `tipo`, `descricao`, `estado` (aberta | em_analise | resolvida),
`registrada_por`, `motivo` texto **obrigatório**.

## Aviso (Mural)
`id`, `autor_id`, `titulo`, `corpo`, `publicado_em`, `cancelado` booleano,
`motivo_cancelamento` **obrigatório**, `destinatarios` (área/local/todos).

### AvisoCiente
`aviso_id`, `pessoa_id`, `visto_em`.

## Registro (auditoria)
Toda ação sensível grava: `quem`, `quando`, `o_que`, `entidade`, `antes`, `depois`, `motivo`.

Guarda **as duas versões** numa escrita concorrente: a anterior e a nova. A última alteração
só prevalece quando a pessoa escolhe sobrescrever explicitamente — ver a regra de escrita
concorrente em `03-regras-de-negocio.md`.

## Versionamento para escrita concorrente
`LivroDoDia` e `Escala` precisam de `versao` (inteiro) ou `atualizado_em` comparável. Ao
salvar, o servidor compara com a versão que o cliente carregou; se mudou, responde com o
conflito e o que mudou, em vez de gravar.
