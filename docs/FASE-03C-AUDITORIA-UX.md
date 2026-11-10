# Fase 03C — Auditoria de experiência

**Maturidade atual: laboratório operacional. Prontidão comercial da interface: NO-GO.** A telefonia tem controles e feedback reais, e o discador permanece montado ao alternar os painéis atuais. A hierarquia de tarefas, a recuperação de erros, a descoberta de configurações e a homologação de uso ainda precisam evoluir. A nota é uma avaliação técnica da amostra, sem pesquisa com usuários.

| Dimensão | Nota | Evidência e limite |
| --- | ---: | --- |
| Acessibilidade | 2/4 | Labels, status, foco visível e retorno de foco no detalhe coexistem com alvos pequenos e múltiplas regiões anunciando alterações. A fase não certifica WCAG nem leitores de tela. |
| Desempenho | 2/4 | Sem animação ornamental relevante. Operações consultam a cada 3 s e a tela agrega consultas, eventos e polling. Falta perfil de render e rede sob carga. |
| Tematização | 2/4 | Tokens no CSS e tema claro consistente. Ainda há cores locais de estado e ausência de contrato semântico completo para tema escuro. |
| Responsividade | 2/4 | As amostras a 390 px e as sondas a 320 px ficaram sem overflow de documento. O discador sai da área visível ao rolar. Detalhes e botões secundários têm alvos reduzidos. |
| Integridade da implementação | 2/4 | Componentes de supervisão, histórico, agenda e SIP existem. A navegação e as operações de naturezas diferentes ainda disputam a mesma página. |

**Total 10/20.** A captura móvel mediu 18 px no controle de áudio, 21 px em sumários e 30 px nos botões de detalhe. A meta de 44 px é critério interno de ergonomia. Um alvo abaixo dela, sozinho, não estabelece violação de WCAG. [Medições](evidence/phase-03c/atual/medicoes.json)

## Tarefas por perfil

| Perfil e tarefa | Caminho atual, feedback e recuperação | Severidade |
| --- | --- | --- |
| Atendente entra | Selecione ramal, preencha token e senha, conecte. Há estado e erro, mas a linguagem é de laboratório e o usuário precisa conhecer seu ramal. Retomar sessão distingue senha SIP no texto auxiliar. | Alta |
| Atendente seleciona microfone | Expanda Dispositivo de áudio, busque microfones, conceda permissão e selecione. Há alerta de revogação e possibilidade de selecionar outro dispositivo. A descoberta fica escondida em sumário pequeno. | Média |
| Atendente recebe e liga | O botão Atender aparece junto à sessão SIP válida. No desktop está visível no discador inicial. Ao rolar, o painel não acompanha o usuário. Para ligar, digite ramal ou fila e pressione Ligar. A razão de desabilitação não aparece junto ao destino. | Alta |
| Atendente põe em espera e transfere | Espera e retomada aparecem em chamada. Transferência exige abrir seção, escolher destino e decidir entre direta e consulta. O retorno depende do texto de estado. Em consulta, original e destino compartilham a mesma área visual. | Alta |
| Atendente entra e sai de fila | A fila associada traz ações de presença e aguarda confirmação do Asterisk. Estado SIP e presença são distintos. O escopo de fila pode ficar abaixo do discador em mobile. | Média |
| Atendente e supervisor consultam histórico | Abra filtros, aplique, encontre uma linha e abra Ver. O detalhe preserva foco e mostra eventos. Sem rota própria, a tarefa compete com os controles da central e começa abaixo das operações. | Média |
| Supervisor lê a operação | Selecione Supervisão dentro de Operação de filas. Há ao vivo, últimas 24 h e vazios separados. O caminho é aninhado e o contexto de período e frescor precisa ficar perto de cada número. | Média |
| Admin configura ramal | Catálogo e registro podem ser consultados. Criação, edição administrativa e recuperação de credenciais não estão disponíveis. | Alta para comercialização |
| Admin cria departamento e fila | Abra Administração, localize a seção e preencha. Controles nativos têm validação. Código, estratégia e tempos exigem conhecimento prévio. Criação e edição compartilham o formulário. Erros são gerais. | Alta |
| Admin configura horários | Abra a seção, escolha departamento, dias, horas, fuso e destino. Botão desabilita combinações inválidas. Falta explicação junto aos campos e resumo da regra resultante. | Média |
| Admin ajusta tronco e restrições | Código mostra um único formulário de laboratório para configuração e antifraude. O ambiente auditado retornou 404 e escondeu a seção. Código registra sucesso e mensagens gerais, com envio direto. | Alta |
| Admin investiga bloqueio | Código mostra consumo agregado por motivo, direção e resultado. Faltam linha individual com referência, filtros e próximos passos. | Alta |
| Administrador da plataforma | Perfil e console não identificados no checkout. | Fora da cobertura atual |

Redesenhar a arquitetura de navegação, discador durante transferência, Administração e Configurações avançadas. Ajustar identidade e ajuda na entrada, ergonomia de áudio, indicadores de supervisão e apresentação do histórico. Manter separação de SIP, mídia, canal operacional e presença. Preservar retorno de foco no histórico, escrita de estado em texto e autorização do backend. [Inventário](FASE-03C-INVENTARIO.md)

## Benchmark de padrões

A análise foi documental, sobre referências oficiais. Os produtos serviram para identificar padrões de tarefa. A direção visual e os componentes foram desenhados para a Flora.

| Produto | Padrão documentado | Decisão para a Flora |
| --- | --- | --- |
| Aircall | Ações de espera e transferência concentradas na conversa. Papéis de supervisão e administração distintos. | Deixar controles de chamada no discador e ações organizacionais em área própria. [Controles](https://support.aircall.io/en-gb/articles/21534383206685) · [Papéis](https://support.aircall.io/en-gb/articles/26013509732509) |
| Dialpad | Dashboard por escopo, filtros e acesso a histórico a partir dos agentes. | Separar ao vivo e 24 h e indicar o contexto de cada métrica. [Dashboard](https://help.dialpad.com/v1/docs/contact-center-dashboards) |
| CloudTalk | Wallboard privilegia tempo de espera, filas e agentes em tempo real. | Dar prioridade à espera acionável. Painel para TV seria uma entrega futura. [Wallboard](https://www.cloudtalk.io/wallboard/) |
| RingCentral | Relatórios em tempo real por atividade de agentes e saúde da fila. | Manter visão operacional separada de histórico e deixar atualização explícita. [Relatórios](https://developers.ringcentral.com/engage/voice/guide/analytics) |
| JustCall | Atividade ao vivo e análise por equipe e número. Permissões distintas por função. | Associar investigação a escopo e função. Escuta, sussurro e intervenção ficam fora desta proposta. [Análise](https://help.justcall.io/en/articles/1883665-know-more-about-your-call-analytics-dashboard) · [Papéis](https://help.justcall.io/en/articles/7913447-understanding-the-default-roles-on-justcall) |
| 3CX | Discador acessível a partir do cliente e controle explícito de estado e fila. | Manter acesso ao discador durante navegação e tratar presença de fila separadamente. [Cliente web](https://www.3cx.com/user-manual/web-client/) · [Administração](https://www.3cx.com/docs/manual/) |
