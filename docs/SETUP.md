# Execução local

## Ambiente observado em 08/11/2026

macOS 27.0.1 ARM64; 16 GiB RAM; cerca de 26 GiB livres antes da instalação. Docker Desktop 4.45 / Engine 28.3.3 / Compose 2.39.2; Go 1.26.0 inicialmente instalado (projeto fixado em 1.26.10 após análise de segurança); Node 22.23.2; npm 10.9.8. Portas 13400, 18400, 18489 e UDP 18000–18020 reservadas para este projeto. Serviços existentes foram preservados.

Dependências: Docker Compose, Python 3, mkcert. Go deve suportar download de toolchain 1.26.10 para os testes locais. Go/Node locais são opcionais quando tudo roda em containers. As imagens têm suporte ARM64. Desde a Fase 02.5, ambos os PBXs são compilados a partir do Asterisk 20.22.0 oficial com PJProject embutido e base Debian estável. Para atualizar uma instalação existente, siga [as migrações e a separação de credenciais](FASE-02-5-MULTITENANT.md).

## Certificado

`mkcert` deve estar instalado. Nesta máquina a CA de desenvolvimento existente foi verificada como confiável; nenhuma configuração global de confiança foi modificada. O bootstrap somente lê essa CA e grava certificados dentro de `.local/certs`.

Em outra máquina sem CA confiável, o operador deve preparar a confiança conscientemente com `mkcert -install` antes do bootstrap (modifica o trust store; não foi executado nesta entrega). Firefox pode exigir importação da CA no seu perfil. Nunca ignorar erros TLS nem usar flags que desativam validação. A chave da CA não entra no container; somente chave/certificado do servidor. Certificado emitido para localhost, 127.0.0.1 e ::1.

## Iniciar

Na raiz do projeto:

```sh
python3 scripts/bootstrap.py
docker compose up -d --build
docker compose ps
curl --fail http://localhost:18400/health/ready
```

Abrir http://localhost:13400. Usar sempre `localhost`, inclusive para cookies/origem e WSS. O bootstrap é idempotente, não imprime segredos nem sobrescreve `.env`. A inicialização da base aplica a migração e dados fictícios automaticamente no primeiro volume vazio. Não editar a migração já aplicada para futuras alterações; adicionar novas versões e runner antes da Fase 02.

Abra `.env` localmente. Para 201, use `TOKEN_201` e `SIP_201_PASSWORD`; para 202, `TOKEN_202` e `SIP_202_PASSWORD`. Não compartilhe esse arquivo. Cada ramal deve ser aberto em um perfil/contexto diferente do navegador: cookies são compartilhados entre abas normais. Permita microfone e áudio.

Nenhuma senha SIP é obtida por API ou incorporada no bundle. O navegador recebe a senha digitada pelo próprio operador; apenas credencial SIP individual é utilizada no WSS.

## Parar e voltar

```sh
docker compose stop
# retomar sem recriar dados
docker compose up -d
# remover containers/rede deste projeto, preservando dados
docker compose down
```

Não usar `down -v` para encerramento normal. Não executar prune global ou parar outros projetos. Os volumes pertencem a `flora-phase1`.

## Desenvolvimento e testes

```sh
npm ci --prefix web --cache .local/npm
# variáveis Go evitam gravações de cache fora do projeto
export GOPATH="$PWD/.local/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PWD/.local/cache/go-build"
(cd backend && go test -race ./... && go vet ./...)
scripts/test-integration.sh
npm --prefix web run typecheck
npm --prefix web run build
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers" web/node_modules/.bin/playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers" npm --prefix web run test:e2e
```

Integração cria um container PostgreSQL descartável sem porta host e remove somente esse container ao sair. Nunca usar a base de desenvolvimento como `DATABASE_URL_TEST`. O teste WebRTC utiliza a central de desenvolvimento e registra histórico real; não rodá-lo enquanto operadores usam os mesmos ramais.

sqlc 1.30.0: baixar o binário oficial adequado à arquitetura para `.local/bin` e executar `(cd backend && ../.local/bin/sqlc generate)`. Arquivos gerados são versionados; runtime não depende de sqlc.

## Rede e limitações

Loopback + Docker Desktop: `MEDIA_ADDRESS=127.0.0.1`, faixa UDP pequena e ICE habilitado, sem STUN/TURN externos. Não é configuração para LAN, dispositivos móveis ou WAN. Ambientes com VPN/firewall podem exigir diagnóstico próprio. Não publicar em 0.0.0.0 para contornar isso. Se portas estiverem ocupadas, ajustar Compose, origem backend, URL SIP.js, CSP e teste de forma consistente.
