'use client';

import { useState } from 'react';
import { Search, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, MessageSquare, Clock, Mic, User, ShieldCheck } from 'lucide-react';

export type TranscriptTurn = {
  id: string;
  speaker: 'agent' | 'customer';
  speakerName: string;
  time: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  text: string;
  keywords?: string[];
};

export type CallIntelligenceData = {
  callId: string;
  summary: {
    intent: string;
    description: string;
    actionTaken: string;
    nextSteps: string;
  };
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number; // 0 a 100
    initialTone: 'Frustrado / Inseguro' | 'Neutro' | 'Receptivo';
    finalTone: 'Satisfeito / Resolvido' | 'Neutro' | 'Insatisfeito';
    reversalSuccess: boolean;
  };
  metrics: {
    talkRatioAgent: number; // ex: 45%
    talkRatioCustomer: number; // ex: 55%
    interruptionCount: number;
    speechRateWpm: number; // palavras por minuto
  };
  compliance: {
    lgpdDisclaimerPresent: boolean;
    riskTermsDetected: string[];
    criticalAlert: boolean;
  };
  transcript: TranscriptTurn[];
};

export const sampleIntelligenceData: Record<string, CallIntelligenceData> = {
  default: {
    callId: 'call-sample',
    summary: {
      intent: 'Renovação de Contrato Corporativo & Ajuste de SLA',
      description: 'O cliente entrou em contato manifestando preocupação com o prazo de atendimento nos finais de semana e solicitou revisão da proposta comercial antes de assinar a prorrogação anual.',
      actionTaken: 'Atendente explicou as coberturas do plano corporativo vigente, aplicou a tabela especial de retenção com SLA 24/7 e enviou o anexo atualizado por e-mail.',
      nextSteps: 'Aguardar retorno do diretor financeiro do cliente até quinta-feira às 15:00 para assinatura eletrônica.'
    },
    sentiment: {
      overall: 'positive',
      score: 84,
      initialTone: 'Frustrado / Inseguro',
      finalTone: 'Satisfeito / Resolvido',
      reversalSuccess: true
    },
    metrics: {
      talkRatioAgent: 46,
      talkRatioCustomer: 54,
      interruptionCount: 1,
      speechRateWpm: 128
    },
    compliance: {
      lgpdDisclaimerPresent: true,
      riskTermsDetected: ['cancelamento', 'reajuste', 'prazo legal'],
      criticalAlert: false
    },
    transcript: [
      {
        id: 't-1',
        speaker: 'agent',
        speakerName: 'Atendente (Ramal 202)',
        time: '00:03',
        sentiment: 'neutral',
        text: 'Bom dia! Você está na Flora IA. Esta chamada é gravada para sua segurança e garantia de qualidade. Com quem eu falo?'
      },
      {
        id: 't-2',
        speaker: 'customer',
        speakerName: 'Carlos Mendonça (Cliente)',
        time: '00:11',
        sentiment: 'negative',
        text: 'Bom dia. Aqui é o Carlos, da Finvest Capital. Olha, recebi a minuta de renovação do contrato e sinceramente estou preocupado. Se o SLA de final de semana continuar demorado como no mês passado, vamos precisar considerar o cancelamento.',
        keywords: ['renovação', 'contrato', 'cancelamento']
      },
      {
        id: 't-3',
        speaker: 'agent',
        speakerName: 'Atendente (Ramal 202)',
        time: '00:26',
        sentiment: 'positive',
        text: 'Compreendo perfeitamente sua colocação, Carlos. Agradeço pela transparência. Nós implementamos uma nova escala dedicada de suporte no início deste mês justamente para garantir tempo de primeira resposta inferior a 15 minutos em qualquer horário.',
        keywords: ['suporte', 'garantir', '15 minutos']
      },
      {
        id: 't-4',
        speaker: 'customer',
        speakerName: 'Carlos Mendonça (Cliente)',
        time: '00:44',
        sentiment: 'neutral',
        text: 'Certo, e isso vai constar formalmente na cláusula 4 da proposta? Porque a minha diretoria precisa dessa garantia explícita.',
        keywords: ['cláusula', 'proposta', 'garantia']
      },
      {
        id: 't-5',
        speaker: 'agent',
        speakerName: 'Atendente (Ramal 202)',
        time: '00:58',
        sentiment: 'positive',
        text: 'Com certeza! Estou adicionando o termo aditivo de SLA 24/7 prioritário com bonificação automática em caso de descumprimento, mantendo o valor contratual acordado sem acréscimo.',
        keywords: ['aditivo', 'SLA 24/7', 'sem acréscimo']
      },
      {
        id: 't-6',
        speaker: 'customer',
        speakerName: 'Carlos Mendonça (Cliente)',
        time: '01:15',
        sentiment: 'positive',
        text: 'Excelente, nesse caso resolve totalmente o nosso receio. Pode me enviar por e-mail que vou encaminhar imediatamente para validação do nosso jurídico.',
        keywords: ['excelente', 'resolve', 'jurídico']
      },
      {
        id: 't-7',
        speaker: 'agent',
        speakerName: 'Atendente (Ramal 202)',
        time: '01:28',
        sentiment: 'positive',
        text: 'Perfeito, Carlos! Minuta enviada com cópia para seu e-mail corporativo. Protocolo de atendimento número 49200-24. Tenha um excelente dia de trabalho!'
      }
    ]
  }
};

