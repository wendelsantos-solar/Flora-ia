# Fase 03A.2 — Recuperação

| Momento | Comportamento seguro |
| --- | --- |
| Antes da autorização | A saída depende de reserva PostgreSQL confirmada. Falha no banco ou no AGI encerra a tentativa sem usar o tronco. |
| Chamada ativa | O CEL preserva eventos já emitidos em volume persistente. Registro terminal pode reconstruir histórico sem evento inicial. |
| Encerramento | O AGI grava na fila local. O CEL terminal libera reserva correlacionada quando o handler não gravou. O resultado fica desconhecido até chegar uma observação mais forte. |
| Queda simultânea ou perda da fonte de evidência | Sem CEL terminal nem item no outbox, a reserva expira pelo limite existente. A tentativa permanece sem confirmação e não conta tempo conversado. |

O fluxo usa a identidade de tenant atribuída pelo PBX após o grant. O consumidor só aceita CEL do tenant associado ao seu volume. O estado de consumo é atualizado apenas em tentativa previamente autorizada e com hora de criação anterior ou igual ao CEL terminal. Replay e eventos duplicados preservam a chave original.

A ausência de um evento inicial no histórico e a ausência da autorização são casos distintos. A reconstrução de histórico a partir de evidência do PBX não cria uma nova autorização.

## Evidência executada

No reteste final, a parada do banco antes da autorização gerou zero novos registros de reserva e nenhum canal para o simulador. Com o banco restaurado, uma chamada autorizada foi concluída com o handler AGI removido do dialplan de teste. O PostgreSQL registrou zero eventos iniciais do canal original, um evento de recuperação, resultado `UNKNOWN` e duração nula. Uma chamada seguinte obteve a mesma capacidade e terminou com `ANSWER` e 12 segundos comprovados pelo handler normal. [Experimento PJSIP](evidence/phase-03a-2/cel-recovery.json).

O primeiro ensaio com suspensão do processo PostgreSQL excedeu o prazo de limpeza e deixou uma reserva sem canal observado no tronco. O limite do autorizador agora é de 1,5 segundo no Go, e o AGI descarta grants que ultrapassem dois segundos no seu relógio monotônico. A identificação do canal passa a estar disponível antes da consulta ao autorizador. A repetição aprovada usou parada e reinício do banco. [Ensaio inicial](evidence/phase-03a-2/db-outage-attempt.json).

A integração PostgreSQL também aplicou o CEL terminal duas vezes, isolou o mesmo identificador em outro tenant e aceitou somente o primeiro encerramento AGI definitivo. [Integração](evidence/phase-03a-2/integration.log).
