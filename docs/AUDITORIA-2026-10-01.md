# Auditoria de tela e prontidão — 01/10/2026

## Atualização — correções feitas no mesmo dia (Claude)

| Item | O que mudou | Como foi conferido |
|---|---|---|
| **B1** perfil | "Nova pessoa" tem **Perfil** (Elenco, Supervisão, Direção, Administração); a pessoa nasce com o perfil em cada operação ativa. Na edição, dá para **trocar o perfil**, com motivo (`PUT /api/users/:id/perfil`). Ninguém troca o próprio perfil, e a última Administração não sai. A lista mostra "Sem perfil — não consegue entrar no app" para cadastros antigos. | Teste `fase-e-cadastro` (25 verificações), inclusive **a pessoa criada entrar no app** com o login gerado; mutações; tela na amostra. |
| **B2** supervisão | Botão **Supervisão** em cada área: um seletor por local, só com quem tem perfil Supervisão, ou "Ninguém (vai para a Administração)". Grava na hora, com Registro. | Teste (definir, recusar quem não é Supervisão, retirar); tela na amostra. |
| **B3** login | O app gera o **login e a senha provisória** e mostra os dois uma vez, logo depois de criar. O login aparece no cartão da pessoa (só para a Administração). | Teste e tela. |
| extra | **Local novo já nasce ligado à operação**; sem isso, a Escala do local não funcionava. | Teste. |
| I1 | Check-in do Elenco: só os próprios turnos, botão "Fazer check-in"; opções "Cheguei / Vou atrasar / Não vou"; erro dentro da janela. | Tela no celular (amostra). |
| I2 | "online agora" saiu; no lugar, "conversa direta" ou "N pessoas". | Tela. |
| I3 | Categorias da Biblioteca em português. | Tela. |
| I4 | Textos neutros: "Você está na convocação deste show", "Você não tem nenhum bloco na escala de hoje". | Tela e teste do Meu Dia. |
| I5 | Agenda: "Não consegui carregar a Agenda agora. Confira a conexão e tente de novo." | Código (nenhuma outra tela mostra erro técnico). |
| I6 | Tela de entrada: "Esqueceu a senha ou o login? Peça à Administração…". | Código. |
| I7 | Meus shows para o Elenco: sem "nasce do Livro do Show v1"; números "pessoas no show hoje / cenas hoje". | Tela. |
| Acabamento | Título não repete no celular. Palavras grudadas no Check-in separadas. Meu Dia vazio com frase própria; Administração sem locais é levada a "Cadastrar os locais". Faixa vazia e cartões altos em Pessoas. Rodapé da Biblioteca. Estrela de favorito em Shows com nome. Folgas do Elenco: "Suas folgas · Seu mês". | Tela (celular e computador). |
| Falso alarme | "Botões pequenos para o dedo": Meu Dia, Escalas e Meus shows já têm área de toque invisível de 44–48 px. Os botões "Ajustar" da Escala têm nome (só aparecem ao passar o mouse). | Leitura do CSS. |

Continua pendente: **B4** (planos pagos, decisão da dona do produto), **I8** (a verificação da ASA
— recado ao Codex) e a entrada em etapas.

## Como foi feita

- **Telas:** as 18 do menu novo.
- **Perfis:**
  - Administração no computador;
  - Elenco no celular (375 px, tamanho de iPhone);
  - Supervisão e Direção conferidas nos pontos em que a tela muda.
- **Dados:** modo de amostra (`?amostra=1`).
- **Verificação automática em cada tela:**
  - página mais larga que a tela;
  - texto cortado;
  - imagem quebrada;
  - botão sem nome;
  - link vazio;
  - "undefined"/"null" aparecendo para a pessoa;
  - área de toque pequena no celular.
- **Produção:** login, troca de senha e Meu Dia da Barbara, agendador e banco de São Paulo.
- **Código:** leitura dos formulários (Pessoas, Áreas, Locais) e das rotas do servidor.

## Veredito: entregar amanhã?

**Para a Barbara começar a montar a operação: quase.** Há um bloqueio de cadastro (B1–B3), que dá
para resolver em poucas horas.

**Para a equipe toda usar amanhã: não.** Além do bloqueio, a operação precisa ser montada:
- locais, áreas e pessoas;
- programação da escala;
- os Livros do Show com cenas e posições.

Isso é trabalho de dias, não de uma noite. O recomendado é uma entrada em etapas (ver o fim).

## Bloqueios (impedem o uso real)

| # | O quê | Onde | Efeito |
|---|---|---|---|
| B1 | **"Nova pessoa" não tem campo de perfil** (Elenco, Supervisão, Direção, Administração). O servidor cria a pessoa sem perfil nenhum. | `pages/cadastros.tsx`, `POST /api/users` | A pessoa criada **não consegue entrar**: o servidor recusa com "Conta sem perfil de acesso ativo". Também não há como trocar o perfil depois (só existia na tela antiga `admin/users.tsx`, que não abre mais). |
| B2 | **Não há tela para definir quem supervisiona cada área em cada local.** A tela nova só **mostra** a supervisão. | `pages/cadastros.tsx` (Áreas) | Sem isso, a Supervisão não vê ninguém, não decide folga nem pedido, e os avisos de pedido vão todos para a Administração. |
| B3 | **O nome de usuário nunca aparece.** O servidor cria sozinho (ex.: `julia.silva`) e não mostra em lugar nenhum. | `POST /api/users`, cartão da pessoa | A Barbara não sabe que login passar para cada pessoa. |
| B4 | **Planos grátis** (decisão A1). | Vercel Hobby, Supabase Free | O Hobby proíbe uso comercial. O Supabase Free pausa o projeto depois de dias sem uso, e o app cai. |

