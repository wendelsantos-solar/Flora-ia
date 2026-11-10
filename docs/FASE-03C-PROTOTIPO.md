# Fase 03C — Protótipo navegável

Abra [o protótipo](prototipo-03c/index.html) no navegador. O HTML, CSS e JavaScript são editáveis e ficam em `docs/prototipo-03c`. O protótipo funciona a partir do arquivo local, com dados marcados como simulados, sem backend, SIP, WebRTC ou chamadas de rede.

1. Em **Atendimento**, simule chamada recebida. Abra **Histórico** e observe o convite ainda disponível. Atenda, coloque em espera, retome e faça uma consulta. Selecione um ramal para a consulta ou fila para transferência direta.
2. Explore **Supervisão**, **Histórico**, **Administração** e **Configurações avançadas**. A política simulada pede revisão e confirma na tela que nenhum dado foi alterado.
3. Use o seletor de perfil. Supervisor tem Supervisão. Atendente tem atendimento, filas e histórico. Alterar o perfil reinicia o telefone demonstrativo.
4. No mobile, confira a experiência de consulta e o atalho para voltar ao discador. Os controles telefônicos são estados de demonstração.

## Telas e comparação

| Fluxo | Interface atual | Proposta desktop | Proposta móvel |
| --- | --- | --- | --- |
| Mesa de trabalho | [Admin](evidence/phase-03c/atual/admin.png) | [Visão geral](evidence/phase-03c/prototipo/overview.png) | [Visão geral](evidence/phase-03c/prototipo/overview-mobile-390.png) |
| Atendimento | [Atendente](evidence/phase-03c/atual/atendente.png) | [Fila e cenários](evidence/phase-03c/prototipo/atendimento.png) | [Chamada recebida](evidence/phase-03c/prototipo/recebida-mobile-390.png) |
| Receber e conversar | [Recebida](evidence/phase-03c/atual/recebida.png) · [Ativa](evidence/phase-03c/atual/ativa.png) | [Recebida](evidence/phase-03c/prototipo/recebida.png) · [Ativa](evidence/phase-03c/prototipo/ativa.png) | [Ativa](evidence/phase-03c/prototipo/ativa-mobile-390.png) |
| Consulta | [Consulta atual](evidence/phase-03c/atual/consulta.png) | [Consulta assistida](evidence/phase-03c/prototipo/consulta.png) | [Consulta assistida](evidence/phase-03c/prototipo/consulta-mobile-390.png) |
| Supervisão e histórico | [Supervisão](evidence/phase-03c/atual/supervisao.png) · [Histórico](evidence/phase-03c/atual/historico.png) | [Supervisão](evidence/phase-03c/prototipo/supervisao.png) · [Histórico](evidence/phase-03c/prototipo/historico.png) | [Supervisão](evidence/phase-03c/prototipo/supervisao-mobile-390.png) · [Histórico](evidence/phase-03c/prototipo/historico-mobile-390.png) |
| Administração | [Departamentos](evidence/phase-03c/atual/departamentos.png) · [Filas](evidence/phase-03c/atual/filas.png) | [Ramais](evidence/phase-03c/prototipo/ramais.png) · [Departamentos e filas](evidence/phase-03c/prototipo/departamentos.png) · [Horários](evidence/phase-03c/prototipo/horarios.png) | [Ramais](evidence/phase-03c/prototipo/ramais-mobile-390.png) · [Departamentos](evidence/phase-03c/prototipo/departamentos-mobile-390.png) |
| Configurações avançadas | Inspeção por código. Módulo indisponível no ambiente ativo. | [Tronco](evidence/phase-03c/prototipo/tronco.png) · [Discagem](evidence/phase-03c/prototipo/discagem.png) | [Tronco](evidence/phase-03c/prototipo/tronco-mobile-390.png) · [Discagem](evidence/phase-03c/prototipo/discagem-mobile-390.png) |

[Antes e depois da mesa](evidence/phase-03c/comparativo-mesa.png) · [Chamada recebida móvel](evidence/phase-03c/comparativo-chamada-mobile.png) · [Consulta assistida](evidence/phase-03c/comparativo-consulta.png)

## Validação

O Chrome percorreu 34 capturas em 1440, 390 e 320 px sem overflow de documento, sem erros JavaScript e sem requisições HTTP. A automação verificou convite preservado ao navegar, espera, consulta para ramal, bloqueio de consulta para fila, filtro, Escape no detalhe, confirmação da política, visibilidade por perfil e atalho móvel. O detector Impeccable rodou em modo degradado por ausência de dependências de parsing. Seus avisos usam o `DESIGN.md` vigente da aplicação e incluem diferenças intencionais de paleta e raios deste conceito isolado. A inspeção visual comparou desktop e mobile. Nenhuma dessas verificações homologa telefonia no protótipo. [Resultados do navegador](evidence/phase-03c/prototipo/validacao.json) · [Detector](evidence/phase-03c/prototipo/detector.json)
