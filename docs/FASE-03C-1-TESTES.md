# Fase 03C.1 — Testes

O laboratório Docker privado usa Asterisk/PJSIP, WSS, WebRTC e PostgreSQL reais. O microfone de teste é sintético. A referência foi iniciada com a imagem da 03B.0 antes da troca de interface. A execução nova usa imagem própria e preserva a stack local em loopback.

## Referência anterior à mudança

O Chromium de referência passou 11 de 13. O caso consecutivo falhou na troca de microfone porque o ID do track permaneceu igual por mais de 5 s. O cenário de fila atingiu o limite global de 150 s e o erro apareceu no fechamento do contexto. Os dois PBXs e o PostgreSQL terminaram com zero sessões abertas. [Log de referência](evidence/phase-03c-1/baseline-chromium/chromium.log) · [Estado final de referência](evidence/phase-03c-1/baseline-chromium/after.json)

O Chrome Stable de referência passou 5 de 6. A falha no caso consecutivo ocorreu na leitura de energia recebida durante mute. A faixa local estava desabilitada, mas a janela de medição superou o limiar esperado. [Log Chrome de referência](evidence/phase-03c-1/baseline-chrome/telephony-retest.log)

## Casos direcionados

- O teste da Mesa falhou inicialmente ao aguardar o registro de 202. O reteste isolado passou com os três papéis, convite no Histórico, foco e atendimento por teclado, consulta assistida e retorno à ligação original. A mesma referência SIP permaneceu nas áreas e houve avanço de RTP nos dois lados. A asserção verificou a contagem de REGISTER exatamente antes e depois da navegação. O JSON inicial registra também a contagem no fim do teste, depois do logout, e esse valor pertence a outro recorte. [Primeira tentativa](evidence/phase-03c-1/mesa/telephony-retest.log) · [Reteste](evidence/phase-03c-1/mesa-reteste/telephony-retest.log) · [Medições](evidence/phase-03c-1/mesa-reteste/cases/phase-03c-1/depois/mesa.json)
- O teste do INVITE passou após login, navegação, perda e recuperação do WSS operacional e novo registro após reinício do Asterisk. [Trilha sanitizada](evidence/phase-03c-1/invite/cases/phase-01-1/chromium-incoming-trace.json)
- Dez chamadas consecutivas sem recarregar passaram com mídia, troca de microfone, encerramento, dez entradas no histórico e zero canais ou sessões abertas ao final. [Log](evidence/phase-03c-1/stress/telephony-retest.log) · [Estado final](evidence/phase-03c-1/stress/after.json)
- Sem overflow de documento em 1440, 1280, 768, 390, 375 e 320 px em cinco áreas. A checagem adicional de reflow usou 720 px, equivalente à largura CSS de 1440 px a 200%, e o navegador confirmou escala visual 2 via CDP. Foram verificados a árvore de acessibilidade, o nome Atender, o foco visível e a altura mínima de 44 px da ação. [Teste](evidence/phase-03c-1/mesa-reteste/cases/phase-03c-1/depois/mesa.json)

## Primeira matriz na nova interface

**18 de 19**. Chromium 12/13 e Chrome Stable 6/6. O único caso reprovado verificava se uma fila recém-criada já aparecia com zero chamadas em espera. A API ainda retornava ausência dessa fila no snapshot do motor dentro da janela da asserção. Isso ocorreu antes das ações do navegador. As demais operações, incluindo espera, transferências direta e assistida, destino indisponível, desligamento, reconexão e isolamento REST/WSS, passaram. [Chromium](evidence/phase-03c-1/chromium/chromium.log) · [Chrome Stable](evidence/phase-03c-1/chrome/telephony-retest.log)

A revogação passou com cookie opaco, replay HTTP 401 e fechamento WSS 1008. TypeScript, build da imagem privada, Go tests e vet passaram. [Revogação](evidence/phase-03c-1/revocation/cases/phase-02-5/session-revocation.json) · [TypeScript](evidence/phase-03c-1/typecheck.log) · [Build](evidence/phase-03c-1/build-final.log) · [Go e vet](evidence/phase-03c-1/go.log)

Os pares de contraste principais foram medidos. Branco sobre verde de ação deu 7,83:1. Texto de apoio sobre papel deu 6,41:1. Borda funcional sobre branco deu 3,82:1. O detector Impeccable não registrou achados nos arquivos inspecionados. A checagem é parcial. [Contraste](evidence/phase-03c-1/contraste.json) · [Detector](evidence/phase-03c-1/design-detector.json)

A homologação humana, o comportamento com aba efetivamente oculta e o suporte de voz em dispositivos móveis, Firefox e Safari continuam separados. A auditoria de acessibilidade usa foco, teclado, nomes acessíveis, árvore de acessibilidade e reflow. A confirmação com leitor de tela em uso real requer uma rodada própria.

A meta de 44 px para ações críticas é uma decisão de ergonomia da Flora. O critério de reflow foi usado como referência para a checagem de 320 px. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
