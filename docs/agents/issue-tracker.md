# Issue tracker: GitHub

As issues e specs deste repositório ficam como issues do GitHub (`ArtsAndSportsAcademy/my-asa`). Use a CLI `gh` para todas as operações.

> **Nesta máquina (Windows):** o `gh` foi instalado em 16/10/2026, mas pode não estar no PATH de sessões abertas antes disso. Se `gh` não for encontrado, use o caminho completo: `& 'C:\Program Files\GitHub CLI\gh.exe' ...`. O login já foi feito (`gh auth status`). Criar e usar issues não depende do "pode enviar" da Babi; só o push de código e a promoção dependem.

## Convenções

- **Criar uma issue**: `gh issue create --title "..." --body "..."`. Use heredoc para corpos com várias linhas.
- **Ler uma issue**: `gh issue view <número> --json number,title,body,labels,comments`.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, com os filtros `--label` e `--state` que couberem.
- **Tornar uma issue sub-issue de uma pai**: `gh issue create --parent <pai> ...`, ou depois `gh issue edit <pai> --add-sub-issue <filha>` (`gh` 2.94+). Em `gh` mais antigo: `gh api --method POST repos/<dono>/<repo>/issues/<pai>/sub_issues -F sub_issue_id=<id-da-filha>` (id do banco, como em **Bloqueios** abaixo). Sem sub-issues, ponha `Part of #<pai>` no topo do corpo da filha.
- **Comentar numa issue**: `gh issue comment <número> --body "..."`
- **Aplicar / remover rótulos**: `gh issue edit <número> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <número> --comment "..."`

O repositório vem de `git remote -v`; o `gh` já faz isso sozinho dentro de um clone.

## Pull requests como porta de entrada da triagem

**PRs como porta de pedidos: não.** _(Mude para `sim` se este repositório tratar PRs externos como pedidos de funcionalidade; o `/triage` lê este campo.)_

Quando estiver em `sim`, os PRs passam pelos mesmos rótulos e estados das issues, com os equivalentes de `gh pr`:

- **Ler um PR**: `gh pr view <número> --comments` e `gh pr diff <número>` para o diff.
- **Listar PRs externos para triagem**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comentar / rotular / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

O GitHub usa uma numeração só para issues e PRs, então um `#42` solto pode ser qualquer um dos dois: tente `gh pr view 42` e, se falhar, `gh issue view 42`.

## Quando um skill diz "publicar no issue tracker"

Crie uma issue do GitHub.

## Quando um skill diz "buscar o ticket relevante"

Leia-o como em **Ler uma issue**, acima.

## Operações do wayfinder

Usadas pelo `/wayfinder`. O **mapa** é uma issue única, com **issues filhas** como tickets.

- **Mapa**: uma issue com o rótulo `wayfinder:map`, que guarda as Notas / Decisões até aqui / Névoa. `gh issue create --label wayfinder:map`.
- **Ticket filho**: uma issue ligada ao mapa como sub-issue do GitHub (ver **Tornar uma issue sub-issue de uma pai**). Onde sub-issues não estiverem habilitadas, ponha a filha numa lista de tarefas no corpo do mapa e `Part of #<mapa>` no topo do corpo dela. Rótulos: `wayfinder:<tipo>` (`research`/`prototype`/`grilling`/`task`). Ao ser assumido, o ticket é atribuído a quem está conduzindo.
- **Bloqueios**: as **dependências nativas de issue** do GitHub, que são a representação canônica e visível na interface. Crie a ligação com `gh api --method POST repos/<dono>/<repo>/issues/<filha>/dependencies/blocked_by -F issue_id=<id-do-bloqueador>`, onde `<id-do-bloqueador>` é o **id numérico do banco** (`gh api repos/<dono>/<repo>/issues/<n> --jq .id`, _não_ o `#número` nem o `node_id`). O GitHub informa `issue_dependencies_summary.blocked_by` (só bloqueadores abertos, que é o portão de verdade). Onde dependências não existirem, use uma linha `Blocked by: #<n>, #<n>` no topo do corpo da filha. Um ticket está livre quando todos os bloqueadores estão fechados.
- **Consulta de fronteira**: liste as filhas abertas do mapa (`gh issue list --state open`, restrito às sub-issues / lista de tarefas do mapa), descarte as que têm bloqueador aberto (`issue_dependencies_summary.blocked_by > 0`, ou issue aberta na linha `Blocked by`) ou responsável; vence a primeira na ordem do mapa.
- **Assumir**: `gh issue edit <n> --add-assignee @me`, a primeira escrita da sessão.
- **Resolver**: `gh issue comment <n> --body "<resposta>"`, depois `gh issue close <n>`, depois acrescente um ponteiro de contexto (gist + link) às Decisões até aqui do mapa.
