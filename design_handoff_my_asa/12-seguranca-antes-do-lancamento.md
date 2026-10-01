# Revisão de segurança antes do lançamento

Quarenta pessoas, dados de trabalho de gente real, três delas menores de idade. Não é banco,
mas é ficha de pessoa, motivo de falta e histórico de ocorrência. O risco não é invasão — é
alguém da operação ver o que não devia e a confiança no app morrer na primeira semana.

Isto é lista de verificação, não teoria. Cada item tem como testar.

## 1 · O que tem que estar fechado antes de abrir

> **Correção de segurança aplicada em 17/09/2026.** Achado no fim do Bloco 7: oito tabelas do
> `public` sem RLS e com grants ao papel anônimo — a chave anônima fica no front-end, então
> isso contornaria a matriz inteira dos Blocos 5 e 6. **Não houve exposição real**: o ambiente
> de produção ainda não existe, só o banco de teste.
>
> Corrigido: **85/85 tabelas do `public` com RLS, 0 grants anônimos.** As duas rotas com
> validação de organização insuficiente (`GET /api/requests/:id`,
> `GET /api/library/documents/:id/versions`) fechadas e cobertas pela matriz.
> 292/292 rotas protegidas devolvem 401 sem sessão. Suíte: 489 asserts.
> Banco vazio + 30 migrações = schema completo com RLS, sem passo manual.
>
> Os grants restantes em `realtime` e `storage` são dos schemas gerenciados do Supabase.
> **Um a revisitar**: quando a Biblioteca entrar, os arquivos (documentos e vídeos) provavelmente
> vão para o Supabase Storage — e é ali que a permissão passa a viver. Bucket privado, nunca
> público; a permissão de quem lê o quê continua sendo da API.

**Ambiente do piloto criado (17/09/2026).** Banco separado do de teste, 30 migrações aplicadas,
auditoria própria: 85/85 tabelas do `public` com RLS, zero grants anônimos. A suíte segue no
banco de teste e tem **trava que recusa a URL do piloto** — impossível apagar dado real rodando
teste por engano. Nenhum dado semeado: as contas do elenco nascem pela tela de Pessoas.

**O seletor "Ver como" não vai para produção.** Ele troca de perfil livremente. É ferramenta de
revisão de desenho. *Como testar:* procurar o componente no código e confirmar que não existe
caminho até ele em build de produção — não basta esconder o botão.

**Permissão checada no servidor, em toda rota.** O teste que prova: autenticar como MEM e
chamar direto o endpoint de outra pessoa e de outra área. Tem que voltar 403, não dado.
A suíte já tem 16 verificações de segurança de perfis — confirmar que elas cobrem as rotas
novas dos Blocos 2, 3 e 4, não só as antigas.

**Escopo do supervisor é real.** Deborah não escreve na área do Victor. *Como testar:*
autenticar como SUP de Patinadores e tentar salvar escala de Bailarinos → 403.
E o caso torto: Bailarinos tem supervisor diferente por local (Victor em Snowland, Stephani em
Acquamotion). Testar que Victor não escreve no Acquamotion.

**Direção é leitura.** DIR vê quase tudo e altera quase nada — as exceções são Agenda,
Mural e Mensagens, onde é total. *Como testar:* DIR tentando salvar escala → 403.

**Senha nunca em texto puro.** Hash no banco, e a senha não aparece em log, em resposta de
erro nem em telemetria.

**Sessão expira.** Sessão eterna num celular compartilhado de camarim é o vazamento mais
provável que este app tem.

## 2 · Os dados sensíveis, nomeados

| Dado | Quem pode ver | Cuidado |
|---|---|---|
| Motivo de falta (enfermidade, problema pessoal) | a pessoa, sua supervisão, ADM | **nunca no Mural, nunca em grupo, nunca no Painel com nome** |
| Ocorrência e seu histórico | a pessoa, sua supervisão, ADM | agregado no Painel sim; nome, não |
| Ficha de pessoa | ADM total, SUP escopo, DIR leitura | MEM não tem acesso à tela |
| Registro de auditoria | ADM, DIR | contém o "antes" de tudo — é o dado mais sensível do sistema |
| Pessoa menor de idade | ADM, sua supervisão | autorização registrada; não expor a marcação a MEM |

O modelo já ajuda: sem CPF, sem endereço, sem dado de saúde. Só o que a operação usa. Manter
assim — a pressão para adicionar campo "por acaso de precisar" vem depois do lançamento.

## 3 · Contas e desligamento

Conta é criada pela Administração. Sem convite, sem autocadastro, sem aprovação.
Trocar o perfil de alguém exige motivo registrado.

**Desligamento é o ponto que mais escapa.** Quando alguém sai: `ativa = false`, sai dos grupos,
acesso desativado, sessão ativa **invalidada na hora** — não na próxima vez que abrir o app.
Nunca apagar a pessoa; o histórico é da operação. *Como testar:* desligar uma conta de teste
com sessão aberta e confirmar que a próxima chamada dela falha.

## 4 · As cinco decisões que precisam da Cris

Estão em `07-o-que-falta.md` e continuam abertas. Nenhuma é técnica; todas são de dono.

1. Onde hospedar e quanto custa por mês.
2. Quem atende quando cai num domingo de show.
3. Quanto tempo os dados ficam guardados.
4. Quem é o responsável nomeado pelos dados.
5. Confirmação "tem certeza" **ou** ação imediata com "desfazer" nas ações irreversíveis —
   desligar pessoa, cancelar aviso publicado, negar folga, reabrir local, desativar formação.
   Minha leitura: "desfazer" para o que se usa o dia inteiro, "tem certeza" para o que não dá
   para desfazer, como aviso que já foi para o celular de todos.

**Sobre cair no domingo**: um app de 40 pessoas não sustenta plantão. Desenhe para a falha — a
escala do dia precisa existir fora do app, impressa no camarim ou no grupo na véspera. O app é
onde a escala **nasce**, não o único lugar onde ela **vive**. Vale a pena tratar isso como
requisito do lançamento, não como contingência: um botão de imprimir a escala do dia.
