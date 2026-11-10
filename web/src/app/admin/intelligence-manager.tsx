'use client';

import { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Smile,
  Meh,
  Frown,
  Search,
  Building2,
  Briefcase,
  Headphones,
  Stethoscope,
  Filter,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
  X
} from 'lucide-react';
import { CallIntelligenceView } from '../call-intelligence';

type EnvironmentProfile = 'corporate' | 'financial' | 'support' | 'healthcare';

type TopicRadarItem = {
  id: string;
  topic: string;
  volume: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  trend: 'up' | 'stable' | 'down';
};

type CriticalCallAlert = {
  id: string;
  timestamp: string;
  caller: string;
  agent: string;
  extension: string;
  department: string;
  trigger: string;
  severity: 'high' | 'medium';
  sentimentScore: number;
};

const initialTopics: TopicRadarItem[] = [
  { id: '1', topic: 'Renovação de Contrato Corporativo', volume: 240, sentiment: 'positive', sentimentScore: 82, trend: 'up' },
  { id: '2', topic: 'Dúvidas sobre Faturamento & Boleto', volume: 185, sentiment: 'neutral', sentimentScore: 58, trend: 'stable' },
  { id: '3', topic: 'Instabilidade de Conexão no Sistema', volume: 94, sentiment: 'negative', sentimentScore: 28, trend: 'down' },
  { id: '4', topic: 'Solicitação de Proposta Comercial', volume: 142, sentiment: 'positive', sentimentScore: 88, trend: 'up' },
  { id: '5', topic: 'Ajuste de SLA & Horário de Atendimento', volume: 76, sentiment: 'neutral', sentimentScore: 62, trend: 'stable' },
];

const criticalCalls: CriticalCallAlert[] = [
  { id: 'call-101', timestamp: 'Hoje às 16:20', caller: '(11) 98765-4321', agent: 'Bruno Mendes', extension: '202', department: 'Comercial', trigger: 'Risco de Cancelamento (Contrato Corporativo)', severity: 'high', sentimentScore: 24 },
  { id: 'call-102', timestamp: 'Hoje às 15:05', caller: '(21) 99123-8877', agent: 'Diego Ramos', extension: '204', department: 'Comercial', trigger: 'Reclamação de SLA e Atraso na Entrega', severity: 'medium', sentimentScore: 35 },
  { id: 'call-103', timestamp: 'Hoje às 11:42', caller: '(31) 98455-1200', agent: 'Carla Nogueira', extension: '203', department: 'Suporte', trigger: 'Menção a Notificação Extrajudicial', severity: 'high', sentimentScore: 18 },
];

