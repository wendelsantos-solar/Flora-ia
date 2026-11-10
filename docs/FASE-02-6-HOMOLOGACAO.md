# Fase 02.6 — Homologação multi-rede e prontidão SIP

## Escopo e parecer

**GO COM RESTRIÇÕES para laboratório interno. NO-GO para piloto com operadora e produção.** Os critérios integrais incluem uma sessão real com três pessoas em redes privadas distintas. A evidência da conversa humana da Fase 01.1 segue válida para aquele cenário. Os fluxos desta fase aguardam confirmação humana.

O trabalho partiu dos relatórios da [Fase 02.5](FASE-02-5-TESTES.md) e da [arquitetura de prontidão](FASE-03-PRONTIDAO-SIP.md). Os resultados históricos de 4/4 cenários de hardening, 24/24 verificações AMI/ARI e 19/19 regressões pertencem à Fase 02.5.

O laboratório copia a arquitetura em um Compose com dois Asterisk 20.22.0, volumes próprios, CA efêmera, três clientes A em bridges Docker independentes e um cliente B com dois perfis. O frontend aceita endpoints WSS por configuração de build e mantém os padrões locais. O caminho de mídia e a lógica SIP do produto foram preservados. [Topologia e configuração](FASE-02-6-REDES.md).

## Execução

- Build isolado do frontend, TypeScript, testes Go com `-race`, `go vet` e 3 testes unitários do gate AMI passaram. [Log da verificação estática e unitária](evidence/phase-02-6/local-validation.txt).
- Os quatro peers autenticaram por WireGuard. As negativas de API anônima, SIP do tenant oposto, AMI e HTTP bruto dos PBXs passaram. Nenhuma porta do Compose de laboratório foi publicada. [Evidência do perímetro](evidence/phase-02-6/perimeter.txt).
- A primeira automação obteve registro SIP e não chegou ao INVITE. O servidor Playwright descartou os argumentos de captura e o Chromium headless shell retornou erro de dispositivo. A captura sintética foi verificada isoladamente no Chromium com o canal completo. Esse diagnóstico é do executor, com aplicação preservada.

## Pendências para aceite

- Executar o [roteiro humano](FASE-02-6-ROTEIRO-HUMANO.md) em três redes físicas distintas, com avaliação de inteligibilidade, eco, atraso, cortes e voz em ambos os sentidos antes e depois das transferências.
- Revisar o perímetro real, validar revogação dos peers e repetir as negativas por rede. [Auditoria e limites](FASE-02-6-SEGURANCA.md).
- Definir o ambiente do piloto, acordar a interconexão e implementar controles de fraude, política de saída e limites por tenant. [Gate para operadora](FASE-03-GATE-SIP.md).
- Implantar, aprovar e exercitar a contingência independente junto à equipe de home care.

## Cenários na primeira topologia do túnel

| Cenário | Resultado técnico |
| --- | --- |
| Direta 203 → 201 | Sinalização e encerramento confirmados, com chamada concluída e duas pernas encerradas. Mídia reprovada nesta topologia. |
| Entrada em fila e agente disponível | Filas 301 dos dois tenants atenderam simultaneamente com agentes 202 e 212. Históricos e pernas encerrados. Mídia não comprovada. |
| Pausa e retomada | Agente pausado deixou de receber a fila. O PBX registrou destino indisponível e o agente voltou a disponível após retomar. |
| Espera e retomada em chamada | Estados SIP e controles aceitaram as duas ações. O silêncio durante a espera não foi homologado, pois já faltava áudio. |
| Transferência direta | O destino recebeu e atendeu. A chamada original encerrou após perda de mídia e a verificação final falhou. |
| Assistida, rejeição, destinatário indisponível e desconexão na consulta | Pendentes nesta topologia. A sequência foi interrompida na transferência direta. |
| Isolamento de dados e eventos | A consulta cruzada dos IDs retornou 404 nos dois sentidos. Cada sessão recebeu 10 eventos próprios e zero da outra. Os conjuntos de ramais foram segregados. |

[Evidência por chamada, eventos, RTP e pernas](evidence/phase-02-6/functional-signaling.json).

### Diagnóstico inicial de mídia e navegadores

