'use client';

import { useState } from 'react';
import { Search, Play, Pause, Download, ShieldCheck, Lock, Clock, Filter, Check, FileCheck2, Sparkles, X } from 'lucide-react';
import { CallIntelligenceView } from '../call-intelligence';

type Recording = {
  id: string;
  timestamp: string;
  caller: string;
  agent: string;
  extension: string;
  duration: string;
  tag: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  audioUrl?: string;
};

const initialRecordings: Recording[] = [
  { id: 'rec-01', timestamp: 'Hoje às 16:42', caller: '(11) 98765-4321', agent: 'Bruno Mendes', extension: '202', duration: '04:12', tag: 'Consentimento Registrado', sentiment: 'positive', sentimentScore: 84 },
  { id: 'rec-02', timestamp: 'Hoje às 15:18', caller: '(21) 99123-8877', agent: 'Diego Ramos', extension: '204', duration: '02:45', tag: 'Venda Confirmada', sentiment: 'positive', sentimentScore: 92 },
  { id: 'rec-03', timestamp: 'Hoje às 14:05', caller: '(31) 98455-1200', agent: 'Ana Fonseca', extension: '201', duration: '06:30', tag: 'Suporte Técnico', sentiment: 'neutral', sentimentScore: 65 },
  { id: 'rec-04', timestamp: 'Hoje às 11:22', caller: '(41) 97788-3344', agent: 'Carla Nogueira', extension: '203', duration: '03:15', tag: 'Consentimento Registrado', sentiment: 'negative', sentimentScore: 28 },
  { id: 'rec-05', timestamp: 'Hoje às 09:40', caller: '(19) 99344-5566', agent: 'Bruno Mendes', extension: '202', duration: '01:50', tag: 'Dúvida Geral', sentiment: 'positive', sentimentScore: 78 },
];

