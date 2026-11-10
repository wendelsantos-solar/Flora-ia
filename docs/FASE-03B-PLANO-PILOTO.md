# Fase 03B — Plano de piloto controlado

**NO-GO para conectar prestadora real.** Este plano depende de autorização explícita depois dos gates abaixo.

1. Concluir o [roteiro humano](FASE-02-6-ROTEIRO-HUMANO.md) com três pessoas, redes físicas distintas, voz nos dois sentidos, transferências direta e assistida, espera e retomada e avaliação de cortes, atraso e inteligibilidade. Manter Firefox e Safari pendentes até teste próprio.
2. Aprovar e exercitar a contingência independente de home care com a equipe responsável. Confirmar alternativas se falharem internet, plataforma ou prestadora e critérios operacionais de acionamento.
3. Identificar prestadora, ambiente de homologação, regras de numeração e identificação, canais, codecs, DTMF, autenticação, rotas, disponibilidade, dados de CDR e cobrança. Rever endereços e firewall do edge.
4. Reexecutar a regressão completa no laboratório, investigar recorrências de registro WebRTC e homologar a reconciliação quando o evento não chega a ser gravado pelo PBX.
5. Aprovar políticas por tenant, destinos explicitamente autorizados, bloqueios, limites de simultaneidade, duração e tentativas, orçamento, alertas e procedimento de interrupção. Exercitar desligamento e rollback sem prejudicar telefonia interna.
6. Com autorização, validar um tenant e um conjunto restrito de números de teste. Começar com entrada, depois saída de destinos autorizados. Conferir CDR, sinalização, mídia e contingência. Qualquer fraude, áudio unilateral ou inconsistência de CDR interrompe o piloto.

O aceite do laboratório, a autorização de interconexão, a homologação comercial e a liberação de produção são decisões separadas.
