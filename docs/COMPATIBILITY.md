# Compatibilidade e fontes oficiais

Atualização Fase 02.5: os dois motores locais usam Asterisk 20.22.0. As versões anteriores abaixo são a baseline histórica. Veja a [matriz atual](FASE-02-5-TESTES.md).

Verificado em 08/11/2026 e validado na execução local ARM64 descrita no TEST-REPORT.

- Go 1.26.10: patch explícito com correções de segurança, sem modificar instalação global. O Go 1.26.0 inicialmente instalado não era adequado ao parecer final; toolchain local é obtido pelo mecanismo padrão do Go e cache fica no projeto. [Releases oficiais](https://go.dev/dl/?mode=json), [govulncheck](https://go.dev/doc/tutorial/govulncheck).
- Next.js 16.4.5 / React 19.3.1 / Node 22.23.2 no host: npm registry declara mínimo Node 20.9 para Next. Imagem Node 22 fornece runtime mantido; versões exatas das bibliotecas no lockfile. [Instalação Next](https://nextjs.org/docs/app/getting-started/installation).
- SIP.js 0.21.2: UserAgent, Registerer, Inviter, Invitation e SessionState; lifecycle explícito, uso das interfaces e tipos instalados para peerConnection opcional. [Guia oficial](https://sipjs.com/guides/user-agent/), [releases](https://github.com/onsip/SIP.js/releases).
- Asterisk 20.15.2-r1 em Alpine 3.23 ARM64: pacote contém res_http_websocket, res_pjsip_transport_websocket, SRTP e CEL Custom; módulos reais conferidos por CLI. Codec PCMU comum ao Chromium e Asterisk. Não pressupõe suporte a Opus: evitada dependência adicional de codec. [WebRTC Asterisk](https://docs.asterisk.org/Configuration/WebRTC/Configuring-Asterisk-for-WebRTC-Clients/), [PJSIP 20](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/Module_Configuration/res_pjsip/), [calendário de suporte](https://docs.asterisk.org/About-the-Project/Asterisk-Versions/).
- Eventos correlacionados por linkedid/uniqueid; CEL grava epoch fracionário nesta versão. [CEL](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/CEL/), [CoreShowChannel](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Events/CoreShowChannel/), [configuração CEL Custom](https://github.com/asterisk/asterisk/blob/20/configs/samples/cel_custom.conf.sample).
- PostgreSQL 17 / pgx 5.12 / sqlc 1.30: APIs usadas compiladas e integração RLS executada em banco descartável. [pgx](https://github.com/jackc/pgx), [sqlc](https://docs.sqlc.dev/), [RLS PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Asterisk 20 é LTS com calendário de manutenção de segurança até 19/10/2027. A página de versões ainda exibia “Fully Supported” na coluna de estado, embora a data de início de security-only seja 19/10/2026; esta documentação usa as datas explícitas. A Fase 02 deve validar uma LTS mais recente antes de qualquer planejamento comercial.

Licenças verificadas nos pacotes instalados e arquivos upstream: [License Information Asterisk](https://docs.asterisk.org/About-the-Project/License-Information/), [COPYING](https://github.com/asterisk/asterisk/blob/20/COPYING). Inventário JavaScript em evidence/npm-licenses.json; avisos diretos em THIRD-PARTY-NOTICES.md.

A reprodução é funcional, não byte a byte: imagens base usam tags de série e seus patches podem avançar; APK Asterisk e bibliotecas de aplicação estão fixados. Preservar os digests dos logs de build e repetir os testes ao reconstruir com atualizações de sistema.