| Cliente | Evidência | Estado |
| --- | --- | --- |
| Chromium 158, Linux ARM64 | WSS e SIP reais, captura sintética viva e PCMU. Na variante inicial com SNAT, ICE conectou nos dois lados. A conexão geral ficou em negociação em uma ponta e os contadores recebidos ficaram zerados. Na variante com retorno roteado, a amostra no router viu datagramas em direção ao PBX e nenhum no sentido de retorno. | Sinalização parcial aprovada. Mídia multi-rede reprovada no laboratório. |
| Firefox Playwright, Linux ARM64 | O reteste com TLS confiável foi bloqueado por `SEC_ERROR_UNKNOWN_ISSUER`, inclusive após reemitir a CA com extensão explícita. O diagnóstico de mídia anterior registrou microfone ativo, host mDNS, ICE em checking e zero RTP. | Restrição. A causa da falha anterior de ICE não foi determinada. |
| Google Chrome 156, macOS | Binário disponível. Nesta fase, o cliente automatizado usado foi Chromium Linux ARM64. | Execução física pendente. |
| Safari 27.0.1, macOS | Presença do navegador nativo verificada. O laboratório não abriu rota no host para acessá-lo. | Pendente. |

A coleta diferencia captura, SDP, ICE, estado da conexão e mídia recebida. Na variante roteada, uma sonda UDP independente confirmou que o router observou a saída em direção ao PBX, mas o socket de teste do PBX não recebeu o datagrama. Isso localiza a falha de ingresso após o ponto de captura, sem determinar a regra responsável. Na variante com SNAT, ainda falta identificar por que o DTLS-SRTP não produziu RTP bidirecional. Manter TLS validado, testar perfil Firefox padrão com fonte física e registrar autoplay e seleção de dispositivo separadamente. [Chromium com SNAT](evidence/phase-02-6/chromium-nat-baseline.json), [amostra UDP roteada](evidence/phase-02-6/udp-path.txt), [Firefox](evidence/phase-02-6/firefox.json), [diagnóstico anterior](FASE-02-5-TESTES.md).


### Resiliência na topologia roteada inicial

- Backend Go. A chamada SIP 201 → 202 foi completada com o Go parado, a conexão de eventos fechou com código 1006 e a recuperação gravou exatamente uma chamada. Áudio indisponível. [Evidência](evidence/phase-02-6/backend-outage.json).
- Asterisk. Reinício isolado e novo registro dos ramais permitiram uma nova chamada com histórico único. Áudio indisponível. [Evidência](evidence/phase-02-6/pbx-restart.json).
- PostgreSQL. A primeira tentativa parou durante a preparação das sessões. Na topologia corrigida, a prontidão caiu para 503, uma chamada 201 → 202 foi completada com RTP e energia sintética nos dois sentidos e o retorno do banco gerou exatamente um histórico encerrado. [Primeira tentativa](evidence/phase-02-6/db-outage-initial.json), [reteste](evidence/phase-02-6/db-outage.json).

### Mídia na topologia corrigida

Na variante final, o router responde ARP para endereços WireGuard reservados no segmento de cada PBX. A sonda UDP passou nos dois sentidos. Na chamada 203 → 201, o Chromium 158 negociou PCMU e, nas amostras do receptor, acumulou 60 e 42 pacotes com aumento de energia nos dois sentidos. Durante a espera, a variação de energia medida na ponta em espera foi zero. Após a retomada, houve mais 32 e 26 pacotes com energia positiva. O Asterisk encerrou as duas pernas e o histórico ficou concluído. [Captura funcional](evidence/phase-02-6/functional-proxyarp.json), [sonda UDP](evidence/phase-02-6/udp-path.txt).

A execução conjunta da topologia corrigida parou ao carregar o formulário do segundo tenant. A evidência de filas simultâneas e segregação pertence à topologia inicial, em que a mídia das filas não foi comprovada. A evidência acima prova mídia sintética da chamada direta e da retomada, dentro de uma única VM Docker.

Na execução isolada dos três ramais, a transferência direta para 202 foi concluída com mídia sintética entre origem e destino. A assistida comprovou recuperação de mídia com o interlocutor original após a rejeição, mídia na consulta e mídia após confirmar a transferência. As duas transferências geraram seus eventos no histórico. O destinatário indisponível e o fechamento abrupto do navegador durante a consulta encerraram as pernas observadas. [Evidência das transferências](evidence/phase-02-6/transfers.json).

Os retestes separados das filas 301 nas duas empresas comprovaram RTP e energia nos dois sentidos. O histórico apontou 202 no tenant A e 212 no tenant B. O reteste de perímetro com o endereçamento final passou nos quatro peers. Ao final, os dois PBXs do laboratório estavam com zero canais ativos, a aplicação original respondeu com prontidão 200 e o Compose descartável foi parado com os volumes preservados. [Fila A](evidence/phase-02-6/queue-a.json), [fila B](evidence/phase-02-6/queue-b.json), [perímetro final](evidence/phase-02-6/perimeter-proxyarp.txt), [estado final](evidence/phase-02-6/final-state.txt).
