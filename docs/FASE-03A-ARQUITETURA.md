# Fase 03A — Arquitetura

O laboratório usa dois PBXs Flora e duas instâncias Asterisk como prestadoras simuladas. Cada par de telefonia está em uma bridge privada diferente. O Go continua no monólito e consulta o PostgreSQL. A base WebRTC, as filas, o histórico interno e o WebSocket preservam seus fluxos. A configuração UDP para ramais de teste existe somente nas cópias do laboratório.

O módulo `backend/internal/siptrunk` separa classificação, política, reserva e consumo. O endpoint SIP determina o contexto. A identidade de origem vem de uma variável configurada no endpoint autenticado, e o tenant vem da credencial do PBX. Nenhum deles é aceito como escolha do navegador. O AGI passa a decisão ao dialplan, o Asterisk executa sinalização e o handler de encerramento consolida o resultado disponível.

A migração 008 adiciona políticas e tentativas com RLS forçada, chave de chamada composta por tenant e índice por período. A reserva usa a mesma transação com lock por tenant das operações existentes. A tabela de tentativas guarda política aplicada, resultado de autorização e estado terminal. Há campos opcionais para ID da prestadora e tempo faturável, reservados para futura conciliação. Segundos conversados são operacionais.

O painel administrativo e a API `GET/PUT /v1/sip-lab` aparecem somente com o modo de laboratório configurado. Incluem estado administrativo do tronco, listas, ramais, destino de entrada, limites e agregado móvel de 24 horas. A superfície interna do AGI é autenticada separadamente e está fora das rotas que o Next encaminha. [API](openapi.yaml).

O perfil de laboratório contém um único tronco fixo por tenant. O módulo não provisiona hosts, credenciais ou registros SIP arbitrários. O próximo perfil poderá usar o mesmo contrato de autorização e persistência, após o aceite do perímetro e da configuração PJSIP.

## Encerramento durante indisponibilidade

O AGI de encerramento grava o resultado e o horário observado em uma fila SQLite local antes de devolver o controle ao Asterisk. A fila fica no volume persistente de cada PBX. O processo de reenvio sobe com o PBX de laboratório e remove uma entrada somente após o HTTP 204. O PostgreSQL atualiza a chamada autorizada do tenant uma única vez, preservando o horário observado dentro do intervalo válido da sessão.

A fila recupera eventos que chegaram ao handler do Asterisk e foram gravados em disco. Encerramentos anteriores a essa versão, perda do volume e quedas que impedem a execução do handler ainda exigem uma fonte independente de reconciliação. A expiração de reservas continua protegendo a capacidade.
