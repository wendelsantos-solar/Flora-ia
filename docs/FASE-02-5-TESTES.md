# Fase 02.5 — Evidências e homologação

## Testes automatizados

- Suite de hardening: dois PBXs e quatro contextos Chromium; chamadas simultâneas para o número 301 de cada empresa, RTP e energia decodificada em cada receptor. Testes HTTP de troca de IDs, FK de membro estrangeiro, role, delegação e eventos. INVITE e REFER adulterados são encaminhados ao WSS real; as respostas e a mídia vêm dos PBXs. O teste não simula resposta do motor.
- Sessão opaca: replay de cookie revogado recebe 401; WebSocket aberto antes do logout fecha com código 1008.
- Banco: parada temporária somente do PostgreSQL do projeto; SIP continua com mídia; readiness acusa indisponibilidade; WebSocket e histórico recuperam; uma chamada, pernas encerradas e nenhum canal. O mesmo ID fica inacessível ao operador que não participou e à outra empresa.
- Fila com membro ocupado: dois diálogos no mesmo tenant em três ramais; a segunda chamada fica na fila até o agente encerrar a primeira.
- Regressões: Fase 02 (filas, espera, transferências, horário e contingência), Fase 01 (reinício de backend e Asterisk), Fase 01.1 (mídia, microfone, encerramento e reconexão) e integração PostgreSQL descartável.
- Verificação AMI/ARI: chamadas de protocolo para ações negadas e tentativa de alcançar a porta AMI nativa a partir do backend; módulos ARI verificados nos dois motores. Logs de teste não incluem credenciais.

Use [scripts/test-hardening.sh](../scripts/test-hardening.sh) com os seis ramais livres. O roteiro para Firefox e WebKit usa a configuração Playwright de compatibilidade; FF_LOOPBACK_PROBE=1 habilita o perfil diagnóstico isolado.

As evidências novas ficam em [evidence/phase-02-5](evidence/phase-02-5/). Os diretórios das fases anteriores não são sobrescritos. Testes com áudio usam gerador nativo de teste, SIP/DTLS-SRTP real e contadores do receptor. Não representam fala humana.

## Roteiro pendente com três pessoas

**Pendente: não executado nesta fase.** Começar em Chrome em três perfis/equipamentos independentes. Usar somente pessoas e ramais de laboratório e fones físicos. Anotar navegador/versão, rede, horário, IDs de chamadas, sentido e inteligibilidade; não gravar voz nem registrar segredos.

1. 203 liga a 201; 201 atende e confirma voz nos dois sentidos, incluindo fala simultânea.
2. 201 coloca em espera; 203 confirma que não ouve a fala de 201. Retomar e confirmar escuta. Repetir após troca de dispositivo físico, se disponível.
3. 201 consulta 202: 203 continua em espera, 201 e 202 conversam. Cancelar e retomar com 203. Repetir, confirmar a assistida e conversar entre 203/202 após a saída de 201. Testar transferência direta e rejeição do destino.
4. Com 202 ocupado, 201 liga para a fila da Recepção. Confirmar espera, retomada da oferta, pausa e encaminhamento interno. Repetir desligando inesperadamente o navegador de origem; conferir canais, reconexão e histórico.
5. Repetir a matriz no segundo tenant com contas próprias. Não reutilizar credenciais ou gravações de teste de outra empresa. O supervisor compara o histórico com o relato de cada participante.
6. Em Firefox e Safari nativos, repetir com perfil padrão, TLS confiável, microfones/fones reais e captura de diagnóstico de candidatos sem SDP integral. Registrar falha ou pendência se não houver áudio nos dois sentidos.

A confirmação humana da Fase 01.1 já registrada não se estende à Fase 02.5, nem identifica aprovação de Firefox ou Safari.

## Roteiro privado entre redes

**Pendente: nenhuma rede remota foi conectada.** O laboratório mantém WSS, RTP e web em loopback. Antes de repetir em duas redes reais, preparar ambiente isolado com VPN privada autenticada (por exemplo, WireGuard gerenciado pela equipe de teste), DNS e certificado do ambiente, rotas de mídia restritas às interfaces privadas e ACL entre os clientes e o PBX correto. Parametrizar WSS/CSP/ICE para essa topologia em vez de expor portas. AMI, ARI, PostgreSQL e administração do host nunca integram as rotas de clientes. Manter restrição de WSS/RTP por tenant.

