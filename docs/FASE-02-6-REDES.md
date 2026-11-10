# Fase 02.6 — Redes de homologação

O laboratório `flora-026` usa clientes em bridges Docker diferentes e peers WireGuard com chaves próprias, dentro da VM do Docker. O router aplica a política no namespace do container. A topologia separa clientes e exercita roteamento e NAT sob controle do laboratório, em um único Mac. A validação por três acessos físicos continua pendente.

| Plano | Caminho no laboratório | Política para o teste com pessoas |
| --- | --- | --- |
| Aplicação e API HTTPS | Peer → edge TCP 443 → Next.js → Go | DNS e certificado confiáveis na rede privada. |
| Eventos operacionais | Peer → WSS na mesma origem HTTPS → Go | Sessão individual revogável e escopo por tenant. |
| SIP/WSS | Peer → TCP 8443 (A) ou 8444 (B) → proxy exato `/ws` → TLS do PBX | Autorizar peer por empresa, validar origem e certificado e manter autenticação PJSIP individual. |
| Mídia DTLS-SRTP e ICE | Peer → UDP 18000–18020 (A) ou 18100–18120 (B) → PBX, com endereço de retorno próprio no segmento do PBX | O endereço que o PBX anuncia no SDP precisa ser alcançável a partir do navegador. Medir o par ICE selecionado e tráfego em ambos os sentidos. |
| Administração | AMI fica nas redes internas de serviço, ARI desativado | Nenhuma rota de acesso de clientes para AMI, ARI, banco ou API interna. |

O ambiente principal mantém os endereços WSS locais. O build privado aceita `NEXT_PUBLIC_FLORA_WSS_A` e `NEXT_PUBLIC_FLORA_WSS_B` e deriva a lista CSP dos respectivos endpoints WSS. A CA efêmera é confiada somente dentro dos clientes descartáveis. As chaves e credenciais do laboratório ficam em `.local/phase-02-6/lab`, fora dos relatórios.

A rota privada deve ser específica para os endereços de serviço, evitando conflito com sub-redes domésticas e rotas amplas. Conferir IPv4, IPv6, DNS, MTU, timeout UDP e firewall de cada rede. Testar HTTPS, depois WSS e, por fim, o par ICE, contadores RTP/SRTP, perdas e jitter. HTTPS e REGISTER funcionando provam apenas a sinalização. O laboratório atribui a cada peer de mídia um endereço reservado no segmento do próprio PBX. O router termina o túnel e responde ARP por esses endereços, com ACL por peer e faixa. O SNAT fica limitado ao proxy TCP. O laboratório não configura STUN/TURN. Se os candidatos host do cenário físico não formarem um par utilizável, avaliar TURN privado com credenciais de curta duração e teste de relay com UDP bloqueado. STUN ajuda na descoberta de endereço e TURN fornece relay. [ICE no Asterisk](https://docs.asterisk.org/Configuration/Miscellaneous/Interactive-Connectivity-Establishment-ICE-in-Asterisk/), [WebRTC no Asterisk](https://docs.asterisk.org/Configuration/WebRTC/Configuring-Asterisk-for-WebRTC-Clients/).

## Repetição local

A partir da raiz do repositório, com as imagens locais da Fase 02.5 disponíveis, execute estes comandos. Se o Compose privado já tiver sido gerado, omita o comando de setup. A CA do laboratório expira em dois dias.

```sh
docker build -t flora-026-router -f infra/network-lab/Dockerfile.router infra/network-lab
docker build -t flora-026-browser -f infra/network-lab/Dockerfile.browser infra/network-lab
python3 scripts/network-lab.py setup
dc() { docker compose -p flora-026 -f .local/phase-02-6/lab/compose.json "$@"; }
dc up -d
scripts/probe-network-lab.sh
dc exec -T control node /app/verify.cjs functional
```

Os testes de falha usam `scripts/run-network-lab-resilience.sh` e o projeto descartável. A matriz Firefox pode ser executada iniciando o servidor local de Firefox com `dc exec -d client1 node /app/browser-server.cjs firefox` e o equivalente para `client2`, então `dc exec -T control node /app/verify.cjs firefox`. Executar um cenário por vez. Encerrar o laboratório com `dc stop`, preservando os volumes.

A imagem browser inclui um servidor Playwright interno para automação. Para três pessoas, usar VPN autenticada já aprovada pelo responsável, com identidade por dispositivo e ACLs por empresa. A preparação dessa conectividade física ainda depende da infraestrutura autorizada. Não reutilizar as chaves nem o servidor Playwright do laboratório com participantes.
