# Fase 03A.2 — Regressões

A matriz histórica de 19 casos é composta por cinco casos operacionais, dois casos de telefonia e seis cenários de mídia repetidos em Chromium e Google Chrome. Os primeiros sete também usam Chromium. Os 13 casos de Chromium rodam sobre o laboratório WireGuard, com a origem privada HTTPS e os tokens do próprio laboratório. O executor `scripts/test-private-regressions.py` redireciona os comandos permitidos de reinício e consulta exclusivamente ao Compose `flora-026`. Nenhum teste necessita do Docker socket dentro do navegador.

A repetição histórica em Google Chrome permanece pendente. O executor privado usa Chromium Linux e não substitui os seis casos do navegador Google Chrome. [Log da matriz Chromium](evidence/phase-03a-2/historical/chromium.log).

## Verificações complementares

- Go com detector de corrida, go vet, TypeScript e testes unitários do AMI. [Log](evidence/phase-03a-2/checks.log).
- PostgreSQL descartável com as oito migrações. O teste de recuperação verificou mesmo identificador em tenants distintos, CEL terminal duplicado, ausência de início e atualização posterior por evidência AGI. [Log](evidence/phase-03a-2/integration.log).
- A rodada privada complementar comprovou chamada direta, espera e retomada e filas A e B. Na sequência de transferências, os cenários direto, assistido e destino indisponível passaram. Um perfil Chromium caiu durante a desconexão na consulta. [Evidências de navegador](evidence/phase-03a-2/browser).
- AMI/ARI no laboratório PJSIP passou 24 de 24 verificações, incluindo negativas de ações administrativas, acesso à porta AMI nativa e módulo ARI ausente. [Verificação de fio](evidence/phase-03a-2/ami-ari.json).
- A bateria SIP após as mudanças passou entrada, saída, concorrência por uma vaga, limite de tentativas, destinos bloqueados, autenticação inválida e negativa no segundo tenant desabilitado. [Evidência SIP](evidence/phase-03a-2/sip.json).
- O reteste de guardas SIP confirmou REFER rejeitado com 603, redirecionamento bloqueado e discagem negada durante a indisponibilidade do autorizador. [Evidência](evidence/phase-03a-2/guard.json).

## Resultado da matriz histórica

A execução inicial terminou com **5 aprovados, 8 reprovados e 6 pendentes** entre os 19 casos. Os seis pendentes pertencem ao Google Chrome. Três falhas operacionais ocorreram na pré-condição de zero canais, pois havia dois canais ativos após o caso anterior. O caso de espera e consulta falhou porque o controle de espera não apareceu. Os casos de chamadas consecutivas e reconciliação de fila após reinício excederam 150 segundos. Os dois casos de telefonia foram repetidos após a correção do diretório de evidências e do esquema WebSocket usado em HTTPS.

| Grupo | Aprovações na execução inicial | Falhas na execução inicial | Pendentes |
| --- | ---: | ---: | ---: |
| Áudio Chromium | 5 | 1 | 0 |
| Operação Chromium | 0 | 5 | 0 |
| Telefonia Chromium | 0 | 2 | 0 |
| Áudio Google Chrome | 0 | 0 | 6 |

Os retestes confirmaram autorização REST e isolamento dos eventos WebSocket com HTTPS. A última execução também confirmou chamadas nos dois sentidos, áudio sintético, encerramento, reconexão SIP após reinício do Asterisk e recuperação após queda do backend. O coletor de teste agora reconhece o caminho SIP `/ws`, inclusive na porta privada do laboratório. Os dois resultados atualizam o total para **7 aprovados, 6 reprovados e 6 pendentes**. As seis reprovações remanescentes são o caso de chamadas consecutivas em Chromium e os cinco casos operacionais. [REST e eventos](evidence/phase-03a-2/historical/telephony-first-retest.log), [Telefonia e reconexão](evidence/phase-03a-2/historical/telephony-retest.log).