Repetir o roteiro em redes distintas, confirmar áudio bidirecional e transferência, medir jitter/perda/RTT e exercitar queda/retorno da VPN. Anotar topologia, estados ICE sem endereços pessoais, resultado, responsáveis e comparação de histórico. Não marcar aprovação com base em registro SIP ou ping.

## Compatibilidade e diagnóstico ICE

| Ambiente | Evidência | Restrição |
| --- | --- | --- |
| Chromium completo / Chrome nativo no macOS ARM64 | WebRTC com áudio de teste, chamadas internas e regressões automatizadas | Hardware físico e duas redes ainda não exercitados |
| Firefox Playwright 159 | Registro WSS e sessão SIP estabelecida; microfone de teste ativo; ICE em checking; zero RTP recebido | Mídia não homologada. A preferência de loopback em perfil separado não resolveu |
| WebKit Playwright 27.2 | Registro WSS confiável e capacidades do navegador | Mídia não executada; não equivale ao Safari |
| Safari nativo 27.0.1 | Inventariado no Mac | Registro e mídia não homologados nesta fase |

As capturas Firefox registram classes, não endereços ou SDP integral: candidatos host locais mDNS e candidato IPv4 remoto. A falha é observável na conectividade ICE anterior ao fluxo RTP. Não foi possível atribuir a causa definitiva à resolução mDNS, à interface Docker ou ao comportamento do microfone simulado; ativar a preferência de loopback sem resolver a falha não é correção. [Mozilla: comportamento de loopback](https://bugzilla.mozilla.org/show_bug.cgi?id=1659672), [Firefox com mídia de teste em localhost](https://bugzilla.mozilla.org/show_bug.cgi?id=1672145). Próxima investigação: perfil padrão e fonte física, certificado confiável e endereçamento privado alcançável nos dois lados; observar o par ICE selecionado e repetir o teste RTP. Não alterar preferências globais ou desligar TLS.

## Acesso por departamento

O 203 leu uma chamada real do departamento delegado Recepção e recebeu 404 ao trocar o ID pelo de uma chamada real de outro departamento da mesma empresa ([verificação](evidence/phase-02-5/department-history-scope.json)). Em cenário independente, 202 tentou consultar chamada direta 201 ↔ 203 e recebeu 404. O WebSocket do supervisor entregou eventos da chamada delegada e nenhum da chamada de outro departamento ([verificação](evidence/phase-02-5/department-event-scope.json)). A configuração de delegação foi criada, consultada e revogada no segundo tenant; outro tenant e supervisor não autorizado não puderam concedê-la.

## Resultado final

- **4/4** cenários de hardening ([log](evidence/phase-02-5/verified-hardening.log)); **24/24** verificações AMI/ARI ([resultado](evidence/phase-02-5/ami-gate.json)). A senha da aplicação autentica como papel sem superusuário e é rejeitada para postgres ([evidência](evidence/phase-02-5/database-credential-isolation.txt)).
- **5/5** regressões operacionais da Fase 02 ([log](evidence/phase-02-5/verified-operations.log)), **2/2** da Fase 01 ([log](evidence/phase-02-5/verified-regression.log)) e **12/12** de áudio em Chrome/Chromium ([log](evidence/phase-02-5/verified-audio.log)). O ensaio anterior da Fase 02 expôs 429 na sequência de reaberturas; a execução acima passou após o cursor inicial e agrupamento de consultas. A fixture de transferência entre departamentos foi ajustada para conceder as delegações exigidas pelo novo papel de 203.
- Compatibilidade: **1 verificação de capacidades/registro WebKit aprovada; 2 testes de mídia Firefox falharam**, com e sem a preferência experimental. A falha é uma restrição da matriz, sem efeito sobre os resultados Chrome/Chromium ([log](evidence/phase-02-5/verified-browser.log)).
- Go com detector de corrida, go vet, duas integrações em PostgreSQL descartável, TypeScript e três testes de unidade do filtro AMI passaram. npm audit de produção retornou zero achados e govulncheck não encontrou vulnerabilidades conhecidas no escopo analisado. Isso não é uma auditoria integral do sistema operacional, firmware, imagens ou infraestrutura.
- [Estado final](evidence/phase-02-5/final-state.json): cinco serviços locais ativos; ambos os motores Asterisk 20.22.0 com CEL ativo, zero canais, volumes existentes preservados. Os testes só criaram registros de chamadas de laboratório e associações temporárias.
