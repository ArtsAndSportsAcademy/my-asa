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

A planilha (aba **Personagens**) já tem as filas desses dois locais; os shows existem em produção,
mas **sem nenhuma vaga**, então os Livros do Dia deles nascem vazios.

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

## 5. Perguntas que ainda estão com a Babi

- Shows de Natal estreiam dia 22 e são diferentes dos atuais — montar quando ela mandar.
- Snowland volta a abrir às quartas em novembro: quando isso valer, a folga fixa da quarta muda.
- "A definir" na planilha: Técnico Musical (Snowland/Musical), Jingle e Bell (Teatro Natal).
- Horários do Goodbye às 15:45 e dos shows de hotel.
- Regra de recesso de 2027.
- A tabela de folgas montada automaticamente precisa de uma revisão com ela.

## 6. Ambiente de teste

Existe uma empresa de teste no banco de teste (organização com a marca `testemv09gz7j`), criada
para andar pelas telas sem tocar em dado real. Os scripts que a criam e a apagam ficam fora do
repositório, na pasta temporária da sessão, porque carregam senhas de teste. Para recriar algo
parecido, o caminho é um script que use `.env.test` e nunca `.env.producao`.
