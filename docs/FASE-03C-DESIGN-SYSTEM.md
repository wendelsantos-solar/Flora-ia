# Fase 03C — Design system proposto

## Mesa de Operação

A proposta preserva o verde, o fundo de papel e a linguagem direta da Flora. O desktop organiza navegação à esquerda, tarefa no centro e discador à direita. O telefone conserva contexto ao navegar. A faixa verde clara de chamada recebida, a origem e o botão **Atender** têm a maior prioridade na coluna do discador. O mobile prioriza consulta e configuração administrativa. Atendimento móvel aparece como demonstração e exige homologação de dispositivo, microfone, tela bloqueada, alternância de abas e rede.

| Token claro | Valor | Uso |
| --- | --- | --- |
| Papel e superfície | `#F3F6F2` · `#FFFFFF` | Fundo e área de tarefa |
| Texto e apoio | `#172820` · `#495E53` | Títulos, informação e metadados |
| Divisória e borda de controle | `#D7E0D9` · `#74877B` | Separar superfícies e delimitar inputs |
| Ação, ênfase e estado positivo | `#175D43` · `#104632` · `#E4F0E7` | CTA, navegação e disponibilidade |
| Chamada recebida | `#D7EBDF` | Superfície de chamada entrante |
| Foco | `#176B54` | Contorno de 3 px, com offset |
| Alerta | `#78520B` sobre `#FFF2D6` | Pausa, aviso e estado incerto |
| Perigo | `#962D39` sobre `#FAE9EC` | Rejeitar, encerrar, bloquear |
| Escala | 4, 8, 12, 16, 24, 32, 48 px | Grupos, seções e respiro |
| Raios | 5 e 6 px em etiquetas, 8 em controles, 10 em identidade, 12 em painel | Hierarquia de formas |

Contrastes calculados na proposta: branco sobre ação **7,83:1**, texto principal sobre branco **15,43:1**, apoio sobre papel **6,41:1**, erro **6,57:1**, aviso **6,29:1** e borda funcional sobre branco **3,82:1**. Estes valores cobrem pares selecionados. Validação de contraste, foco e estados completos continua como critério de implementação.

Tipografia Avenir Next, Segoe UI e fallback de sistema. Corpo de 15 px, apoio de 12–13, subtítulos de 16–20 e títulos de 29–42. Use números tabulares em duração, fila, métricas e ramais. Ícones de traço consistente com texto em ações críticas. Grade desktop de 228 px, conteúdo fluido e 304 px. Em tablet, navegação migra para o topo. Até 680 px, uma coluna com atalho para o telefone quando fora de vista.

## Componentes e acessibilidade

- Botões primário, secundário e destrutivo com verbo explícito, altura de interação de 44 px e foco contrastante. Reservar o primário para a decisão da sessão atual. Durante envio, bloquear reenvio e preservar o texto do estado.
- Campos com rótulo, instrução junto ao valor, unidade, mensagem específica e manutenção do rascunho após falha. Relacionar erro ao campo com descrição acessível. Exibir sucesso no mesmo contexto.
- Tabelas com cabeçalho semântico, linhas tabulares, paginação e foco preservado. No mobile, condensar colunas mantendo resultado e detalhe. Filtros mostram seleção, contagem, limpar e vazio com recuperação.
- Menus usam navegação por links e indicador de rota atual. Modais ficam para confirmação de risco ou revisão que exige foco. Retornar foco à origem e permitir Escape quando seguro.
- Alertas distinguem registro, mídia, captura, presença, frescor dos eventos e saúde do motor. Um único anúncio por mudança importante e texto além de cor.
- Tema escuro futuro reutiliza tokens semânticos de superfície, ação, erro e foco. Antes de habilitar, validar todos os pares, ícones, gráficos, hover, selecionado, desabilitado e foco. O protótipo entrega tema claro.

## Estados da sessão

| Estado | Sinal e ação principal | Recuperação |
| --- | --- | --- |
| Desconectado | Informe o ramal e ofereça Conectar. | Verifique acesso e credencial. |
| Registrando | Mostre espera pelo SIP e bloqueie Ligar. | Exiba a falha de registro e ação apropriada. |
| Disponível | Mostre registro e destino com motivo de desabilitação. | Corrija o destino ou escolha fila permitida. |
| Microfone negado | Separe permissão de registro. | Oriente liberar permissão e tentar de novo. |
| Recebida | Origem, Atender e Rejeitar só com convite SIP apto. | Cancelamento remoto remove ações imediatamente. |
| Estabelecendo | Destino e status. Permita cancelar quando aplicável. | Distinga recusada, ocupada, timeout e falha. |
| Ativa | Origem, duração e comandos. | Mute, espera, transferência e encerramento claros. |
| Em espera | Identifique a chamada original e explique o estado do microfone. | Retomar ou encerrar. |
| Consulta assistida | Distinga conversa de consulta da original em espera. | Confirmar só com consulta estabelecida ou cancelar e retomar. |
| Transferência pendente | Mostre destino, tipo e confirmação aguardada. | Trate falha e resultado desconhecido sem inventar desfecho. |
| Destino indisponível | Mostre falha da consulta e estado da original. | Retomar original conforme evento de sessão. |
| Falha e reconexão SIP | Mostre sinalização e mídia separadas durante a recuperação. | Reconciliar sessão e oferecer ação possível. |
| Encerrando | Confirmação pendente e controles inativos. | Quando confirmado, voltar a disponível e atualizar histórico. |

Fora da aba, um atalho visual dentro do documento não substitui notificação do navegador. Notificações, política de autoplay e comportamento sob aba oculta ou tela bloqueada devem ser testados antes de virar garantia. [Diagnóstico 03B.0](FASE-03B-0-WEBRTC.md)
