# Preparação de testes entre dispositivos e redes

**Estado: cenários preparados, execução pendente. Nenhum Asterisk foi exposto na internet.**

## Configuração atual e limite real

Web: loopback 13400, HTTP confiável apenas por ser localhost; API: loopback 18400; SIP WSS: loopback 18489 com certificado local; mídia: UDP loopback 18000–18020, ICE habilitado, `MEDIA_ADDRESS=127.0.0.1`. O cliente aponta explicitamente para `wss://localhost:18489/ws`; CSP e origem da API também são locais. Não há STUN externo, TURN, VPN, tronco ou NAT de WAN configurados.

Dois contextos de navegador no mesmo computador não validam dois dispositivos nem travessia de NAT. A pausa de um container em testes interrompe mídia real, mas não equivale a testar um firewall ou roteador doméstico.

## Matriz preparada

| Cenário | Pré-condições | Teste | Situação |
| --- | --- | --- | --- |
| Dois perfis, mesmo Mac | Dois headsets e saídas individuais; CA confiável | Roteiro humano completo | PENDENTE humano |
| Dois computadores na mesma LAN privada | HTTPS de desenvolvimento nos dois clientes, WSS confiável, endpoint e origem parametrizados, mídia anunciada no endereço privado correto | Chamar nos dois sentidos, falar simultaneamente, encerrar e confrontar histórico | NÃO EXECUTADO |
| Dispositivos em redes distintas | VPN privada autorizada cobrindo sinalização e UDP, DNS/certificado privado e ACL restrita aos dois dispositivos | Repetir áudio/ICE e observar par de candidatos selecionado | NÃO EXECUTADO |
| UDP bloqueado em um lado | Laboratório privado descartável com filtro restrito ao teste, sem editar firewall global do host | Confirmar aviso de mídia indisponível e encerramento; confirmar que SIP registrado sozinho não é tratado como áudio aprovado | NÃO EXECUTADO |
| Rede com perda/latência | Emulação em rede/container de laboratório isolado, preservando serviços existentes | Conversa humana e métricas de jitter, perda e RTT antes/depois | NÃO EXECUTADO |
| VPN interrompida e restaurada | Cenário privado anterior aprovado | Observar SIP e mídia separadamente; validar recuperação ou nova chamada, sem sessão órfã | NÃO EXECUTADO |

## Mudanças necessárias antes de executar fora de localhost

Não basta trocar localhost por um IP no navegador. Em um ambiente de teste dedicado será necessário:

1. Definir endereços privados e domínio que identifiquem o host real; gerar certificado de servidor com SAN adequado e instalar conscientemente a CA de desenvolvimento em cada cliente. Nunca desativar validação TLS.
2. Parametrizar URL WSS/identidade SIP do cliente, CSP e origem permitida da API/WS. Atualmente os valores locais são intencionais e não foram alterados nesta fase.
3. Publicar web/WSS exclusivamente na interface da LAN/VPN autorizada, com autenticação; manter AMI/PostgreSQL sem portas host. Não fazer port forwarding no roteador nem usar túnel HTTP público para “resolver” a mídia.
4. Configurar `media_address`/endereços externos e locais do PJSIP conforme a topologia real e publicar a faixa UDP somente na interface privada escolhida. A mídia precisa ser alcançável nos dois sentidos; encaminhar somente TCP/WSS não garante RTP.
5. Verificar ICE e o par de candidatos selecionado. Se o caminho privado não oferecer alcance UDP suficiente, projetar um relay TURN autenticado em ambiente controlado antes de prosseguir. Nenhum relay foi instalado, contratado ou testado.
6. Verificar conectividade, certificados e regras do laboratório sem interromper outros projetos. Depois executar o roteiro humano e registrar IDs, estados, perda/jitter/RTT e resultado perceptual.

Essas alterações devem ser revisadas e testadas no ambiente privado real. Este documento prepara o procedimento; não afirma que a configuração local atual já atende LAN/WAN.

## Limitações antes de troncos externos

Ainda faltam homologação humana, domínio/TLS remotos, topologia NAT/ICE/SBC adequada, política de segurança SIP, validação de DTMF, chamadas longas e áudio sob perda, além do provisionamento de tenants e autenticação comercial. O timeout RTP de 30 s limpa canais sem mídia no laboratório; precisa ser recalibrado com codecs, silêncio/DTX, hold e topologia reais antes de expansão. Não iniciar operadora ou Fase 02 com base apenas em contadores de teste local.
