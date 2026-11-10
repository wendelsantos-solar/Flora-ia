# Fase 03C — Plano incremental após aprovação

## Arquitetura de informação

| Área | Atendente | Supervisor | Admin da organização |
| --- | --- | --- | --- |
| Visão geral | Sua presença e acesso às filas | Recorte operacional | Recorte da organização |
| Atendimento | Discador e filas permitidas | Mesmo contrato de atendimento | Mesmo contrato de atendimento |
| Supervisão | Oculta | Departamentos autorizados | Organização |
| Histórico | Dados autorizados pelo contrato atual | Escopo autorizado pelo backend | Organização |
| Administração | Oculta | Oculta | Catálogo, departamentos, filas, horários e encaminhamento |
| Configurações avançadas | Ocultas | Ocultas | Tronco e política de laboratório, quando habilitados |

O admin de plataforma depende de capacidade futura e requer desenho de segurança próprio. O provisionamento de usuário e ramal, a configuração organizacional editável e a trilha individual de bloqueio exigem contratos futuros. A proposta atual separa esses itens das operações já existentes. O gate de telefonia pública permanece independente.

| Etapa | Entrega após aprovação | Critérios e risco principal |
| --- | --- | --- |
| 1. Fundação | Tokens, componentes base, semântica, foco e navegação por perfil. | Conferir estados, leitura, contraste e teclado. Risco de esconder recurso autorizado. Validar 201, 202 e 203 e testes negativos. |
| 2. Discador | Montar controlador SIP uma vez por sessão de usuário, fora das páginas que mudam. Implantar atalhos e estados de chamada. | Repetir a matriz de 19 e o teste Atender da 03B.0. Verificar ligação ativa, consulta e convite ao navegar. Risco de remontagem, listeners duplicados ou encerramento. |
| 3. Supervisão e histórico | Separar métricas, escopo e atualização. Evoluir filtro, paginação, detalhe e foco. | Conferir dados vazios, obsoletos, reconexão WSS, escopo e consistência de totais. Risco de mostrar contagem desatualizada ou cruzar tenants. |
| 4. Administração | Separar listas e formulários. Revisar efeitos de exclusão, alteração de horário, saída e limites. | Preservar API e permissões, testar validação, conflito, confirmação, falha e estado pendente. Risco de mudanças de roteamento e antifraude. |
| 5. Homologação de experiência | Sessões de tarefa com cada perfil, desktop e mobile. Revisar teclado, leitor de tela, zoom, áudio, recuperação e redes. | Cada usuário conclui tarefas críticas com feedback e sem perda de sessão. Atendimento móvel, Firefox e Safari têm gates próprios. |

A migração deve ter critérios de aceite e rollback por etapa. Preservar os eventos SIP como fonte do estado de chamada. O WebSocket operacional alimenta indicadores e histórico, com distinção entre desconectado e desatualizado. Separar a política ativa da edição e apresentar o efeito das mudanças antes de enviar. Repetir regressões, revogação e testes de isolamento após mudanças de navegação ou formulários.

**Decisão solicitada após esta entrega:** aprovar ou revisar a direção visual e a arquitetura de informação do protótipo. A implementação real começa somente após essa aprovação. [Auditoria](FASE-03C-AUDITORIA-UX.md) · [Protótipo](FASE-03C-PROTOTIPO.md)
