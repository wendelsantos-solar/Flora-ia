# Fase 03B.0 — Perímetro e checklist de prestadora

A borda de uma futura interconexão deve encaminhar somente SIP e RTP negociados de origens autorizadas ao contexto dedicado de cada tronco. Separar sinalização e mídia da prestadora, clientes WebRTC e rede administrativa. O PBX deve ancorar a mídia com `direct_media=no`, e os endereços anunciados na sinalização e no SDP precisam corresponder à topologia efetiva. Validar `local_net` e endereços externos em função do ponto que termina NAT ou proxy. Para TLS, validar cadeia e identidade. Para SRTP, documentar o método efetivamente contratado e, se houver SDES, proteger o transporte SIP que carrega as chaves. [NAT no PJSIP](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-res_pjsip-to-work-through-NAT/) · [Configuração oficial PJSIP](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/Module_Configuration/res_pjsip/)

| Tema | Evidência a obter antes do piloto |
| --- | --- |
| Rede e autenticação | IPs e CIDRs de sinalização e mídia, rotas primária e secundária, transporte e portas, IP estático, autenticação por IP ou registro, realm, rotação e tempos de registro. Validar listas de origem e destino no firewall. |
| Mídia | Codecs e ordem, ptime, RTP/RTCP, DTMF RFC 4733 ou alternativa acordada, perfis TLS/SRTP, NAT, simetria, perda de mídia e comportamento ao mudar o endereço SDP. |
| Entrada e saída | DIDs autorizados, regras de número e E.164, apresentação de número, P-Asserted-Identity quando aplicável, destinos autorizados, restrições e mapeamento de motivo SIP/Q.850. |
| Isolamento e antifraude | Contexto de tronco e tenant explícito, credenciais separadas, deny by default, bloqueio de serviços especiais e alto risco, limites por tenant, ramal e tronco, tentativas, duração, orçamento, interrupção e auditoria. |
| Falhas e recuperação | SLA, suporte, janelas, failover, ordem de tentativa, critérios de retorno, DNS, perda de registro, perda de mídia e ausência de chamada duplicada. |
| Operação | CDR e tarifação acordados, correlação de IDs, disponibilidade, PDD, rejeição, RTP unilateral, custos e alertas. Redigir dados sensíveis e segredos de logs. |
| Homologação | Ambiente privado aprovado, credenciais temporárias e destinos estritamente controlados. Exercitar entrada, saída, erro, fraude e rollback antes do aceite. |

O simulador privado permite testar políticas, capacidade, autenticação, resultado e bloqueio de transferências sem uma prestadora. As exigências de transporte, endereçamento, numeração, tarifação e failover do fornecedor continuam pendentes. O perímetro real precisa de aprovação própria. [Arquitetura de perímetro anterior](FASE-03A-PERIMETRO.md)
