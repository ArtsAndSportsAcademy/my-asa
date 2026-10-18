# Cadastro de Operações (Etapa 1 do plano pós-revisão, 17/10/2026)

Tela **Gestão → Operações** (`/operacoes`, `artifacts/web-admin/src/pages/operacoes.tsx`). Só a Administração cria,
edita, ativa, pausa, encerra, reabre, liga locais e dá acesso a pessoas. A Direção só lê. Supervisão e Elenco não veem
o item no menu e, se abrirem o endereço, caem no Meu Dia.

## O que o checklist exige para ativar (regra do servidor)

Código: `getOperationsReadiness` / `evaluateOperationReadiness` em `services/operation-lifecycle.ts`. A ativação
(`PATCH /operations/:id/status` → `ACTIVE`) responde 409 `OPERATION_NOT_READY` com a lista enquanto faltar algo:

1. **Dados gerais e local** — nome, descrição, empreendimento (para quem a ASA trabalha) e **pelo menos um local aberto
   ligado à operação**. (Antes era o campo antigo `locations`, uma lista de textos que nenhuma tela preenchia; agora vale
   o vínculo real em `operation_locations`.)
2. **Identidade visual** — cor e ícone. Já vêm preenchidos ao criar; a tela deixa escolher a cor.
3. **Módulos relacionados** — a Administração marca que conferiu Escalas, Programação e Livros do Dia (`setup-review`,
   reversível).

Responsabilidades e tarefas não fazem parte do checklist: não são algo que a operação precise ter (decisão de 18/10/2026).
Pessoas com acesso também saiu do checklist: ao ativar, toda pessoa ativa da casa ganha acesso na hora (decisão de 18/10/2026), então exigir isso antes era uma etapa à toa. Os avisos de mudança de situação levam a Administração e a Direção à tela de Operações e a Supervisão ao Meu Dia, que é uma tela que ela vê.

## Regras das ações

- **Criar**: nasce em configuração (rascunho). Nome único (sem diferenciar caixa e espaços).
- **Editar**: nome, empreendimento, descrição, cor. Operação encerrada não se edita até ser reaberta.
- **Locais** (`PUT /operations/:id/locations`): um local pertence a uma operação só (409 com o nome da dona). Só mexe nos
  locais abertos; o vínculo de local encerrado fica para voltar junto se ele reabrir. **Operação ativa não perde o último
  local aberto** (409 `ULTIMO_LOCAL`). Local desmarcado fica sem operação até ser ligado a outra, e a tela avisa.
  O cadastro de local novo (`POST /locations`) agora aceita também operação em configuração.
- **Pessoas** (`POST /operations/:id/access`): várias de uma vez; cada uma ganha na operação o mesmo perfil que já tem na
  casa. Quem não tem perfil fica de fora, com o porquê. Operação ativa: as pessoas são avisadas no sino.
- **Ativar / reativar**: pede confirmação depois do checklist. Ao ativar, toda pessoa ativa da casa ganha na operação o
  mesmo perfil que já tem (decisão de 18/10/2026), na mesma transação, e o Registro conta quantas ganharam. Em toda
  mudança de situação, Administração, Direção e Supervisão (exceto quem agiu) recebem um aviso.
- **Fechar o último local**: encerrar (ou editar como fechado) o último local aberto de uma operação ativa é recusado
  (409 `ULTIMO_LOCAL`), também pela tela Locais (decisão de 18/10/2026).
- **Pausar**: motivo opcional. **Encerrar**: motivo escrito obrigatório, nada é apagado, some das listas de uso.
  **Reabrir**: motivo obrigatório; volta como "em configuração" e passa de novo pelo checklist.
- **A casa não fica sem operação ativa**: pausar ou encerrar a única ativa é recusado (409 `LAST_ACTIVE_OPERATION`),
  porque o perfil de cada pessoa é gravado em cada operação ativa.
- Toda escrita grava `writeHistoryEvent`/`writeEntityHistory` na mesma transação; o motivo vai em `metadata.reason`.
- `GET /operations/overview` (Administração e Direção) traz tudo da tela numa chamada: situação, locais, pessoas com
  acesso, checklist e o motivo do encerramento.

## Fora do escopo desta etapa (decisões abertas)

Nenhuma. Decididas em 18/10/2026: aviso a Administração, Direção e Supervisão; bloqueio do último local; acesso
automático ao ativar.

Sem migração: nada de schema mudou. Ordem para promover: API primeiro, site depois.
