# Fase 03A.2 — Confiabilidade pré-SIP

O Asterisk mantém o CEL em volume local, com identidade do tenant e identificadores de canal e chamada. O backend reprocessa o diário. A fila SQLite dos encerramentos AGI continua no volume de cada PBX e reenvia até receber HTTP 204. A autorização de saída continua dependente do PostgreSQL, com reserva transacional antes da discagem.

A recuperação pelo CEL usa o identificador vinculado da chamada. Um fim sem início original nem evidência de atendimento produz estado interrompido, sem duração ou resultado inferido. No laboratório SIP, um CEL terminal também pode liberar uma reserva autorizada do mesmo tenant com resultado `UNKNOWN`. Um encerramento AGI posterior com resultado conhecido refina esse estado sem duplicar a tentativa.

## WSS

O incidente histórico 1006 continua com causa indeterminada. O código do navegador registra os 32 eventos mais recentes por sessão na memória, incluindo início de conexão, conexão estabelecida, registro, recusa, desconexão e reconexão. `window.floraSipDiagnostics()` devolve identificador aleatório de sessão, tenant autenticado e estado de conexão do motor. O proxy privado registra apenas porta, status de upgrade, status upstream, protocolo TLS e duração. O teste Chromium coleta somente códigos reconhecidos de TLS emitidos pelo navegador.

Nenhum evento diagnóstico registra senha, número, IP de cliente, cookies ou mensagens SIP. O código 1006 indica fechamento anormal. Para classificar uma falha TLS, exigir erro de certificado ou negociação explícito e correlacionar o horário com o proxy e o estado AMI do tenant.

Critérios propostos para instrumentação operacional do piloto:

- Investigar três desconexões anormais no mesmo tenant em cinco minutos ou ausência de novo registro por mais de 60 segundos.
- Verificar cadeia, validade e nome do certificado quando o navegador emitir erro explícito de TLS. HTTP 101 comprova o upgrade.
- Separar falha anterior ao upgrade, falha do proxy upstream e rejeição do REGISTER. Preservar apenas metadados redigidos.
- A coleta atual fica no laboratório e na sessão do navegador. A integração com alertas operacionais do piloto permanece pendente.

O reinício controlado do proxy privado produziu 1006 na sessão Chromium instrumentada. O Asterisk permaneceu conectado e o mesmo identificador de sessão voltou a registrar SIP cerca de três segundos depois. O navegador não apresentou código de erro TLS nesse ensaio. Essa reprodução verifica o diagnóstico de uma interrupção controlada e deixa em aberto a causa do incidente histórico. [Rastro da sessão](evidence/phase-03a-2/browser/signaling-reconnect.json).

O proxy registrou upgrades HTTP 101 do cliente e do upstream com TLS 1.3. [Metadados do proxy](evidence/phase-03a-2/wss-edge.log).
