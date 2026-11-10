'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScheduleForm, type Schedule } from './schedule';
import { Supervision } from './supervision';
import { SIPLab } from './sip-lab';
import { UsersManager } from './admin/users-manager';
import { QueuesManager } from './admin/queues-manager';
import { IVRManager } from './admin/ivr-manager';
import { RecordingsManager } from './admin/recordings-manager';
import { ReportsManager } from './admin/reports-manager';
import { TrunksManager } from './admin/trunks-manager';
import { IntelligenceManager } from './admin/intelligence-manager';
import { Building2, Users, Layers, GitFork, Disc, BarChart3, PhoneCall, Sparkles } from 'lucide-react';

type Department = { code: string; name: string };
export type Queue = { number: string; department: string; strategy: string; ring_seconds: number; wait_seconds: number; fallback: string };
type Member = { queue: string; extension: string; joined: boolean; paused: boolean };
type LiveQueue = { waiting: number; members: Record<string, { paused: boolean; state: string }> };
type Operations = { role: string; catalog: { departments: Department[]; queues: Queue[]; members: Member[]; schedules: Schedule[] }; engine: { fresh: boolean; queues: Record<string, LiveQueue> } };

const labels: Record<string, string> = {
  available: 'Disponível para fila',
  paused: 'Pausado',
  busy: 'Em atendimento',
  disconnected: 'Sem registro alcançável',
  unavailable: 'Indisponível'
};

const defaultQueue = { number: '', department: '', strategy: 'rrmemory', ring_seconds: 8, wait_seconds: 30, fallback: '' };

export type AdminSubTab = 'departamentos' | 'usuarios' | 'filas' | 'ura' | 'gravacoes' | 'relatorios' | 'linhas' | 'inteligencia';

const adminTabs = [
  { id: 'departamentos', label: 'Organização & Horários', icon: Building2 },
  { id: 'usuarios', label: 'Usuários & Ramais', icon: Users },
  { id: 'filas', label: 'Filas & Políticas', icon: Layers },
  { id: 'ura', label: 'Menus de Voz (URA)', icon: GitFork },
  { id: 'gravacoes', label: 'Gravações & LGPD', icon: Disc },
  { id: 'relatorios', label: 'Relatórios & SLA', icon: BarChart3 },
  { id: 'linhas', label: 'Linhas, DIDs & Custos', icon: PhoneCall },
  { id: 'inteligencia', label: 'Inteligência & Sentimento', icon: Sparkles },
] as const;

