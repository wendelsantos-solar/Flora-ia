# Fase 01.1 — Homologação de telefonia humana

Data: 08/11/2026, America/Sao_Paulo. Projeto: `/Users/wendelpaco/works/flora-ia`.

**Parecer: GO COM RESTRIÇÕES para continuidade da homologação local. Aprovação integral humana: PENDENTE.**

O usuário escolheu preparar o roteiro e realizar a conversa depois. Nenhuma pessoa confirmou nesta execução uma conversa humana bidirecional de qualidade aceitável. Os testes de mídia automatizados utilizam sinal gerado nativamente pelo navegador, com SIP/WebRTC e Asterisk reais; não substituem a avaliação humana.

## Adendo de homologação humana — 08/11/2026

Ao iniciar a Fase 02, o responsável pelo projeto confirmou manualmente que a **conversa humana bidirecional funcionou**. É um relato do responsável posterior à execução automatizada descrita abaixo. Não foram informados navegador, dispositivos, duração, IDs de chamadas ou os resultados de todos os itens do roteiro; esses detalhes não foram inferidos. Firefox continua com falha de mídia na execução automatizada e Safari nativo continua sem homologação.

Os estados PENDENTE no relatório original registram a situação daquela execução. A confirmação acima não altera os resultados por navegador nem a restrição de operação local.

## 1. Estado anterior

Monólito modular Go/chi, Next.js/React/TypeScript/Tailwind/SIP.js 0.21.2, Asterisk 20.15.2/PJSIP e PostgreSQL. Dois ramais 201/202, WSS e DTLS-SRTP, histórico CEL e eventos AMI/WS já validados na Fase 01, com restrição de ausência de escuta humana. Os arquivos/evidências anteriores foram preservados; os testes desta fase gravam em `docs/evidence/phase-01-1`.

Seleção anterior: apenas entrada para a próxima chamada, após enumeração iniciada por clique. Permissão de microfone solicitada por getUserMedia no começo de ligação/atendimento ou em Buscar microfones. Sem observador de devicechange/ended, sem medidor de áudio e saída limitada ao sistema. SIP.js negocia oferta/resposta SDP e ICE; Asterisk faz ponte de mídia. Codecs configurados: ulaw/PCMU e alaw/PCMA; sem Opus. ICE habilitado, sem servidores STUN/TURN externos; endereços e bindings exclusivos de localhost.

## 2. Problemas encontrados

- Revogar a permissão de microfone numa chamada real encerrava a captura sem aviso do discador. O ensaio anterior à correção falhou esperando um alerta; transcrição em `evidence/phase-01-1/baseline-permission-failure.txt`.
- Fechar abruptamente os clientes deixou dois pares de canais de teste ativos: o endpoint tinha `rtp_timeout=0`. Apenas esses canais criados pela verificação foram encerrados; histórico e volumes foram preservados.
- Ausência de separação entre falha de sinalização e falha de mídia; controles sem estados explícitos para atender/encerrar e sem limite local para término pendente.
- Mensagens nativas de falha de áudio nem sempre explicavam recuperação. Sem recuperação guiada de microfone removido/revogado, seleção de saída ou fallback explícito de reprodução bloqueada.
- Janela de risco em cancelamento durante getUserMedia: a captura pode chegar depois de encerrar a sessão. Adicionado controle de propriedade e liberação da stream tardia.
- Ambiente de teste: Chromium Headless Shell devolveu NotSupportedError na captura. Uma reprodução independente capturou e gerou oferta com o Chromium completo. A homologação passou a usar o binário completo; isso não é apresentado como falha do Asterisk.
- Durante a construção dos testes, seletores ambíguos confundiam “Disponível” com “Histórico indisponível”; foram substituídos por igualdade. Um teste lia opções antes da enumeração terminar; agora aguarda a lista. Erros de sintaxe/tipos do próprio teste foram corrigidos antes da validação final.

## 3. Correções realizadas

- Observação das tracks reais e aviso para captura encerrada, mutada ou recuperada; atualização da lista por devicechange, sem solicitar nova permissão automaticamente.
- Estados SIP e mídia separados. Atendimento/encerramento têm estados próprios; falha de conexão de áudio informa o usuário e libera a sessão. Desconexão transitória pode recuperar; permanece limite local de 15 s para desconexão de mídia não recuperada, e 8 s para encerramento pendente.
- Troca da entrada durante chamada com getUserMedia + RTCRtpSender.replaceTrack, encerramento da track antiga, preservação do mute e descarte da stream se a chamada terminar no meio da operação. Não há nova pilha SIP/RTP.
- Seleção da saída via setSinkId quando suportada/permissão concedida; caso contrário, orientação para saída do sistema. Remoção da saída selecionada gera aviso.
- Medidores reais de RMS de entrada e recepção, processados localmente por Web Audio, sem gravação. Eles comprovam atividade de sinal, não voz humana ou qualidade perceptual.
- Recuperação de autoplay bloqueado por botão Reproduzir áudio. Limpeza de tracks, RTCPeerConnection, AudioContext, listeners, timers e elemento de reprodução ao encerrar.
- Timeout RTP de 30 s no Asterisk e 60 s em hold; atualizados por reload do módulo PJSIP no próprio serviço. Sem tronco externo, sem nova porta, sem alteração de transporte ou rede de outros projetos.
- Hooks de diagnóstico somente de leitura: estados, tracks efêmeras, fechamento e contadores/codec. Não incluem tokens, senhas, áudio ou identificadores persistentes de dispositivo.

