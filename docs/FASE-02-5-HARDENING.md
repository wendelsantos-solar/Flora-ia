# Fase 02.5 — Hardening local

Projeto: Flora IA. Data de referência: 09/11/2026, America/Sao_Paulo. Escopo: laboratório local, sem chamadas públicas, operadora ou integração corporativa.

**GO COM RESTRIÇÕES para demonstração interna local. NO-GO para iniciar testes com operadora ou para produção até a homologação humana/privada e os controles descritos na prontidão SIP.**

## Auditoria e correções

| Superfície | Antes | Correção e verificação |
| --- | --- | --- |
| Histórico, detalhe e eventos | O papel de atendente podia ler chamadas de outros atendentes no próprio tenant. Um teste de leitura direta recebeu 200. | Política SQL comum nas listagens, IDs e eventos: atendente só acessa sessão da qual participou; supervisor, sessão cujo departamento principal foi delegado; administrador, tenant inteiro. A tentativa de leitura do ID de outra chamada agora retorna 404. |
| Supervisão | Papel com visão de todo o tenant. A API legada de métricas era acessível a qualquer identidade. | Catálogo de supervisão, estado ao vivo e totais limitados aos departamentos delegados. A API legada exige administrador; gravação de delegações exige administrador, origem válida e FK do mesmo tenant. |
| Catálogo e SIP | Catálogo e histórico separados por RLS, mas apenas um tenant tinha telefonia. | Dois PBXs, contextos locais, pares WSS/RTP, diários, grupos de rede e credenciais distintos. Chamadas simultâneas para o mesmo número de fila foram atendidas na empresa correta. INVITE e REFER forjados foram bloqueados pelo motor. |
| Sessão HTTP | O cookie continha o token reutilizável de login; remover cookie não revogava uma cópia. | Cookie opaco com 256 bits aleatórios e digest armazenado sob RLS. Expira em 8 h. Login rotaciona a sessão, logout revoga no servidor. O WebSocket revalida periodicamente e fecha em revogação. |
| Abuso | Limites por usuário e login; sessões WebSocket longas podiam consumir slots. | No máximo duas conexões de eventos por identidade, timeout e revalidação. Bucket de taxa tem teto e remove entradas vencidas; limite de login por IP observado e por identidade. Uma nova tela usa o cursor atual do tenant e agrupa atualizações: reler todo o histórico a cada perfil causava 429 no teste sequencial. Reconexões usam o último cursor recebido. |
| AMI e ARI | Classes do AMI concediam mais ações que as usadas; AMI e frontend compartilhavam uma rede. | O PBX escuta AMI nativo no loopback do container. Um filtro local de ações libera consultas e comandos de fila estritamente necessários por conta, com validação de nome de fila, ramal e tamanho de quadro. Recarga usa a CLI local com módulos fixos. ARI não está carregado. |
| PostgreSQL | O backend conhecia a mesma senha do superusuário e da aplicação, anulando a separação prática de papéis se o backend fosse comprometido. | Credenciais separadas; senha administrativa anterior invalidada; backend recebe apenas o acesso limitado sujeito a RLS. |
| Logs e auditoria | Correlação HTTP, auditoria de mudanças, diário do motor, sem gravações. | Auditoria de delegação mantém tenant, ator e correlation ID. Logs operacionais do PBX/Go recebem identificação do tenant; chamadas e eventos ficam em RLS. As evidências registram códigos de resposta e contadores, sem segredo ou áudio. |

A autorização não usa tenant enviado por query, payload ou ID da URL. Autenticação e vínculos definem o escopo no servidor. O diretório de discagem continua interno ao tenant. Uma delegação de supervisão limita observação, não cria uma barreira de discagem entre departamentos da mesma empresa. A política usa o primeiro departamento persistido para classificar a sessão transferida. Sessões sem departamento conhecido não entram na supervisão delegada.

Cookies usam HttpOnly e SameSite Strict. Secure é exigido quando a origem é HTTPS; o ambiente atual usa HTTP apenas em loopback. Tokens bearer de bootstrap continuam estáticos e são aceitos para a API de laboratório; sua rotação e revogação como credencial primária, SSO e MFA são pendências. Sem armazenamento de gravações ou endpoint para escuta.

## Recuperação

1. Verificar readiness, status do tenant e canais em cada PBX antes de reiniciar qualquer componente. Guardar horários, correlation IDs e estado dos volumes; não apagar CEL, queue_log ou PostgreSQL.
2. Se Go ou PostgreSQL estiver indisponível, não alterar catálogo durante a falha. O Asterisk pode seguir usando a configuração carregada. Aplicação de mudanças e observação ficam indisponíveis; um PBX reiniciado durante indisponibilidade do banco pode voltar sem membros dinâmicos até reconciliar.
3. Recuperar primeiro PostgreSQL, depois observar Go reconectar e os snapshots voltarem. Conferir canais, contatos, filas e histórico em cada tenant. O CEL e o queue_log são reaplicados com deduplicação; eventos não gravados pelo motor podem se perder num encerramento abrupto.
4. Em caso de volume ausente, corrupção ou limite de tamanho, fazer cópia antes de intervenção. Restaurar em ambiente isolado; comparar contagens, integridade e chamadas. Não truncar diários para “destravar” a interface. Não foi executado ensaio de recuperação de desastre nesta fase.

## Contingência para home care

Modelo proposto, não implantado: linha telefônica independente da Flora e da mesma conexão, escala de responsáveis e números de contingência validados pela operação, procedimento manual de registro e reconciliação, critério objetivo de acionamento, retorno e comunicação interna. A equipe assistencial deve aprovar o protocolo e exercitá-lo antes de piloto. A central não deve ser o único canal assistencial ou de emergência.

Ver [isolamento](FASE-02-5-MULTITENANT.md), [testes](FASE-02-5-TESTES.md) e [prontidão SIP](FASE-03-PRONTIDAO-SIP.md).

## Superfície verificada

Readiness público local retorna apenas condição do serviço. Sessão, identidade, diretório de ramais, estado do motor, operações e eventos exigem autenticação. IDs de ramal e chamada são resolvidos após aplicar o tenant; a leitura de chamada aplica também a política de participação/departamento. Catálogo e horário só podem ser modificados pelo administrador; a presença muda apenas a associação do próprio ramal. Mutações usam Origin esperado, corpo limitado e respostas com correlation ID. Não há endpoint de originação, desligamento, gravação ou escuta.

O AMI nativo fica no loopback de cada container. A porta interna 5038 é do filtro; o backend não alcança 5039. O filtro passa a autenticação do próprio Asterisk, mas valida lista de ações, argumentos e escopo antes de encaminhar. Não substitui mTLS em topologia distribuída. Os dois PBXs usam TLS local para WSS e DTLS-SRTP para mídia; não houve dispensa de validação de certificado.

## Dependências do motor

O pacote anterior 20.15.2 foi substituído localmente por Asterisk 20.22.0 compilado de [release oficial](https://github.com/asterisk/asterisk/releases/tag/20.22.0) com SHA-256 fixado. Alpine/musl não compilou a variante tentada; a imagem usa Debian estável e PJProject embutido do release. O novo módulo CEL usa o mapeamento DSV de 20.22 com as mesmas dez colunas, sem migrar ou truncar o CSV histórico. A atualização foi limitada aos dois motores locais. A troca não equivale a um inventário/SBOM ou pentest de produção.
