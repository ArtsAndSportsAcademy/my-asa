# Mural aberto (14/10/2026)

O Mural é o mural de uma escola: o lugar geral da casa. Avisos, publicações, reconhecimentos,
aniversários e datas especiais. Este arquivo guarda o que foi decidido e como o app obedece.

## Decisões da dona do produto

- **O Elenco também publica** (coisas gerais, para a casa, uma área, um local ou pessoas escolhidas).
  A Administração e a Direção derrubam o que não valer. Direção age como a Administração no Mural.
- **Aviso oficial x publicação.** Aviso oficial (`NOTICE`) é só da gestão: pede ciente, fica no topo e
  toca o sino. Publicação (`POST`) é de qualquer pessoa: não pede ciente e só avisa quem foi marcado ou o
  público de uma área/local — a casa inteira **não** recebe push de publicação.
- **Reconhecer vale para várias pessoas**, por grupo (área/local), pessoas específicas ou misturado,
  num post só. O reconhecimento é visto por todos.
- **Destino misturável** também em aviso e publicação. Um destino simples (a casa, uma área, um local)
  continua dinâmico (quem entra na área depois também vê). Qualquer mistura vira uma lista de pessoas
  gravada na hora (`announcement_recipients`) com um texto de destino (`destination_label`).
- **Editar:** quem publicou edita; no aviso oficial a Administração e a Direção também. A edição mostra
  "editado". No aviso que pede ciente, quem edita escolhe "pedir ciente de novo" (zera os cientes) e
  "avisar no sino"; por padrão a edição é silenciosa.
- **Remover é lógico e volta:** `cancelled_at` + motivo + `removed_by`. Quem publicou remove e desfaz a
  própria remoção; a Administração e a Direção removem qualquer uma e restauram qualquer uma; quem
  publicou **não** desfaz a decisão da Administração. O aviso de remoção só sai depois da janela de 10 s
  do "Desfazer" e cai junto se a pessoa desfizer. "Removidas" lista os últimos 60 dias.
- **Reações:** uma por pessoa, emoji da lista (❤️ 👏 🎉 😂 🙏 🎂), dá para trocar e tirar, e dá para ver
  quem reagiu. Reação **não** entra no Registro (seria ruído). Vale também para as Mensagens (a fazer).
- **Janela:** só o mês atual e o seguinte (fuso de São Paulo). Fica além da janela apenas o aviso que
  pede ciente e a pessoa ainda não deu. Publicação antiga com data de evento nesta janela continua;
  evento depois do mês que vem ainda não aparece. Meu Dia usa a mesma janela e não lista publicação
  casual para a casa inteira (as 3 linhas são de aviso, reconhecimento e do que é dirigido à pessoa).
- **Datas especiais** (Dia do Teatro, Dia da Dança…): se repetem todo ano; Administração e Direção
  cadastram; o Mural mostra na semana (uma linha) e no dia (cartão com a mensagem). Remover é lógico.

## Quem fica sabendo (sino)

| Acontecimento | Quem recebe |
| --- | --- |
| Aviso oficial publicado | o público do aviso (sem quem publicou); com ciente, como alerta importante e push |
| Publicação em área/local/pessoas | o público; para a casa inteira, ninguém |
| Reconhecimento | cada pessoa reconhecida, com quem reconheceu e o motivo |
| Aviso editado (se pedirem) | o público e quem publicou, menos quem editou |
| Aviso cancelado / publicação removida | o público do aviso e quem publicou, menos quem removeu; com o motivo |
| Voltou ao Mural | quem já tinha sido avisado da remoção |

Tudo entra no Registro na mesma transação (`writeHistoryEvent`), com o número de pessoas avisadas.

## Migração 0065 (`0065_mural_aberto.sql`)

Acrescenta o valor `POST` ao enum `announcement_type`, as colunas `edited_at`, `removed_by` e
`destination_label` em `announcements`, e a tabela `mural_datas_especiais` (com RLS). O rollback
(`rollback/0065_mural_aberto.down.sql`) tira a tabela e as colunas; o valor `POST` do enum não sai
(o Postgres não remove valor de enum) e as publicações `POST` já feitas continuam na tabela.
**Ordem:** migração primeiro (banco de produção, ela roda), depois o deploy da API e do site.

## Código

- API: `routes/communication-hub.ts` (feed, publicar, editar, ciente, reação, comentário, remover,
  restaurar, removidas), `routes/mural-datas.ts` (datas especiais), `services/mural-destinos.ts`
  (destinos misturados), `services/mural-janela.ts` (janela do mês e datas).
- Site: `pages/mural.tsx` (tela), `components/comm-ui.tsx` (janela, estados, helpers), estilo em
  `pages/communication.css`.
- Testes: `mural-avisos.test.ts` (sino e permissão de cancelar), `mural-aberto.test.ts` (publicação do
  Elenco, mistura, lote, editar, remover/restaurar, reações, janela, datas), `grupo-c-communication.test.ts`.

## Ainda não feito

- **Mensagens** estilo WhatsApp: feitas em 15/10/2026, ver `docs/mensagens-grupos.md`. Foto, PDF e
  áudio esperam medir o armazenamento (Supabase no plano grátis).
- O Mural **não** limita quantas publicações uma pessoa faz por dia. Se virar barulho, é o primeiro
  ajuste a considerar.
