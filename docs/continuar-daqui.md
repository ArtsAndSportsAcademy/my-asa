# Continuar daqui — 10/10/2026

Lista do que está em aberto, com o detalhe necessário para pegar do ponto certo. Leia antes
`AGENTS.md` (como trabalhar) e `docs/regras-de-folgas.md` (a regra real de folga).

## 1. Esperando promoção

A última promoção levou até o commit `fc4a326`. Depois dela entraram, já testados e no branch:

- Esc fecha os diálogos (Escalas, Livro do Dia, Check-in).
- Livro do Dia: botões Hoje/Amanhã (antes só dava para ver o dia corrente) e, na lista de Livros,
  a hora do evento e o nome do local — sem eles, dez livros do mesmo dia viravam dez linhas iguais.
- **A sessão deixou de cair quando o servidor falha.** Era o defeito mais sério: a renovação do
  acesso apagava a sessão em qualquer erro (queda, deploy, 500) com a credencial ainda boa, e a
  pessoa ia parar no login no meio do trabalho. Aconteceu com a Babi durante a promoção.
- A tela de entrada parou de dizer "usuário ou senha não conferem" para erro de servidor.

Não há migração pendente para estes: a 0060 já foi aplicada em produção.

## 2. Vagas de personagem de Buona e Bella

**Concluído no banco de produção em 10/10, com autorização específica da dona do produto.** Os seis
shows agora têm as 11 vagas abaixo, nas filas indicadas; a Noite Alemã guarda suas regras como texto.
O cadastro foi ensaiado no banco de teste, verificado na tela e conferido por leitura depois da
gravação. Não houve migração. O código de preparação está nos commits `d2a2725` e `345a92b`.

Quantidades confirmadas pela Babi em 10/10:

| Local | Show | Vagas | Fila (ordem do rodízio) |
|---|---|---|---|
| Buona | Palhacinhos | 3 | Julia, Isadora, Vinícius, Victor Massalai, Antônio, Junior |
| Buona | Antonella | 1 | Louis, Amanda, Cássia, Luize, Mariela |
| Bella | Noite Alemã | 2 | Daniele, Daiane, Julia, Amanda, Antônio |
| Bella | Pocket Nonna e Frida | 2 | Daniele, Daiane, Izabel, Amanda, Esther |
| Bella | Torre do Bella | 2 | Daniele, Daiane, Izabel, Amanda, Esther |
| Bella | Zuca | 1 | Julia, Daiane, Luize |

Nomes das vagas: use o nome do personagem quando existir (Nonna, Frida) e o nome do show numerado
quando não existir (Palhacinhos 1, 2 e 3). **Ela edita depois pela tela** — não trave nisso. Falta
ela confirmar se a Torre do Bella usa os mesmos personagens Nonna e Frida.

Regras da **Noite Alemã**, para guardar **como texto no show** (o rodízio não aplica sozinho, e isso
precisa ficar dito): *Dani ou Daia sempre precisam estar como Frida; Amanda e Daia não podem fazer
juntas porque nenhuma das duas fala alemão; Antônio só pode fazer quando está de férias da escola.*

## 3. Acquamotion

Os cinco shows (Opening, Boas Vindas, Musical, Acquashow, Goodbye) continuam "a definir" na planilha.
Enquanto isso, os Livros do Dia de lá nascem vazios e a Escala sinaliza "blocos sem ninguém" — está
correto, não é defeito. As cenas do Acquashow (Início, Duo, Trio, Finale; na primavera com Ponte)
já estão na planilha e podem ser montadas quando ela mandar o resto.

## 4. Próximo módulo: Folgas e Solicitações

Revisar tela a tela com o crivo do `AGENTS.md`, como foi feito com o dia de trabalho. Antes de
mexer em qualquer validação, ler `docs/regras-de-folgas.md`: a conta é **mensal**, a segunda folga
é condicionada à jornada completa, e o dia de parque fechado (quarta em Snowland, segunda em
Acquamotion) já é uma das duas folgas.

Revisão iniciada em 10/10: a antiga tela de “regime”, com corte semanal, contradizia a contagem
mensal e foi substituída por uma explicação da regra. Em Solicitações, a troca de perfil deixava
uma aba invisível selecionada e a falha ao carregar pedidos de folga era escondida. Essas correções
estão no branch, ainda sem promoção.

Decisões da Babi para a continuação: **o Elenco espera a republicação** para ver o mapa alterado;
quem pediu folga pode retirar o pedido enquanto está pendente; **Supervisão da área e Administração**
recebem o aviso de pedido novo; a gestão pode definir folga para **várias pessoas numa ação**.

