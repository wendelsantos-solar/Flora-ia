# Fase 03A.3 — Matriz de regressões

A matriz mantém os 19 casos da 03A.2. São 13 no Chromium e seis no Google Chrome. Cada navegador rodou com um worker, na origem HTTPS do laboratório WireGuard. As chamadas exercitaram Asterisk, SIP/WSS, WebRTC e PostgreSQL reais. O áudio veio de um dispositivo sintético do navegador.

O Chrome foi executado pelo binário oficial Google Chrome Stable 157.0.8103.38 em Ubuntu 24.04.5 LTS, Linux ARM64, headless. O SHA-256 do pacote foi conferido com o índice da distribuição. [Versão e binário observado](evidence/phase-03a-3/chrome-version.txt)

## Resultado por caso

**19/19 aprovados** na execução final, com 13/13 no Chromium e 6/6 no Google Chrome.

| Cenário | Chromium | Google Chrome |
| --- | --- | --- |
| Três chamadas consecutivas, mídia nos dois sentidos, mute, troca de microfone e liberação | Aprovado | Aprovado |
| Revogação e restauração da permissão durante a chamada | Aprovado | Aprovado |
| Permissão negada antes de ligar e atender, seguida de recuperação | Aprovado | Aprovado |
| Cancelamento durante toque e atendimento | Aprovado | Aprovado |
| Interrupção e recuperação real de mídia após pausa do Asterisk | Aprovado | Aprovado |
| Fechamento abrupto, timeout RTP e consistência do histórico | Aprovado | Aprovado |
| Fila, autorização, pausa, timeout e reconciliação após reinício | Aprovado | Fora deste grupo |
| Espera, rejeição e cancelamento da consulta, REFER assistido | Aprovado | Fora deste grupo |
| REFER direto com preservação do chamador e encerramento | Aprovado | Fora deste grupo |
| REFER entre departamentos, horários e contingência | Aprovado | Fora deste grupo |
| Transferência com destino indisponível, rejeição, encerramento e origem desconectada | Aprovado | Fora deste grupo |
| WebRTC nos dois sentidos, encerramento e reconexão SIP | Aprovado | Fora deste grupo |
| Autorização REST, limites, origem WSS e isolamento de eventos | Aprovado | Fora deste grupo |

[Log Chromium](evidence/phase-03a-3/chromium-full/chromium.log) · [Log Google Chrome](evidence/phase-03a-3/chrome-six/telephony-retest.log) · [Retestes isolados e diagnóstico](FASE-03A-3-DIAGNOSTICO.md)

## Verificações de código

`go test ./...`, `go test -race ./...`, `go vet ./...`, verificação TypeScript e build Next.js passaram. Os três testes de integração também passaram com as oito migrações aplicadas a um PostgreSQL descartável. [Integração](evidence/phase-03a-3/integration.log)

O teste isolado de dez ligações é complementar à matriz e usa o mesmo cenário de chamadas consecutivas, ampliado de três para dez iterações. [Log das verificações](evidence/phase-03a-3/checks.log) · [Sequência de dez](FASE-03A-3-ESTABILIDADE.md)

## Repetição no laboratório privado

O executor `scripts/test-private-regressions.py` usa exclusivamente o Compose `flora-026`. A matriz Chromium usou `FLORA_REGRESSION_QUEUE_START=388`, com a faixa 388–390. Em novas rodadas, escolha uma faixa desocupada de três ramais de fila. `FLORA_REGRESSION_PREFLIGHT=1` exige o estado limpo antes da rodada. Para repetir o grupo de mídia no Chrome, selecione `FLORA_REGRESSION_BROWSER=chrome` e `homologacao.spec.ts`, com o binário oficial disponível em `/opt/google/chrome/chrome` dentro do cliente privado.
