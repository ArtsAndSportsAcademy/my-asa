# Relatório prévio — Homologação da Onda 1 no Replit

Data: 23/08/2026

## Objetivo

Validar a Onda 1 de segurança e perfis no projeto `MyASA-Desenvolvimento`, sem
alterar o aplicativo em Produção.

## Código que entrará no teste

- Branch de origem: `codex/seguranca-perfis-p0`.
- Alterações da Onda 1: elegibilidade organizacional da Escala, segurança de
  autenticação e autorização por perfil e suporte de validação no Windows.
- Registro formal da revisão e aprovação da responsável do produto.

## Ambiente confirmado

- Projeto Replit: `MyASA-Desenvolvimento`.
- Repositório conectado: `ArtsAndSportsAcademy/my-asa`.
- Branch atual do Replit antes da homologação:
  `codex/operacoes-validacao-replit`.
- Banco disponível: somente `Development Database`.
- O projeto nunca foi publicado.

## Dados de teste

- Usar exclusivamente o banco de desenvolvimento do Replit.
- Não reutilizar credenciais ou dados do banco de Produção.
- Criar apenas usuários e registros fictícios necessários para a matriz de
  perfis.
- Não ativar integrações externas de IA durante a homologação.

## Proteções

- Não publicar o projeto.
- Não criar `Production Database`.
- Não alterar Vercel, Supabase ou a branch de Produção.
- Não usar o Replit Agent, evitando consumo de créditos de IA.

## Retorno seguro

Se a homologação falhar, o Replit poderá voltar para a branch
`codex/operacoes-validacao-replit`. O aplicativo e o banco de Produção não são
afetados por essa troca.

## Critério de conclusão

A Onda 1 será considerada homologada somente após iniciar o aplicativo no
Preview, aplicar a estrutura necessária no banco de desenvolvimento e validar a
matriz de acesso dos perfis previstos.
