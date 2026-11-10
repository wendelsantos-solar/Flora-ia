# Fase 03C.1 — Mesa de Operação

## Arquitetura

Antes, `page.tsx` reunia login, discador, equipe, operações e histórico em uma única página. A própria página criava `Phone` sob demanda depois da identidade autenticada e guardava a instância em uma referência React. A navegação interna antiga alterava apenas a aba de operações.

O `AppShell` agora apresenta marca, identidade do ramal, perfil e áreas persistentes. A URL usa fragmentos como `/#historico` dentro da rota real existente. Isso permite links, voltar e avançar sem recarregar o documento. O controlador, o formulário de áudio e o painel permanecem montados na mesma posição React. Os estados da sessão e os comandos seguem centralizados em `page.tsx` e `Phone`. O catálogo de filas permanece carregado nas demais áreas para conservar destinos de discagem e transferência.

| Área | Visibilidade |
| --- | --- |
| Visão geral, Atendimento, Histórico | Atendente, supervisor e administrador |
| Supervisão | Supervisor e administrador |
| Administração | Administrador |
| Configurações avançadas | Administrador, quando a API do laboratório SIP está habilitada |

A interface usa o papel informado por `/api/v1/me`. A autorização continua nas APIs. Um fragmento de área fora do perfil cai no Atendimento. Administração reutiliza formulários de departamentos, filas, integrantes, horários e destino alternativo. Visão geral reúne o catálogo de ramais. O tronco e a política existentes têm entrada própria quando disponíveis. Provisionamento de usuário e edição de organização seguem sem menu dedicado porque essas superfícies ainda não existem.

## Atendimento e transferências

- O discador usa a superfície verde da Mesa de Operação, fica à direita no desktop e vem primeiro no mobile. Quando o foco telefônico sai da área visível no mobile, o atalho volta ao discador. Em chamada recebida, ele leva o foco a **Atender** somente por ação do usuário.
- A chamada apresenta participante, tempo, referência curta derivada do SIP Call-ID, condição de mídia e registro SIP. A referência é SHA-256 e não corresponde ao ID do histórico. Fila e departamento aparecem quando o identificador exposto pelo SIP corresponde ao catálogo existente.
- A chamada recebida continua condicionada à sessão SIP. CANCEL remoto pode informar que a chamada ficou indisponível e o clique de atendimento fica no rastreio sanitizado. A regra de estado da sessão, o motor, o dialplan e o transporte permanecem os mesmos.
- A chamada original mantém participante e tempo na parte superior. A consulta tem região própria, destinatário e estado. Cancelar consulta usa o comando de retomada existente. Encerrar mantém o comportamento anterior e a interface explicita que o comando termina as duas ligações durante consulta.
- A transferência direta usa os destinos já autorizados. A interface alerta sobre ramal sem registro, mantém o bloqueio de duplicidade durante REFER e distingue confirmação, recusa e resultado desconhecido.
- **Atender**, **Rejeitar** e as ações principais usam alvos de pelo menos 44 px. O layout móvel informa que chamadas em navegador móvel ainda estão em homologação.

O design conserva a paleta clara e verde. A composição difere do protótipo onde os dados e contratos exigem: o seletor fictício de perfil virou identidade autenticada, as métricas simuladas saíram da Visão geral e as áreas legadas usam os componentes atuais. [Design da Fase 03C](FASE-03C-DESIGN-SYSTEM.md)

[Ver testes](FASE-03C-1-TESTES.md) · [Ver comparativos](FASE-03C-1-COMPARATIVOS.md)
