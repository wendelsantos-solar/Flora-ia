# Telefonia

A configuração atual da Fase 02 acrescenta filas, espera e transferências; veja [arquitetura atual](FASE-02-ARQUITETURA.md). As seções da Fase 01 abaixo registram a baseline.

Fase 01.1: [homologação](FASE-01-1-HOMOLOGACAO.md) e [roteiro humano](ROTEIRO-AUDIO-HUMANO.md). A interface atual observa perda de captura/mídia, permite troca da entrada em chamada e oferece saída individual quando setSinkId está disponível. Metros mostram atividade local sem gravação; qualidade humana continua pendente.

Atualização de 08/11/2026: o responsável confirmou conversa humana bidirecional; Firefox e Safari permanecem restritos conforme o [adendo da Fase 01.1](FASE-01-1-HOMOLOGACAO.md#adendo-de-homologação-humana--08112026).

## Separação de fluxos

- SIP: navegador → `wss://localhost:18489/ws`, autenticação digest individual 201/202.
- Mídia: DTLS-SRTP com ICE, RTP/RTCP multiplexado, codecs PCMU/PCMA (ulaw/alaw), DTMF RFC4733. Backend não transporta áudio.
- Eventos: AMI interno, usuário observador com `read=call,system,reporting`, `write=reporting` para snapshots. Sem privilégios de originação/comando.
- Histórico: CEL Custom CSV em volume → importação transacional → `call_sessions`, `call_legs`, `call_events`.
- Administração: somente CLI dentro do container pelo operador local; nenhum endpoint administrativo público. ARI não carregado.

## Primeira chamada manual

1. Subir serviços conforme SETUP; conferir `/health/ready`.
2. Conectar 201 no navegador A com seu token e senha SIP.
3. Conectar 202 em perfil separado B. Ambos devem mostrar Disponível.
4. Conferir `docker compose exec asterisk asterisk -rx 'pjsip show contacts'`.
5. No A, discar 202 e clicar Ligar. B deve apresentar Chamada recebida.
6. B clica Atender e permite microfone.
7. Falar uma frase única no A e repeti-la no B; depois fazer o inverso. Confirmar escuta com fones, sem apenas observar timer ou pacotes.
8. Silenciar A: B deixa de escutar A; reativar e confirmar retorno.
9. Encerrar no A; ambos voltam a Disponível. Histórico deve mostrar Concluída e duração.
10. Repetir 202 → 201 e encerrar no 202.
11. Rejeitar uma chamada; confirmar encerramento no outro lado e histórico não atendido.
12. Desconectar e reconectar a rede de um ramal; verificar novo registro e possibilidade de nova ligação.

Registrar data, navegador, dispositivos, IDs do histórico, resultado da escuta em cada direção e responsável. Não registrar áudio ou dados pessoais.

## Teste automatizado real

`web/tests/telephony.spec.ts` usa dois contextos Chromium e SIP.js de verdade. WSS com validação TLS normal, registro digest, INVITE/200/ACK/BYE e mídia real pelo Asterisk. O microfone de teste nativo do Chromium gera áudio sintético para medir crescimento de pacotes e energia decodificada no receptor. Isso testa transporte e decodificação de mídia nos dois sentidos; não testa fala humana, qualidade perceptual, eco ou hardware físico. Não há interceptação/mock de SIP, API, WebSocket ou RTP. Mocks de conectividade existem somente nos testes unitários Go e são identificados.

Estatísticas não incluem áudio, senha ou token. `window.floraMediaStats()` expõe somente contadores da RTCPeerConnection corrente para diagnóstico local. Resultados em `docs/evidence/webrtc.json`.

## Eventos suportados

`call.created`, `call.ringing` (AMI, best effort em lacunas), `call.answered`, `call.completed`, `call.failed`, `call.interrupted` (reconciliação), `extension.registered`, `extension.unregistered`. `telephony.CHAN_END` preserva término individual de perna. Uma sessão pode gerar mais de um `call.created`/`call.answered` de pernas diferentes; sequência/event_key identifica o registro, call_id agrega a conversa.

Não há controles/eventos de hold/resume, transferência, DTMF na UI, originação REST. Seleção de saída depende de setSinkId e da permissão do navegador. DTMF está configurado para RFC4733; envio, recepção e conteúdo não foram validados nesta fase.

## Diagnóstico

```sh
docker compose exec asterisk asterisk -rx 'module show like chan_pjsip'
docker compose exec asterisk asterisk -rx 'http show status'
docker compose exec asterisk asterisk -rx 'pjsip show contacts'
docker compose exec asterisk asterisk -rx 'core show channels'
docker compose exec asterisk asterisk -rx 'cel show status'
docker compose logs --tail=100 backend
```

Evitar habilitar SIP logger em sessões de operadores: headers digest e SDP podem aparecer. Logs padrão não incluem senhas, tokens, gravação ou corpo de requisições. Não apagar/truncar CEL antes de importação confirmada. O limite de 32 MiB interrompe ingestão com readiness 503, preservando dados, e exige arquivamento/rotação assistidos antes de uso prolongado.
