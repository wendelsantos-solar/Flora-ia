# Relatório da Fase 01 — 08/11/2026

**Parecer: GO COM RESTRIÇÕES para prova local. Não autoriza produção ou piloto externo.**

Chamadas SIP/WebRTC reais foram estabelecidas entre 201 e 202 nos dois sentidos, com áudio de teste atravessando Asterisk/DTLS-SRTP, decodificado nos dois clientes, encerramento propagado e histórico persistido. Não houve operadora, número público, contratação, serviço pago ou integração com saúde. Não foi usado mock de chamada, sinalização ou transporte de mídia.

A restrição principal é a ausência de escuta humana com microfones/fones físicos. O teste usa o dispositivo de áudio de teste nativo do Chromium: um sinal sintético, transportado por sessões reais. A evidência comprova tráfego e decodificação bidirecional; não comprova inteligibilidade de fala, qualidade perceptual, eco nem hardware físico. Chrome/Firefox/Safari de uso cotidiano e redes além de localhost ainda exigem validação.

Atualização posterior: o responsável confirmou conversa humana bidirecional ao iniciar a Fase 02. Consulte o adendo em [Fase 01.1](FASE-01-1-HOMOLOGACAO.md). Os resultados abaixo são o registro original da Fase 01.

## Entrega implementada

- Monólito modular Go/chi; pgx, leituras de ramais geradas por sqlc, config por ambiente, logs JSON, correlation ID, timeouts, limites e shutdown gracioso.
- PostgreSQL com tenants, usuários fictícios, ramais, sessões, pernas, eventos e base de auditoria. RLS força contexto de tenant; papel da aplicação não é proprietário/superuser.
- Asterisk/PJSIP em imagem ARM64 com módulos explícitos, credenciais individuais, WSS validado por CA local, ICE/DTLS-SRTP, PCMU/PCMA, RFC4733 e dialplan restrito a 201/202.
- REST versionada e OpenAPI; autenticação por token individual/cookie HttpOnly, autorização por tenant. Sem endpoint de originação REST fictício.
- AMI somente na rede Docker; snapshots/reconexão e eventos operacionais. Diário CEL persistente, importação idempotente e recuperação de histórico após parada do backend.
- WebSocket autenticado com origem validada, cursor/replay e reconexão. Eventos reais de chamada/registro; nenhuma dependência Redis.
- Discador Next.js/React/TypeScript/Tailwind/SIP.js: conectar ramal, discar, receber, atender, rejeitar, encerrar, mute/unmute, duração, erros reais e seleção de microfone para a próxima chamada.
- Docker Compose isolado, bootstrap local de segredos/certificados, testes e documentação.

## Arquivos e módulos

`backend/cmd/server`, `backend/internal/{identity,tenants,extensions,telephony,calls,realtime,integrations,audit,store,httpapi}`, SQL/migração em `backend/db`, código sqlc em `backend/internal/store/dbgen`, testes Go em módulos e `backend/integration`.

`web/src/app` contém interface/estilos/layout; `web/src/lib/phone.ts`, ciclo de vida SIP e mídia; `web/tests`, teste real e testes REST/WebSocket. `infra/asterisk` contém templates/entrypoint/imagem, `infra/postgres` o provisionamento do papel limitado. `scripts` contém bootstrap, integração descartável e rotina geral de testes. Arquitetura e diagrama em ARCHITECTURE.md; versões/fontes em COMPATIBILITY.md.

## Execução

```sh
python3 scripts/bootstrap.py
docker compose up -d --build
```

Abrir http://localhost:13400. Credenciais de 201/202 no `.env` local, nunca incluídas neste relatório. Usar dois perfis de navegador separados. `docker compose stop` encerra somente este projeto preservando dados. Instruções completas: SETUP.md e TELEPHONY.md.

## Testes e evidências

