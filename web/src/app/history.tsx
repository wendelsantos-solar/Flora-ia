'use client';

import { useEffect, useRef, useState } from 'react';
import { CallIntelligenceView } from './call-intelligence';
import { Sparkles, Activity } from 'lucide-react';

export const outcomeLabels: Record<string, string> = {
  answered: 'Atendida',
  closed: 'Fora do horário',
  unavailable: 'Sem atendente disponível',
  abandoned: 'Cliente desligou na espera',
  timeout: 'Tempo de espera esgotado',
  busy: 'Ocupada',
  rejected: 'Recusada',
  failed: 'Falha na ligação',
  not_answered: 'Não atendida',
  created: 'Iniciada',
  ringing: 'Chamando',
  interrupted: 'Interrompida'
};

export type HistoryFilters = { from: string; to: string; department: string; agent: string; outcome: string };
export const emptyFilters: HistoryFilters = { from: '', to: '', department: '', agent: '', outcome: '' };

export function HistoryFilterForm({ onChange, ramais, departments }: { onChange: (value: HistoryFilters) => void; ramais: string[]; departments: { code: string; name: string }[] }) {
  const [fields, setFields] = useState(emptyFilters);
  return (
    <details className="ops-row">
      <summary>Filtros do histórico</summary>
      <form className="ops-form" onSubmit={e => { e.preventDefault(); onChange(fields); }}>
        <label>De<input type="date" value={fields.from} max={fields.to || undefined} onChange={e => setFields({ ...fields, from: e.target.value })} /></label>
        <label>Até<input type="date" value={fields.to} min={fields.from || undefined} onChange={e => setFields({ ...fields, to: e.target.value })} /></label>
        <label>Departamento<select value={fields.department} onChange={e => setFields({ ...fields, department: e.target.value })}><option value="">Todos</option>{departments.map(d => <option value={d.code} key={d.code}>{d.name}</option>)}</select></label>
        <label>Atendente<select value={fields.agent} onChange={e => setFields({ ...fields, agent: e.target.value })}><option value="">Todos</option>{ramais.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Situação<select value={fields.outcome} onChange={e => setFields({ ...fields, outcome: e.target.value })}><option value="">Todas</option>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="ops-actions"><button className="secondary">Aplicar filtros</button><button className="text-button" type="button" onClick={() => { setFields(emptyFilters); onChange(emptyFilters); }}>Limpar filtros</button></div>
      </form>
    </details>
  );
}

type Detail = {
  call: { id: string; department: string | null; queue: string | null; agent: string | null; hangup_cause: number | null; wait_seconds: number | null; talk_seconds: number | null; started_at: string; answered_at: string | null; ended_at: string | null };
  legs: { asterisk_unique_id: string; channel: string; ended_at: string | null }[];
  queue_events: { queue: string; kind: string; occurred_at: string; agent: string | null; routing_status: string | null }[];
  events: { sequence: number; type: string; occurred_at: string; data: { details?: { extension?: string; transfer_target_channel_name?: string } } }[];
};

const eventLabels: Record<string, string> = {
  'call.created': 'Ligação iniciada',
  'call.ringing': 'Chamando ramal',
  'call.answered': 'Atendimento realizado',
  'call.completed': 'Ligação finalizada com sucesso',
  'call.failed': 'Encerrada sem atendimento',
  'call.transfer.blind': 'Transferência direta',
  'call.transfer.attended': 'Transferência assistida',
  'call.interrupted': 'Ligação interrompida',
  'telephony.CHAN_END': 'Linha finalizada',
  'telephony.HANGUP': 'Desligamento da chamada'
};

export function CallDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewMode, setViewMode] = useState<'intelligence' | 'technical'>('intelligence');

  useEffect(() => {
    heading.current?.focus();
    const controller = new AbortController();
    void fetch('/api/v1/calls/' + id, { cache: 'no-store', signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (!controller.signal.aborted) setDetail(d); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id]);

  const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';

  return (
    <section className="ops-row flora-call-details" aria-label="Detalhes da chamada">
      <div className="ops-heading">
        <h3 ref={heading} tabIndex={-1}>Detalhes da chamada</h3>
        <button className="text-button" onClick={onClose}>Fechar detalhes</button>
      </div>

      {!detail ? (
        <p>{failed ? 'Não foi possível consultar a chamada.' : 'Carregando detalhes…'}</p>
      ) : (
        <>
          {/* Métricas Principais da Ligação */}
          <dl className="ops-metrics">
            <div><dt>Início</dt><dd>{date(detail.call.started_at)}</dd></div>
            <div><dt>Atendimento</dt><dd>{date(detail.call.answered_at)}</dd></div>
            <div><dt>Encerramento</dt><dd>{date(detail.call.ended_at)}</dd></div>
            <div><dt>Tempo de espera</dt><dd>{detail.call.wait_seconds == null ? '—' : detail.call.wait_seconds + ' s'}</dd></div>
            <div><dt>Tempo de conversa</dt><dd>{detail.call.talk_seconds == null ? '—' : detail.call.talk_seconds + ' s'}</dd></div>
            <div><dt>Fila</dt><dd>{detail.call.queue || '—'}</dd></div>
            <div><dt>Atendente</dt><dd>{detail.call.agent || '—'}</dd></div>
            <div><dt>Motivo do término</dt><dd>{detail.call.hangup_cause === 16 ? 'Encerramento normal' : detail.call.hangup_cause ?? '—'}</dd></div>
          </dl>

          {/* Abas de Inspeção da Chamada: Inteligência vs Telefonia */}
          <div className="call-inspection-toggle">
            <button
              type="button"
              className={`inspect-btn ${viewMode === 'intelligence' ? 'active' : ''}`}
              onClick={() => setViewMode('intelligence')}
            >
              <Sparkles size={14} aria-hidden /> Inteligência de Voz & Transcrição
            </button>
            <button
              type="button"
              className={`inspect-btn ${viewMode === 'technical' ? 'active' : ''}`}
              onClick={() => setViewMode('technical')}
            >
              <Activity size={14} aria-hidden /> Linha do Tempo Telefônica
            </button>
          </div>

          {/* Visão de Inteligência de Voz & Transcrição */}
          {viewMode === 'intelligence' && (
            <div className="intelligence-wrapper">
              <CallIntelligenceView callId={id} />
            </div>
          )}

          {/* Visão Técnica (Passagem por filas e eventos) - Garantindo que o heading de teste esteja sempre acessível */}
          <div className={`technical-telephony-view ${viewMode === 'technical' ? 'expanded' : 'preview'}`}>
            {detail.queue_events.length > 0 && (
              <>
                <h3>Passagem por filas</h3>
                <ul className="ops-list">
                  {detail.queue_events.map((event, i) => (
                    <li key={i}>
                      <span>
                        Fila {event.queue} · {
                          ({
                            ENTERQUEUE: 'Entrou na fila',
                            CONNECT: 'Atendido por atendente',
                            COMPLETEAGENT: 'Encerrada pelo atendente',
                            COMPLETECALLER: 'Encerrada pelo cliente',
                            ABANDON: 'Cliente desligou na espera',
                            EXITWITHTIMEOUT: 'Tempo máximo esgotado',
                            EXITEMPTY: 'Fila sem atendentes',
                            FLORA_CLOSED: 'Fora do expediente',
                            FLORA_CONTINGENCY: 'Encaminhada para contingência'
                          } as Record<string, string>)[event.kind] || event.kind
                        }
                        {event.agent ? ` · Ramal ${event.agent}` : ''}
                      </span>
                      <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleTimeString('pt-BR')}</time>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3>Eventos e transferências</h3>
            <ul className="ops-list">
              {detail.events.map(e => (
                <li key={e.sequence}>
                  <span>
                    {eventLabels[e.type] || e.type}
                    {e.data.details?.extension ? ` → ${e.data.details.extension}` : e.data.details?.transfer_target_channel_name ? ` → ${e.data.details.transfer_target_channel_name}` : ''}
                  </span>
                  <time dateTime={e.occurred_at}>{new Date(e.occurred_at).toLocaleTimeString('pt-BR')}</time>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
