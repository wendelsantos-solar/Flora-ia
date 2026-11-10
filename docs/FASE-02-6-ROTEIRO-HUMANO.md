# Fase 02.6 — Roteiro humano com três pessoas

**Estado inicial PENDENTE.** Reservar 30–45 minutos, três dispositivos independentes em três redes privadas, navegador Chrome atualizado, fone com microfone e uma pessoa responsável pelo ambiente. Usar somente dados fictícios.

1. O responsável disponibiliza uma VPN privada autenticada previamente aprovada, com acesso apenas ao HTTPS, WSS SIP e UDP de mídia do tenant A. Verifica DNS, confiança TLS e ausência de alcance a AMI, ARI, PostgreSQL e tenant B. Se qualquer acesso esperado falhar, registrar a etapa e suspender a execução remota até corrigir a rota.
2. A, B e C entram com seus próprios perfis e credenciais, entregues por canal protegido. A usa 201, B usa 202 e C usa 203. Selecionar microfone e saída, conceder permissão quando solicitada e confirmar registro. Configurar 202 como agente disponível da fila 301 e validar que o painel reflete a presença.
3. Em cada chamada atendida, cada lado lê cinco palavras ou números combinados e o interlocutor repete. Depois conversar por pelo menos um minuto, com fala simultânea por alguns segundos. Registrar inteligibilidade, eco, cortes, atraso perceptível e estabilidade separadamente por direção. Usar palavras fictícias e guardar apenas a avaliação.
4. Executar a matriz abaixo. Entre cenários, confirmar o estado de cada ramal e conferir se a chamada anterior encerrou no painel e no Asterisk.

| Cenário | Ação e critério de aprovação |
| --- | --- |
| 1. Direta | C liga para A. A atende, ambos confirmam voz e C encerra. |
| 2. Entrada em fila | C liga para 301. Supervisão vê entrada. Somente integrante elegível recebe. |
| 3. Agente disponível | B atende a fila e confirma voz em ambos os sentidos. Histórico aponta fila e agente. |
| 4. Pausa e retomada | B pausa a fila. C repete e confirma que B não toca. B retoma e recebe a próxima chamada. Em chamada ativa, testar também espera e retomada. |
| 5. Transferência direta | C liga para A. A transfere para B. B atende e conversa com C. A retorna ao estado livre. |
| 6. Transferência assistida | C liga para A. A consulta B, confirma voz na consulta e conclui. C e B confirmam voz. |
| 7. Rejeição | B rejeita a consulta. A retorna à chamada original e confirma voz com C. |
| 8. Indisponível | B sai do ramal. A tenta transferir. Verificar o desfecho e se os canais e histórico fecham de forma consistente. |
| 9. Desconexão | Repetir consulta com B e desconectar C. Observar liberação da consulta, estados e reconexão, registrando os tempos. |
| 10. Encerramento | Finalizar os testes, verificar zero canais do teste nos dois PBXs, histórico sem duplicação e presença coerente. |

Para cada linha registrar data/hora com fuso, três versões de navegador/SO, tipo de rede, ID da chamada, evento Asterisk, estado do backend, histórico, canais ao final e, se disponíveis, codec, tipo de candidato ICE, perdas, jitter e RTT. Guardar somente IDs de teste e estatísticas sanitizadas. Evitar SDP completo, cookies, senhas, chaves e gravações. Para falhas, anotar última ação, parte afetada, direção do áudio e se uma repetição reproduziu o problema.

**APROVADO** quando o fluxo e a limpeza conferem e as duas pessoas que conversaram consideram a voz inteligível e estável. **REPROVADO** quando qualquer critério aplicável falha. **PENDENTE** quando o cenário não foi concluído ou falta confirmação. Registrar Firefox e Safari em linhas próprias, com a mesma disciplina. Ao final, sair das sessões, desconectar os peers e pedir ao responsável a revogação dos acessos temporários.

## Contingência independente para home care

Plano documental, com implantação pendente. Manter canal de voz corporativo independente da Flora e da mesma operadora, diretório atualizado fora do aplicativo e responsável por ativação e retorno. Se cair sistema, servidor, internet ou operadora, ativar o canal alternativo e usar dispositivo e acesso alternativos previamente testados. Para fora do expediente, encaminhar ao plantonista pelo canal alternativo conforme escala aprovada. A equipe assistencial define os critérios para urgência e a orientação de contato, aprova a comunicação aos usuários e conduz exercícios periódicos. Registrar início, fim, responsável e normalização sem copiar dados clínicos para logs técnicos.
