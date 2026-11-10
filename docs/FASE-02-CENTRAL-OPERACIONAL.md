# Fase 02 — Central operacional local

**Parecer: GO COM RESTRIÇÕES para demonstração interna local.** Os critérios funcionais foram exercitados no laboratório; não é aprovação para produção, telefonia multiempresa provisionada ou operadora.

A Flora opera com departamentos configuráveis, filas do Asterisk, presença de atendimento separada do registro SIP, espera, transferência, supervisão e histórico. Os serviços permanecem locais. O responsável confirmou conversa humana bidirecional na Fase 01.1; isso não valida a nova operação em hardware, Firefox ou Safari.

## Demonstração

1. Abra [a central](http://localhost:13400/) no Chrome. Use perfis independentes para 201, 202 e 203. Leia tokens e senhas SIP do arquivo local .env. O 201 é administrador, o 202 é atendente e o 203 é supervisor e também possui ramal.
2. Em **Administração**, o 201 cria ou edita os departamentos, suas filas e vínculos com os ramais. No ambiente atual a fila 301 está ligada à Recepção, com associação ao 202. Em uma instalação nova, crie a fila e adicione o ramal. Para outro departamento, configure por exemplo 302 com 203 como integrante.
3. No 202, selecione **Entrar na fila** na Recepção e aguarde “Disponível para fila”. Estar conectado via SIP não basta. Disque 301 a partir do 201. O 202 recebe e atende no navegador.
4. Use **Colocar em espera** e **Retomar ligação**. Para encaminhar, abra **Transferência**: selecione 203 ou a fila 302 para encaminhamento direto, ou 203 para consulta assistida. Na consulta, confirme após o atendimento ou cancele para voltar à ligação original.
5. Abra **Supervisão** como 201 ou 203. O estado do discador permanece montado ao alternar os painéis. Consulte o histórico por período, departamento, atendente ou situação e abra o detalhe de eventos.
6. Use **Pausar atendimento** no 202 e confirme que a fila deixa de oferecer chamadas a ele. Em **Horários de atendimento**, defina os dias, fuso e destino de fechado. Encaminhamentos de fechado, indisponibilidade e timeout só alcançam ramais internos configurados.

Para reproduzir “201 transfere para 202”, inicie a ligação no 203, atenda no 201 e selecione o 202. Para demonstrar dois departamentos, associe 201 e 202 a filas diferentes, entre em ambas e use 203 como chamador. Transferência direta aceita pelo motor pode terminar sem atendimento; a assistida permite verificar o destinatário antes.

## Atualizar o ambiente existente

As migrações 002–005 são aplicadas em ordem, no banco do projeto, usando o papel de migração. Os scripts de inicialização do PostgreSQL só rodam automaticamente em volume novo. Em volume existente, use a sequência abaixo. Não recrie o banco nem remova volumes. Confira que não há chamada ativa antes de atualizar o motor local.

```sh
python3 scripts/bootstrap.py
for migration in backend/db/migrations/00[2-5]_*.sql; do
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d flora < "$migration" || exit 1
done
docker compose build asterisk backend web
docker compose up -d --no-deps asterisk backend web
```

Consulte [arquitetura e definições dos indicadores](FASE-02-ARQUITETURA.md), [contrato OpenAPI](openapi.yaml), [testes](FASE-02-TESTES.md) e [planejamento de troncos](FASE-03-TRONCOS-SIP-PLANEJAMENTO.md).

## Limites para operação externa

- Apenas um tenant tem ramais provisionados no motor; outro tenant existente testa isolamento de dados, API e eventos. Não vender o ambiente como PBX multiempresa provisionado.
- Autenticação e papéis de desenvolvimento, sem revogação, provisionamento dinâmico de ramais ou supervisão delegada por departamento. A administração é tenant-wide e o operador só altera a própria presença em filas associadas. Leituras de histórico existentes continuam autorizadas por tenant.
- Escuta humana da Fase 02, múltiplos dispositivos e topologias, carga, retenção e recuperação de desastre ainda exigem homologação. Firefox permanece restrito e Safari não homologado.
- O AMI privado é uma credencial de serviço com privilégios amplos para reconciliação; precisa de endurecimento antes de produção. Não houve escuta silenciosa, gravação, chamadas externas ou integração clínica.
- Para home care, exigir canal independente de contingência e protocolos assistenciais aprovados. A central local não é um serviço de emergência.

## Recomendação

A próxima etapa deve ser uma homologação humana interna da Fase 02 com três participantes, incluindo filas, espera, consulta, transferência e contingência. Antes de aprovar um piloto com operadora, isolar contextos por tenant com segundo tenant de telefonia real, endurecer identidade e AMI, exercitar LAN/VPN privada e documentar capacidade, backup e rotação de diários. Use o planejamento da Fase 03 como preparação; a conexão externa não está autorizada nem habilitada.
