# API REST e eventos

A versão 0.2 do [OpenAPI](openapi.yaml) documenta o catálogo operacional, presença, métricas, horários e filtros do histórico. Consulte também [Fase 02](FASE-02-CENTRAL-OPERACIONAL.md). A descrição inicial abaixo fica como referência da Fase 01.

OpenAPI 3.1 em `openapi.yaml`. Base direta `http://localhost:18400`; navegador acessa `/api` em `http://localhost:13400` pelo proxy Next. Recursos são sempre filtrados pelo tenant da identidade; IDs de outro tenant retornam 404.

| Método | Caminho | Autenticação / comportamento |
| --- | --- | --- |
| GET | `/health/live` | Público, processo HTTP vivo |
| GET | `/health/ready` | Público, 200 somente com banco, AMI conectado e importador saudável; 503 caso contrário. Não prova áudio |
| POST | `/v1/session` | `{ "token": "token local" }`, origem exata; 204 com cookie HttpOnly, 400/401/403/429 |
| DELETE | `/v1/session` | Autenticado e origem exata; apaga cookie, 204 |
| GET | `/v1/me` | Identidade/ramal, sem segredos |
| GET | `/v1/extensions` | `{items:[{id,number,registered,updated_at}]}` |
| GET | `/v1/extensions/{id}` | Um ramal UUID; 400/404 |
| GET | `/v1/calls?limit=50&offset=0` | `{items:[...],limit,offset}`; limite 1–100, offset 0–100000 |
| GET | `/v1/calls/{id}` | `{call,legs:[...]}` incluindo IDs Asterisk; 400/404 |
| GET | `/v1/telephony/status` | Conexão AMI, saúde do diário e última sincronização; não expõe configuração administrativa |
| GET | `/v1/metrics` | Contagens persistidas por tenant: total, atendidas, concluídas, falhas, ativas, interrompidas, eventos |
| GET (upgrade) | `/v1/events?after=0` | Cookie/token e Origin exata; cursor de sequência global, visibilidade por tenant, replay em lotes de 200 |

Não existe POST de originação nem alteração de ramais. Comandos telefônicos são enviados por SIP.js com credenciais SIP limitadas. Assim não há chave de idempotência de comando REST; idempotência de importação é verificada por event_key.

Autenticação para ferramentas: header `Authorization: Bearer <TOKEN_201>`, ou cookie de sessão. Não incluir token em URL. Usar `.env` local sem copiar tokens a relatórios ou terminais compartilhados. Endpoints não autenticados retornam 401. Operações fora do tenant não revelam existência de recurso. Não há API administrativa nesta fase.

Formato de erro:

```json
{"error":{"code":"invalid_id","message":"Bad Request","correlation_id":"identificador-gerado"}}
```

Erros explícitos de cursor/origem no handshake WebSocket usam texto simples; falhas de autenticação/limite anteriores ao upgrade usam o envelope JSON da API. Mensagens de erro não incluem detalhe SQL, token ou senha. `X-Correlation-ID` acompanha respostas HTTP; os logs identificam método e rota, sem corpo/query string.

Evento WebSocket:

```json
{"sequence":42,"call_id":"uuid-da-sessao","type":"call.answered","occurred_at":"2026-11-08T21:00:00Z","data":{"asterisk_unique_id":"exemplo","asterisk_linked_id":"exemplo","source":"201","destination":"202","journal_type":"ANSWER"}}
```

Exemplo de formato, não evidência de ligação. Eventos de ramal possuem call_id null. Persistir o último cursor consumido, reconectar com `after`, descartar duplicatas e reconsultar REST para estado corrente. UI mantém cursor em memória durante reconexões e solicita replay completo após reload. Ocorrência é ordenada pela sequência de persistência, não pelo relógio do motor: evento tardio conserva seu occurred_at. Após 30 minutos o socket é renovado automaticamente pelo cliente.
