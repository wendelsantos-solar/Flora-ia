# Fase 02 — Testes e evidências

Ambiente local Docker, Asterisk 20.15.2/PJSIP e Chromium completo. Os perfis usam SIP.js, WSS com certificado validado, DTLS-SRTP e fonte de áudio de teste nativa do Chromium. Nenhum mock atua sobre SIP, transporte, fila, API ou banco nos testes ponta a ponta. As medições de RTP e energia não são avaliação perceptual humana.

Execute [scripts/test-operations.sh](../scripts/test-operations.sh) somente no ambiente de desenvolvimento e sem operadores usando 201–203. A rotina verifica ausência de canais, usa filas de teste reservadas 391–393 e limpa os registros de configuração criados. Ligações e seus eventos continuam no histórico. Um teste reinicia Asterisk e a regressão anterior para/reinicia o backend do próprio projeto. A integração usa PostgreSQL descartável.

## Critérios e evidência

| Critério | Verificação | Evidência |
| --- | --- | --- |
| 02A: catálogo, presença, reconciliação | Criação/edição, validação, papéis, contexto isolado, fila nativa, 202 recebe; pausa impede distribuição, timeout encerra, reinício restaura o estado desejado | [Fila e mídia](evidence/phase-02/02a-queue.json) |
| 02B: espera e transferência assistida | Cortar áudio ao receptor durante espera, retomar energia, rejeitar consulta, cancelar consulta atendida, confirmar REFER/Replaces, decodificar mídia nos participantes restantes e ler evento persistido | [Assistida](evidence/phase-02/02b-attended.json) |
| 02B: transferência direta | 203 → 201, REFER para 202, mídia 203 ↔ 202, rota de origem preservada no histórico e zero canais | [Direta](evidence/phase-02/02b-blind.json) |
| 02C: supervisão e histórico | Chamada com várias pernas conta uma vez; atendimento, abandono, timeout, filtros e totais após reinício; acesso separado para supervisor | [Métricas e histórico](evidence/phase-02/02c-supervision.json) |
| 02D: roteamento | Transferência entre departamentos, GotoIfTime aberto/fechado, fallback real ao pausar o único membro e ao vencer a espera. Mídia e resultado do Asterisk em cada rota | [Contingências](evidence/phase-02/02d-routing.json) |
| Persistência e autorização | PostgreSQL descartável: CRUD, chaves compostas, RLS, replay, eventos fora de ordem, deduplicação, histórico após exclusão do catálogo | [Integração](evidence/phase-02/integration.log) |

## Defeitos encontrados na execução

- PJSIPShowContacts responde “No Contacts found” sem registro. Esse retorno agora equivale a snapshot vazio; outros erros continuam indicando falha.
- O primeiro teste de transferências encontrou eventos reais no CEL, mas a API não lia JSON aninhado. O contrato de eventos passou a aceitar dados estruturados. O novo destino também sobrescrevia a rota original em um evento de término; a origem foi estabilizada antes da transferência. As duas modalidades foram repetidas com verificação de mídia e histórico.
- Um seletor de supervisão encontrava o mesmo trajeto na lista de chamadas ativas e no histórico; o teste passou a inspecionar apenas o painel ao vivo.
- A auditoria de interface identificou acesso ruim aos detalhes no mobile. As durações foram deslocadas para os detalhes nessa largura, com ação visível, foco no painel ao abrir e retorno de foco ao fechar. Chamadas entre terceiros recebem ícone neutro.

## Compatibilidade

O responsável confirmou conversa humana bidirecional da Fase 01.1, sem atribuição a navegador ou hardware. Os novos ensaios validam áudio sintético real em Chromium e a regressão da Fase 01.1 passou em Chrome e Chromium. Firefox continua com a restrição de mídia documentada na Fase 01.1; Safari nativo não homologado. A Fase 02 ainda precisa de escuta humana dos novos fluxos, LAN/VPN privada, testes de carga, falhas de infraestrutura e recuperação de desastre.


## Resultado final

- **5/5** cenários ponta a ponta da Fase 02 ([log](evidence/phase-02/final-operations.log)). Os casos de destino indisponível, rejeição, encerramento durante espera e desconexão durante consulta deixaram zero canais ([evidência](evidence/phase-02/02b-edges.json)).
- **2/2** regressões da Fase 01 ([log](evidence/phase-02/final-regression.log)) e **12/12** regressões de áudio da Fase 01.1: seis Chromium, seis Chrome ([log](evidence/phase-02/final-audio-regression.log)).
- Espera/assistida repetida com medição adicional de 2,2 s após a transferência ([log](evidence/phase-02/attended-sustained.log)). Os dois receptores somaram 110 e 111 pacotes, com incrementos de energia decodificada de 0.436990 e 0.370278. O Asterisk registrou o evento ATTENDEDTRANSFER, a rota de origem continuou no histórico e não sobraram canais.
- Backend: Go com detector de corrida e go vet ([log](evidence/phase-02/backend-tests.log)); duas integrações PostgreSQL ([log](evidence/phase-02/integration.log)). TypeScript, build local e dois testes unitários de áudio também passaram.
- Supervisão após recarregar com sessão HTTP válida e sem registrar SIP novamente; navegação durante chamada sem perda de diálogo. Capturas [desktop](evidence/phase-02/supervisao-desktop.png) e [mobile 390 px](evidence/phase-02/supervisao-mobile.png). Revisão de interface: os três pontos examinados (ação visível, foco e direção) foram resolvidos.
- [Estado final](evidence/phase-02/final-state.json): quatro serviços ativos, readiness ready, zero canais e chamadas ativas. Volumes de histórico preservados.
