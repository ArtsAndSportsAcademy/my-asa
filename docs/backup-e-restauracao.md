# Backup e restauração do banco (sem plano pago)

Feito em 23/10/2026. O Supabase do projeto está no plano grátis, que **não guarda backup automático**. Até existir um plano pago, o backup é
este: um script que você roda no seu computador. Em palavras simples: ele copia o banco inteiro para uma pasta, e outro script sabe ler essa pasta e
devolver os dados.

## O que é feito e o que é preciso lembrar

- **Quem roda:** quem constrói o app, no próprio computador. **Quando:** uma vez por semana, e **sempre antes de qualquer mudança grande em produção**
  (migração, limpeza de dados). Se só uma coisa for lembrada: antes de mexer em produção, faça um backup.
- **Quanto demora:** poucos minutos. No banco de teste, 116 tabelas e 14 mil linhas viraram 1,3 MB.
- **O script só LÊ o banco.** Não muda nada nele.

## Fazer o backup

No PowerShell:

```powershell
cd C:\Users\Usuario\Documents\MyASA\lib\db
node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/backup-producao.ts
```

**O que deve aparecer:** o servidor e a base (nunca senha), a lista das tabelas com o número de linhas, e no fim
`Pronto. N tabelas, N linhas, X MB compactados.` e o caminho da pasta, por exemplo
`C:\Users\Usuario\Backups-MyASA\2026-10-23_1530`.

Se aparecer `Parei:` e uma frase, leia a frase e me mande: o script diz o que houve.

### Onde guardar, e o cuidado que isso pede

- A pasta tem **dados de pessoas** (nomes, mensagens, escala) e os códigos das senhas (já embaralhados, mas ainda sensíveis).
- **Nunca** no repositório (o script recusa gravar lá), nem no Drive compartilhado, nem por e-mail.
- Guarde num lugar só seu e protegido (por exemplo um disco com BitLocker ou um zip com senha, e uma segunda cópia num pendrive guardado).
- Os logins abertos e a contagem de senha errada **não entram** na cópia: depois de restaurar, todo mundo só entra de novo.
- **Mantenha as últimas 8 cópias** e apague as mais antigas à mão. Uma cópia com mais de 3 meses deve ser apagada (tem dado de gente que pode ter saído).

## Conferir que a cópia está boa (faça uma vez por mês)

Isto não usa o banco e não precisa de senha:

```powershell
node ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/restaurar-backup.ts --pasta="C:\Users\Usuario\Backups-MyASA\2026-10-23_1530"
```

Deve dizer `Cópia conferida: N arquivos íntegros, N linhas.` Se disser `ESTRAGADO` ou `FALTA`, aquela cópia **não serve**: faça outra.

## Quando algo der errado: trazer de volta o que foi perdido

**O caso mais comum:** alguém apagou ou estragou alguns registros (folgas de uma pessoa, um documento) e você quer só aquilo de volta.

1. **Não carregue por cima do banco.** O restaurador não deixa. Ele carrega a cópia numa **área separada**, e dali você traz só o que precisa.
2. Carregue a cópia numa área nova (troque a data no nome):

   ```powershell
   node --env-file=../../.env.producao ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/restaurar-backup.ts --pasta="C:\Users\Usuario\Backups-MyASA\2026-10-23_1530" --aplicar --para-schema=restauracao_20261023
   ```

   Isto cria uma área chamada `restauracao_20261023` no banco, com todas as tabelas da cópia. **Nada do app é tocado.**
3. No **SQL Editor** do Supabase, olhe o que existia na cópia e não existe mais no app. Exemplo, folgas de uma pessoa:

   ```sql
   select * from restauracao_20261023.folgas where user_id = '<id da pessoa>';
   ```
4. Traga de volta só o que precisa (cada tabela tem a coluna `id`; `on conflict do nothing` não mexe no que já existe):

   ```sql
   insert into public.folgas
   select * from restauracao_20261023.folgas where id in ('<id 1>', '<id 2>')
   on conflict (id) do nothing;
   ```
5. Quando terminar, **apague a área**, porque ela tem uma cópia dos dados:

   ```sql
   drop schema restauracao_20261023 cascade;
   ```

Se você não souber qual tabela ou qual id, me diga o que se perdeu e eu monto a consulta.

## Desastre total (o banco inteiro se perdeu)

Isto é raro e exige cuidado: **me chame antes**. O resumo do caminho:

1. Criar um **projeto novo** no Supabase.
2. Rodar nele as migrações (`scripts/migrar-producao.ts`, apontando para o banco novo).
3. Carregar a cópia nas tabelas do app com `--aplicar --para-schema=public`. O script só carrega se **todas** as tabelas estiverem vazias.
4. Apontar a Vercel (variável `DATABASE_URL` da API) para o banco novo, e depois refazer o envio.
5. Todo mundo entra de novo, porque os logins abertos não entram na cópia.

**Limite honesto:** esse último caminho (carregar em `public` num banco novo e vazio) **não foi testado de ponta a ponta**. O que foi testado:
o backup, a conferência, a restauração numa área separada com comparação linha por linha (115 tabelas idênticas), a recusa de carregar em
banco cheio e a detecção de arquivo estragado. Vale fazer um ensaio completo num projeto novo e vazio do Supabase quando houver tempo.

## O que o backup NÃO é

- **Não é automático.** Se ninguém rodar, não existe. É por isso que o plano pago é melhor: ele roda sozinho todo dia.
- **Não guarda o histórico do dia a dia.** A cópia é um retrato de uma hora. O que mudou depois dela se perde numa restauração.
- **Não cobre a Vercel** (o código está no GitHub) nem o Sentry ou o Better Stack (são serviços de fora, sem dado do app).