export function OperationsPanel({
  extension,
  ramais,
  onQueues,
  tab,
  initialSubTab
}: {
  extension: string;
  ramais: string[];
  onQueues: (queues: Queue[], departments: Department[]) => void;
  tab: 'queue' | 'admin' | 'supervision' | 'advanced';
  initialSubTab?: AdminSubTab;
}) {
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState({ code: '', name: '' });
  const [editing, setEditing] = useState(false);
  const [queue, setQueue] = useState<Queue>(defaultQueue);
  const [editingQueue, setEditingQueue] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>(initialSubTab || 'departamentos');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/v1/operations', { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Não foi possível consultar as filas.');
    const next: Operations = await response.json();
    if (signal?.aborted) return;
    setData(next);
    setUnavailable(false);
    onQueues(next.catalog.queues, next.catalog.departments);
  }, [onQueues]);

  useEffect(() => {
    const controller = new AbortController();
    const update = () => void refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setUnavailable(true);
    });
    update();
    const timer = setInterval(update, 3000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [refresh]);

  async function change(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!response.ok) throw new Error(
        response.status === 409 ? 'Há uma associação em conflito. Confira o departamento e os ramais.' :
        response.status === 403 ? 'Seu acesso não permite essa alteração.' :
        'Não foi possível salvar. Confira os dados e tente novamente.'
      );
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const fresh = !unavailable && Boolean(data?.engine.fresh);

  return (
    <section className="operations" aria-labelledby="ops-title">
      <div className="section-heading">
        <h2 id="ops-title">
          {tab === 'queue' ? 'Filas de atendimento' :
           tab === 'supervision' ? 'Visão ao vivo' :
           tab === 'advanced' ? 'Linhas externas da empresa' :
           'Administração Corporativa'}
        </h2>
        {data && <span className="hint">{fresh ? 'Central conectada e atualizada' : 'Atualização temporariamente indisponível'}</span>}
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      {!data ? (
        <p className="empty-copy">{unavailable ? 'Não foi possível carregar as filas.' : 'Carregando central…'}</p>
      ) : (
        <>
          {tab === 'supervision' && (data.role === 'admin' || data.role === 'supervisor') && (
            <Supervision queues={data.catalog.queues.map(q => ({
              ...q,
              department: data.catalog.departments.find(d => d.code === q.department)?.name || q.department
            }))} />
          )}

          {tab === 'advanced' && data.role === 'admin' && (
            <SIPLab extensions={ramais} queues={data.catalog.queues.map(q => q.number)} />
          )}

          {tab === 'queue' && (
            <>
              {data.catalog.queues.length === 0 && <p className="empty-copy">Nenhuma fila configurada.</p>}
              {data.catalog.queues.map(q => {
                const live = fresh ? data.engine.queues[q.number] : undefined;
                const own = data.catalog.members.find(m => m.queue === q.number && m.extension === extension);
                const member = live?.members[extension];
                const pending = !!own && fresh && (own.joined !== Boolean(member) || (member && own.paused !== member.paused));
                return (
                  <article className="ops-row" key={q.number}>
                    <div className="ops-heading">
                      <h3>{data.catalog.departments.find(d => d.code === q.department)?.name} · {q.number}</h3>
                      <span>{live ? `${live.waiting} clientes aguardando` : 'Sem leitura da fila'}</span>
                    </div>
                    {own ? (
                      <>
                        <p>{!fresh ? 'Estado operacional indisponível' : pending ? 'Confirmando alteração com a central…' : member ? labels[member.state] : 'Fora da fila'}</p>
                        <div className="ops-actions">
                          <button className="secondary" disabled={busy || !!pending} onClick={() => void change(`queues/${q.number}/presence`, 'PUT', { joined: !own.joined, paused: false })}>
                            {own.joined ? 'Sair da fila' : 'Entrar na fila'}
                          </button>
                          {own.joined && (
                            <button className="secondary" disabled={busy || !!pending} onClick={() => void change(`queues/${q.number}/presence`, 'PUT', { joined: true, paused: !own.paused })}>
                              {own.paused ? 'Retomar atendimento' : 'Pausar atendimento'}
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p>Seu ramal não está associado a esta fila.</p>
                    )}
                    {data.role === 'admin' && live && Object.values(live.members).length > 0 && (
                      <ul className="ops-list">
                        {Object.entries(live.members).map(([n, m]) => (
                          <li key={n}><span>Ramal {n}</span><span>{labels[m.state]}</span></li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </>
          )}

          {tab === 'admin' && data.role === 'admin' && (
            <div className="flora-admin-suite">
              {/* Navegação por Sub-abas da Administração */}
              <nav className="flora-admin-tabs" aria-label="Módulos administrativos">
                {adminTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`admin-tab-btn ${activeSubTab === id ? 'active' : ''}`}
                    onClick={() => setActiveSubTab(id as AdminSubTab)}
                    aria-current={activeSubTab === id ? 'page' : undefined}
                  >
                    <Icon size={15} aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>

              {/* Módulo 1: Organização & Horários (Departamentos, Horários e Filas legadas) */}
              {activeSubTab === 'departamentos' && (
                <div className="admin-module-content">
                  <ScheduleForm
                    departments={data.catalog.departments}
                    schedules={data.catalog.schedules}
                    ramais={ramais}
                    busy={busy}
                    change={change}
                  />

                  <details className="ops-row" open>
                    <summary>Departamentos</summary>
                    <ul className="ops-list">
                      {data.catalog.departments.map(d => (
                        <li key={d.code}>
                          <span>{d.name}</span>
                          <button className="text-button" onClick={() => { setDepartment(d); setEditing(true); }}>
                            Editar {d.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <form className="ops-form" onSubmit={async e => {
                      e.preventDefault();
                      if (await change('departments/' + department.code, 'PUT', { name: department.name })) {
                        setDepartment({ code: '', name: '' });
                        setEditing(false);
                      }
                    }}>
                      <label>
                        Identificador
                        <input
                          value={department.code}
                          onChange={e => setDepartment({ ...department, code: e.target.value })}
                          pattern="[a-z][a-z0-9\\-]{0,31}"
                          readOnly={editing}
                          required
                        />
                      </label>
                      <label>
                        Nome do departamento
                        <input
                          value={department.name}
                          onChange={e => setDepartment({ ...department, name: e.target.value })}
                          maxLength={80}
                          required
                        />
                      </label>
                      <div className="ops-actions">
                        <button className="primary" disabled={busy}>Salvar departamento</button>
                        {editing && (
                          <>
                            <button type="button" className="text-button" disabled={busy} onClick={() => { setDepartment({ code: '', name: '' }); setEditing(false); }}>
                              Cancelar edição
                            </button>
                            <button type="button" className="text-button" disabled={busy} onClick={async () => {
                              if (await change('departments/' + department.code, 'DELETE')) {
                                setDepartment({ code: '', name: '' });
                                setEditing(false);
                              }
                            }}>
                              Excluir departamento
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                  </details>

                  <details className="ops-row">
                    <summary>Filas e integrantes</summary>
                    <ul className="ops-list">
                      {data.catalog.queues.map(q => (
                        <li key={q.number}>
                          <span>{q.number} · {data.catalog.departments.find(d => d.code === q.department)?.name}</span>
                          <button className="text-button" onClick={() => { setQueue(q); setEditingQueue(true); }}>
                            Editar fila {q.number}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <form className="ops-form" onSubmit={async e => {
                      e.preventDefault();
                      const { number, ...body } = queue;
                      if (await change('queues/' + number, 'PUT', body)) {
                        setQueue(defaultQueue);
                        setEditingQueue(false);
                      }
                    }}>
                      <label>
                        Número da fila
                        <input
                          value={queue.number}
                          onChange={e => setQueue({ ...queue, number: e.target.value })}
                          pattern="3[0-9]{2}"
                          inputMode="numeric"
                          readOnly={editingQueue}
                          required
                        />
                      </label>
                      <label>
                        Departamento
                        <select required value={queue.department} onChange={e => setQueue({ ...queue, department: e.target.value })}>
                          <option value="">Selecione</option>
                          {data.catalog.departments.map(d => (
                            <option key={d.code} value={d.code}>{d.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Distribuição
                        <select value={queue.strategy} onChange={e => setQueue({ ...queue, strategy: e.target.value })}>
                          <option value="ringall">Tocar todos da equipe ao mesmo tempo</option>
                          <option value="rrmemory">Revezamento equilibrado (quem atendeu menos)</option>
                          <option value="fewestcalls">Menos chamadas atendidas no dia</option>
                        </select>
                      </label>
                      <label>
                        Toque por tentativa (s)
                        <input type="number" min={3} max={30} required value={queue.ring_seconds} onChange={e => setQueue({ ...queue, ring_seconds: Number(e.target.value) })} />
                      </label>
                      <label>
                        Espera máxima (s)
                        <input type="number" min={queue.ring_seconds} max={180} required value={queue.wait_seconds} onChange={e => setQueue({ ...queue, wait_seconds: Number(e.target.value) })} />
                      </label>
                      <label>
                        Se ninguém atender, encaminhar para
                        <select value={queue.fallback} onChange={e => setQueue({ ...queue, fallback: e.target.value })}>
                          <option value="">Encerrar chamada</option>
                          {ramais.map(n => <option key={n}>{n}</option>)}
                        </select>
                      </label>
                      <div className="ops-actions">
                        <button className="primary" disabled={busy}>Salvar fila</button>
                        {editingQueue && (
                          <>
                            <button type="button" className="text-button" onClick={() => { setQueue(defaultQueue); setEditingQueue(false); }}>
                              Cancelar edição
                            </button>
                            <button type="button" className="text-button" disabled={busy} onClick={async () => {
                              if (await change('queues/' + queue.number, 'DELETE')) {
                                setQueue(defaultQueue);
                                setEditingQueue(false);
                              }
                            }}>
                              Excluir fila
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                    {editingQueue && (
                      <div className="ops-row">
                        <h3>Integrantes da fila {queue.number}</h3>
                        <ul className="ops-list">
                          {ramais.map(n => {
                            const assigned = data.catalog.members.some(m => m.queue === queue.number && m.extension === n);
                            return (
                              <li key={n}>
                                <span>Ramal {n}</span>
                                <button className="text-button" disabled={busy} onClick={() => void change(`queues/${queue.number}/members/${n}`, assigned ? 'DELETE' : 'PUT')}>
                                  {assigned ? 'Remover' : 'Adicionar'} {n}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </details>
                </div>
              )}

              {/* Módulo 2: Usuários & Ramais */}
              {activeSubTab === 'usuarios' && (
                <div className="admin-module-content">
                  <UsersManager departments={data.catalog.departments} ramais={ramais} />
                </div>
              )}

              {/* Módulo 3: Filas & Políticas */}
              {activeSubTab === 'filas' && (
                <div className="admin-module-content">
                  <QueuesManager
                    queues={data.catalog.queues}
                    departments={data.catalog.departments}
                    ramais={ramais}
                    busy={busy}
                    change={change}
                  />
                </div>
              )}

              {/* Módulo 4: Menus de Voz & URA */}
              {activeSubTab === 'ura' && (
                <div className="admin-module-content">
                  <IVRManager queues={data.catalog.queues} ramais={ramais} />
                </div>
              )}

              {/* Módulo 5: Gravações & LGPD */}
              {activeSubTab === 'gravacoes' && (
                <div className="admin-module-content">
                  <RecordingsManager />
                </div>
              )}

              {/* Módulo 6: Relatórios & SLA */}
              {activeSubTab === 'relatorios' && (
                <div className="admin-module-content">
                  <ReportsManager />
                </div>
              )}

              {/* Módulo 7: Linhas, DIDs & Custos */}
              {activeSubTab === 'linhas' && (
                <div className="admin-module-content">
                  <TrunksManager />
                </div>
              )}

              {/* Módulo 8: Inteligência de Voz & Análise de Sentimento */}
              {activeSubTab === 'inteligencia' && (
                <div className="admin-module-content">
                  <IntelligenceManager />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
