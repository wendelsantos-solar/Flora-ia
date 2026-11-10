# Central de telefonia · Fase 01

Go + Next.js + SIP.js + Asterisk/PJSIP + PostgreSQL. Apenas chamadas internas 201 ↔ 202, desenvolvimento local, sem serviços pagos.

```sh
python3 scripts/bootstrap.py
docker compose up -d --build
```

Interface: http://localhost:13400. Credenciais individuais no `.env` gerado localmente. Use dois perfis/contextos de navegador separados. Permita microfone e áudio. Não ignore certificados TLS.

[Execução completa](docs/SETUP.md) · [Telefonia e primeira chamada](docs/TELEPHONY.md) · [Arquitetura](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Segurança e licenças](docs/SECURITY.md) · [Resultado dos testes](docs/TEST-REPORT.md) · [Próximos passos](docs/ROADMAP.md)

Encerrar preservando dados: `docker compose stop`. Sem commit, push ou implantação automática.

## Homologação humana — Fase 01.1

[Relatório da Fase 01.1](docs/FASE-01-1-HOMOLOGACAO.md) · [Roteiro com duas pessoas e headsets](docs/ROTEIRO-AUDIO-HUMANO.md) · [Cenários privados de rede](docs/REDES-DE-HOMOLOGACAO.md). Conversa humana continua pendente; os sinais automatizados não a substituem.

A [Fase 02](docs/FASE-02-CENTRAL-OPERACIONAL.md) acrescenta operação de filas, espera, transferências, supervisão e horários. Em volume PostgreSQL existente, aplique as migrações incrementais conforme o roteiro da fase antes de atualizar os serviços.

A [Fase 02.5](docs/FASE-02-5-HARDENING.md) acrescenta o segundo PBX local, permissões por departamento e sessões revogáveis. Para atualizar volumes existentes, consulte o [roteiro de migração e credenciais](docs/FASE-02-5-MULTITENANT.md).
