# Fase 03B.0 — Homologação

A 03A.3 deixou 19/19 regressões aprovadas em laboratório, dez chamadas consecutivas com mídia sintética e uma ocorrência anterior do ramal 201 sem **Atender** ainda sem causa raiz. O 203 já existe no tenant de laboratório. [Matriz anterior](FASE-03A-3-REGRESSOES.md) · [Diagnóstico anterior](FASE-03A-3-DIAGNOSTICO.md)

## Evidências automatizadas

- Cenário dirigido de atendimento aprovado em cinco situações, com correlação entre navegador, CEL e PostgreSQL. [Diagnóstico WebRTC](FASE-03B-0-WEBRTC.md)
- Sequência inicial de dez chamadas interrompida. O Chromium completou oito e reportou `Target crashed` no encerramento da nona. O laboratório recuperou prontidão e terminou com zero canais e sessões abertas. O incidente ocorreu enquanto o build em container e outras verificações rodavam. A causa da queda do renderizador permanece indeterminada. A repetição isolada na versão instrumentada completou dez chamadas sem recarregar, com mídia bidirecional, dez encerramentos no histórico e zero canais e sessões abertas. [Repetição](evidence/phase-03b-0/stress/telephony-retest.log) · [Estado após repetição](evidence/phase-03b-0/stress/after.json) · [Log inicial](evidence/phase-03b-0/baseline/telephony-retest.log) · [Estado final](evidence/phase-03b-0/baseline/after.json)
- Go, detector de corrida, vet e três integrações em PostgreSQL descartável passaram. TypeScript e build Next.js no host e em Docker passaram. O primeiro build Docker foi interrompido durante o período de lentidão. O segundo usou dois threads Rayon no build descartável. [Go e PostgreSQL](evidence/phase-03b-0/backend.log) · [TypeScript](evidence/phase-03b-0/typecheck.log) · [Build Docker](evidence/phase-03b-0/build-retry.log)
- Revogação passou com cookie opaco, HttpOnly e SameSite Strict, replay HTTP 401 e encerramento WSS 1008. A bateria antifraude passou com zero reservas ativas ao final. As 24 verificações AMI/ARI passaram. O guarda de tronco recusou REFER com 603, bloqueou redirecionamento e falhou de forma fechada durante perda do autorizador. [Sessão](evidence/phase-03b-0/revocation/cases/phase-02-5/session-revocation.json) · [Antifraude](evidence/phase-03b-0/sip.json) · [Reservas](evidence/phase-03b-0/active-reservations.txt) · [AMI/ARI](evidence/phase-03b-0/ami-ari.json) · [Guardas](evidence/phase-03b-0/guard.json)

**Matriz histórica 19/19 aprovada.** Os seis casos de mídia passaram em cada navegador. No Chromium também passaram os cinco cenários operacionais e os dois de telefonia e autorização.

| Grupo | Chromium | Google Chrome |
| --- | ---: | ---: |
| Mídia, permissões, cancelamento, interrupção e fechamento abrupto | 6/6 | 6/6 |
| Fila, espera, REFER direto e assistido, departamentos e falhas de transferência | 5/5 | — |
| WebRTC, reconexão, autorização REST e isolamento WSS | 2/2 | — |
| Total | 13/13 | 6/6 |

[Log Chromium](evidence/phase-03b-0/chromium/telephony-retest.log) · [Log Chrome](evidence/phase-03b-0/chrome/telephony-retest.log)

## Roteiro humano com três pessoas

**PENDENTE.** Reserve 30–45 minutos. A usa 201, B usa 202 e C usa 203, cada um em um dispositivo, perfil Chrome e rede física distinta. Use fones com microfone e dados fictícios. O responsável libera o acesso privado conforme o [plano de rede](FASE-03B-0-REDES.md) e entrega credenciais individuais por canal protegido. Cada pessoa abre o endereço HTTPS aprovado, escolhe seu ramal, entra, permite o microfone e confirma **Disponível**. B entra na fila 301 e confirma presença disponível. Se houver erro de certificado ou registro, pare e informe o responsável.

