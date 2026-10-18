# Gerar o mês (como funciona e como medir)

Rota `POST /escalas/mes/gerar` → `gerarMes` em `artifacts/api-server/src/services/escala-mes.ts`. A tela
(`gerar-mes-dialog.tsx`) pede um bloco de dias por vez; cada chamada trabalha uns 15 s e devolve o que gerou e de onde
continuar. Dia já gerado é pulado, então repetir a chamada retoma sem duplicar.

## Como ficou rápido (18/10/2026)

De ~350 para ~50 idas ao banco por dia, ~61 s para ~10 s por dia na casa de teste (2 Livros/dia, banco de teste lento).
- Leituras que não mudam durante o mês (Show, elenco, sessões, Programação, folgas, regras do local) são lidas uma vez
  por chamada: `LeiturasDoMes` (`services/leituras-do-mes.ts`).
- O Livro é gravado em uma instrução por tabela; o retrato (snapshot) é montado em memória.
- Os conflitos de horário são conferidos uma vez por dia, para todos os Livros (`conferirConflitosDosLivros`).
- Os dias seguem em ordem e **nunca em paralelo**: o equilíbrio do rodízio depende dos dias anteriores.
- O que muda durante a geração (Livros já gerados, carga de trabalho) continua lido a cada Livro.

## Local sem operação

Local desligado de toda operação não gera: o resumo traz `semOperacao` e gerar responde 409 `LOCAL_SEM_OPERACAO`.

## Ferramenta de medição

`artifacts/api-server/tests/escala-mes-medida.ts` (fora da suíte; só roda no banco de teste). Monta uma casa fixa, gera N
dias, conta as consultas por tabela e grava uma "assinatura" do que foi gerado (quem está em qual vaga, retrato do Livro,
contagem do Registro). Rodar antes e depois de uma mudança e comparar prova que o resultado não mudou.

```powershell
# em artifacts/api-server
$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="escala-mes-medida.ts"; $env:MYASA_MEDIDA_DIAS="7"
$env:MYASA_MEDIDA_SAIDA="C:\fora\do\repo\antes.json"        # grava números e assinatura
# $env:MYASA_MEDIDA_COMPARAR="C:\fora\do\repo\antes.json"   # na segunda rodada: compara com a anterior
node --env-file=../../.env.test ./tests/run-tests.mjs
```

Para conferir a tela com a API de teste de verdade: `MYASA_MEDIDA_SERVIR=<arquivo>` e `MYASA_MEDIDA_SERVIR_PARAR=<arquivo>`
deixam a casa de pé, com a API na porta 3001 (ou na de `MYASA_MEDIDA_PORTA`) e um token de Administração gravado (vale 15 min) no primeiro arquivo, até o
segundo existir. `MYASA_MEDIDA_SEM_OPERACAO=1` desliga o local da operação antes. O token vale só no banco de teste.

Nota: `restricao-horario.test.ts` falha por um motivo antigo, não relacionado (issue #2).
