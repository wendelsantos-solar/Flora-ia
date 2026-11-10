---
name: Central de telefonia
description: Mesa de operação diurna para chamadas internas.
colors:
  green: "#175d43"
  paper: "#f4f5f1"
  surface: "#fff"
  ink: "#202f29"
  muted: "#617168"
  line: "#dce2db"
  red: "#a32b35"
  danger-surface: "#f8e9e9"
  input-line: "#bcc9be"
  extension-surface: "#e4e9df"
typography:
  headline:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontSize: "12px"
    fontWeight: 600
rounded:
  control: "8px"
  extension: "12px"
  panel: "14px"
spacing:
  compact: "8px"
  field: "12px"
  row: "16px"
  panel: "24px"
  section: "32px"
  workspace: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-danger:
    backgroundColor: "{colors.danger-surface}"
    textColor: "{colors.red}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  phone-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
---

# Design System: Central de telefonia

## Overview

**Creative North Star: "Mesa de operação diurna"**

Mesa de operação diurna: superfícies claras, texto verde escuro e divisórias leves mantêm o foco na conversa. A densidade é moderada; o telefone concentra as ações e a área lateral reúne equipe, operação de filas e histórico. A linguagem permanece direta e em português.

**Key Characteristics:**
- Superfícies claras e hierarquia por espaço.
- Ações concentradas no telefone.
- Estados explícitos e números tabulares.

## Colors

Primary: verde de ação em botões principais, foco e estados positivos. Neutral: papel no fundo, superfície branca no telefone e cabeçalho, tinta no texto e verde acinzentado no apoio. Linhas suaves delimitam seções. Vermelho e fundo rosado identificam erros e encerramento; o botão de microfone selecionado usa um fundo âmbar suave (#f6e8d0).

**The Estado Legível Rule.** Todo estado tem texto além de cor; registro SIP, motor de telefonia e canal de eventos têm indicadores separados.

## Typography

A pilha nativa favorece leitura operacional. O título principal usa a função headline; seções usam title. Textos auxiliares variam entre (11px) e (13px). No telefone, o ramal em chamada recebe destaque (64px, peso 500); destino usa (24px). Ramais, duração e tabela usam números tabulares. Ícones Lucide acompanham texto nos controles principais.

## Layout

O conteúdo tem largura máxima (1240px) e margens automáticas, com respiro (48px 36px 56px). A grade principal combina telefone fixo (352px) e área flexível, separados por (40px). Até (820px), telefone passa a (310px), intervalo a (24px) e margens internas a (32px 24px). Até (680px), a grade vira uma coluna com intervalo (32px), margens (32px 20px), título (29px) e cabeçalho (70px). A tabela permite rolagem horizontal própria. Até (680px), as colunas de espera e conversa saem da tabela e os tempos continuam disponíveis nos detalhes. O estado pode quebrar em mais de uma linha e os ícones de direção cedem espaço ao texto da chamada.

**The Telefone Primeiro Rule.** Em telas estreitas, preserve a ordem telefone, equipe, operação de filas e histórico.

## Elevation & Depth

O sistema é plano, sem sombras. Superfície branca, fundo papel, bordas finas e espaçamento fazem a separação. O telefone mantém borda (1px); listas e tabela usam divisórias horizontais.

## Shapes

Controles têm cantos suaves (8px), identificadores de ramal (12px) e painel do telefone (14px). Indicadores de estado são pontos circulares (6px). Não há cartões elevados para cada item de lista.

## Components

Botões principais, secundários e de encerramento têm altura mínima (48px), conteúdo centralizado e ícone com texto. O principal escurece no hover (#124b36); encerramento usa fundo rosado mais forte (#f0d5d6). O secundário selecionado sinaliza microfone silenciado com texto e `aria-pressed`. Controles desabilitados têm opacidade (.45).

Campos e seletores têm altura mínima (44px), borda input-line (1px), labels explícitos e fundo branco. O destino centralizado tem altura mínima (56px). Foco de teclado usa contorno verde (2px) afastado (4px), inclusive em links e summary. Erros aparecem em faixa com `role="alert"` e ação Fechar.

O cabeçalho contém marca, indicação de desenvolvimento e Sair durante a sessão. A equipe usa linhas com identificador, descrição e disponibilidade. Histórico alterna entre mensagem vazia e tabela. Após Sair, equipe e chamadas deixam de ser exibidas. A chamada estabelecida usa “Em conversa com”, sem inferir direção.

**Telefone.** O painel permanece na mesa ao alternar entre Atendimento, Supervisão e Administração. O discador aceita ramal ou fila. Em conversa, os controles incluem espera e retomada, além de transferência em uma seção expansível. A transferência direta aceita ramal ou fila. A transferência assistida abre uma consulta a outro ramal, mantém a ligação original em espera e oferece confirmação ou cancelamento. O retorno da central aparece em texto.

**Operação de filas.** Atendimento organiza filas em linhas com departamento, número, contagem de espera e estado do ramal. Integrantes podem entrar, sair, pausar ou retomar o atendimento. Supervisores e administradores alternam Atendimento e Supervisão por botões que quebram linha e indicam a seleção com fundo verde suave e `aria-pressed`. Administração aparece para administradores e usa seções expansíveis para departamentos, filas e integrantes, e horários de atendimento. A grade dos formulários se ajusta ao espaço, com colunas a partir de (150px) quando há espaço. Horários agrupam os dias em caixas de seleção com legenda e oferecem fuso, abertura, fechamento e destino quando fechado.

**Supervisão.** Pares de rótulo e valor exibem métricas em grade fluida com números tabulares. As métricas ao vivo, as listas de atendentes e chamadas em andamento e o resumo das últimas 24 horas têm estados próprios. Quando a leitura do Asterisk está indisponível, os valores ao vivo aparecem como traços e as listas são ocultadas. O resumo identifica separadamente a indisponibilidade do diário de filas.

**Histórico.** Filtros expansíveis cobrem período, departamento, atendente e situação. A paginação fica abaixo da tabela. A tabela ocupa uma região nomeada com foco visível e rolagem por teclado. Cada botão Ver identifica origem e destino no nome acessível. Ao abrir, o foco vai para o título dos detalhes na própria página. Ao usar Fechar detalhes, o foco volta ao botão Ver da chamada. Os detalhes reúnem horários, tempos de espera e conversa, passagem por filas e eventos de chamada, incluindo transferências quando registradas.

Apenas o fundo dos botões recebe transição curta (.15s); com movimento reduzido, transições são removidas. Não adicionar animação decorativa.

## Do's and Don'ts

### Do:
- Do associar estado a texto legível além da cor.
- Do manter o telefone antes da equipe, da operação de filas e do histórico em telas estreitas.
- Do usar números tabulares para ramais, duração e registros de chamadas.
- Do apresentar somente controles ligados às ações disponíveis no estado atual.

### Don't:
- Don't transformar estados SIP, motor e eventos em um único indicador.
- Don't exibir dados de equipe e histórico após sair da sessão.
- Don't usar sombra, gradiente ou movimento decorativo para criar hierarquia.

## Homologação de áudio — Fase 01.1

O telefone mostra SIP, mídia e captura separadamente, sem depender só de cor. Atendimento e encerramento possuem estados transitórios. Dois medidores nativos exibem atividade local de entrada/recepção; ausência de suporte ou bloqueio de reprodução recebe texto explícito. Dispositivos ficam no details existente, com entrada/saída por capacidade do navegador e operação pendente desabilitada. Alertas indicam recuperação por permissões ou seleção de outro dispositivo. O leiaute, tokens e hierarquia anteriores são preservados.