Em cada conversa, cada lado lê cinco palavras combinadas e o outro repete. Conversem por um minuto, incluindo alguns segundos de fala simultânea. Avaliem separadamente cada direção. Entre cenários, encerrem e confirmem o estado livre no discador. O responsável confere o histórico e os canais no servidor.

| Cenário | Passos | Aprovação | Estado |
| --- | --- | --- | --- |
| 1. Direta | A disca 202. B atende. B encerra. | Voz inteligível e estável nos dois sentidos. | PENDENTE |
| 2. Fila | A disca 301. B atende. | B recebe como agente elegível, os dois conversam e o histórico aponta fila e agente. | PENDENTE |
| 3. Espera | Durante chamada de A, B clica **Colocar em espera**, depois **Retomar ligação**. | A deixa de ouvir o microfone de B durante a espera e a conversa volta na retomada. | PENDENTE |
| 4. Direta para C | Em nova chamada de A, B seleciona 203 em **Transferência** e clica **Transferir direto**. C atende. | A e C conversam. B retorna a disponível. | PENDENTE |
| 5. Assistida | B atende A, seleciona 203 e clica **Consultar ramal**. C atende e conversa com B. B clica **Confirmar transferência**. | A fica em espera durante a consulta e depois conversa com C. B fica livre. | PENDENTE |
| 6. Rejeição | Repita a consulta. C clica **Rejeitar**. | B volta à chamada original e confirma voz com A. | PENDENTE |
| 7. Reconexão | Em chamada de teste, C interrompe brevemente sua própria conexão privada e restabelece. | O sistema recupera a sessão ou encerra corretamente conforme a política e permite nova chamada. | PENDENTE |

Registre por linha horário com fuso, iniciais A/B/C, navegador e versão, sistema, tipo de rede, resultado, inteligibilidade, eco, cortes, atraso perceptível, erro de interface e última ação. O responsável associa horário e ID do histórico a eventos do Asterisk, estado final dos canais e estatísticas técnicas disponíveis. Use **APROVADO** somente se todos os passos aplicáveis e a limpeza conferirem, **REPROVADO** se um deles falhar e **PENDENTE** se faltar execução ou confirmação. Em caso de falha, anote a direção do áudio e o momento do erro. Ao terminar, todos saem, o responsável confere zero canais de teste e revoga os acessos temporários. Colete somente a avaliação e os metadados necessários. A voz fica sem gravação.

## Reprodução local

Com o Compose privado pronto, executar a partir da raiz do projeto. O executor usa as credenciais do laboratório, espera zero canais e sessões abertas e grava estados antes e depois. Para filas, escolher três números consecutivos desocupados no catálogo de teste.

```sh
export FLORA_REGRESSION_PREFLIGHT=1
FLORA_REGRESSION_EVIDENCE=docs/evidence/phase-03b-0/repeticao-invite \
  python3 scripts/test-private-regressions.py homologacao.spec.ts --grep 'incoming INVITE'
FLORA_REGRESSION_QUEUE_START=376 FLORA_REGRESSION_EVIDENCE=docs/evidence/phase-03b-0/repeticao-chromium \
  python3 scripts/test-private-regressions.py --grep-invert 'incoming INVITE'
FLORA_REGRESSION_BROWSER=chrome FLORA_REGRESSION_EVIDENCE=docs/evidence/phase-03b-0/repeticao-chrome \
  python3 scripts/test-private-regressions.py homologacao.spec.ts --grep-invert 'incoming INVITE'
```

A execução Chrome exige o binário oficial em `/opt/google/chrome/chrome` no cliente Linux do laboratório. O diagnóstico do INVITE exige a imagem web desta fase. A rodada usa Chromium como padrão e mantém separados os casos suplementares.
