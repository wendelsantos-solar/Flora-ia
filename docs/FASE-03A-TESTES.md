# Fase 03A — Testes e evidências

**GO COM RESTRIÇÕES para laboratório. NO-GO para operadora e produção.**

## Sinalização real no simulador

A bateria Asterisk 20.22.0 usou PJSIP entre instâncias distintas e PostgreSQL real. Confirmou entrada e saída atendidas, ocupado, timeout, DID sem rota, credencial SIP inválida, bloqueio padrão, tronco desabilitado, limite de tentativas, ramal bloqueado, lista de bloqueio, destinos internacionais, especiais e de emergência, e discagem pelo contexto interno. Duas originações simultâneas tiveram exatamente uma reserva aceita e uma negativa por capacidade. O outro tenant permaneceu bloqueado com credenciais e PBX independentes. Os dois PBXs ficaram sem canais ao final. [Evidência SIP](evidence/phase-03a/sip.json).

O resultado `ANSWER` e os canais PJSIP observados provam estabelecimento e encerramento pelo motor. A bateria de tronco não mediu mídia perceptual ou capturou RTP bidirecional. O simulador usa chamadas sintéticas privadas. As estatísticas do CDR não incluem tarifa ou faturamento da prestadora.

## API, perímetro e regressões

A API recusou anônimo, operador, origem HTTP indevida e credencial administrativa no comando privado do PBX. O proxy Next retornou HTTP 200 para a API administrativa autorizada, 404 para o comando privado e 101 na abertura do WebSocket autenticado. O Compose registrou zero portas publicadas e três bridges internas. [API e WebSocket](evidence/phase-03a/web-proxy.txt), [perímetro](FASE-03A-PERIMETRO.md).

Builds Docker de Go e Next, testes Go com detector de corrida, go vet, TypeScript e testes unitários AMI executados. [Verificações estáticas e unitárias](evidence/phase-03a/checks.log).

As duas integrações PostgreSQL anteriores passaram em um banco novo com as oito migrações. A primeira tentativa usou um executor sem dados de fuso horário. A repetição usou a imagem do backend, que inclui tzdata. O npm audit de produção encontrou zero vulnerabilidades nas dependências JavaScript auditadas. [Integração](evidence/phase-03a/integration.log), [auditoria npm](evidence/phase-03a/npm-audit.json).

Os resultados de navegador e mídia das fases anteriores permanecem no [relatório 02.6](FASE-02-6-HOMOLOGACAO.md). A bateria completa de 19 regressões da Fase 02.5 não foi reexecutada no ambiente ativo.

## Gates pendentes

Continuam pendentes voz humana com três pessoas em redes físicas distintas, Firefox, Safari, perímetro real da prestadora, contingência assistencial exercitada e autorização explícita para 03B. O simulador cobre um tronco estático por tenant. Registro com operadora, alta disponibilidade, política de saída pública, importação de CDR e custo real seguem fora do escopo implementado. [Plano de piloto](FASE-03B-PLANO-PILOTO.md).

## Limites encontrados durante a execução

O redirecionamento antes de atender terminou sem alcançar o destino bloqueado. No reteste instrumentado, o REFER recebeu SIP 603 e o destino bloqueado continuou sem receber chamada. Com o backend parado, o PBX não abriu um canal ao simulador nem criou reserva. Depois de restabelecer o Go, a chamada de teste voltou a ser atendida. [Redirecionamento, REFER e recuperação](evidence/phase-03a/guard.json).

O encerramento agora usa fila persistente por PBX. O teste pausou o backend durante uma chamada PJSIP atendida, encerrou o canal e reiniciou o PBX. Após a retomada do backend, a fila foi drenada e o PostgreSQL registrou `ANSWER`, dois segundos conversados e horário de fim anterior à retomada. Uma tentativa antiga que ficou sem confirmação continua sem estimativa de tempo conversado. [Replay do encerramento](evidence/phase-03a/finish-replay.json), [Go com detector de corrida](evidence/phase-03a/replay-go.log).

A primeira regressão Chromium isolada falhou no registro SIP sobre WSS com código 1006, antes de exercitar chamadas. A verificação independente obteve upgrade HTTP 101. Em nova execução, a falha de registro não se repetiu. O Chromium passou chamada direta, espera, retomada e mídia da fila A. A causa do 1006 permanece indeterminada. [Chamada direta](evidence/phase-03a/regression/direct-only.json), [Fila A](evidence/phase-03a/regression/queue-a.json).

As rodadas finais em Chromium passaram a transferência direta, a assistida com rejeição e recuperação, o destino indisponível, a desconexão durante a consulta e a fila do tenant B com mídia. Duas tentativas intermediárias excederam prazos do navegador e foram repetidas em execução isolada. [Transferências](evidence/phase-03a/regression/transfers.json), [fila B](evidence/phase-03a/regression/queue-b.json).
