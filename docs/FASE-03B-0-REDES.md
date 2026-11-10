# Fase 03B.0 — Laboratório e redes físicas

O laboratório WireGuard usa peers, bridges e ACLs distintos dentro de um único host Docker. A topologia física para três pessoas exige VPN privada autenticada e aprovada pelo responsável. O 201, 202 e 203 pertencem ao tenant A de teste. Reservar uma identidade individual de VPN e credencial SIP por pessoa. Provisionar rotas apenas para os serviços necessários e excluir AMI, ARI, PostgreSQL e rotas do tenant B. O laboratório usa chaves descartáveis próprias.

| Plano | Trajeto | Verificação |
| --- | --- | --- |
| Aplicação e API HTTPS | Cliente privado → edge 443 → Next.js e Go | DNS privado, certificado confiável, sessão individual. |
| Eventos operacionais | WSS na origem HTTPS → Go | Autorização, revogação e ausência de eventos alheios. |
| Sinalização SIP | WSS 8443 para A e 8444 para B → PBX correspondente | Restrição de peer, origem HTTPS e registro individual. |
| Mídia | UDP 18000–18020 para A e 18100–18120 para B → PBX | Par ICE selecionado e fluxo DTLS-SRTP nos dois sentidos. |
| Administração | Rede interna de serviços | AMI somente pelos controles internos e ARI desativado. |

Antes da rodada física, o responsável valida DNS, certificados e rotas por dispositivo, incluindo ausência de sobreposição de sub-redes. Em cada rede, testa HTTPS, WSS e depois ICE/RTP, registrando MTU, perdas e limitações de UDP quando aparecerem. Se candidatos host não formarem par, documentar o bloqueio e avaliar relay TURN privado com credenciais curtas e ACL por usuário. A validação depende do caminho anunciado no SDP e do retorno UDP. VPN e registro SIP confirmam partes distintas desse caminho.

**Redes físicas PENDENTES.** Acesso humano depende de infraestrutura privada aprovada e certificados confiáveis nos dispositivos. [Roteiro humano](FASE-03B-0-HOMOLOGACAO.md) · [Topologia WireGuard de referência](FASE-02-6-REDES.md)

O inventário confirmou zero portas publicadas no laboratório. As portas mapeadas do ambiente local preexistente continuam em loopback. O router do laboratório aplica regras dentro do namespace do container. [Inventário](evidence/phase-03b-0/ports.txt)

## Resultado do laboratório

A rodada funcional passou com 201, 202 e 203 em três peers WireGuard e 211/212 em um quarto peer, reservado ao tenant B. Houve chamada direta, espera e retomada, duas filas 301 simultâneas, atendimento pelos agentes 202 e 212, pausa e retorno, transferência direta, rejeição de consulta, transferência assistida, destino indisponível e desconexão durante consulta. O teste usou dois Asterisks 20.22.0, Chromium 158 e mídia sintética. O histórico alheio retornou HTTP 404 e cada sessão WSS recebeu dez eventos próprios e zero cruzados. [Cenários, métricas e histórico](evidence/phase-03b-0/multirede/functional.json) · [Versão do Asterisk](evidence/phase-03b-0/asterisk-version.txt)

A sonda sem upgrade obteve HTTP 403 na porta WSS SIP permitida e nenhum HTTP na porta do outro tenant. O registro e as chamadas da rodada comprovaram o upgrade com os clientes autorizados. [Matriz de portas](evidence/phase-03b-0/multirede/peer-perimeter.tsv)

A repetição focada das filas e da pausa também passou com os dois peers necessários. [Reteste de isolamento](evidence/phase-03b-0/multirede/queues-isolation.json) · [Logs e canais](evidence/phase-03b-0/multirede/run.log)
