# Próximas fases

Fase 01 termina no parecer do TEST-REPORT. Um GO técnico de chamadas locais não autoriza lançamento comercial.

Antes da Fase 02: executar escuta humana com fones/microfones físicos nos navegadores alvo, revisar evidências da mídia, corrigir pendências de recuperação/histórico e aprovar os riscos. Migrar Asterisk para LTS mais recente após validar pacote/ARM64; não trocar versão sem repetir o teste de mídia.

Fase 02 recomendada: identidade com sessão revogável/OIDC, RBAC, provisionamento de ramais por tenant com contextos isolados no Asterisk e testes reais entre tenants; mecanismo versionado de migração; cursor/rotação/retention de CEL com confirmação; outbox e backpressure para eventos; testes de desastre e monitoramento. Antes de expandir concorrência, remover serialização de leituras por tenant preservando a ordem de commit dos eventos.

Somente depois: hold/resume/transferência com múltiplas pernas, seleção de saída de áudio, testes de DTMF, qualidade de rede/jitter/perda/eco, matriz Chrome/Firefox/Safari, TLS HTTPS completo e desenho STUN/TURN/SBC para rede alvo. Contratação de operadora, produção, faturamento, CRM e IA exigem escopo e autorização próprios e não fazem parte desta entrega.
