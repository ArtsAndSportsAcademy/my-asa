# Etapa 2 — Check-in por turno

Data: 03/10/2026. Branch: `codex/myasa-novo`.

## Implementação

- Migração 0054: turnos globais, vigência a partir do dia seguinte, vínculo de
  check-in com turno e unicidade por pessoa, data e turno. RLS e rollback manual.
- Configuração de 1 a 3 turnos, sem sobreposição, com aviso de horários sem turno.
  Atividade nesse intervalo pertence ao turno anterior; sua janela se estende
  até o fim da última atividade publicada. Atividade nesse intervalo sem horário
  final precisa ser corrigida na Escala; a API não inventa um fim.
- Convocação somente por escala publicada. Abertura duas horas antes da primeira
  atividade. Chegada fora da tolerância fica registrada como atraso. Sem resposta
  e atraso sem chegada são estados próprios, não faltas presumidas.
- Pronta, Atraso com previsão, Cheguei e Falta com motivo, histórico mensal,
  indicadores de 30 dias, orientação sem sinal e telefone da supervisão quando
  compartilhado. A supervisão vê seu escopo; a Direção recebe só agregados.
- Aviso de falta para supervisão área+local e responsável do Livro do Show,
  sem expor o motivo na mensagem. Ocorrências continuam entidade separada.
- Escritas legadas por dia/bloco são recusadas quando o turno está configurado;
  projeções mantêm a Escala e o Livro do Dia sincronizados. Lembretes, Meu Dia e
  rotina de fechamento usam os turnos onde aplicável. As consultas da ASA de
  check-in próprio e da equipe passam a usar as ocorrências por turno.

## Validação

- Migração 0054 aplicada **somente no banco de teste**.
- Testes unitários das regras de turno e integração de configuração, janela,
  concorrência, transação/Registro, escopo, fechamento e API executados no banco
  de teste. Typechecks da API e do web app aprovados. Build web aprovado.
- Comparação visual com o desenho 19 em amostras locais para Administração,
  Direção, Supervisão e Elenco, no desktop e em 375 px. A visão da Direção foi
  inspecionada novamente após a restrição a números agregados.
- A suíte completa foi iniciada no banco de teste; registrar resultado e commit
  somente depois de sua conclusão e da reexecução do teste específico final.

## Limites

0054 **não foi aplicada em São Paulo/produção**; exige autorização específica.
Prévia visual sem login real não substitui homologação com contas reais.
Etapas 3–7 ainda não foram iniciadas nesta entrega.
