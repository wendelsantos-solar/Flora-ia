'use client';

import { useState } from 'react';
import { Volume2, Play, Pause, Plus, X, ArrowDown, Settings, Upload, Check, GitFork, Clock } from 'lucide-react';

type IVROption = {
  digit: string;
  label: string;
  destinationType: 'queue' | 'extension' | 'voicemail' | 'submenu';
  destinationValue: string;
  description: string;
};

const initialOptions: IVROption[] = [
  { digit: '1', label: 'Comercial & Vendas', destinationType: 'queue', destinationValue: '301', description: 'Encaminha para a equipe comercial' },
  { digit: '2', label: 'Suporte Técnico', destinationType: 'queue', destinationValue: '302', description: 'Encaminha para a fila de suporte N1' },
  { digit: '3', label: 'Financeiro & Cobrança', destinationType: 'extension', destinationValue: '204', description: 'Encaminha diretamente para o setor fiscal' },
  { digit: '9', label: 'Falar com a Recepção', destinationType: 'extension', destinationValue: '201', description: 'Transfere para o ramal da operadora central' },
];

export function IVRManager({ queues, ramais }: { queues: { number: string; department: string }[]; ramais: string[] }) {
  const [options, setOptions] = useState<IVROption[]>(initialOptions);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingDigit, setEditingDigit] = useState<IVROption | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [digit, setDigit] = useState('4');
  const [label, setLabel] = useState('');
  const [destType, setDestType] = useState<'queue' | 'extension' | 'voicemail'>('queue');
  const [destValue, setDestValue] = useState(queues[0]?.number || '301');

  function togglePlay() {
    setIsPlaying(!isPlaying);
  }

  function openEdit(opt: IVROption) {
    setEditingDigit(opt);
    setDigit(opt.digit);
    setLabel(opt.label);
    setDestType(opt.destinationType === 'submenu' ? 'queue' : opt.destinationType);
    setDestValue(opt.destinationValue);
    setIsDrawerOpen(true);
  }

  function openCreate() {
    setEditingDigit(null);
    setDigit(String(options.length + 1));
    setLabel('');
    setDestType('queue');
    setDestValue(queues[0]?.number || '301');
    setIsDrawerOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    if (editingDigit) {
      setOptions(options.map(o => o.digit === editingDigit.digit ? {
        ...o,
        digit,
        label,
        destinationType: destType,
        destinationValue: destValue,
        description: `Encaminha para ${destType === 'queue' ? 'Fila ' + destValue : 'Ramal ' + destValue}`
      } : o));
      setFeedback(`Opção ${digit} atualizada no menu da URA.`);
    } else {
      setOptions([...options, {
        digit,
        label,
        destinationType: destType,
        destinationValue: destValue,
        description: `Encaminha para ${destType === 'queue' ? 'Fila ' + destValue : 'Ramal ' + destValue}`
      }]);
      setFeedback(`Opção ${digit} adicionada com sucesso.`);
    }

    setIsDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleDelete(digitToDelete: string) {
    setOptions(options.filter(o => o.digit !== digitToDelete));
    setFeedback(`Opção ${digitToDelete} removida do menu.`);
    setIsDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>URA & Menus de Voz Interativos</h3>
          <p className="hint">Construa o fluxo de autoatendimento das chamadas entrantes, configure saudações e destinos por dígito.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary" onClick={() => alert('Simulador de discagem disparado: ligando para a URA institucional...')}>
            <Volume2 size={16} aria-hidden /> Testar no Navegador
          </button>
          <button type="button" className="primary" onClick={openCreate}>
            <Plus size={16} aria-hidden /> Nova Opção de Menu
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flora-success-banner" role="status">
          <Check size={16} aria-hidden />
          <span>{feedback}</span>
        </div>
      )}

      {/* Visual Tree Display */}
      <div className="flora-ivr-tree-container">
        {/* Raiz: Saudação Inicial */}
        <div className="flora-ivr-node root-node">
          <div className="node-badge">Entrada da Linha Principal · (11) 4004-9200</div>
          <div className="node-content">
            <div className="node-header">
              <strong>Saudação Institucional de Abertura</strong>
              <span className="flora-tag-pill">Áudio Ativo</span>
            </div>
            <p className="node-transcript">
              &ldquo;Olá! Você ligou para a Flora IA. Para assuntos comerciais ou novas contratações, digite 1. Para suporte ao cliente, digite 2. Para falar no financeiro, digite 3. Ou aguarde na linha para nossa recepção.&rdquo;
            </p>
            <div className="audio-player-mini">
              <button
                type="button"
                className={`player-btn ${isPlaying ? 'playing' : ''}`}
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar áudio de saudação' : 'Ouvir áudio de saudação'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <div className="waveform-bar">
                <span className={`bar-level ${isPlaying ? 'active-level' : ''}`} style={{ width: isPlaying ? '68%' : '0%' }} />
              </div>
              <span className="audio-duration tabular-num">{isPlaying ? '00:05' : '00:08'}</span>
              <button type="button" className="text-button" onClick={() => alert('Selecione um arquivo de áudio WAV (16-bit 8kHz ou 16kHz) para substituir a saudação.')}>
                <Upload size={13} aria-hidden /> Substituir áudio
              </button>
            </div>
          </div>
        </div>

        {/* Linha de ramificação */}
        <div className="tree-connector">
          <div className="stem-line" />
          <span className="stem-label">Roteamento por Dígito DTMF</span>
        </div>

        {/* Opções de Dígitos */}
        <div className="flora-ivr-branches">
          {options.map(opt => (
            <div key={opt.digit} className="flora-ivr-branch-card">
              <div className="branch-key">
                <span>Tecla</span>
                <strong>{opt.digit}</strong>
              </div>
              <div className="branch-details">
                <strong>{opt.label}</strong>
                <span className="destination-badge">
                  {opt.destinationType === 'queue' ? `Fila ${opt.destinationValue}` : `Ramal ${opt.destinationValue}`}
                </span>
                <p className="branch-desc">{opt.description}</p>
              </div>
              <button
                type="button"
                className="text-button edit-branch-btn"
                onClick={() => openEdit(opt)}
                aria-label={`Editar opção ${opt.digit}`}
              >
                <Settings size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>

        {/* Linha para Fallback */}
        <div className="tree-connector">
          <div className="stem-line" />
        </div>

        {/* Nó de Timeout / Sem Resposta */}
        <div className="flora-ivr-node fallback-node">
          <div className="node-badge">Regra de Tempo Esgotado (5 segundos sem dígito)</div>
          <div className="node-content">
            <div className="node-header">
              <strong>Transbordo Automático por Inatividade</strong>
              <span className="flora-tag-pill">Conveniência</span>
            </div>
            <p className="node-transcript">
              Se o cliente não discar nenhuma opção em até 5 segundos após a saudação, a chamada é repetida uma vez e, persistindo, é encaminhada diretamente para a <strong>Fila Geral (301)</strong> para não perder o contato.
            </p>
          </div>
        </div>
      </div>

      {/* Drawer de Edição / Criação da Opção */}
      {isDrawerOpen && (
        <div className="flora-modal-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="flora-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>{editingDigit ? `Editar Opção Dígito ${editingDigit.digit}` : 'Adicionar Nova Opção no Menu'}</h4>
              <button type="button" className="close-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="drawer-form">
              <div className="form-row-2">
                <label>
                  Dígito do teclado (0-9)
                  <input
                    type="text"
                    required
                    pattern="[0-9]"
                    maxLength={1}
                    value={digit}
                    onChange={e => setDigit(e.target.value)}
                  />
                </label>

                <label>
                  Identificação da opção
                  <input
                    type="text"
                    required
                    placeholder="Ex: Comercial & Vendas"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                  />
                </label>
              </div>

              <label>
                Tipo de destino
                <select
                  value={destType}
                  onChange={e => setDestType(e.target.value as 'queue' | 'extension' | 'voicemail')}
                >
                  <option value="queue">Fila de atendimento</option>
                  <option value="extension">Ramal individual</option>
                  <option value="voicemail">Caixa postal de recados</option>
                </select>
              </label>

              {destType === 'queue' ? (
                <label>
                  Fila de destino
                  <select value={destValue} onChange={e => setDestValue(e.target.value)}>
                    {queues.map(q => (
                      <option key={q.number} value={q.number}>Fila {q.number} ({q.department})</option>
                    ))}
                  </select>
                </label>
              ) : destType === 'extension' ? (
                <label>
                  Ramal de destino
                  <select value={destValue} onChange={e => setDestValue(e.target.value)}>
                    {ramais.map(r => (
                      <option key={r} value={r}>Ramal {r}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="drawer-footer">
                {editingDigit && (
                  <button
                    type="button"
                    className="danger text-button"
                    onClick={() => handleDelete(editingDigit.digit)}
                  >
                    Excluir Opção
                  </button>
                )}
                <button type="button" className="secondary" onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary">
                  Salvar Opção da URA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
