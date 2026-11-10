# Fase 03A.3 — Estabilidade e controles

## Chamadas consecutivas

O cenário original foi executado com dez iterações, alternando 201 → 202 e 202 → 201, nos mesmos dois contextos e sem recarregar a página. O cenário exige crescimento de pacotes RTP e energia de áudio nos dois sentidos em todas as chamadas, silêncio e reativação do microfone, troca da captura na primeira ligação, encerramento dos tracks e do peer connection ao final de cada chamada e dez novas chamadas com estado `completed` no histórico. A sequência passou com zero canais nos dois Asterisks e zero sessões abertas no PostgreSQL. A [falha anterior de toque](FASE-03A-3-DIAGNOSTICO.md) continua registrada.

[Log das dez chamadas](evidence/phase-03a-3/ten-calls/telephony-retest.log) · [Sinalização](evidence/phase-03a-3/ten-calls/cases/phase-01-1/chromium-consecutive-signals.json) · [Estado final](evidence/phase-03a-3/ten-calls/after.json)

## Antifraude e perímetro

- O simulador SIP privado passou a bateria de bloqueio por padrão e por ramal, destino inválido, internacional e serviços especiais, emergência, credencial inválida, precedência da lista de bloqueio, capacidade concorrente, limite de tentativas, entrada e saída, falhas de rota e tronco desabilitado. O retrato final registrou zero canais ativos. [Resultado do simulador](evidence/phase-03a-3/sip.json)
- Os guardas bloquearam redirecionamento e REFER do lado da operadora simulada com código 603. Durante a indisponibilidade do autorizador, não houve nova reserva nem chamada ao simulador. [Guardas](evidence/phase-03a-3/guard.json)
- As 24 verificações de AMI/ARI passaram nos dois Asterisks, com negativas de comandos administrativos e filas alheias, AMI nativo inacessível e ARI desativado. O ambiente WebRTC privado executou sem portas publicadas. [AMI/ARI](evidence/phase-03a-3/ami-ari.json) · [Portas do laboratório WebRTC](evidence/phase-03a-3/private-ports.txt)

## Recuperação e limites de observabilidade

O executor verifica prontidão, contatos PJSIP, canais, chamadas em aberto no PostgreSQL e reservas ainda válidas quando a tabela existe. Em caso de estado sujo, aguarda por até 75 s com sondagem a cada 2 s. Captura o estado final antes de liberar a próxima repetição. As falhas seguem visíveis no log de cada caso. A fase acrescentou instrumentação de teste e manteve o caminho de produção de replay persistente, deduplicação, reconciliação CEL e sinalização WSS 1006 da 03A.2.

Se CEL e a fila persistente de replay forem perdidos simultaneamente, pode faltar evidência terminal para reconstruir duração ou desfecho. O resultado `UNKNOWN` deve continuar explícito quando os dados não permitem recuperar esses campos. Um fechamento observado em um teste de indisponibilidade não cobre a perda simultânea desses dois registros.

[Recuperação da Fase 03A.2](FASE-03A-2-RECUPERACAO.md)

## Dois tenants e clientes WireGuard

O reteste final colocou duas chamadas simultâneas na fila 301 de cada tenant, em dois clientes WireGuard autorizados e quatro contextos de navegador. A fila do tenant A entregou ao 202 e a do tenant B ao 212. Ambas tiveram mídia sintética bidirecional. O histórico alheio retornou HTTP 404 nos dois sentidos e o replay WSS entregou 10 eventos próprios e zero alheios em cada tenant. A pausa e a retomada também passaram. O retrato final teve zero canais em ambos os Asterisks.

[Chamadas, mídia e eventos](evidence/phase-03a-3/isolation/queues-retry.json) · [Canais antes e depois](evidence/phase-03a-3/isolation/queues-retry.log)

O teste negativo de rede confirmou que cada cliente alcança apenas a porta WSS SIP autorizada. A requisição sem upgrade na porta autorizada recebeu HTTP 403 do serviço. A porta do outro tenant ficou inacessível. Uma tentativa de registrar o 211 pelo cliente reservado ao tenant A também resultou em WSS 1006, coerente com a política explícita do roteador. Esse 1006 tem contexto distinto da falha de toque registrada no cenário consecutivo.

[Matriz de portas por cliente](evidence/phase-03a-3/isolation/peer-perimeter.tsv) · [Tentativa de registro cruzado](evidence/phase-03a-3/isolation/queues-local.json)

Duas tentativas anteriores ficaram registradas. A primeira expirou aguardando **Em ligação** na chamada direta antes das filas, embora o diagnóstico subsequente tenha capturado ambos os lados conectados. A segunda abriu uma chamada por tenant, mas expirou na ação **Atender** em um dos navegadores. A causa dos atrasos de interação permanece indeterminada. O reteste aprovado usou apenas os dois clientes necessários para a prova de isolamento.

[Tentativa com chamada direta](evidence/phase-03a-3/isolation/queues.json) · [Primeira tentativa de filas simultâneas](evidence/phase-03a-3/isolation/queues-isolation.json)