Implementado no branch, ainda sem promoção: “Publicar mês” guarda o retrato das folgas no Registro,
e o calendário do Elenco, a Minha Escala e a consulta antiga de folgas usam esse retrato. A edição
posterior avisa a Administração para republicar; só então o Elenco recebe o mapa novo. Pedidos
pendentes podem ser retirados nas duas telas, com registro e aviso à gestão. A definição direta de
folga aceita várias pessoas, valida o alcance da Supervisão e grava cada pessoa no Registro dentro
da mesma transação. A amostra de Solicitações também passou a mostrar o pedido criado, para que a
retirada possa ser testada. Não foi criada migração: o retrato usa o campo JSON do Registro.

Validação em 10/10: `folgas-equipe.test.ts` passou com 29 verificações; o teste do ciclo operacional
passou com 20. Builds da API e do site passaram. As telas Folgas e Solicitações foram abertas e
clicadas em `?amostra=1`, inclusive em 375 px. O `tsc` completo continua com erros em dependências
e componentes anteriores, fora dessas telas; não há erro de tipo apontado nos arquivos alterados.
Conferência adicional em 10/10, com contas autenticadas da empresa de teste: a Administração publicou
o mês, alterou uma folga e republicou. O Elenco continuou vendo o primeiro retrato até a
republicação; depois viu a folga. Um dia gerado e publicado com dois Livros mostrou a folga na Minha
Escala e nenhum bloco para a pessoa. O pedido novo apareceu para Administração e Supervisão da área;
a pessoa o retirou antes da decisão, e a tentativa posterior de aprovação foi recusada. Os avisos
entraram na fila durável e apareceram no sino quando o agendador local processou a fila. A conferência
da interface em `?amostra=1` e 375 px permanece a validação visual desta fase.

Consulta somente de leitura em produção em 10/10: **não há evento de publicação mensal de Folgas**.
Outubro tinha 212 registros ativos de folga para 30 pessoas em uma operação; novembro a fevereiro
não tinham registros ativos naquele momento. Esses números podem mudar até a promoção.

**Transição preparada, ainda sem promoção:** a migração `0061_folgas_retrato_inicial` fotografa,
no Registro, as folgas ativas já visíveis de cada mês da operação. Esse retrato conserva a leitura
anterior do Elenco, mas não se apresenta como publicação. A Administração ainda vê “Publicar mês”.
Uma edição após a foto não chega ao Elenco até esse primeiro clique; então a publicação substitui
o retrato inicial. A migração tem rollback que desativa apenas os retratos que ela criou, sem apagar
folgas. Foi aplicada **somente no banco de teste**. Nele, uma folga de novembro permaneceu visível,
uma alteração posterior ficou escondida e a primeira publicação mostrou a alteração. O teste de
integração passou com 35 verificações; os builds da API e do site passaram. A tela de amostra foi
conferida em 375 px. O `tsc` completo ainda falha por erros anteriores de tipos do Express e de
dependências geradas, sem erro novo apontado no componente de Folgas.

Para produção, **a Babi roda a migração 0061 primeiro e promove o código depois**, em uma janela
sem edição de folgas entre esses dois passos. A foto é tirada quando a migração roda; uma mudança
feita no app antigo depois dela não entraria na foto. A primeira publicação de outubro continua
sob decisão da Administração, sem necessidade de acontecer no mesmo minuto da promoção.

## 5. Perguntas que ainda estão com a Babi

- Shows de Natal estreiam dia 22 e são diferentes dos atuais — montar quando ela mandar.
- Snowland volta a abrir às quartas em novembro: quando isso valer, a folga fixa da quarta muda.
- "A definir" na planilha: Técnico Musical (Snowland/Musical), Jingle e Bell (Teatro Natal).
- Horários do Goodbye às 15:45 e dos shows de hotel.
- Regra de recesso de 2027.
- A tabela de folgas montada automaticamente precisa de uma revisão com ela.

## 6. Ambiente de teste

Para andar pelas telas sem tocar em dado real, monte uma empresa de teste (precisa da API rodando
em `localhost:3001`):

```powershell
cd artifacts/api-server
node ./scripts/empresa-de-teste.cjs criar     # organização, locais, áreas, pessoas dos 4 perfis,
                                              # dois shows com vagas, Programação, turnos e uma folga
node ./scripts/empresa-de-teste.cjs apagar    # remove tudo o que ela criou
```

As senhas são **sorteadas em cada execução** e ficam em `scripts/empresa-de-teste.local.json`, que o
Git ignora. Nunca copie senha de teste para commit, para documento do repositório ou para a conversa
com o assistente: é o hábito que protege as senhas de verdade. O script recusa qualquer banco que não
seja o de teste.
