# Fase 03A — Perímetro

| Plano | Laboratório | Futuro piloto |
| --- | --- | --- |
| SIP do simulador | UDP/5060 em cada bridge interna. Digest bilateral e contextos isolados. | Edge SIP/SBC privado ou interconexão dedicada com CIDRs e identidade confirmados. TLS com validação de nome quando suportado. |
| Mídia | RTP privado entre processos Asterisk. Sem NAT público. | Faixa UDP negociada, SRTP quando suportado e mídia ancorada. Testar rotas de retorno, NAT, MTU e SDP real. |
| WebRTC | WSS e DTLS-SRTP no fluxo existente. | Manter separado do plano de prestadora. |
| API | HTTPS previsto no edge de acesso humano. Tráfego AGI HTTP em rede Docker privada com chave exclusiva por tenant. | Autenticação forte entre PBX e Go, controle de rede e gestão de rotação e revogação. |
| Administração | AMI interno conforme fase anterior. ARI desativado. | Manter AMI, ARI, PostgreSQL e portas de gestão fora da interconexão. |

O projeto de testes usa bridges Docker internas e não publica portas. A separação de rede complementa credenciais independentes e RLS. O Compose é descartável. A operação real precisa de mapa de listeners, endereços da prestadora, inspeção IPv4 e IPv6, política de tráfego de retorno e teste de falha de origem. Nenhuma regra global foi modificada.

A aprovação do perímetro exige evidências com a topologia real, inclusive TLS, SRTP ou aceitação formal de exceções, negativa de origens indevidas e validação da política de fraude sob carga. [Gate SIP](FASE-03-GATE-SIP.md), [NAT no PJSIP](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-res_pjsip-to-work-through-NAT/).
