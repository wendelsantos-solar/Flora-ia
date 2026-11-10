'use client';

import { useState } from 'react';
import { Download, Calendar, TrendingUp, Clock, CheckCircle2, AlertCircle, Award } from 'lucide-react';

type AgentPerformance = {
  extension: string;
  name: string;
  department: string;
  callsHandled: number;
  averageTalkTime: string;
  pauseTime: string;
  csat: string;
  slaAdherence: string;
};

const agentData: AgentPerformance[] = [
  { extension: '202', name: 'Bruno Mendes', department: 'Comercial & Vendas', callsHandled: 48, averageTalkTime: '03:12', pauseTime: '00:25', csat: '98%', slaAdherence: '96.5%' },
  { extension: '204', name: 'Diego Ramos', department: 'Comercial & Vendas', callsHandled: 42, averageTalkTime: '03:45', pauseTime: '00:30', csat: '95%', slaAdherence: '94.0%' },
  { extension: '201', name: 'Ana Fonseca', department: 'Geral & Diretoria', callsHandled: 34, averageTalkTime: '02:50', pauseTime: '00:15', csat: '99%', slaAdherence: '98.2%' },
  { extension: '203', name: 'Carla Nogueira', department: 'Suporte Técnico', callsHandled: 39, averageTalkTime: '05:10', pauseTime: '00:20', csat: '94%', slaAdherence: '91.8%' },
];

const hourlyDistribution = [
  { hour: '08h', volume: 14, height: 25 },
  { hour: '09h', volume: 38, height: 60 },
  { hour: '10h', volume: 56, height: 90 },
  { hour: '11h', volume: 62, height: 100 },
  { hour: '12h', volume: 28, height: 45 },
  { hour: '13h', volume: 35, height: 55 },
  { hour: '14h', volume: 58, height: 92 },
  { hour: '15h', volume: 52, height: 82 },
  { hour: '16h', volume: 44, height: 70 },
  { hour: '17h', volume: 31, height: 50 },
  { hour: '18h', volume: 16, height: 26 },
];

export function ReportsManager() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  function exportCSV() {
    const headers = 'Ramal,Atendente,Departamento,Chamadas Atendidas,TMA,Tempo em Pausa,Aderencia SLA,CSAT\n';
    const rows = agentData.map(a =>
      `${a.extension},"${a.name}","${a.department}",${a.callsHandled},${a.averageTalkTime},${a.pauseTime},${a.slaAdherence},${a.csat}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-desempenho-flora-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Relatórios Gerenciais & Indicadores de SLA</h3>
          <p className="hint">Acompanhe tempos de espera, taxa de atendimento, metas de qualidade e produtividade da equipe.</p>
        </div>
        <div className="header-actions">
          <select value={period} onChange={e => setPeriod(e.target.value as 'today' | 'week' | 'month')}>
            <option value="today">Hoje (Tempo Real)</option>
            <option value="week">Últimos 7 dias</option>
            <option value="month">Mês Atual</option>
          </select>
          <button type="button" className="secondary" onClick={exportCSV}>
            <Download size={15} aria-hidden /> Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="flora-kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-label">SLA de Atendimento (&lt; 20s)</div>
          <div className="kpi-value tabular-num">94.2%</div>
          <div className="kpi-trend positive">
            <CheckCircle2 size={13} /> Acima da meta de 90.0%
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Volume Total de Ligações</div>
          <div className="kpi-value tabular-num">1.428</div>
          <div className="kpi-subtext">1.398 atendidas · 30 abandonadas (2.1%)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Tempo Médio de Espera (TME)</div>
          <div className="kpi-value tabular-num">00:18</div>
          <div className="kpi-subtext">Média ponderada de todas as filas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Tempo Médio de Conversa (TMA)</div>
          <div className="kpi-value tabular-num">03:42</div>
          <div className="kpi-subtext">Estável em relação a ontem</div>
        </div>
      </div>

      {/* Hourly Curve Chart */}
      <div className="flora-chart-card">
        <div className="chart-header">
          <strong>Distribuição Horária de Chamadas</strong>
          <span className="secondary-text">Pico registrado entre as 10h e 12h</span>
        </div>
        <div className="flora-bar-chart">
          {hourlyDistribution.map(item => (
            <div key={item.hour} className="chart-col">
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ height: `${item.height}%` }}
                  title={`${item.hour}: ${item.volume} chamadas`}
                />
              </div>
              <span className="col-label">{item.hour}</span>
              <span className="col-val tabular-num">{item.volume}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance by Agent Table */}
      <div className="table-wrap history-table">
        <div className="table-caption">Desempenho por Operador</div>
        <table>
          <thead>
            <tr>
              <th>Ramal</th>
              <th>Operador</th>
              <th>Departamento</th>
              <th>Chamadas Atendidas</th>
              <th>TMA</th>
              <th>Pausa Acumulada</th>
              <th>Aderência SLA</th>
              <th>Satisfação (CSAT)</th>
            </tr>
          </thead>
          <tbody>
            {agentData.map(a => (
              <tr key={a.extension}>
                <td>
                  <span className="flora-ext-badge">{a.extension}</span>
                </td>
                <td>
                  <strong>{a.name}</strong>
                </td>
                <td>{a.department}</td>
                <td className="tabular-num">{a.callsHandled}</td>
                <td className="tabular-num">{a.averageTalkTime}</td>
                <td className="tabular-num">{a.pauseTime}</td>
                <td>
                  <span className="flora-tag-pill positive-pill tabular-num">{a.slaAdherence}</span>
                </td>
                <td>
                  <strong className="tabular-num">{a.csat}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
