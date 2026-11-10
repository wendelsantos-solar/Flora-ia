# Fase 03 — Planejamento de troncos SIP

Planejamento técnico. Nesta fase não se contrata prestadora, abre porta pública, provisiona DID ou habilita chamada externa.

## Pontos de integração

- Entrada: prestadora → interconexão privada ou SBC com ACL de pares → contexto PJSIP exclusivo do tronco → mapa DID normalizado para tenant, departamento e regra de horário/fila. Rejeitar DIDs não cadastrados, origem não autenticada e divergência de tenant. O identificador do chamador não escolhe o tenant.
- Saída: ramal autenticado → política explícita de destinos, perfil de saída e limites por tenant → normalização → contexto do tronco correspondente. Não habilitar rota genérica no contexto interno existente. Transferência para destino externo deve ficar bloqueada até haver permissão, orçamento e rastreio.
- Cada tronco terá autenticação e configuração próprias, separadas do usuário do navegador. Avaliar registro digest, autenticação por IP ou mTLS conforme oferta. Nunca expor AMI, ARI, banco ou configuração do Asterisk; preferir VPN/interconexão privada e SBC como limite de rede.
- Mapa de DIDs, versão da configuração, políticas de destino e identificação de chamadas deverão ser persistidos por tenant. Reusar fila, horário e histórico já existentes. Manter dados de tarifação em registros próprios, com diálogo/leg IDs do motor e ID de referência da prestadora. Não usar os contadores de chamadas como medição de fatura.

## Numeração, sinalização e mídia

Armazenar números públicos normalizados em E.164 e manter ramais e filas como identificadores locais separados. Para números brasileiros geográficos, validar +55, DDD e número de assinante; o fixo usa oito dígitos e o móvel usa nove. Tratar números curtos e séries não geográficas separadamente, inicialmente sem permissão de discagem. O formato aceito pela prestadora pode diferir do formato interno: adaptar no limite do tronco. Referências: [ITU-T E.164](https://www.itu.int/rec/T-REC-E.164-202602-I/en), [plano de numeração da Anatel](https://www.gov.br/anatel/pt-br/regulado/numeracao) e [nono dígito](https://www.gov.br/anatel/pt-br/regulado/numeracao/nono-digito).

Homologar From, P-Asserted-Identity e Privacy conforme a prestadora, enviando somente números atribuídos e permitidos. Não repassar identificação arbitrária vinda do navegador. Confirmar ANI/DID recebido, chamadas com identidade restrita, causas SIP/Q.850, early media e tratamento de retransmissão.

O lado WebRTC continua WSS e DTLS-SRTP. No tronco, negociar o transporte, TLS e SRTP oferecidos; documentar explicitamente qualquer trecho sem criptografia. Começar por PCMU/PCMA compatíveis com a instalação, medir transcodificação e CPU, e exigir DTMF bidirecional com [RFC 4733](https://www.rfc-editor.org/info/rfc4733/) quando disponível. Homologar dígitos contra URA controlada e verificar que não aparecem em logs ou gravações.

Validar NAT, endereço de mídia anunciado, ACL, keepalive, renovação de registro, MTU, RTP simétrico e failover. Qualificar áudio bidirecional com jitter, perda e RTT de redes reais privadas; TURN para o navegador pode ser necessário, mas não resolve a topologia SIP do tronco. Não usar o mesmo acesso de rede para interfaces administrativas e mídia de prestadora.

## Capacidade, custo e prevenção de fraude

Solicitar cotações comparáveis: mensalidade do DID/tronco, portabilidade, canais concorrentes, chamadas por segundo, valor por minuto por categoria (fixo, móvel, DDD, internacional), arredondamento mínimo, impostos, consumo de entrada, suporte e contingência. Custo previsto = fixos + minutos faturáveis por categoria × tarifa da proposta + itens avulsos e impostos. Não foram cotadas tarifas nesta fase.

Aplicar limites por ramal, tenant e tronco: concorrência, taxa de tentativas, duração máxima, destinos permitidos e teto de custo com alerta e bloqueio. Negar internacional, destinos especiais/premium e padrões não cadastrados por padrão. Auditar alterações e rotação de credenciais. Usar CDR da prestadora para conciliação e validar chamadas que não geram cobrança e transferências que criam múltiplas pernas tarifadas.

## Plano de homologação antes de ativar

1. Aprovar prestadora, contrato, numeração, responsáveis, custos e topologia privada. Obter sandbox ou janela controlada com números autorizados.
2. Testar entrada/saída em redes autorizadas, fixo/móvel, identificação, early media, DTMF, codecs, timeout, busy/rejeição, horário e contingência.
3. Testar capacidade e limites com volume pactuado; reconciliar diário de eventos, CDR e cobrança. Ensaiar queda de SBC, operadora, WAN, energia e indisponibilidade da Flora.
4. Validar restauração de backups, alertas, escalonamento, retenção, privacidade e revisão operacional. Fazer rollback para rota de contingência e repetir os testes de isolamento.

Para home care, providenciar **canal de contingência independente**, pessoas e números de fallback acordados, orientações de emergência e protocolos assistenciais aprovados antes de qualquer piloto. A Flora não deve ser o único canal de comunicação assistencial. Não há fluxo clínico automatizado nesta entrega.