export function RecordingsManager() {
  const [recordings] = useState<Recording[]>(initialRecordings);
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1.0x' | '1.5x' | '2.0x'>('1.0x');
  const [retentionDays, setRetentionDays] = useState(90);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inspectingCallId, setInspectingCallId] = useState<string | null>(null);

  function togglePlay(id: string) {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  }

  function handleSaveRetention(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(`Política de retenção atualizada para ${retentionDays} dias. Registrado na auditoria de conformidade.`);
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleDownload(rec: Recording) {
    const blob = new Blob([`Flora IA - Áudio de Gravação Auditada #${rec.id}\nOrigem: ${rec.caller}\nAtendente: ${rec.agent} (Ramal ${rec.extension})\nData: ${rec.timestamp}\nSentimento: ${rec.sentimentScore}/100\nConformidade: LGPD AES-256`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gravacao-${rec.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = recordings.filter(r =>
    r.caller.includes(search) ||
    r.agent.toLowerCase().includes(search.toLowerCase()) ||
    r.extension.includes(search) ||
    r.tag.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Repositório de Gravações & Conformidade LGPD</h3>
          <p className="hint">Consulte gravações com criptografia de ponta a ponta, reprodutor auditado, transcrição e análise de sentimento.</p>
        </div>
      </div>

      {feedback && (
        <div className="flora-success-banner" role="status">
          <Check size={16} aria-hidden />
          <span>{feedback}</span>
        </div>
      )}

      {/* Card de Governança LGPD */}
      <div className="flora-governance-card">
        <div className="gov-icon">
          <ShieldCheck size={28} />
        </div>
        <div className="gov-body">
          <div className="gov-title">
            <strong>Proteção de Dados, Retenção & Transcrição Segura (LGPD)</strong>
            <span className="flora-tag-pill">Criptografia AES-256 Ativa</span>
          </div>
          <p>
            Todas as chamadas recebidas contam com aviso legal no início da ligação. As transcrições e análises de sentimento são anonimizadas para conformidade regulatória.
          </p>

          <form onSubmit={handleSaveRetention} className="retention-form">
            <label htmlFor="retention-select">
              Período de guarda de arquivos:
            </label>
            <select
              id="retention-select"
              value={retentionDays}
              onChange={e => setRetentionDays(Number(e.target.value))}
            >
              <option value={30}>30 dias (Mínimo operacional)</option>
              <option value={60}>60 dias (Padrão SAC)</option>
              <option value={90}>90 dias (Recomendado BACEN/Procon)</option>
              <option value={180}>180 dias (Auditoria estendida)</option>
              <option value={365}>365 dias (1 ano)</option>
            </select>
            <button type="submit" className="secondary">
              Atualizar Política
            </button>
          </form>
        </div>
      </div>

      <div className="flora-filter-bar">
        <div className="search-box">
          <Search size={15} aria-hidden />
          <input
            type="text"
            placeholder="Buscar por telefone do cliente, nome do atendente ou tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>Data & Hora</th>
              <th>Cliente (Origem)</th>
              <th>Operador</th>
              <th>Duração</th>
              <th>Sentimento IA</th>
              <th>Enquadramento Legal</th>
              <th>Reprodutor Auditado</th>
              <th>Transcrição & Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">Nenhuma gravação encontrada para o critério informado.</td>
              </tr>
            ) : (
              filtered.map(rec => {
                const isCurrentPlaying = playingId === rec.id;
                return (
                  <tr key={rec.id}>
                    <td>
                      <span className="tabular-num">{rec.timestamp}</span>
                    </td>
                    <td>
                      <strong>{rec.caller}</strong>
                    </td>
                    <td>
                      {rec.agent} <span className="secondary-text">({rec.extension})</span>
                    </td>
                    <td>
                      <span className="tabular-num">{rec.duration}</span>
                    </td>
                    <td>
                      <span className={`flora-tag-pill ${rec.sentiment === 'positive' ? 'positive-pill' : rec.sentiment === 'negative' ? 'danger-pill' : ''}`}>
                        {rec.sentiment === 'positive' ? 'Positivo' : rec.sentiment === 'negative' ? 'Crítico' : 'Neutro'} ({rec.sentimentScore})
                      </span>
                    </td>
                    <td>
                      <span className="flora-tag-pill lgpd-pill">
                        <FileCheck2 size={12} aria-hidden /> {rec.tag}
                      </span>
                    </td>
                    <td className="audio-cell">
                      <div className="inline-player">
                        <button
                          type="button"
                          className={`player-mini-btn ${isCurrentPlaying ? 'active' : ''}`}
                          onClick={() => togglePlay(rec.id)}
                          aria-label={isCurrentPlaying ? 'Pausar áudio' : 'Ouvir gravação'}
                        >
                          {isCurrentPlaying ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <div className="track-scrubber">
                          <span
                            className="scrubber-progress"
                            style={{ width: isCurrentPlaying ? '55%' : '0%' }}
                          />
                        </div>
                        <div className="speed-pills">
                          {(['1.0x', '1.5x', '2.0x'] as const).map(speed => (
                            <button
                              key={speed}
                              type="button"
                              className={`speed-btn ${playbackSpeed === speed ? 'selected' : ''}`}
                              onClick={() => setPlaybackSpeed(speed)}
                            >
                              {speed}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setInspectingCallId(rec.id)}
                        >
                          <Sparkles size={13} aria-hidden /> Transcrição
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          title="Baixar áudio da gravação"
                          onClick={() => handleDownload(rec)}
                        >
                          <Download size={14} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de Transcrição e Sentimento Detalhado */}
      {inspectingCallId && (
        <div className="flora-modal-backdrop" onClick={() => setInspectingCallId(null)}>
          <div className="flora-drawer wide-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>Transcrição de Áudio & Análise de IA · {inspectingCallId}</h4>
              <button
                type="button"
                className="close-btn"
                onClick={() => setInspectingCallId(null)}
                aria-label="Fechar gaveta"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <CallIntelligenceView callId={inspectingCallId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
