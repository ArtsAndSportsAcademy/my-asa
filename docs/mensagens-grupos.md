# Mensagens com grupos (15/10/2026)

As Mensagens são o chat da casa, no jeito do WhatsApp mas para o trabalho. Este arquivo guarda o que foi
decidido e como o app obedece. As decisões vêm de 14/10/2026 (ver também `docs/mural-aberto.md`).

## Decisões da dona do produto

- **A Administração não lê conversa de ninguém.** Ela (e a Direção) vê a lista de grupos e quem está em
  cada um, arquiva com motivo, mas só participante lê o conteúdo. Para ler um grupo da casa, ela entra
  nele de propósito, à vista de todos.
- **Qualquer pessoa cria grupo** (por tarefa, mídias…) e passa a ser a dona dele: convida, tira, muda o
  nome e arquiva. Nem a Administração mexe em grupo de uma pessoa (só arquiva, com motivo).
- **Grupos da casa** ("meninas", "meninos"…): criados pela Administração/Direção, que também organizam
  quem está neles. Quem criou o grupo da casa não entra sozinha. Quem está não sai (pode silenciar).
- **Grupo da área** continua automático (acompanha o cadastro) e não se arquiva.
- **Reações** nas mensagens (as mesmas seis do Mural), uma por pessoa, sem Registro.
- **"Visto por"** nas conversas de duas pessoas e nos grupos, **só para quem enviou** a mensagem.
- **Figurinhas da ASA** (14 poses de `/asa/*.webp`); foto, PDF e áudio esperam a medição do
  armazenamento (Supabase no plano grátis).

## O que o servidor garante

- **Registro sem texto.** `message_sent` guarda quem, onde e quando, nunca o conteúdo. Linhas antigas que
  guardaram o texto ficam mascaradas na leitura do Registro e fora da busca (`routes/history.ts`).
- **Conversa direta única:** abrir conversa com a mesma pessoa volta à existente (travada por par, para
  duas pessoas clicando juntas não criarem duas). O título é sempre o nome da outra pessoa.
- **"Visto" não mente:** a atualização automática da tela usa `?semLer=1` e não marca como visto. Marca
  ao abrir a conversa e, com a aba à vista e em foco, quando chega mensagem. O horário de leitura de cada
  pessoa não vai para os outros.
- **Aviso de mensagem nova: um por conversa**, não um por mensagem (o aviso aberto só tem o texto
  atualizado), entregue pela fila de notificações (mesma da escala e do Mural, na transação do envio).
  Quem silenciou não recebe. **Quem está de folga recebe no sino, sem push** (`semPush`). Abrir a
  conversa marca como lido o aviso dela no sino.
- Citar só vale para mensagem da mesma conversa; mensagem tem no máximo 4000 letras; grupo, 200 pessoas.
- `/messages/recipients` não devolve mais o e-mail dos colegas.

## Migração 0066 (`0066_mensagens_grupos.sql`)

Coluna `messages.kind` (TEXT/STICKER), colunas `message_threads.closed_by` e `closed_reason`, tabela
`message_reactions` (com RLS) e índice `(thread_id, created_at)` em `messages`. Os tipos de conversa
continuam em `message_threads.context_type` (texto): `DIRECT`, `GROUP`, `HOUSE_GROUP`, `AREA_GROUP`.
O rollback (`rollback/0066_mensagens_grupos.down.sql`) tira a tabela e as colunas; figurinhas já enviadas
ficam como texto com o nome da figurinha. **Ordem:** migração primeiro (produção, ela roda), depois API e site.

## Código

- API: `routes/messages.ts` (conversas, mensagens, reações), `routes/messages-grupos.ts` (grupos, integrantes,
  arquivar), `services/mensagens.ts` (figurinhas, folga, aviso único por conversa).
- Site: `pages/mensagens.tsx` e `pages/mensagens.css` (lista → conversa em tela cheia no telefone).
- Testes: `mensagens-grupos.test.ts`.

## Decisão de 15/10/2026: a mensagem toca o celular pelo site

- Respondida pela Babi: **sim**. `message.new` entrou em `WEB_PUSH_TYPES` (`services/web-push.ts`) e o
  `block7-integrity` agora fixa isso (6 tipos). O push web é **sempre genérico**: "Você tem uma mensagem nova —
  abra o My ASA", sem texto da conversa e sem o nome de quem escreveu. Quem está de folga continua sem push
  (`semPush`), e o silêncio noturno da pessoa segue valendo (o push espera o fim da janela).
- O texto de uma mensagem também deixou de entrar no Registro pelo ASA (antes `asa.ts` gravava o começo da
  mensagem ao enviar uma proposta confirmada). Linhas antigas: `lib/db/scripts/limpar-texto-de-mensagens-no-registro.sql`,
  que a Babi roda em produção (não é migração).

## Ainda não feito

Editar e apagar mensagem (com marca "apagada"), foto/PDF/áudio, enquete, compartilhar tela do app dentro da
conversa, mensagem que vira tarefa, @pessoa, grupo só de avisos, grupo temporário, presença "em show até…".
