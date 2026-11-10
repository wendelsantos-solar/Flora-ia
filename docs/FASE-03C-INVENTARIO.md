# Fase 03C — Inventário da Flora IA

A interface tem uma única rota de produto, `/`. Atendimento, Supervisão e Administração são estados do painel de operações. O histórico é uma seção da mesma página e seus detalhes abrem em linha. A API fica sob `/api` e o WSS operacional fica separado do WSS SIP. A inspeção usou Chrome local em três contextos independentes e chamadas WebRTC reais no laboratório privado com áudio sintético. As capturas do estado atual são do produto, incluindo as chamadas.

| Superfície | Conteúdo, controles e feedback | Evidência |
| --- | --- | --- |
| Entrada e retomada | Seletor fixo de seis ramais, token, senha SIP, processamento e alerta. Sessão autenticada pode pedir somente a senha SIP para retomar. | [Entrada](evidence/phase-03c/atual/login.png), `page.tsx` |
| Discador | Destino interno, ligar, receber, rejeitar, silenciar, espera, transferência direta e consulta. Status SIP, mídia, captura, reprodução e saída por capacidade. | [Recebida](evidence/phase-03c/atual/recebida.png) · [Ativa](evidence/phase-03c/atual/ativa.png) · [Espera](evidence/phase-03c/atual/espera.png) · [Consulta](evidence/phase-03c/atual/consulta.png) |
| Equipe e dispositivos | Ramais e registros, configuração de entrada e saída em seção expansível, descoberta de microfones e alerta de permissão. | [Atendente e áudio](evidence/phase-03c/atual/atendente-audio.png) |
| Filas e presença | Associação, presença, pausa e retomada, volume em espera, sincronização e estados vazio, indisponível e pendente. Atendente usa os próprios controles. | [Atendente](evidence/phase-03c/atual/atendente.png), `operations.tsx` |
| Supervisão | Métricas ao vivo, resumo de 24 h, agentes, chamadas e indicadores de indisponibilidade. | [Supervisão](evidence/phase-03c/atual/supervisao.png), `supervision.tsx` |
| Histórico | Filtros por data, departamento, agente e resultado, paginação, tabela com rolagem própria, detalhe em linha e foco restaurado. | [Filtros](evidence/phase-03c/atual/historico.png) · [Detalhe](evidence/phase-03c/atual/historico-detalhe.png), `history.tsx` |
| Departamentos | Listagem e formulário compartilhado de criação/edição, identificador, nome, cancelamento e exclusão. | [Departamentos](evidence/phase-03c/atual/departamentos.png), `operations.tsx` |
| Filas e integrantes | Número, departamento, distribuição, tempos, contingência e membros. Editar fila revela integrantes. | [Filas](evidence/phase-03c/atual/filas.png), `operations.tsx` |
| Horários | Departamento, fuso, dias, início, fim e destino quando fechado. Edição e remoção. | [Horários](evidence/phase-03c/atual/horarios.png), `schedule.tsx` |
| Tronco SIP e política | Seção administrativa condicional. Formulário reúne controle do simulador, listas, ramais, limites e rota de entrada. Consumo agregado em 24 h por direção, decisão e resultado. | Código de `sip-lab.tsx` e resposta 404 nos três perfis do ambiente ativo. A seção não ficou disponível para captura nesse ambiente. |
| Administração de usuários e plataforma | O catálogo de ramais é visível. Cadastro, rotação de credencial, organização editável e console de plataforma não foram encontrados nas rotas, componentes e identidade atuais. | `page.tsx`, `identity.go`, `operations.tsx` |

O atendente 202 exibiu atendimento, equipe, filas e histórico, sem abas administrativas. O supervisor 203 teve Supervisão, sem Administração. O administrador 201 teve os três modos. O seletor de login apresenta ramais de ambos os tenants antes da autenticação. Trata-se de exposição de identificadores de demonstração na interface, distinta de uma concessão de acesso. A resposta 404 do módulo SIP nesse ambiente indica indisponibilidade, sem exercitar o 403 da política habilitada. [Medições e papéis observados](evidence/phase-03c/atual/medicoes.json)

[Admin móvel](evidence/phase-03c/atual/admin-mobile.png) · [Atendente móvel](evidence/phase-03c/atual/atendente-mobile.png) · [Supervisor móvel](evidence/phase-03c/atual/supervisor-mobile.png)
