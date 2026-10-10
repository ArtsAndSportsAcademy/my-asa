# Vagas de Buona e Bella — 10/10/2026

O cadastro segue a tabela de `continuar-daqui.md`: 11 vagas nos seis shows, cada uma com a fila
completa na ordem aprovada. No Pocket, os nomes são Nonna e Frida. Na Torre, Torre do Bella 1 e 2
até a confirmação dos personagens. Na Noite Alemã, Frida e Noite Alemã 2.

As três restrições da Noite Alemã ficam nas Observações, com a frase de que o rodízio não as
aplica automaticamente. A gestão precisa conferir a dupla e quem fará Frida antes de publicar.

## Aplicação

Não há mudança de schema nem migração. O preparador usa as rotas existentes do app; cada vaga e
as observações gravam Registro e versão na mesma transação da respectiva escrita.

Dentro de `artifacts/api-server`, com `MYASA_API_URL` (terminando em `/api`) e
`MYASA_ACCESS_TOKEN` de uma sessão autorizada somente no ambiente:

```powershell
node ./scripts/vagas-buona-bella.mjs             # apenas confere e mostra o plano
node ./scripts/vagas-buona-bella.mjs --aplicar   # cadastra depois da autorização
```

Nunca copie o token para documento, comando versionado, log ou conversa. A Babi autorizou a
gravação em produção nesta conversa em 10/10/2026. Como não havia sessão de produção aberta,
o cadastro foi feito em uma única transação direta no banco, após um ensaio revertido, com o
ator registrado como Codex autorizado pela Administração:

```powershell
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs ./scripts/vagas-buona-bella-banco.ts
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs ./scripts/vagas-buona-bella-banco.ts --ensaiar
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs ./scripts/vagas-buona-bella-banco.ts --aplicar
node --env-file=../../.env.producao ./scripts/verificar-vagas-buona-bella-banco.mjs
```

O último comando confirmou os seis shows, as 11 vagas, a ordem das filas, as observações da
Noite Alemã e os 12 eventos no Registro. O script de aplicação recusa uma nova execução porque
agora já existem vagas; essa recusa protege o cadastro contra duplicação.

A conferência exige exatamente um show por nome/local e uma pessoa ativa por nome. Ignora acentos
na correspondência e aceita os sobrenomes intermediários de Victor Emanuel Massalai, sem confundir
com o outro Victor. Qualquer ambiguidade interrompe antes da primeira escrita.

O lote inteiro não é uma transação: cada chamada é transacional. Em falha de rede, pare, confira o
Registro e rode primeiro sem `--aplicar`. Vagas já completas são reconhecidas; filas, nomes ou ordem
diferentes interrompem a retomada para não sobrescrever ajustes. Não rode duas aplicações ao mesmo
tempo nem edite os mesmos shows durante a aplicação. Observações anteriores são preservadas.

O script não gera nem republica Livros do Dia, não avança contadores e não convoca pessoas. Livros
já criados precisam de conferência própria pela administração; o cadastro não os preenche por trás.

## Conferência em teste

Com API local apontando para `.env.test`, a empresa de teste pronta e o site local aberto:

```powershell
node --env-file=../../.env.test ./scripts/validar-vagas-buona-bella.mjs
node --test ./tests/vagas-buona-bella.test.mjs
```

O ensaio acrescenta locais, pessoas e shows apenas à empresa descartável do roteiro
`empresa-de-teste.cjs`. Confere o cadastro pela API e a retomada sem duplicar vagas ou observações.
Credenciais permanecem no arquivo local ignorado pelo Git. A conferência visual deve abrir cada
show e conferir nomes, quantidade, filas e Observações da Noite Alemã.

## Coisinhas encontradas no cadastro atual

- Corrigido em Shows: o histórico escrevia "3 alteraçãoões". Agora usa "3 alterações".
- Corrigido em Shows: Esc fecha o editor de personagem sem salvar, conferido pela interface.
- A tela cadastra uma vaga por vez. O preparador resolve este lote; cadastro em lote na interface
  permanece uma melhoria separada.
- A remoção de vaga pede confirmação, é lógica e grava Registro, mas não há ação de restaurar vaga
  na interface. Não chamar a remoção de plenamente restaurável enquanto isso não existir.
- A rota registra a versão do show, mas o evento `showbook.version_created` não tem consumidor
  para avisar pelo sino. Falta definir quem recebe o aviso de mudança no molde e implementar.
- Falta confirmar se a Torre usa Nonna e Frida. A numeração provisória permite corrigir pela tela.

Estas pendências não foram corrigidas nesta tarefa de cadastro e devem ser separadas de erros no
resultado das filas. Folgas e Solicitações continua como próxima revisão, com as 15 perguntas do
AGENTS.md atualizado e a conta mensal de `regras-de-folgas.md`.
