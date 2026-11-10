# Correções encontradas na execução

1. Asterisk Alpine: `chan_pjsip` depende de `res_pjsip_pubsub`, e OPTIONS faz parte do módulo base nesta distribuição. Corrigida a lista explícita, sem carregar módulos alheios ao escopo.
2. CEL observado usa epoch com microssegundos (`1794173480.930103`), não apenas horário formatado. Parser aceita ambos; teste unitário usa linha efetivamente observada.
3. Endpoint sem transporte explícito não entregava INVITE de saída; `transport=transport-wss` restaurou o fluxo e OPTIONS com resposta.
4. Após recriação de container, SIP.js recebeu INVITE e OPTIONS mas registrou `sip.Parser: error parsing header 'From'`. Hipótese: hostname hexadecimal gerado pelo Docker começando por número no domínio From. Correção determinística: hostname `flora-pbx` e `from_domain=localhost`; registro/chamada e reinício do Asterisk passaram após a alteração. O parser não foi relaxado.
5. Go 1.26.0 do host apresentou 23 vulnerabilidades alcançáveis da biblioteca padrão no govulncheck. Projeto elevado para Go 1.26.10, mesma versão patch disponível na imagem utilizada. Revalidação registrada separadamente.

Técnica de recuperação: separar entrega WSS (observada) de aceitação pelo parser (não presumida). Ângulos considerados: captura das exceções do navegador; comparação de headers não sensíveis; fixação explícita de transporte; hostname estável; reprodução em contexto limpo; revisão das dependências de módulos. Não registrar headers Authorization, ICE passwords ou credenciais para diagnóstico.

6. O REGISTER após restart retornava 200, mas o Registerer mantinha seu enum Registered e não disparava nova transição. Atualizar a UI também no onAccept do registro recuperado corrigiu o problema; comprovado por nova chamada após restart.
7. O hook SQL inicial não deve alterar shell options do entrypoint PostgreSQL ao ser sourced. Removida alteração de opções e definido modo executável; bootstrap completo passou no banco descartável.
