# Empresa de teste

Uma organização inventada, no banco de **teste**, para conferir as telas com servidor de verdade, entrando como cada
perfil e no tamanho do celular (375 px). Sem ela, as telas só se testavam com respostas simuladas.

## Como criar (uma vez)

Só roda no banco de teste: o script recusa qualquer outra URL (`MYASA_TEST_DATABASE_REF` do `.env.test`) e exige
`MYASA_E2E_QA=1`. A senha é **sorteada** a cada criação e gravada só no arquivo que você indicar, **fora do
repositório**. Ela nunca sai no terminal.

```powershell
# em artifacts/api-server
$env:MYASA_E2E_QA="1"; $env:MYASA_SENHAS_ARQUIVO="C:\caminho\fora\do\repo\senhas-empresa-de-teste.json"
node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@<versão>/node_modules/tsx/dist/cli.mjs scripts/empresa-de-teste.ts
```

Se a empresa "EMPRESA DE TESTE · My ASA" já existe, o script avisa e não muda nada. Para recomeçar, apague essa
organização do banco de teste.

## O que ela tem

- 2 operações (Snowland e Acquamotion), 4 locais (um deles encerrado), 4 áreas (uma desativada).
- Logins: `teste.admin` (Administração), `teste.direcao` (Direção), `teste.sup1` (Supervisão de Patinadores,
  nos dois locais da Snowland), `teste.sup2` (Supervisão de Bailarinos), `teste.elenco01` a `teste.elenco30`
  (Elenco; 28 a 30 só em Acquamotion), `teste.desligada` (desligada).
- **Produção sem supervisão de propósito**: a proposta de reunião do Elenco dessa área deve cair na Administração.
- `teste.elenco03` está de folga hoje e amanhã (para o ensaio que chama alguém de folga).
- Uma responsabilidade, um documento da Biblioteca que pede leitura.

## Como subir para testar

1. API contra o banco de teste: `node ./build.mjs` em `artifacts/api-server` e `preview_start` da configuração
   `api-server` (porta 3001, lê o `.env.test`).
2. Site: o Vite do projeto (porta 3000) já repassa `/api` para a 3001 quando `API_PROXY_TARGET` está definido.
3. Abra `/login`, entre com o login e a senha do arquivo. Para trocar de perfil, limpe `localStorage` e
   `sessionStorage` e entre de novo.

Nunca aponte isto para produção, e nunca escreva a senha em arquivo do repositório, em log ou na conversa.
