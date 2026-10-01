# Perfis e permissões

Quatro perfis. **Perfil é etiqueta, não tela diferente** — mesma rota, mesmo layout; o perfil
filtra itens de menu, dados e ações.

| chave | perfil | quem é hoje | resumo |
|---|---|---|---|
| `DIR` | Direção | Cris Garcia | vê tudo, quase tudo em leitura |
| `ADM` | Administração | Barbara Sorroche | configura e governa tudo |
| `SUP` | Supervisão | Deborah, Victor Oliveira, Stephani, Rodrigo | escopo da própria área |
| `MEM` | Elenco | as demais ~35 pessoas | só o que é dela |

"Elenco" é a palavra coletiva para quem não supervisiona — **não é uma área**.
As áreas são Patinadores, Bailarinos e Produção.

## Níveis de acesso por tela

- **total** — lê e escreve em tudo
- **leitura** — vê tudo, não altera (o estado padrão da Direção)
- **escopo** — só a própria área; um supervisor não escreve na área de outro
- **proprio** — só os próprios dados

| Tela | ADM | DIR | SUP | MEM |
|---|---|---|---|---|
| 17 Meu Dia | total | leitura | escopo | proprio |
| 20 Agenda | total | **total** | escopo | proprio |
| 15 Escalas | total | leitura | escopo | proprio |
| 13 Shows | total | leitura | escopo | proprio (consulta) |
| 14 Livro do Dia | total | leitura | escopo | proprio ("meus shows") |
| 19 Check-in | total | leitura | escopo | proprio |
| 18 Folgas | total | leitura | escopo | proprio |
| 07 Pessoas | total | leitura | escopo | — |
| 08 Áreas | total | leitura | escopo | — |
| 06 Locais | total | leitura | leitura | — |
| 04 Personagens | total | leitura | escopo | proprio |
| 22 Mural | total | total | escopo | leitura + ciente |
| 23 Mensagens | total | total | escopo | proprio |
| 24 Biblioteca | total | leitura | escopo | leitura |
| 16 Painel | total | leitura | escopo | — |
| 25 Reconhecimentos | total | leitura | escopo | proprio |
| 10 Responsabilidades | total | leitura | escopo | proprio |
| 28 Perfil | proprio | proprio | proprio | proprio |

## Regra crítica de segurança

**A permissão é validada no servidor, não escondida na tela.** Filtrar no front-end é
apresentação; sem checagem no servidor, quem souber o endereço vê tudo.

O protótipo tem um seletor "Ver como" que troca de perfil livremente — é **ferramenta de
revisão de desenho e não pode ir para produção**. Ninguém escolhe o próprio perfil.

## Contas

A Administração cria a conta e a pessoa entra com usuário e senha. **Sem convite, sem
autocadastro, sem aprovação.** Trocar o perfil de acesso de alguém exige motivo registrado.

Desligar uma pessoa: `ativa = false`, tira do grupo, desativa o acesso — **exige motivo**.
Nunca apagar a pessoa; o histórico dela é da operação.
