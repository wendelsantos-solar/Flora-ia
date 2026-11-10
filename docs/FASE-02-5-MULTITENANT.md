# Fase 02.5 — Dois tenants de telefonia reais

| Tenant de laboratório | Ramais e papéis | WSS e mídia no host | Armazenamento do PBX |
| --- | --- | --- | --- |
| Flora original | 201 administrador, 202 atendente, 203 supervisor | 127.0.0.1:18489, UDP 18000–18020 | CEL e configuração originais |
| Horizonte fictícia | 211 administrador, 212 atendente, 213 supervisor | 127.0.0.1:18490, UDP 18100–18120 | Novos volumes CEL e configuração |

A identidade de testes sem ramal permanece separada para preservar a regressão da Fase 01. Cada PBX pertence a uma bridge distinta. Go é o único serviço que participa das duas bridges e da rede web/PostgreSQL. Cada conexão AMI usa seu próprio par de credenciais; cada ramal tem token e senha SIP distintos. Nenhum PBX tem um endpoint, um tronco, uma rota ou um diálogo do outro. As filas nativas podem ter o mesmo número para o usuário; o nome no motor inclui o tenant.

Na ingestão, o vínculo do motor é fixado no servidor. Eventos CEL só entram com accountcode igual ao tenant desse motor; fila, extensão e canal observados são validados no contexto correto. Os dados persistidos usam RLS e chaves compostas. Não há API de controle de chamada por ID: espera e transferência usam o próprio diálogo SIP autenticado. REFER externo e substituição de diálogo remoto não são configurados.

## Provisionamento repetível do laboratório

O bootstrap acrescenta os segredos ausentes a .env; não rotaciona os existentes. As migrações 006 e 007 são aditivas. Em volume PostgreSQL existente aplique ambas com o papel local de migração, antes de iniciar o backend novo:

```sh
python3 scripts/bootstrap.py
for file in backend/db/migrations/00[67]_*.sql; do
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d flora < "$file" || exit 1
done
python3 scripts/split-postgres-credentials.py
docker compose build asterisk asterisk-b backend web
docker compose up -d --no-deps db asterisk asterisk-b backend web
```

Num volume novo, as migrações são montadas na inicialização. Não apagar volumes, não usar down -v. Abrir a central em perfis independentes, entrar no 212 e ingressar na fila 301; chamar 301 a partir de 211. O 213 acompanha o departamento Recepção, que foi delegado por migração. A equipe da primeira empresa usa seu 301, que toca apenas seus próprios membros. As credenciais ficam no .env local.

Um administrador pode conceder ou remover a delegação por PUT/DELETE em /v1/departments/{code}/supervisors/{extension}. O identificador do departamento é resolvido dentro do tenant autenticado. A revogação remove a visibilidade nas consultas futuras; dados já vistos não podem ser removidos do dispositivo do operador.

Não existe autoatendimento de criação de organização: a ligação tenant–PBX–credencial–portas é infraestrutura declarativa, não provisionamento comercial. Logs no coletor do host ainda exigem controle de acesso operacional separado; o tenant nunca acessa os logs de containers pela aplicação.