| Verificação | Resultado / limite |
| --- | --- |
| Go unitários, race detector e go vet | PASS; identidade, validação/autenticação HTTP, leitura AMI, parser CEL formatado/epoch. Double de status somente no teste unitário, identificado no código |
| Integração PostgreSQL descartável | PASS; bootstrap/migração, papel limitado, RLS sem filtro explícito, isolamento, idempotência, evento fora de ordem, reconciliação de órfão e replay em novo pool |
| TypeScript estrito | PASS |
| Next build de produção / Docker ARM64 | PASS; runtime standalone final verificado pela rotina de navegador |
| Dependências JavaScript | npm audit: zero vulnerabilidades reportadas na data; inventário/licenças em evidence |
| Go segurança | govulncheck com Go 1.26.10: nenhuma vulnerabilidade encontrada. O primeiro scan em 1.26.0 encontrou 23 da biblioteca padrão e motivou a atualização |
| 201 e 202 registram via WSS | PASS; REGISTER/401/REGISTER/200 observados, TLS sem bypass |
| 201 → 202 e 202 → 201 | PASS; INVITE, ringing, accept, ACK e mídia nos dois clientes |
| Áudio bidirecional automatizado | PASS para sinal de teste: incremento de pacotes e de energia decodificada nas quatro medições; números/IDs em evidence/webrtc.json |
| Encerramento pelo chamador | PASS nos dois sentidos; BYE/200 e os dois clientes voltam a Disponível |
| Rejeição e mute/unmute | PASS no fluxo real e no estado do botão. Supressão perceptual do microfone físico não foi ouvida/medida separadamente |
| Reinício real do Asterisk | PASS; perda de WSS, novo REGISTER/200, recuperação de estado na UI e de AMI/readiness |
| Backend parado durante chamada | PASS; chamada inicia/termina com backend parado; após retorno, CEL recupera sessão concluída sem inventar resposta REST |
| Histórico | PASS; teste exige ID novo por chamada, estado completed e pelo menos duas pernas, sem reutilizar sucesso de chamadas anteriores |
| REST/autorização/origem WS | PASS; 401 sem acesso, 400 em entradas inválidas, 404 para recursos de outro tenant, 403 para origem indevida, nenhum evento entregue ao tenant vazio |
| Privacidade de respostas/logout | PASS; respostas não contêm segredos conhecidos; após sair não há histórico e requisições pendentes não o repovoam |
| UI desktop/mobile | Capturas reais da aplicação, sem conteúdo mockado; sem overflow horizontal a 390 px; revisão independente encontrou duas correções de estado/copy, aplicadas e verificadas como resolvidas |
| Microfones/fones físicos e escuta humana | NÃO EXECUTADO; roteiro manual em TELEPHONY.md |
| WAN/LAN/VPN, TURN, outros navegadores | NÃO EXECUTADO |
| DTMF efetivo, transferência, hold/resume | DTMF configurado, mas não testado; demais operações fora da fase |
| Scan de SO/imagens, pentest, LGPD | NÃO EXECUTADO; ausência de alertas nas bibliotecas não equivale a certificação |

Os testes integrados e de telefonia não utilizam mocks. Os eventos de validação unitária/integração ficam no banco descartável, removido ao final; o histórico da central de desenvolvimento contém somente tentativas/chamadas realmente feitas no motor, incluindo falhas de diagnóstico.

Arquivos de evidência: `evidence/webrtc.json`, `sip-signals.json` (somente primeiras linhas SIP, sem headers de autenticação), `call-desktop.png`, `history-desktop.png`, `history-mobile.png`, `logout-mobile.png`, logs de backend/integração/E2E/build/segurança e inventário de versões. Não há gravação de áudio.

## Erros encontrados e corrigidos

A primeira chamada falhou até incluir dependências reais dos módulos Asterisk e fixar transporte de saída WSS. O parser CEL precisou aceitar epoch fracionário, como observado no diário. Recriações de container expuseram rejeição do From pelo SIP.js: domínio/hostname agora são determinísticos. O teste de restart encontrou registro confirmado no motor sem atualização da tela; callback explícito de aceite do novo REGISTER corrigiu o estado. Inicialização descartável expôs opções de shell vazando de script SQL inicial: hook passou a executar isoladamente e não muda opções do chamador. Revisão da UI encontrou histórico visível após logout e direção incorreta em chamada recebida; ambos corrigidos. Detalhes em evidence/TROUBLESHOOTING.md e log de falha anterior à correção.

## Limitações e riscos restantes

Autenticação estática de desenvolvimento, sem rotação/revogação/OIDC/RBAC comercial. Um tenant de telefonia estático; infraestrutura de banco/API está isolada por tenant, mas provisionamento multiempresa no Asterisk não está pronto. Diário relido integralmente, limite de 32 MiB, sem rotação/backup automatizados; fonte pode perder evento não flushado em morte abrupta. Transações serializadas por tenant e apenas uma instância backend. UI reapresenta estado agregado via REST; `call.ringing` pode faltar se AMI cair durante o toque. Seleção de dispositivo somente de entrada; sem seletor de alto-falante. Sem hold, transferência, filas, troncos ou números públicos. Asterisk 20 está na etapa de manutenção de segurança pelo calendário; migrar para LTS posterior antes de expansão.

Bindings são loopback; HTTP do app e AMI da bridge são concessões ao laboratório isolado. Segredos permanecem na memória/arquivos locais/ambiente de containers, protegidos pelo limite de confiança de acesso ao host e daemon Docker. Não há garantia de ausência de vulnerabilidades; registrar scans e revisar antes de qualquer uso externo.

## Recomendação para a Fase 02

Primeiro concluir escuta humana e matriz de dispositivos/navegadores do roteiro; só então evoluir identidade/sessão revogável, provisionamento/contextos por tenant, migrações versionadas e ingestão/rotação de eventos para uso prolongado. ROADMAP.md detalha a ordem. Não iniciar operadora, produção ou integrações comerciais nesta entrega.

Serviços locais deste projeto permanecem disponíveis para revisão. Nenhum commit, push ou implantação em produção foi realizado.

Execução final no runtime standalone: **2 testes de navegador passaram em 35,8 s**, incluindo as chamadas nos dois sentidos, mídia, reinícios, replay, autorização e isolamento. Resumo numérico da mídia em [evidence/MEDIA-RESULTS.md](evidence/MEDIA-RESULTS.md). Revisão final da UI: **ship**, estritamente para os dois problemas corrigidos e para o escopo visual revisado.
