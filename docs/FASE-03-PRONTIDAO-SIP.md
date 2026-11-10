# Fase 03 — Prontidão SIP

**Parecer: GO COM RESTRIÇÕES para homologação local da Fase 02.5; NO-GO para iniciar tráfego de operadora ou produção agora.**

Dois tenants de telefonia funcionam com isolamento demonstrável de sinalização, dados e mídia no laboratório. Isso não substitui homologação em rede privada, escuta humana, revisão do perímetro ou autorização comercial. A Fase 03 permanece planejamento.

## Impedimentos antes de conectar uma operadora

1. Validar inventário, CVEs e a imagem completa no perímetro previsto. O pacote anterior 20.15.2-r1 tinha avisos posteriores e foi substituído localmente por 20.22.0; por exemplo, [multipart SIP do PJProject](https://github.com/asterisk/asterisk/security/advisories/GHSA-f948-v379-526c) e [PJSIP TCP/SDP](https://github.com/asterisk/asterisk/security/advisories/GHSA-g8q2-p36q-94f6). Nem todo aviso é alcançável nos módulos/transporte habilitados; isso não autoriza exposição.
2. Homologar três pessoas, equipamentos distintos, chamadas nas duas direções, retenção de mídia em transferência e contingência. Validar caminho privado entre redes e registrar perda, jitter, latência e recuperação. Firefox e Safari continuam fora da matriz homologada até nova evidência.
3. Introduzir identidade revogável com rotação de credenciais, autenticação corporativa e papéis auditáveis; usar HTTPS em toda a aplicação. Isolar melhor credenciais de infraestrutura, garantir trilha operacional e testar recuperação de desastre.
4. Formalizar provisionamento/revogação de tenant, recursos e ramais, DNS privado, limites e gestão de capacidade. Os dois tenants locais demonstram a arquitetura, mas não são provisionamento em escala.
5. Definir SBC ou interconexão privada, ACL, autenticação, TLS/SRTP, mapeamento de DID, origens permitidas, classes de destino, concorrência, taxa, duração e teto de custo por empresa. A métrica local é operacional, não faturamento. Ver [planejamento de troncos](FASE-03-TRONCOS-SIP-PLANEJAMENTO.md).
6. Antes do piloto, aprovar prestadora, números, custos, perímetro, avaliação de privacidade, retenção/backup, procedimentos de resposta e contingência assistencial independente. Não usar a Flora como único canal para operações críticas.

Não foi contratada operadora, configurado tronco, publicada porta SIP/AMI/ARI ou originada chamada pública.
