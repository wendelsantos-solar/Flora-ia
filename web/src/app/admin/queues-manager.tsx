'use client';

import { useState } from 'react';
import { Plus, X, Layers, Users, Clock, ArrowRight, ShieldAlert, Check } from 'lucide-react';
import type { Queue } from '../operations';

type Department = { code: string; name: string };

const strategyDescriptions: Record<string, string> = {
  rrmemory: 'Revezamento equilibrado (prioriza quem atendeu menos recentemente)',
  ringall: 'Tocar simultaneamente em todos os ramais disponíveis',
  fewestcalls: 'Priorizar atendente com menor número de chamadas no dia'
};

export function QueuesManager({
  queues,
  departments,
  ramais,
  busy,
  change
}: {
  queues: Queue[];
  departments: Department[];
  ramais: string[];
  busy: boolean;
  change: (path: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [number, setNumber] = useState('301');
  const [department, setDepartment] = useState(departments[0]?.code || '');
  const [strategy, setStrategy] = useState('rrmemory');
  const [ringSeconds, setRingSeconds] = useState(12);
  const [waitSeconds, setWaitSeconds] = useState(45);
  const [wrapUpSeconds, setWrapUpSeconds] = useState(30);
  const [fallback, setFallback] = useState('');

  function openCreate() {
    setEditingQueue(null);
    setNumber(String(300 + queues.length + 1));
    setDepartment(departments[0]?.code || '');
    setStrategy('rrmemory');
    setRingSeconds(12);
    setWaitSeconds(45);
    setWrapUpSeconds(30);
    setFallback('');
    setIsDrawerOpen(true);
  }

  function openEdit(q: Queue) {
    setEditingQueue(q);
    setNumber(q.number);
    setDepartment(q.department);
    setStrategy(q.strategy);
    setRingSeconds(q.ring_seconds);
    setWaitSeconds(q.wait_seconds);
    setWrapUpSeconds(30); // Enterprise wrap-up setting
    setFallback(q.fallback || '');
    setIsDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      department,
      strategy,
      ring_seconds: ringSeconds,
      wait_seconds: waitSeconds,
      fallback
    };

    const success = await change(`queues/${number}`, 'PUT', payload);
    if (success) {
      setFeedback(`Fila ${number} salva e sincronizada com sucesso.`);
      setIsDrawerOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  async function handleDelete(queueNumber: string) {
    if (confirm(`Confirma a exclusão da fila ${queueNumber}?`)) {
      const success = await change(`queues/${queueNumber}`, 'DELETE');
      if (success) {
        setFeedback(`Fila ${queueNumber} excluída.`);
        setIsDrawerOpen(false);
        setTimeout(() => setFeedback(null), 4000);
      }
    }
  }

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Filas de Atendimento & Políticas de Roteamento</h3>
          <p className="hint">Configure como as ligações entrantes são distribuídas entre os operadores, tempos de pausa e transbordo.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate} disabled={busy}>
          <Plus size={16} aria-hidden /> Nova Fila
        </button>
      </div>

      {feedback && (
        <div className="flora-success-banner" role="status">
          <Check size={16} aria-hidden />
          <span>{feedback}</span>
        </div>
      )}

      <div className="table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>Fila</th>
              <th>Departamento</th>
              <th>Estratégia de Distribuição</th>
              <th>Toque / Espera</th>
              <th>Pós-atendimento</th>
              <th>Transbordo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {queues.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">Nenhuma fila configurada na central.</td>
              </tr>
            ) : (
              queues.map(q => {
                const deptName = departments.find(d => d.code === q.department)?.name || q.department;
                return (
                  <tr key={q.number}>
                    <td>
                      <span className="flora-ext-badge queue-badge">{q.number}</span>
                    </td>
                    <td><strong>{deptName}</strong></td>
                    <td>
                      <span className="flora-strategy-label">
                        {strategyDescriptions[q.strategy] || q.strategy}
                      </span>
                    </td>
                    <td>
                      <span className="tabular-num">{q.ring_seconds}s</span> por toque / <span className="tabular-num">{q.wait_seconds}s</span> máx
                    </td>
                    <td>
                      <span className="flora-tag-pill">30s pausa pós-chamada</span>
                    </td>
                    <td>
                      {q.fallback ? (
                        <span className="flora-route-fallback">
                          <ArrowRight size={13} aria-hidden /> Ramal {q.fallback}
                        </span>
                      ) : (
                        <span className="secondary-text">Encerrar com aviso</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => openEdit(q)}
                        disabled={busy}
                      >
                        Configurar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de Configuração da Fila */}
      {isDrawerOpen && (
        <div className="flora-modal-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="flora-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>{editingQueue ? `Configuração da Fila ${editingQueue.number}` : 'Criar Nova Fila de Atendimento'}</h4>
              <button type="button" className="close-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="drawer-form">
              <div className="form-row-2">
                <label>
                  Número da fila
                  <input
                    type="text"
                    required
                    pattern="3[0-9]{2}"
                    maxLength={3}
                    placeholder="Ex: 301"
                    readOnly={Boolean(editingQueue)}
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                  />
                </label>

                <label>
                  Departamento vinculado
                  <select required value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="">Selecione o departamento</option>
                    {departments.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Estratégia de distribuição
                <select value={strategy} onChange={e => setStrategy(e.target.value)}>
                  <option value="rrmemory">Revezamento equilibrado (quem atendeu menos recentemente)</option>
                  <option value="ringall">Tocar em todos os atendentes simultaneamente</option>
                  <option value="fewestcalls">Menor volume de chamadas atendidas no dia</option>
                </select>
              </label>

              <div className="form-row-2">
                <label>
                  Toque por operador (segundos)
                  <input
                    type="number"
                    min={3}
                    max={30}
                    required
                    value={ringSeconds}
                    onChange={e => setRingSeconds(Number(e.target.value))}
                  />
                  <span className="field-hint">Tempo antes de tentar o próximo operador.</span>
                </label>

                <label>
                  Espera máxima do cliente (segundos)
                  <input
                    type="number"
                    min={ringSeconds}
                    max={180}
                    required
                    value={waitSeconds}
                    onChange={e => setWaitSeconds(Number(e.target.value))}
                  />
                  <span className="field-hint">Tempo máximo antes de disparar o transbordo.</span>
                </label>
              </div>

              <div className="flora-slider-group">
                <div className="slider-label">
                  <label htmlFor="wrap-up-input">Tempo de pós-atendimento (Wrap-up / ACW)</label>
                  <span className="tabular-num strong">{wrapUpSeconds} segundos</span>
                </div>
                <input
                  id="wrap-up-input"
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  value={wrapUpSeconds}
                  onChange={e => setWrapUpSeconds(Number(e.target.value))}
                />
                <p className="field-hint">
                  Janela em que o atendente não recebe novas chamadas da fila para preencher anotações e atualizar o CRM.
                </p>
              </div>

              <label>
                Transbordo de contingência (se ninguém atender)
                <select value={fallback} onChange={e => setFallback(e.target.value)}>
                  <option value="">Encerrar com mensagem amigável</option>
                  {ramais.map(n => (
                    <option key={n} value={n}>Desviar para Ramal {n}</option>
                  ))}
                </select>
              </label>

              <div className="drawer-footer">
                {editingQueue && (
                  <button
                    type="button"
                    className="danger text-button"
                    onClick={() => handleDelete(editingQueue.number)}
                    disabled={busy}
                  >
                    Excluir Fila
                  </button>
                )}
                <button type="button" className="secondary" onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={busy}>
                  Salvar Política da Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
