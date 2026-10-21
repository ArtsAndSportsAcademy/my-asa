# Handoff — Fechamento da revisão 4 e preparo da promoção (20/10/2026)

Quem lê só este arquivo deve conseguir continuar. Leia antes o `AGENTS.md` (agora com 19 perguntas no crivo) e, se quiser o relato
da revisão em si, `docs/handoff-2026-10-20-revisao-4.md`. Branch `codex/myasa-novo`. Nunca fazer merge na `main`.

## Em uma frase

A revisão 3, a revisão 4 e o fechamento estão feitos e a **bateria completa passou: 76 de 76 arquivos**. Falta enviar ao GitHub (22
commits locais, desde `82c98a3`) e promover: **a migração 0075 já foi aplicada em produção** (pela pessoa que constrói o app, em 20/10),
então a ordem que sobra é **API, depois o site**.

## Estado do git

- Enviado ao GitHub: tudo até `82c98a3`.
- **Local, sem envio (22 commits, `fefadbd` até `4b2dac3`):** a revisão 4 inteira (`d2bebf2`…`73d943d`) e o fechamento (abaixo).
- Nenhuma alteração solta em arquivo versionado. Ficam sem commit de propósito: `artifacts/brand/`, `docs/apresentacao/` (só na entrega) e
  `artifacts/web-admin/playwright.config.ts` e `tests/` (testes de tela, sem decisão).

## O que o fechamento fez (as decisões aceitas, aplicadas)

| O quê | Commit | Para quem usa |
|---|---|---|
| Limite de tentativas de senha (migração 0075) | `2c42899` | 8 senhas erradas em 15 minutos pausam a conta por 15 minutos; a tela diz por quanto tempo e o que fazer; a Administração é avisada |
| 114 telas e componentes mortos fora do site | `940ba1c` | Nada muda na tela (esse código já não ia ao navegador) |
| Restaurar documento arquivado; Direção lê as versões; Supervisão vê os temas sem documento | `1df5069` | Botão "Restaurar" (volta como rascunho, sem aviso) |
| Salvar bloco da Programação sobre versão velha dá 409 | `f44a179`, `56e84ad` | A segunda pessoa vê "Outra pessoa alterou este bloco…" e nada é apagado |
| "(local encerrado)" no cartão da Área | `3975154` | |
| Botões de resposta de pedido de folga a 44 px | `135d4de` | |
| 12 roteadores sem tela anotados | `ae343ff` | Só comentário |
| Script de migração com ensaio e freios | `b01bc13` | `lib/db/scripts/migrar-producao.ts` |
| Documentos (AGENTS, plano, mapa, regras) | `f8a1f7a` | |
| 3 testes atualizados | `0197409`, `1f6977b`, `4b2dac3` | Ver "Defeitos que a bateria achou" |

## Migração 0075 (limite de tentativas de senha)

- Arquivo: `lib/db/drizzle/0075_tentativas_de_acesso.sql`; desfazer: `lib/db/drizzle/rollback/0075_tentativas_de_acesso.down.sql`.
- **Aplicada em produção em 20/10/2026** pela pessoa que constrói o app, com `scripts/migrar-producao.ts`: "75 de 76 aplicadas, faltava só a
  0075; Pronto, a tabela existe e está protegida (RLS ligado)". Aplicar antes do código é seguro: a API que está no ar não usa a tabela.
- **Enquanto a API nova não for promovida, o limite não vale.** Só então as pessoas passam a ser bloqueadas.
- Para rodar migração em produção no futuro: na pasta `lib/db`, primeiro o ensaio (só lê), depois `--aplicar --so=<nome>`:

  ```powershell
  node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/migrar-producao.ts
  node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/migrar-producao.ts --aplicar --so=<migração>
  ```
  Nunca cole o SQL à mão no editor do Supabase: o registro do Drizzle não é atualizado e a próxima migração tenta criar de novo.

## Ordem para promover

1. ~~Migração 0075~~ **feita**.
2. Enviar ao GitHub (22 commits). Só com o "pode enviar" de quem constrói o app.
3. Promover a **API** (`my-asa`).
4. Promover o **site** (`my-asa-web`). Antes: `node scripts/verificar-nomes-build.mjs` (rodado em 20/10, limpo: nenhum dos 51 nomes do elenco no pacote).
5. Teste de fumaça em produção (abaixo) e conferir o backup do banco.

## Resultado das verificações