export function IntelligenceManager() {
  const [environment, setEnvironment] = useState<EnvironmentProfile>('corporate');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const environmentDetails = {
    corporate: {
      name: 'Ambiente Corporativo / B2B',
      icon: Briefcase,
      focus: 'Foco em negociação de contratos, SLA corporativo, retenção de clientes e alinhamento executivo.'
    },
    financial: {
      name: 'Financeiro & Cobrança',
      icon: Building2,
      focus: 'Foco em acordos de pagamento, mitigação de litígios e conformidade com código de defesa do consumidor.'
    },
    support: {
      name: 'Suporte & Atendimento ao Cliente (SAC)',
      icon: Headphones,
      focus: 'Foco em resolução no primeiro contato (FCR), redução de tempo de espera e satisfação (CSAT).'
    },
    healthcare: {
      name: 'Clínico & Saúde',
      icon: Stethoscope,
      focus: 'Foco em acolhimento humano, triagem rápida de urgência e clareza nas orientações ao paciente.'
    }
  };

  const currentEnv = environmentDetails[environment];
  const EnvIcon = currentEnv.icon;

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Inteligência de Voz, Transcrição & Análise de Sentimento</h3>
          <p className="hint">
            Auditoria automatizada por IA de todas as conversas telefônicas, identificação de sentimentos e insights estratégicos.
          </p>
        </div>

        {/* Seletor de Perfil de Ambiente */}
        <div className="env-selector-wrapper">
          <label htmlFor="env-select" className="sr-only">Perfil de Ambiente</label>
          <div className="env-pill">
            <EnvIcon size={15} aria-hidden />
            <select
              id="env-select"
              value={environment}
              onChange={e => setEnvironment(e.target.value as EnvironmentProfile)}
            >
              <option value="corporate">Ambiente Corporativo / B2B</option>
              <option value="financial">Financeiro & Cobrança</option>
              <option value="support">Suporte & SAC</option>
              <option value="healthcare">Clínico & Saúde</option>
            </select>
          </div>
        </div>
      </div>

      {/* Faixa Informativa do Ambiente Ativo */}
      <div className="flora-env-banner">
        <strong>{currentEnv.name}</strong>
        <span>· {currentEnv.focus}</span>
      </div>

      {/* KPI Cards de Sentimento */}
      <div className="flora-kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-label">Índice Geral de Satisfação (CSAT Preditivo)</div>
          <div className="kpi-value tabular-num">8.6 / 10</div>
          <div className="kpi-trend positive">
            <CheckCircle2 size={13} /> +0.4 pontos vs. média do mês
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Chamadas com Sentimento Positivo</div>
          <div className="kpi-value tabular-num">76.4%</div>
          <div className="kpi-subtext">1.068 conversas bem avaliadas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Taxa de Reversão de Frustração</div>
          <div className="kpi-value tabular-num">68.2%</div>
          <div className="kpi-subtext">Clientes irritados que terminaram satisfeitos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Alertas Críticos / Risco de Perda</div>
          <div className="kpi-value tabular-num danger-val">4.8%</div>
          <div className="kpi-subtext">68 chamadas requerem atenção imediata</div>
        </div>
      </div>

      {/* Tópicos Mais Frequentes e Sentimento Médio */}
      <div className="flora-card">
        <div className="card-header-icon">
          <Sparkles size={18} />
          <strong>Radar de Tópicos Corporativos & Nuvem de Intenções</strong>
        </div>
        <p className="hint">
          Assuntos mais abordados nas ligações classificados automaticamente pelo modelo de processamento de linguagem natural.
        </p>

        <div className="table-wrap history-table">
          <table>
            <thead>
              <tr>
                <th>Tópico / Motivo Identificado</th>
                <th>Volume de Chamadas</th>
                <th>Sentimento Predominante</th>
                <th>Pontuação Média</th>
                <th>Tendência</th>
              </tr>
            </thead>
            <tbody>
              {initialTopics.map(t => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.topic}</strong>
                  </td>
                  <td className="tabular-num">{t.volume} chamadas</td>
                  <td>
                    <span className={`flora-tag-pill ${t.sentiment === 'positive' ? 'positive-pill' : t.sentiment === 'negative' ? 'danger-pill' : ''}`}>
                      {t.sentiment === 'positive' ? 'Predominantemente Positivo' : t.sentiment === 'negative' ? 'Crítico / Fricção' : 'Neutro'}
                    </span>
                  </td>
                  <td>
                    <span className="tabular-num strong">{t.sentimentScore}/100</span>
                  </td>
                  <td>
                    <span className="trend-label">
                      {t.trend === 'up' ? 'Em alta ↑' : t.trend === 'down' ? 'Em queda ↓' : 'Estável —'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas de Chamadas Críticas para Supervisão */}
      <div className="flora-card">
        <div className="card-header-icon">
          <AlertTriangle size={18} />
          <strong>Chamadas com Alerta Crítico para Supervisão Imediata</strong>
        </div>
        <p className="hint">
          Ligações onde foram detectadas ameaças de cancelamento, litígio ou atrito grave que demandam acompanhamento da liderança.
        </p>

        <div className="table-wrap history-table">
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Cliente</th>
                <th>Operador Responsável</th>
                <th>Departamento</th>
                <th>Gatilho de Risco Identificado</th>
                <th>Pontuação</th>
                <th>Auditoria</th>
              </tr>
            </thead>
            <tbody>
              {criticalCalls.map(c => (
                <tr key={c.id}>
                  <td><span className="tabular-num">{c.timestamp}</span></td>
                  <td><strong>{c.caller}</strong></td>
                  <td>{c.agent} <span className="secondary-text">({c.extension})</span></td>
                  <td>{c.department}</td>
                  <td>
                    <span className={`risk-badge severity-${c.severity}`}>
                      {c.trigger}
                    </span>
                  </td>
                  <td>
                    <span className="tabular-num danger-val strong">{c.sentimentScore}/100</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSelectedCallId(c.id)}
                    >
                      Ver Transcrição & IA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de Auditoria Detalhada da Chamada */}
      {selectedCallId && (
        <div className="flora-modal-backdrop" onClick={() => setSelectedCallId(null)}>
          <div className="flora-drawer wide-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>Auditoria de Inteligência de Voz · #{selectedCallId}</h4>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedCallId(null)}
                aria-label="Fechar gaveta"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <CallIntelligenceView callId={selectedCallId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
