# Fase 02.6 — Segurança e isolamento

## Escopo

Dois PBXs Asterisk 20.22.0 independentes, usuários de teste distintos e uma cópia descartável da aplicação. O Compose privado deixa listeners fora do Mac. As portas 443, 8443/8444 e as faixas UDP de mídia só são roteadas pelos peers autenticados e pelas regras do router Docker. O nginx valida TLS upstream e limita o proxy SIP a `/ws` com origem esperada. Origin é uma barreira de navegador, complementada pela ACL WireGuard e autenticação PJSIP.

O serviço Go autentica APIs e a conexão de eventos, aplica limites por usuário e revalida a sessão do WebSocket. O código mantém consultas e eventos no tenant e no escopo do principal. Ramais, filas e REFER são tratados no dialplan do próprio PBX. ARI está desativado. O AMI continua interno com as ações restritas da Fase 02.5. As 24 verificações daquela fase pertencem ao relatório anterior. As evidências desta fase estão no [relatório de homologação](FASE-02-6-HOMOLOGACAO.md).

## Ameaças e limites

- O edge é um ponto confiável com acesso aos dois segmentos PBX. A rede do router também toca ambos os segmentos para transportar mídia. Manter imagens, configuração, credenciais e operações sob controle de infraestrutura. Uma falha de ACL precisa ser detectada antes do piloto.
- As regras IP valem no namespace do laboratório. Testar as negativas também em uma VPN física, incluindo um cliente sem chave e um peer autenticado da empresa errada. Revisar IPv6, regras no concentrador, rotas de retorno, perda de conectividade e revogação.
- O servidor Playwright existe apenas no underlay isolado do laboratório. Ele permite automação de navegador e deve permanecer fora da solução remota para pessoas. Nenhuma CA efêmera deve ser instalada globalmente no Mac.
- Evitar dump de SDP, cabeçalhos de autenticação, números reais e dados de pacientes. O coletor guarda somente classes de candidatos ICE, métricas selecionadas e histórico sintético.
- A atualização e a varredura de dependências, o teste de revogação física e a revisão de acesso ao futuro perímetro de operadora permanecem itens do gate. A topologia local não determina o risco de um ambiente que ainda não foi especificado.

## Verificação

Executar `scripts/probe-network-lab.sh` com os clientes ativos. O script testa HTTPS, exige 401 para API sem sessão, confirma bloqueio do WSS de outro tenant e de listeners brutos e verifica handshakes WireGuard e ausência de portas publicadas. A verificação funcional cruza histórico de dois tenants e a sequência de eventos. Consultar a matriz para o resultado efetivamente observado.

Na topologia final, os quatro peers passaram pelas negativas. A evidência registra zero portas publicadas. No teste de dois tenants, as consultas cruzadas de histórico retornaram 404 e os fluxos WebSocket retornaram zero eventos da outra empresa. [Perímetro final](evidence/phase-02-6/perimeter-proxyarp.txt), [histórico e eventos](evidence/phase-02-6/functional-signaling.json).