- **Bateria completa da API no banco de teste: 76 de 76** (um arquivo por vez). Primeira passada: 73 de 76; os 3 que falharam eram testes
  velhos ou de escopo e foram corrigidos e rodados de novo, todos verdes.
- Tipos da API, do site e do pacote do banco: limpos. Build do site: limpo. `verificar-nomes-build`: limpo.
- **Conferido na tela com navegador de verdade** (a 1280 e a 375 px): bloqueio de senha no login (a frase e o link "Esqueci minha senha"),
  restaurar documento arquivado (rodapé com Cancelar e confirmar, dentro da tela), conflito de dois navegadores na Programação (a segunda
  pessoa vê o motivo e o texto dela continua no campo), flash da Escala ao trocar de local, criar pessoa e criar operação clicando,
  folha de impressão com escala preenchida, e um passe nas telas do menu dos 4 perfis a 375 px (0 telas com estouro de largura ou frase de erro).
- Antes disso, a revisão 4 e a R3 (B, D, E) já tinham sido conferidas (ver os handoffs de 19 e 20/10).

## Defeitos que a bateria achou (e o que foi feito)

| Arquivo | Causa | Decisão |
|---|---|---|
| `block6-integrity` | Esperava que o Elenco mudasse o estado e apagasse ocorrência registrada pela Supervisão. A rodada 3 mudou isso de propósito | Teste atualizado para a regra atual (`0197409`) |
| `asa-capabilities` | Lia o texto de duas telas mortas que saíram do site, e a regra de quem lê os temas mudou | Teste atualizado (`1f6977b`) |
| `tentativas-de-acesso` | A asserção olhava todas as pausas do banco compartilhado, inclusive a de uma conferência na tela | Passou a olhar só o que o próprio teste cria (`4b2dac3`) |

## Teste de fumaça em produção (depois de promover) — para quem constrói o app

Entre com uma conta de cada tipo (Administração, Direção, Supervisão, Elenco) e confira que as telas abrem sem frase de erro:
Meu Dia, Escalas, Livro do Dia, Folgas, Mural, Mensagens, Biblioteca, Perfil. Anote quanto tempo cada tela leva para encher (no banco de
teste leva de 7 a 10 s; em produção não foi medido).
**Não teste o bloqueio de senha com uma conta de pessoa real:** ela ficaria pausada por 15 minutos. Se quiser ver a frase em produção, use uma
conta criada só para isso e, se travar, a Administração redefine a senha (isso acaba com a pausa).

## O que não foi conferido

- A assistente ASA **com IA** (o banco de teste não tem chave de IA): confira em produção, com a sua conta, o que ela propõe (tarefa para
  duas pessoas, folga em lote) e se pede confirmação antes de gravar.
- Desempenho em produção (ver acima).
- Mediação e troca de folga com colega na tela (os testes passam), dois navegadores no Livro do Dia e na Escala (só a Programação foi vista
  ao vivo; o resto pela API e pelos testes), push de verdade em outros aparelhos além do iPhone da R3-E.
- O botão "colocar foto" do Perfil mede 31 px de altura a 375 px; os outros links do Perfil têm área de toque maior. É detalhe, sem decisão.

## Depende da Babi (regra de negócio; já aplicado como recomendado)

1. **Supervisão da área que só tem local encerrado** vale como "área sem Supervisão": a Administração decide o pedido de folga na hora.
2. **"Grade pessoa × dia" e a Etapa 4 (experimentar grupos de folga) descartadas** até o primeiro mês real mostrar desequilíbrio de folga.

## Dados de teste que ficaram (podem ficar)

Empresa "ASA Teste" (12 pessoas) e "EMPRESA DE TESTE · My ASA" (4 locais): pedidos de folga de exemplo, documentos "R4 …" na Biblioteca
(o "R4 203301 área" está arquivado), operações "Operação R4 …" em configuração, e 2 pessoas "Pessoa R4 …" desativadas. A senha do
`teste.admin` da empresa de 4 locais foi redefinida só no banco de teste e está em `scripts/empresa-de-teste.local.json` (campo
`empresa4locais`, ignorado pelo Git); as contas de Elenco e Direção da "ASA Teste" trocaram a senha provisória (campo `senhaAtual`).

## O que fica para depois (e por quê)

- Tirar as rotas da API sem tela: mexe em `permission-matrix` e em cerca de dez testes; etapa própria, depois desta promoção.
- Tirar do `package.json` as dependências que só o código removido usava: muda o lockfile.
- Desativar formação por tela: ninguém pediu.