## Importantes (atrapalham ou confundem)

| # | O quê | Onde |
|---|---|---|
| I1 | **Check-in do Elenco mostra a visão de gestão**: "Quem chegou?", "Leitura do dia", "posições em risco", "Ocorrências". A bailarina precisa de um botão simples, "Cheguei". | `/check-in` (perfil Elenco) |
| I2 | **"online agora" fixo no código**: aparece em toda conversa, mesmo com a pessoa desligada. | `pages/communication.tsx` (Mensagens) |
| I3 | **Categorias da Biblioteca em inglês**: "SAFETY PROCEDURE", "RULES AND POLICIES". As telas antigas tinham a tradução. | `pages/communication.tsx` (Biblioteca) |
| I4 | **Texto no feminino para todos**: "foi convocad**a**" também para os homens do elenco. | `pages/livro-do-dia.tsx` (linhas 609 e 1095) |
| I5 | **Erro técnico na tela**: a Agenda mostra "HTTP 500 Internal Server Error" quando falha; as outras telas dizem "Não consegui carregar…". | `pages/agenda-workspace.tsx` |
| I6 | **Sem "esqueci a senha"**: a tela de entrada não diz o que fazer. O certo é avisar "peça à Administração", porque a redefinição já existe em Pessoas. | `pages/login.tsx` |
| I7 | **Termos internos para o Elenco** em Meus shows: "nasce do Livro do Show v1", "8/8 cenas em pé". | `pages/livro-do-dia.tsx` |
| I8 | **Teste da ASA (Codex)**: 1 falha, "Elenco não pode ver as responsabilidades da equipe". No fim, a limpeza quebra numa responsabilidade de teste ligada a uma pessoa de teste (`responsibilities_owner_id_fkey`). | `tests/asa-actions-http.test.ts` |
| I9 | **Lista de testes no GitHub cita arquivo que não existe** (`agenda-group.test.ts` → `agenda-group-d.test.ts`). Já corrigido aqui; falta subir. | `tests/run-tests.mjs` |

## Acabamento (layout e texto)

- **Título repetido em todas as telas, no celular:** o nome da tela aparece na barra de cima e de novo
  logo abaixo. Em Meus shows, Mensagens e Biblioteca aparece **três** vezes. Gasta ~60 px no topo
  do celular.
- **Áreas de toque pequenas no celular** (abaixo de ~40 px de altura):
  - "abrir a escala" e "abrir o Mural" no Meu Dia (17 px);
  - ‹ › Hoje / Amanhã / Calendário na Minha escala (29–30 px);
  - chips de cena no Meus shows (30 px).
- **Palavras grudadas:** "Musical do Natal**Livro** do Dia conectado" no Check-in.
- **Meu Dia, lista vazia:** "só o que pede atenção da administração" aparece duas vezes. E "0 locais
  com escala publicada hoje" poderia ser uma frase para quando não há nada.
- **Pessoas no celular:** faixa vazia entre o título e a busca, e os cartões têm muito espaço em
  branco embaixo.
- **Biblioteca no celular:** o rodapé do documento ("v2 · Barbara · Detalhes · PDF aguardando envio
  · Li e entendi") fica espremido e quebra em várias linhas.
- **Formulário Nova pessoa:** os campos não têm nome para leitor de tela.
- **Botões só com ícone, sem nome** (leitor de tela): 6 em Escalas e 16 em Shows.
- **Mapa de palco:** rótulos de 7 px.
- **Folgas do Elenco:** o título "Calendário do grupo" e o subtítulo "Sua linha" se contradizem.

## O que está bom

- **Nenhuma** página mais larga que a tela, imagem quebrada, link vazio, texto cortado ou
  "undefined"/"null", nas 18 telas, nos dois tamanhos.
- **Mascote:**
  - 12 das 14 poses em uso, nenhuma apontando para arquivo inexistente;
  - a pose do lançador muda com o horário (bom dia / feliz / sonolenta);
  - sem uso: `pensativa` e `travessa`.
- **Menu do celular** ("Mais") legível e completo. Mural, Solicitações, Folgas, Escalas e Shows estão
  bem montados.
- **Produção:**
  - login, troca obrigatória de senha e sessão funcionando;
  - banco de São Paulo respondendo em ~0,1 s;
  - agendador rodando a cada minuto com resposta "ok";
  - rotas novas protegidas.
- **Testes:** 40 de 41 arquivos passam no banco de teste. A única falha é a da ASA (I8).

## Plano sugerido

1. **Hoje/amanhã (Claude), antes de qualquer cadastro:** B1, B2, B3, I1, I2, I3, I4, I5 e I6.
   - B1: perfil no formulário de pessoa, e troca de perfil com motivo.
   - B2: supervisão por área e local na tela de Áreas.
   - B3: mostrar o nome de usuário depois de criar e no cartão.
   - Mais os textos.
   - Testes e conferência no navegador, como sempre.
2. **Codex:** I8 (teste da ASA) e subir a correção I9.
3. **Dona do produto:** B4 (planos pagos) antes de a equipe começar.
4. **Entrada em etapas:**
   - **Semana 1:** Barbara cadastra locais, áreas e pessoas (com supervisão); equipe instala o app
     e ativa os avisos; usam Escala, Check-in, Folgas, Solicitações e Mural.
   - **Semana 2:** Livros do Show com cenas e posições → Livro do Dia.
   - **Depois:** Biblioteca, Responsabilidades e tarefas, ASA ampliada.
5. **Opcional, para ganhar tempo:** se a Barbara me mandar a lista da equipe (nome, área, perfil),
   eu cadastro todo mundo de uma vez e entrego os logins e as senhas provisórias.
