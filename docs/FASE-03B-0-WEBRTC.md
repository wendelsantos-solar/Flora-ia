# Fase 03B.0 — WebRTC e botão Atender

O INVITE chega pelo WSS SIP e entra no delegate do SIP.js. O discador vincula a sessão e publica `incoming`. O React monta **Atender** nesse estado. O WebSocket operacional tem ciclo independente e atualiza o histórico e indicadores. As abas internas da aplicação preservam o discador. Departamento e presença influenciam a escolha do membro de fila no Asterisk. O botão depende do INVITE efetivo, mesmo em uma chamada direta.

A instrumentação registra chegada do INVITE, vínculo ou recusa local com motivo, transições da sessão, estado confirmado no React, presença do elemento **Atender**, visibilidade do documento e conexão do canal operacional. O diagnóstico de registro e desconexão WSS permanece disponível. O buffer fica em memória, limitado a 64 registros, e exporta SHA-256 do SIP Call-ID em vez do identificador original. Os registros excluem credenciais, SDP, áudio e endereços ICE brutos.

Para correlacionar uma falha, exportar o resultado de `await window.floraSipDiagnostics()` durante a ocorrência. Registrar data/hora, ramal e origem de teste. Um operador autorizado pode obter o SIP Call-ID no diagnóstico do canal ativo do PBX e calcular o mesmo SHA-256 localmente. Usar canal, UniqueID e LinkedID para juntar CEL e histórico. Conservar só o hash e IDs de teste. O Asterisk expõe esse campo na função `CHANNEL(pjsip,call-id)` para diagnóstico autorizado. [Função CHANNEL](https://docs.asterisk.org/Certified-Asterisk_20.7_Documentation/API_Documentation/Dialplan_Functions/CHANNEL/)

O SIP Call-ID de cada perna é distinto e o LinkedID agrupa as pernas. Se o canal terminou antes da coleta e o log disponível carece do identificador SIP, a correlação será por tempo e pernas, com grau de certeza explícito.

O rastreio separa três resultados investigáveis: nenhum INVITE no navegador, INVITE recusado devido a uma sessão local ou transferência pendente e INVITE vinculado sem confirmação de renderização. A ocorrência histórica da 03A.3 mostra o canal de destino em toque e o histórico terminal sem atendimento. A captura disponível daquela ocorrência antecede a nova instrumentação.

**Falha histórica sem reprodução no teste dirigido.** O botão apareceu após login, navegação para Supervisão com outra aba à frente, perda do WebSocket operacional, retorno do backend e novo registro após reinício do Asterisk. O teste exigiu INVITE vinculado, renderização confirmada, botão ausente antes e depois e zero canais após rejeitar. O reinício controlado produziu WSS 1006, com novo registro SIP aproximadamente 3,27 s após o fechamento. A aba permaneceu `visible` no Chromium headless. A condição real `hidden` segue pendente.

Os cinco INVITEs foram associados ao canal PJSIP de destino pelo ramal e pela diferença temporal, com diferenças de 6 a 101 ms para o candidato mais próximo. A janela de três segundos incluiu dois candidatos nas duas primeiras amostras e um nas três restantes. O LinkedID vinculou CEL e PostgreSQL. A chamada durante a queda do backend também teve eventos terminais no histórico. A associação destas amostras é temporal, sem comparação direta dos hashes entre navegador e PBX. A causa da ausência histórica do botão segue indeterminada e a mudança se limita à instrumentação.

[Trilha dos cinco cenários](evidence/phase-03b-0/incoming/cases/phase-01-1/chromium-incoming-trace.json) · [Correlação CEL e PostgreSQL](evidence/phase-03b-0/incoming-correlation.json)

## Mídia e navegadores

O navegador pede permissão via `getUserMedia` no início da captura. O Asterisk negocia mídia WebRTC com DTLS-SRTP e ICE. O laboratório usa candidatos host e rotas privadas, com `iceServers: []`. Permissão, seleção de dispositivos, reprodução e estatísticas são verificadas separadamente. O roteiro registra inteligibilidade, eco e atraso como avaliação humana. Em teste automatizado, contadores RTP, energia de áudio, RTT, jitter, perdas, codec e ICE provêm de `getStats` quando disponíveis. Métrica ausente deve ficar vazia.

| Navegador | Resultado |
| --- | --- |
| Google Chrome Stable 157.0.8103.38, Linux ARM64 | 6/6 casos sintéticos. Referência de laboratório. [Log](evidence/phase-03b-0/chrome/telephony-retest.log) |
| Chromium 158, Linux ARM64 | 13/13 casos históricos e cenário dirigido do botão. [Log](evidence/phase-03b-0/chromium/telephony-retest.log) |
| Firefox, Linux | 159.0 com TLS e registro no reteste. Mídia reprovada no laboratório, com zero RTP recebido nos dois lados. [Evidência](evidence/phase-03b-0/multirede/firefox-trusted.json) |
| Safari 27.0.1, macOS ARM64 | Disponibilidade local confirmada. PENDENTE para mídia, sem rodada nativa na topologia privada. [Ambiente](evidence/phase-03b-0/safari-environment.txt) |

Uma amostra Chrome da primeira chamada mediu codec PCMU, 91 pacotes recebidos e zero perdidos por lado, jitter de 1 ms nos dois lados e RTT ICE de 31 ms e 55 ms. O par ICE selecionado estava em `succeeded`. São medições do teste sintético, sob as condições do laboratório, e o RTT ICE mede o percurso de rede do par, sem representar atraso perceptível de voz. [Amostra Chrome](evidence/phase-03b-0/chrome/cases/phase-01-1/chrome-consecutive.json)

Para as pessoas, manter a página em chamada durante a amostra. O responsável pode selecionar apenas `codec.mimeType`, `inbound-rtp.packetsReceived`, `packetsLost`, `jitter` e `candidate-pair.currentRoundTripTime` em `await window.floraMediaStats()`, além de `iceConnectionState` em `window.floraMediaDiagnostics()`. Registrar tempo entre ação e estado com a mesma origem de relógio. Relatar a percepção humana em campo separado.

Na mesma amostra Chrome, o primeiro INVITE foi seguido pelo 180 em 65 ms e pelo 200 em 296 ms, medidos no observador Playwright. Esse intervalo inclui a ação automática de atendimento. [Sinalização da amostra](evidence/phase-03b-0/chrome/cases/phase-01-1/chrome-consecutive-signals.json)


A primeira tentativa Firefox parou na confiança TLS com `SEC_ERROR_UNKNOWN_ISSUER`. No reteste, a CA descartável foi importada diretamente na base NSS do perfil temporário antes de iniciar cada Firefox, mantendo a validação TLS. A chamada registrou captura sintética ativa e PCMU. Um lado selecionou par ICE e o outro permaneceu em `checking`. A conexão WebRTC permaneceu `connecting` em ambos e nenhum recebeu RTP. A negociação de mídia fica como bloqueador específico do Firefox nesta topologia. Os dados localizam a interrupção depois do registro e antes do fluxo RTP, sem demonstrar se mDNS, caminho UDP ou DTLS é a causa raiz. Autoplay ou seleção física de dispositivo exigem teste separado. [Falha TLS inicial](evidence/phase-03b-0/multirede/firefox.json) · [Reteste com CA confiável](evidence/phase-03b-0/multirede/firefox-trusted.json)
