# Handoff — varredura, ASA secretária e limites de folga (16/10/2026, sessão 4)

Quem lê só este arquivo deve conseguir continuar. Leia antes `AGENTS.md` (o crivo das 16 "coisinhas"). Os handoffs
anteriores (`handoff-2026-10-16-sessao-3.md`, `-15-sessao-2.md`, `-16.md`, `-14.md`) seguem valendo para o que não mudou.
Branch: `codex/myasa-novo`. Nunca fazer merge na `main`. **Tudo abaixo está só em commits locais: nada foi enviado ao
GitHub nem promovido.** Quem roda migração em produção e dá o "pode enviar" é quem constrói o app.

## 1. O que entrou (8 commits depois de `4f841b6`)

| Commit | O quê |
|---|---|
| `ff39e4d` | Varredura de acessibilidade (axe + medição) nos 4 perfis, no celular e no computador: contraste do menu lateral, grupos de botões que se diziam "abas", rolagem da Escala por teclado, nome "ASA" dentro do círculo do botão, cabeçalhos de segurança no `vercel.json`. |
| `8b091de` | Registro: datas por extenso e "folga" em vez de `DAY_OFF` (só na exibição; nada gravado mudou). |
| `8b51a7e` | `docs/plano-asa-secretaria.md`: o que a ASA já faz, o que falta, fatias. |
| `04aa221` | **Fatia 1 da ASA**: pedidos prontos por tela e por perfil (`lib/asa-por-tela.ts`), pose por momento, o motor responde "O que tenho aqui?" em Painel, Solicitações e Áreas, respostas sem código de pedido nem data crua. |
| `75df43c` | **Fatia 2**: tarefa para várias pessoas (`para "Ana" e "Bia"`, `para mim e "Bia"`, até 20), um Registro e um aviso por pessoa. |
| `fdd50ad` | **Fatia 3**: folga em lote pela ASA (`coloque de folga "Ana" e "Bia" nos dias…`, `tire a folga…`), prévia com cobertura, só Administração e Supervisão da área. A regra do lote saiu de `/folgas/grid/bulk` para `recusaDeFolgaEmLote` e `aplicarFolgasEmLote` (`routes/folgas.ts`), usadas pela grade e pela ASA. |
| `b82e60b` | Testes apontados pela bateria completa; o celular passou a conhecer `FOLGA_LOTE`. |
| `e52d613` | **Migração 0070**: limite total de folgas por dia (casa toda) e limite por área, cada um ligável e com modo (só avisa / exige motivo), e **lembrete** a quem não responde (colega da troca, pessoa da proposta de dias). Janela "Regras do pedido de folga". |

## 2. Respostas da Babi nesta sessão (16/10/2026)

Confirmaram o que estava construído: prioridade antes de publicar; Supervisão primeiro depois de publicar, Administração
só com prazo de 3 dias (configurável); motivo escrito para dia sem cobertura (e pode ir primeiro à Supervisão); lista de
quem cobre = lista de substituições do Livro do Show; troca de um dia por vez; vários dias com parte possível → a
Supervisão propõe só os dias que dão; Supervisão única → vai direto à Administração.
**Mudaram o construído:** o limite de folgas é **no total por dia** (ex.: 10 pessoas, Snowland e Acquamotion juntos,
usado na alta temporada), podendo existir também por área — **feito na 0070**. Quer **lembrete** ao colega que não
responde — **feito** (padrão 24 h, uma vez, 0 desliga). Decisão de quem constrói o app: cada limite liga/desliga e tem
modo; "exigir motivo" nunca é trava absoluta.

## 3. Estado dos testes

Bateria completa da API (banco de teste): 56 de 59 → as 3 falhas foram resolvidas depois: `asa-capabilities` (expressões
velhas sobre a Biblioteca e o celular sem `FOLGA_LOTE`), `block5-integrity` (aviso sai pela fila; o teste agora entrega a
fila), `fase-e-ciclo` (estourava tempo: o banco de teste tinha 86 organizações e 65 locais abertos de testes antigos; os
57 locais das organizações-lixo foram **fechados** — logicamente — a pedido; ficaram a EMPRESA DE TESTE e a ASA Teste).
Rodados depois das mudanças, um a um: `asa-command-engine`, `asa-actions-http` (326), `folgas-equipe` (59), `folga-config`
(42), `folga-analise` (32), `block5-integrity`, `fase-e-ciclo`. **Não rodei a bateria inteira de novo** depois dos últimos
commits. Tipos: `tsc` limpo em api-server, web-admin e mobile. Para rodar um arquivo sem apagar a pasta de outra execução:
`$env:MYASA_TEST_OUT=".dist-x"` (o runner agora aceita).