export function CallIntelligenceView({ callId }: { callId: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'metrics'>('summary');
  const data = sampleIntelligenceData.default;

  const filteredTranscript = data.transcript.filter(turn =>
    turn.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    turn.speakerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sentimentLabels = {
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Frustrado / Crítico'
  };

  return (
    <div className="flora-intelligence-container">
      {/* Barra de Sub-Navegação da Inteligência */}
      <div className="intelligence-nav-tabs">
        <button
          type="button"
          className={`int-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <Sparkles size={14} aria-hidden /> Resumo & Sentimento
        </button>
        <button
          type="button"
          className={`int-tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          <MessageSquare size={14} aria-hidden /> Transcrição Diarizada ({data.transcript.length} falas)
        </button>
        <button
          type="button"
          className={`int-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          <TrendingUp size={14} aria-hidden /> Métricas de Conversação
        </button>
      </div>

      {/* ABA 1: RESUMO EXECUTIVO & ANÁLISE DE SENTIMENTO */}
      {activeTab === 'summary' && (
        <div className="int-tab-content">
          {/* Card de Scorecard de Sentimento */}
          <div className="flora-card sentiment-card">
            <div className="sentiment-header">
              <div>
                <span className="section-eyebrow">Diagnóstico de Sentimento</span>
                <h4>Índice de Satisfação: <span className="tabular-num strong">{data.sentiment.score}/100</span></h4>
              </div>
              <span className={`sentiment-badge badge-${data.sentiment.overall}`}>
                Sentimento Geral: {sentimentLabels[data.sentiment.overall]}
              </span>
            </div>

            {/* Trajetória Emocional */}
            <div className="sentiment-trajectory">
              <div className="trajectory-step">
                <span className="step-label">Início da Ligação</span>
                <span className="tone-indicator initial">{data.sentiment.initialTone}</span>
              </div>
              <div className="trajectory-arrow">
                <span className="arrow-line" />
                <span className="arrow-badge">
                  {data.sentiment.reversalSuccess ? 'Reversão Eficaz de Atrito' : 'Evolução Estável'}
                </span>
              </div>
              <div className="trajectory-step">
                <span className="step-label">Término da Ligação</span>
                <span className="tone-indicator final">{data.sentiment.finalTone}</span>
              </div>
            </div>
          </div>

          {/* Resumo da Conversa Gerado por IA */}
          <div className="flora-card summary-card">
            <div className="summary-section">
              <span className="summary-badge">Motivo do Contato</span>
              <strong>{data.summary.intent}</strong>
            </div>

            <div className="summary-section">
              <span className="summary-title">Resumo dos Fatos Apresentados</span>
              <p>{data.summary.description}</p>
            </div>

            <div className="summary-section">
              <span className="summary-title">Resolução Aplicada pelo Atendente</span>
              <p>{data.summary.actionTaken}</p>
            </div>

            <div className="summary-section next-steps-box">
              <span className="summary-title">Próximos Passos & Pendências Acordadas</span>
              <p>{data.summary.nextSteps}</p>
            </div>
          </div>

          {/* Conformidade e Riscos */}
          <div className="flora-card compliance-card">
            <div className="card-header-icon">
              <ShieldCheck size={18} />
              <strong>Auditoria Corporativa & Riscos</strong>
            </div>

            <div className="compliance-grid">
              <div className="compliance-item">
                <span className="comp-label">Aviso Obrigatório LGPD:</span>
                <span className="comp-status positive">
                  <CheckCircle2 size={13} /> Gravado na Abertura
                </span>
              </div>
              <div className="compliance-item">
                <span className="comp-label">Termos de Atenção Detectados:</span>
                <div className="keyword-tags">
                  {data.compliance.riskTermsDetected.map(term => (
                    <span key={term} className="risk-keyword">{term}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: TRANSCRIÇÃO DIARIZADA */}
      {activeTab === 'transcript' && (
        <div className="int-tab-content">
          <div className="transcript-toolbar">
            <div className="search-box">
              <Search size={14} aria-hidden />
              <input
                type="text"
                placeholder="Buscar palavra na transcrição (ex: cancelamento, SLA, contrato)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {searchTerm && (
              <span className="search-result-count tabular-num">
                {filteredTranscript.length} ocorrência(s)
              </span>
            )}
          </div>

          <div className="flora-dialogue-flow">
            {filteredTranscript.length === 0 ? (
              <p className="table-empty">Nenhum trecho encontrado para o termo pesquisado.</p>
            ) : (
              filteredTranscript.map(turn => {
                const isAgent = turn.speaker === 'agent';
                return (
                  <div key={turn.id} className={`dialogue-turn ${isAgent ? 'speaker-agent' : 'speaker-customer'}`}>
                    <div className="turn-meta">
                      <span className="speaker-avatar">
                        {isAgent ? <Mic size={12} /> : <User size={12} />}
                      </span>
                      <strong>{turn.speakerName}</strong>
                      <span className="turn-time tabular-num">
                        <Clock size={11} aria-hidden /> {turn.time}
                      </span>
                      <span className={`turn-sentiment sentiment-${turn.sentiment}`}>
                        {sentimentLabels[turn.sentiment]}
                      </span>
                    </div>
                    <div className="turn-bubble">
                      <p>{turn.text}</p>
                      {turn.keywords && turn.keywords.length > 0 && (
                        <div className="turn-keywords">
                          {turn.keywords.map(kw => (
                            <span key={kw} className="kw-chip">#{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ABA 3: MÉTRICAS DE CONVERSAÇÃO */}
      {activeTab === 'metrics' && (
        <div className="int-tab-content">
          <div className="flora-card metrics-card">
            <h4>Dinâmica da Conversa (Talk-to-Listen Ratio)</h4>
            <p className="hint">Equilíbrio saudável de tempo de fala entre o operador e o cliente.</p>

            <div className="talk-ratio-meter">
              <div className="ratio-labels">
                <span>Operador: <strong className="tabular-num">{data.metrics.talkRatioAgent}%</strong></span>
                <span>Cliente: <strong className="tabular-num">{data.metrics.talkRatioCustomer}%</strong></span>
              </div>
              <div className="ratio-track">
                <div className="ratio-agent" style={{ width: `${data.metrics.talkRatioAgent}%` }} />
                <div className="ratio-customer" style={{ width: `${data.metrics.talkRatioCustomer}%` }} />
              </div>
              <div className="ratio-legend">
                <span className="legend-agent">Tempo de Fala do Operador</span>
                <span className="legend-customer">Tempo de Escuta Ativa do Cliente</span>
              </div>
            </div>

            <div className="metrics-subgrid">
              <div className="submetric-box">
                <span className="metric-title">Interrupções Mútuas</span>
                <strong className="metric-val tabular-num">{data.metrics.interruptionCount}</strong>
                <span className="metric-desc">Excelente (baixo índice de sobreposição de voz)</span>
              </div>
              <div className="submetric-box">
                <span className="metric-title">Velocidade de Fala</span>
                <strong className="metric-val tabular-num">{data.metrics.speechRateWpm} WPM</strong>
                <span className="metric-desc">Ritmo calmo e de fácil compreensão</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