## 4. Testes automatizados

Resultados finais e comandos estão consolidados na seção “Resultado executado”, abaixo. Não usar um teste interrompido ou uma evidência antiga como sucesso desta versão.

Rotina completa: `scripts/test-homologacao.sh`, apenas com os ramais de desenvolvimento livres. Ela recusa canais ativos; não executar enquanto operadores humanos usam 201/202, mesmo sem chamada. Não grava sobre as evidências da Fase 01.

Comandos individuais na raiz:

```sh
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"
node --experimental-strip-types --test tests/unit/audio-health.test.mjs
web/node_modules/.bin/playwright test --config web/playwright.homologacao.config.ts
web/node_modules/.bin/playwright test --config web/playwright.compatibilidade.config.ts
EVIDENCE_DIR="$PWD/docs/evidence/phase-01-1/regression" npm --prefix web run test:e2e
```

A suite de homologação cobre chamadas sucessivas, mute por energia no receptor, substituição de track, permissão negada/revogada/restaurada, cancelamento durante estabelecimento, interrupção real de mídia por pausa curta do motor e limpeza por timeout após fechamento abrupto. Unit tests usam um EventTarget/track double identificado exclusivamente para testar observação e tradução de erros; esse double não serve como prova de mídia. Não há mock de SIP, Asterisk, API ou RTP nos ensaios de navegador.

## 5. Mídia comprovada

A evidência válida requer incremento de pacotes RTP recebidos e energia de áudio decodificada nos dois lados, sessão real e encerramento. Mute deve reduzir energia no receptor e unmute restaurá-la; alteração visual do botão, sozinha, não basta. Substituir uma track do microfone de teste comprova o mecanismo de troca, não dois headsets físicos diferentes. Os JSON desta fase identificam a fonte de teste e os IDs das chamadas quando aplicável.

## 6. Validação humana necessária

**Todos os itens físicos/humanos continuam PENDENTES:** captura/escuta de fala inteligível, simultaneidade humana, qualidade por três minutos, eco/atraso percebidos, remoção/reconexão física de headset, separação real de entradas/saídas, troca entre dispositivos físicos, reação a mute físico, cinco conversas sucessivas e confirmação dos dois operadores.

[Roteiro com critérios e ficha de registro](ROTEIRO-AUDIO-HUMANO.md). Dois perfis e permissões são preparados, mas não ficam autenticados automaticamente com segredos embutidos. Usar credenciais locais de 201/202 no `.env`, em perfis separados. Não gravar áudio nem dados pessoais.

## 7. Compatibilidade

Chrome e Safari nativos foram encontrados no macOS. Firefox nativo não foi encontrado; foram instalados, apenas no projeto, os runtimes Firefox e WebKit do Playwright para investigação. WebKit automatizado não equivale a Safari nativo. Chrome/Chromium com áudio gerado não equivalem a homologação acústica em hardware.

A matriz efetivamente executada está registrada abaixo, distinguindo registro/capacidades de mídia. Safari nativo, dois equipamentos físicos e redes diferentes permanecem pendentes. Não foram ativadas permissões globais de automação nem alterado o trust store do computador.

## 8. Segurança

AMI e PostgreSQL continuam na rede Docker sem portas host; WSS e RTP permanecem no loopback. Certificados continuam validados, sem ignoreHTTPSErrors ou desativação de TLS. Segredos existentes não foram rotacionados, impressos ou inseridos na UI/bundle. A política de saída de áudio é restrita à própria origem.

Os testes criam ligações/histórico reais de desenvolvimento e pausam/retomam exclusivamente o container Asterisk deste projeto. Fechamento abrupto pode levar até 30 s para o motor liberar os canais. Não houve alteração de firewall global, serviços alheios, operadora, commit, push ou publicação externa. Autenticação estática, HTTP loopback e AMI privado sem TLS continuam concessões do laboratório; não são configuração comercial.

## 9. Limitações para telefonia externa

URL WSS, CSP, origem da API e mídia continuam locais; uma segunda máquina não pode simplesmente abrir o IP do Mac. [Preparação de LAN/VPN/NAT/firewall](REDES-DE-HOMOLOGACAO.md) lista os pré-requisitos ainda não executados, sem exposição pública do Asterisk. Não há VPN/TURN/SBC, tronco, número externo ou teste de operadora. DTMF, chamadas longas, hold real, qualidade sob perda e calibração de timeout/silêncio/DTX continuam sem homologação.

## 10. Parecer e próximo passo

**GO COM RESTRIÇÕES**, apenas para seguir a homologação local. **Não há GO integral da Fase 01.1** enquanto duas pessoas não confirmarem conversa humana bidirecional com qualidade aceitável e os problemas eventualmente encontrados não forem tratados. Não iniciar Fase 02 nem troncos SIP automaticamente.

