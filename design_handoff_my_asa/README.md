# My ASA — pacote de entrega para desenvolvimento

App interno de operação artística da ASA: escala, check-in, folgas, livros de show e comunicação
de um elenco de ~40 pessoas em dois parques (Snowland e Acquamotion) e alguns shows de hotelaria.

## Para quem é este pacote

Serve às duas rotas de construção:

- **Desenvolvedor por empreitada** — leia tudo; o `README` e os seis documentos numerados são a
  especificação completa. Os `.dc.html` são referência visual.
- **Construção assistida por IA (Lovable, Bubble, similar)** — comece por
  `08-prompts-para-construir.md`: são textos prontos para colar, na ordem certa.

## O que são os arquivos .dc.html

**São referências de desenho, não código de produção.** São protótipos em HTML que mostram
aparência e comportamento pretendidos. Dados são fixos no código; não há servidor, banco nem login.

A tarefa **não é publicar esses arquivos** — é recriar as telas no ambiente escolhido
(React, Next.js, Flutter, o que for), com banco de dados e autenticação reais.

## Fidelidade: alta

Cores, tipografia, espaçamento e estados são finais. Recrie fielmente. Onde o pacote
diverge do arquivo, **o pacote vence** — ele já incorpora as correções de auditoria.

## Recomendação de stack

> **Se o app do piloto já existe**, esta seção é substituída pelo que está em
> `09-decisoes-confirmadas.md`: a API existente se mantém, o Supabase entra como banco, e não
> se constrói API nova do zero.

Web responsivo, **instalável na tela de início (PWA)**. Não precisa de app de loja: o elenco
acessa pelo navegador do celular. No iPhone a notificação push só funciona depois de instalado
na tela de início — instalar é passo obrigatório do primeiro acesso.

- Front-end React com roteamento
- Banco relacional (PostgreSQL) — o modelo em `01-modelo-de-dados.md` é relacional por natureza
- Autenticação por usuário e senha, validada no servidor
- Notificação push web
- Backup diário automático **com restauração testada antes do piloto**

Escala é irrelevante: 40 pessoas, uso concentrado em duas janelas do dia.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| `01-modelo-de-dados.md` | Entidades, campos e relações |
| `02-perfis-e-permissoes.md` | Os 4 perfis e o que cada um pode |
| `03-regras-de-negocio.md` | Regras decididas — não reabrir sem conversar |
| `04-telas.md` | As 18 telas, propósito e conteúdo |
| `05-design-tokens.md` | Cores, tipografia, espaçamento, componentes |
| `06-vocabulario-e-elenco.md` | Nomes reais e vocabulário da operação |
| `07-o-que-falta.md` | Auditoria: o que o desenho ainda não resolve |
| `08-prompts-para-construir.md` | Textos prontos para ferramenta de IA |
| `09-decisoes-confirmadas.md` | **Leia primeiro se o app do piloto já existe** — divergências auditadas e decididas, status dos 4 blocos de construção, hospedagem, mobile, adoção e troca |
| `10-bloco-2-entidades.md` | Prompt do Bloco 2 (histórico — já entregue) |
| `11-ligar-telas-api.md` | **Próximo passo.** Inventário de rotas, buracos conhecidos e mapa tela → endpoint |
| `12-seguranca-antes-do-lancamento.md` | Checklist de segurança e privacidade, com como testar cada item |
| `13-guias-por-perfil.md` | Quatro folhas de uma página para imprimir: elenco, supervisão, administração, direção |
| `14-piloto-uma-semana.md` | Roteiro do piloto com Deborah e Victor, e o que medir |
| `15-inventario-da-api.md` | Inventário real das rotas + status dos Blocos 5 e 6 |
| `16-decisoes-da-cris.md` | As cinco decisões de dono, com recomendação para cada uma |
| `17-shell-e-componentes.md` | **Leia antes de construir o front.** A moldura, os três arquétipos de página, os componentes que se repetem, e a ordem de construir |
| `dados-de-exemplo.json` | **Amostra oficial.** Pessoas, áreas, locais, shows com sessões, personagens com filas ordenadas, blocos por local. Carregue deste arquivo em vez de escrever amostra à mão — é o que impede nome inventado e combinação incoerente |
| `18-como-portar-uma-tela.md` | **Leia uma vez antes da primeira tela.** O que copiar e o que escrever, o que descartar da moldura de especificação, a conferência antes de mostrar, e os grupos de telas |
| `19-tela-13-shows-completa.md` | Especificação completa da tela 13 — os três modos, o Livro oficial em detalhe, e a tabela do que é fácil errar |

## Ordem de construção sugerida

> **Estado em 15/09/2026**: a Onda 3 (construção do backend) está concluída — os quatro blocos
> aceitos, suíte de 168 asserts passando contra Postgres real, migrações 0017→0022. O passo
> atual não é mais construir regra de negócio: é **ligar as telas à API** (`11`), fechar a
> segurança (`12`) e rodar o piloto (`14`). A ordem abaixo vale para quem começa do zero.

1. Banco + login + permissão no servidor
2. Pessoas, Áreas, Locais (o cadastro que tudo depende)
3. Escalas + Minha Escala
4. Check-in
5. Folgas
6. Shows + Livro do Dia + Personagens
7. Mural, Mensagens, Biblioteca, Agenda, Painel

Do 1 ao 5 é o piloto mínimo. Sem o Mural, porém, os avisos continuam no WhatsApp e o app só
soma trabalho — a dona do produto decidiu levar o app inteiro ao piloto.

## Privacidade — decidido

- **Atestado não entra no app.** O elenco é PJ; não se trabalha com atestados. O app registra
  ausência e prazo, nunca motivo médico.
- **Menores de 18**, se houver, precisam de autorização por escrito de quem responde por eles
  antes do primeiro acesso. A lista muda com aniversários: confira, não decida uma vez.
- **Retenção**: apagar automaticamente histórico operacional com mais de 12 meses.
- A LGPD pede um responsável nomeado pelos dados.

Isto não é parecer jurídico. Vale uma consulta curta com advogado.

## Assets

`assets/asa-wing.png` — marca. `assets/asa/*.png` — ilustrações da assistente ASA em estados
(consultando, aviso-importante, etc.). Copiados junto neste pacote.