## 4. Ordem para promover (quem constrói o app roda)

1. **Migração 0070** em produção (só uma nova; 0067–0069 já foram). Rollback em `lib/db/drizzle/rollback/0070_*.down.sql`.
2. **API** (`my-asa`), 3. **site** (`my-asa-web`). O site leva: acessibilidade, cabeçalhos de segurança, ASA nova, janela
   de Regras. Antes do site, rode `node scripts/verificar-nomes-build.mjs` (regra D1).
Depois de promover: conferir no iPhone os 3 itens de 15/10 (menu de locais, menu lateral, Perfil/senha/PDF), abrir Regras
do pedido de folga e salvar uma vez, pedir à ASA uma folga de teste e tirar.

## 5. Pendências e decisões abertas

- **Limite de tentativas no login**: não existe (dá para tentar senha à vontade). Decisão dela: **deixar assim por agora**,
  voltar quando o app estiver mais avançado com as pessoas. Precisa de tabela nova (migração).
- **ASA fatias 4 e 5**: recomendações da gerência no começo do dia; lembrar padrões da pessoa (opt-in). Ver o plano.
- Elenco recebe 403 em `GET /locations` e `/areas` em Shows/Pessoas/Responsabilidades (as telas toleram, mas é ruído) e a
  Supervisão em `GET /tasks`; botões "Dispensar aviso" e alguns links com menos de 36 px de largura; texto de 9 px com
  contraste baixo no mapa de Folgas; `maximum-scale=1` no `index.html` impede o zoom no celular (só tirar depois de
  conferir que nenhum campo tem menos de 16 px, para o iPhone não ampliar sozinho).
- **Desempenho do ciclo por minuto** (`/internal/ciclo`): cada local aberto custa ~1,6 s no banco de teste; em produção são
  poucos, mas se o número de locais crescer o ciclo precisa de olhar (montar a escala de cada local é a parte pesada).
- A Babi: conferir no telefone o Perfil e o PDF da Biblioteca e rodar `limpar-texto-de-mensagens-no-registro.sql`.
- Acquamotion sem vagas de personagem (planilha "a definir"); Buona e Bella com filas e sem vagas.
- Arquivos soltos não commitados (`.gitignore`, `AGENTS.md` parcial, `package.json`/`pnpm-lock` do Playwright, `.playwright-mcp/`,
  `my-asa-main.zip` etc.): limpar só com decisão dela.

## 6. Armadilhas desta máquina (descobertas nesta sessão)

- Ao gravar arquivos com Python dentro de heredoc, barras invertidas somem ou viram caractere de controle (`\b` virou
  byte 0x08, `\n` virou quebra de linha). Prefira o Write/Edit; depois confira com `grep -c $'\x08' arquivo`.
- `python3` não existe aqui; use `python`.
- O servidor de desenvolvimento da API (porta 3001) **não reinicia sozinho**: depois de mudar a API, reinicie para a tela
  refletir (a janela de Regras mostrou campos vazios por isso).
- A bateria compartilha o banco de teste com o servidor local; testes que leem notificações logo depois de enfileirar
  precisam chamar `processNotificationOutbox()` (o aviso sai pela fila durável).

## 7. Campanha de revisão com conteúdo completo (noite de 16/10/2026)

Detalhes em `docs/mapa-de-revisao.md` (seção "Campanha com conteúdo completo"). Commits novos depois do handoff acima: `940e948` (ASA
entende fala solta: nomes sem aspas, datas em palavras), `71bd2b2` + `907ecae` (rodízio sem personagem derrubava a geração do dia;
agora com teste), `f23fab1` (tarefas do Elenco, rodapé da Escala, API em JSON), `1ade287` (check-in diz quando abre, arquivo grande
em JSON). Defeito mais grave achado: **uma linha de rodízio sem personagem fazia "Gerar o mês/dia" falhar em todos os dias do local**
(a tela permite criar essa linha). Nada disso foi enviado ao GitHub nem promovido.

Como repetir o conteúdo: os roteiros ficaram na pasta temporária da sessão (cliente da API em `api.mjs`, `seed1` a `seed11`); eles
fazem login com a senha da empresa de teste lida de arquivo fora do repositório e criam shows, programações, escalas, folgas, mural,
mensagens, agenda, tarefas, biblioteca e cadastros. Quem quiser refazer num banco novo precisa reescrevê-los a partir das rotas.