Próximo passo: conectar headsets físicos, executar ROTEIRO-AUDIO-HUMANO.md e preencher resultados e IDs. Se algum requisito técnico automatizado permanecer com falha material, registrá-lo no resultado final e não avançar como aprovado.

## Resultado executado

A rodada final da suite de homologação passou **12/12 cenários em 2,7 minutos**, seis por navegador ([log](evidence/phase-01-1/homologacao-final.log)). Nos dois navegadores, três chamadas consecutivas alternaram o originador; pacotes e energia decodificada cresceram nos dois receptores, mute reduziu energia e unmute restaurou. Permissões negadas/revogadas foram recuperadas sem recarregar, a track substituída foi encerrada e sessões/capturas foram liberadas. Fechamento abrupto foi limpo pelo timeout real e a chamada terminou com pernas e histórico consistentes. São sinais de teste nativos, não conversa humana.

| Navegador/ambiente | Registro SIP/TLS | Mídia/estabilidade automatizada | Conversa humana |
| --- | --- | --- | --- |
| Chrome instalado 156.0.8078.80, macOS ARM64 | PASS | 6/6 PASS, sinal gerado | PENDENTE |
| Chromium completo 158.0.8127.18, Playwright | PASS | 6/6 PASS, sinal gerado | PENDENTE |
| Firefox 159.0, runtime Playwright, sem Firefox nativo instalado | PASS | FAIL: ICE sem caminho de mídia comprovado | PENDENTE; não homologado |
| WebKit 27.2, runtime Playwright | PASS | NÃO EXECUTADO; capacidades apenas | PENDENTE; não equivale a Safari |
| Safari nativo 27.0.1 (22625.1.29.11.28) | NÃO EXECUTADO | NÃO EXECUTADO | PENDENTE |
| Dois equipamentos / redes distintas | NÃO EXECUTADO | NÃO EXECUTADO | PENDENTE |

Foram usados dois contextos independentes de navegador, com credenciais, cookies e permissões separados. Isso valida a separação automatizada; dois perfis de usuários operados por pessoas continuam no roteiro. A perda de mídia foi provocada por pausa do Asterisk por cerca de quatro segundos, seguida de retomada; não representa queda de WAN ou firewall real.

- Regressão original: **2/2 PASS em 45,5 s**, com mídia real gerada, reinício do Asterisk/reconexão SIP, chamada durante indisponibilidade do backend e recuperação CEL, autorização REST, limites de entrada, origem WS e isolamento de eventos entre tenants ([log](evidence/phase-01-1/regression-final.log)).
- Compatibilidade: **1 PASS (WebKit registro/capacidades), 1 FAIL (Firefox mídia)** ([log](evidence/phase-01-1/compatibilidade-final.log), [Firefox](evidence/phase-01-1/firefox-compatibility.json), [WebKit](evidence/phase-01-1/webkit-capabilities-compatibility.json)). A rotina completa retorna falha por essa restrição real; não se declara toda a matriz aprovada.
- Estado final: quatro serviços do projeto ativos, readiness `ready`, zero canais e zero chamadas ativas; serviços sem pausa, dados e volumes preservados ([registro](evidence/phase-01-1/final-state.json)). Não houve commit, push, publicação externa ou início de Fase 02.
- Backend: `go test -race` e `go vet` passaram ([log](evidence/phase-01-1/backend-tests.log)). Integração com PostgreSQL descartável passou: persistência, isolamento entre tenants, ordenação, idempotência e recuperação ([log](evidence/phase-01-1/integration.log)). O banco do produto não foi substituído.
- Dois testes unitários de observação de microfone/erros passaram ([log](evidence/phase-01-1/audio-unit-final.log)); TypeScript passou ([log](evidence/phase-01-1/typecheck-final.log)) e build de produção passou ([log](evidence/phase-01-1/build-final.log)).
- Capturas da chamada: [desktop](evidence/phase-01-1/call-desktop.png) e [390 px](evidence/phase-01-1/call-mobile.png). A inspeção visual manteve os controles legíveis e sem rolagem horizontal nessa largura. Capturas não comprovam qualidade de voz.

A ausência de Firefox nativo limita a conclusão ao runtime automatizado. Nele, o diagnóstico mostrou captura local viva e energia de entrada, codec PCMU, sessão SIP Established, ICE checking e nenhum RTP recebido. A sessão foi posteriormente liberada. A causa exata da negociação ICE nesta topologia Docker/loopback permanece sem resolução; não foi atribuído o problema a permissões ou DTLS sem evidência. Não foram habilitados candidatos loopback por preferência especial para simular compatibilidade padrão. Firefox permanece não homologado para mídia neste ambiente.

## Referências técnicas

[SIP.js: SessionDescriptionHandler](https://github.com/onsip/SIP.js/blob/main/docs/session-description-handler.md), [MediaStreamTrack ended](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event), [connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState), [devicechange](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/devicechange_event), [setSinkId e permissões](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId), [PJSIP e timeouts RTP](https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/Module_Configuration/res_pjsip/).
