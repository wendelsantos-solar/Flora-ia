# Segurança — somente desenvolvimento

## Controles implementados

Credenciais aleatórias de 192 bits por bootstrap; `.env`, chave TLS e configurações renderizadas ignoradas no Git. Tokens diferentes para cada operador e tenant de teste. Tokens comparados por digest em tempo constante. Nenhum segredo retornado pela REST, pelo WebSocket ou por logs da API. Cookie HttpOnly, SameSite Strict, validade do navegador de oito horas; `Secure` quando a origem usa HTTPS. HTTP local é permitido exclusivamente pelo binding loopback; não serve como autenticação comercial.

POST de sessão exige origem exata e tem limite por IP; endpoints autenticados limitados por principal (300/minuto), concorrência global limitada a 64; corpo de sessão 1 KiB, headers 16 KiB, timeouts de leitura e banco. WebSocket exige cookie/token e origem exata, ping e prazo de 30 minutos. Não há token em query string. Correlation ID gerado pelo servidor, sem aceitar entrada arbitrária em logs.

PostgreSQL sem porta publicada; papel `flora_app` não é superuser nem dono de tabela. RLS força tenant em leitura/escrita; transações definem contexto localmente. Tenant nunca é aceito do navegador. Queries parametrizadas, UUIDs validados e paginação limitada. Asterisk é provisionado exclusivamente para o tenant de desenvolvimento; suporte multiempresa de telefonia dinâmica é trabalho futuro, não uma capacidade entregue.

AMI sem porta publicada, observador sem `command`, `originate` ou permissões de escrita de telefonia. ARI desabilitado pela lista explícita de módulos. Não há SIP UDP/TCP publicado. WSS e RTP somente no loopback. Contexto `internal-only` permite exclusivamente 201/202, bloqueia autodiscagem e limita canais de origem concorrentes. Não há tronco, número público ou tarifa possível.

Frontend sem telemetria de produto, câmera/geolocalização proibidas, frame deny, nosniff, referrer desabilitado. CSP limita conexões à mesma origem e WSS local. `unsafe-inline` é uma concessão ao runtime de Next nesta prova; produção exige nonce/CSP estrita.

## Limitações e riscos conhecidos

- Tokens de desenvolvimento estáticos, sem OIDC, rotação online ou revogação de sessão no servidor. Logout apaga cookie, não invalida o token. Operador controla sua credencial SIP; ainda não há cofre/provisionamento comercial.
- Senha SIP permanece na memória do cliente durante registro. XSS compromete essa identidade; não armazenar em localStorage nem incluir em captura de tela de login.
- A chave TLS renderizada é legível no mount para o usuário Asterisk do container. O diretório `.local` é protegido no host com modo 0700. Configurações com senhas são renderizadas somente dentro do container, em arquivos 0640 acessíveis ao grupo do Asterisk. Usuário com acesso Docker controla estes serviços e volumes.
- AMI é TCP na rede bridge exclusiva, sem TLS interno. A rede não deve receber containers não confiáveis. Sem isolamento entre usuários locais com acesso ao daemon Docker.
- Diário CEL não grava áudio, mas mantém ramais e identificadores. Sem política de retenção/backup pronta; não carregar dados reais. Arquivos e volume local devem ser preservados até confirmação de importação.
- Taxas/concorrência de SIP são básicas; não existe SBC, detecção de abuso distribuído ou suporte de internet pública.
- Não realizado pentest, certificação LGPD, SLA ou revisão jurídica de comercialização.

## Dependências/licenças

Versões exatas Go em `backend/go.mod/go.sum`, JavaScript em `web/package-lock.json`. Imagens/módulos registrados em `docs/evidence/versions.txt` após execução. Verificação `npm audit` e `govulncheck` quando disponíveis registrada no relatório; resultado limpo não é prova de ausência de vulnerabilidades. Scan de SO/imagens separado é necessário antes de produção.

| Componente | Licença declarada upstream | Consequência inicial |
| --- | --- | --- |
| Go | BSD-3-Clause | Preservar avisos ao redistribuir |
| chi | MIT | Preservar licença/avisos |
| pgx | MIT | Preservar licença/avisos |
| coder/websocket | ISC | Preservar licença/avisos |
| sqlc (ferramenta) | MIT | Preservar avisos se redistribuída |
| Next.js, React, Tailwind | MIT | Incluir avisos das dependências redistribuídas |
| lucide-react | ISC | Preservar licença/avisos |
| SIP.js | MIT | Preservar licença/avisos |
| PostgreSQL | PostgreSQL License | Preservar licença/avisos |
| Asterisk | GPL-2.0; componentes podem ter termos adicionais | Distribuição de binários/imagens exige disponibilização do código correspondente e cumprimento da GPL; revisar módulos/combinações e licenciamento comercial caso aplicável |
| Alpine e pacotes de sistema | Múltiplas | Inventariar e fornecer avisos/código quando exigido na distribuição |

Executar SaaS e distribuir appliances/imagens são modelos diferentes. A integração SIP/AMI separa processos, mas não substitui revisão jurídica sobre obra derivada ou distribuição. Nenhum serviço pago ou chamada externa foi utilizado.

Fontes oficiais: [Asterisk licensing](https://www.asterisk.org/products/asterisk/licensing/), [Asterisk source COPYING](https://github.com/asterisk/asterisk/blob/20/COPYING), [SIP.js license](https://github.com/onsip/SIP.js/blob/master/LICENSE.md), [PostgreSQL license](https://www.postgresql.org/about/licence/), [Go license](https://go.dev/LICENSE), [sqlc license](https://github.com/sqlc-dev/sqlc/blob/main/LICENSE).

## Acréscimos da Fase 01.1

Os medidores de entrada/recepção analisam RMS em memória e não gravam áudio. Diagnósticos expõem estados e IDs efêmeros de tracks, sem deviceId, rótulos de hardware, tokens ou senhas. Saída via setSinkId requer suporte e permissão da própria origem. Não há pedido automático de microfone por devicechange. Timeout RTP 30 s limita canais abandonados no laboratório; não é uma política homologada para rede pública/DTX/hold. Testes e avaliação humana são separados no relatório da fase.

## Limites de segurança da Fase 02

- Admin local (201) administra o catálogo do próprio tenant de telefonia. Operador (202) muda somente sua associação já autorizada em cada fila. Supervisor local (203) observa o tenant sem permissão de escrita no catálogo. O histórico continua acessível às identidades autenticadas do mesmo tenant. Não existe delegação fina de supervisão por departamento nem identidade comercial revogável.
- Origem obrigatória em mutações, limites por principal, formatos estritos e FKs por tenant impedem escolher ramal de outro tenant. O controlador emite destinos restritos ao conjunto de endpoints provisionados. RLS também protege configurações, horários e diário de filas.
- Asterisk oferece somente rotas locais 201–203 e 3xx configuradas. Não há external_replaces, tronco, registro remoto ou encaminhamento público. O único contexto de telefonia em funcionamento é do tenant de demonstração.
- O socket AMI não foi publicado. As credenciais de observação e controle são distintas. As classes de privilégio do AMI são mais amplas que as ações usadas pelo Go: um comprometimento do servidor não fica limitado às operações públicas. Antes de produção, separar acessos de controle, isolar a rede, limitar operações por ação e rotacionar segredos.
- O diário e os detalhes contêm metadados da chamada, não gravações. Definir política de retenção, minimização e acesso antes de processar números externos ou dados assistenciais. Sem escuta silenciosa ou armazenamento de áudio.
