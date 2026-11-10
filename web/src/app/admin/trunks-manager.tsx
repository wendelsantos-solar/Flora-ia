'use client';

import { useState } from 'react';
import { Phone, Shield, AlertTriangle, Plus, Check, X, ArrowRight, DollarSign, Lock } from 'lucide-react';

type DID = {
  id: string;
  number: string;
  region: string;
  carrier: string;
  destination: string;
  channels: number;
  active: boolean;
};

const initialDIDs: DID[] = [
  { id: '1', number: '(11) 4004-9200', region: 'São Paulo - SP', carrier: 'Tronco SIP Primário', destination: 'URA Principal', channels: 30, active: true },
  { id: '2', number: '0800 720 0011', region: 'Nacional Gratuito', carrier: 'Embratel / Claro', destination: 'Fila 302 · Suporte Técnico', channels: 60, active: true },
  { id: '3', number: '(21) 3500-1122', region: 'Rio de Janeiro - RJ', carrier: 'Tronco SIP Secundário', destination: 'Fila 301 · Comercial & Vendas', channels: 15, active: true },
];

export function TrunksManager() {
  const [dids, setDids] = useState<DID[]>(initialDIDs);
  const [dailyCap, setDailyCap] = useState(250);
  const [spentToday, setSpentToday] = useState(38.40);
  const [blockDDI, setBlockDDI] = useState(true);
  const [blockPremium, setBlockPremium] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Form states
  const [formNumber, setFormNumber] = useState('');
  const [formRegion, setFormRegion] = useState('São Paulo - SP');
  const [formCarrier, setFormCarrier] = useState('Tronco SIP Primário');
  const [formDestination, setFormDestination] = useState('URA Principal');

  function openCreate() {
    setFormNumber('');
    setFormRegion('São Paulo - SP');
    setFormCarrier('Tronco SIP Primário');
    setFormDestination('URA Principal');
    setIsDrawerOpen(true);
  }

  function handleSaveDID(e: React.FormEvent) {
    e.preventDefault();
    if (!formNumber.trim()) return;

    const newDID: DID = {
      id: String(Date.now()),
      number: formNumber,
      region: formRegion,
      carrier: formCarrier,
      destination: formDestination,
      channels: 30,
      active: true
    };

    setDids([...dids, newDID]);
    setIsDrawerOpen(false);
    setFeedback(`Linha ${formNumber} cadastrada e roteada para ${formDestination}.`);
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleSaveSecurity(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(`Configurações antifraude e teto diário de R$ ${dailyCap.toFixed(2)} atualizados.`);
    setTimeout(() => setFeedback(null), 4000);
  }

  const spendPercentage = Math.min(100, Math.round((spentToday / dailyCap) * 100));

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Linhas Telefônicas (DIDs), Roteamento & Custos</h3>
          <p className="hint">Gerencie os números de telefone públicos da sua empresa, destinos de entrada e travas de segurança antifraude.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          <Plus size={16} aria-hidden /> Adicionar Linha Telefônica
        </button>
      </div>

      {feedback && (
        <div className="flora-success-banner" role="status">
          <Check size={16} aria-hidden />
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid de Custos e Travas Antifraude */}
      <div className="flora-antifraud-grid">
        <div className="flora-card cost-card">
          <div className="card-header-icon">
            <DollarSign size={20} />
            <strong>Controle de Gastos Diário em Telefonia</strong>
          </div>
          <p className="hint">Limite orçamentário configurado para proteger sua empresa contra picos inesperados de tráfego.</p>

          <div className="spend-meter">
            <div className="meter-labels">
              <span>Consumido hoje: <strong className="tabular-num">R$ {spentToday.toFixed(2)}</strong></span>
              <span>Teto diário: <strong className="tabular-num">R$ {dailyCap.toFixed(2)}</strong> ({spendPercentage}%)</span>
            </div>
            <div className="meter-track">
              <div className="meter-bar" style={{ width: `${spendPercentage}%` }} />
            </div>
          </div>

          <form onSubmit={handleSaveSecurity} className="cap-form">
            <label htmlFor="daily-cap-input">Ajustar teto diário (R$):</label>
            <input
              id="daily-cap-input"
              type="number"
              min={50}
              max={10000}
              step={10}
              value={dailyCap}
              onChange={e => setDailyCap(Number(e.target.value))}
            />
            <button type="submit" className="secondary">Salvar Teto</button>
          </form>
        </div>

        <div className="flora-card security-card">
          <div className="card-header-icon">
            <Shield size={20} />
            <strong>Proteção Ativa Antifraude</strong>
          </div>
          <p className="hint">Regras automatizadas para prevenir sequestro de rota e desvios de tráfego.</p>

          <div className="security-toggles">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={blockDDI}
                onChange={e => setBlockDDI(e.target.checked)}
              />
              <div>
                <strong>Bloquear chamadas para o exterior (DDI)</strong>
                <span className="secondary-text">Impede discagens internacionais não autorizadas.</span>
              </div>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={blockPremium}
                onChange={e => setBlockPremium(e.target.checked)}
              />
              <div>
                <strong>Bloquear numeração de tarifa especial (0900/0300)</strong>
                <span className="secondary-text">Protege contra prefixos cobrados com tarifa abusiva.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Tabela de Linhas Telefônicas / DIDs */}
      <div className="table-wrap history-table">
        <div className="table-caption">Inventário de Números Públicos (DIDs)</div>
        <table>
          <thead>
            <tr>
              <th>Número Telefônico</th>
              <th>Localidade</th>
              <th>Operadora / Tronco</th>
              <th>Roteamento de Entrada</th>
              <th>Capacidade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dids.map(did => (
              <tr key={did.id}>
                <td>
                  <strong className="did-number">{did.number}</strong>
                </td>
                <td>{did.region}</td>
                <td>
                  <span className="carrier-badge">{did.carrier}</span>
                </td>
                <td>
                  <span className="flora-route-fallback">
                    <ArrowRight size={13} aria-hidden /> {did.destination}
                  </span>
                </td>
                <td className="tabular-num">{did.channels} canais</td>
                <td>
                  <span className={`availability ${did.active ? 'online' : ''}`}>
                    {did.active ? 'Ativo e Roteado' : 'Inativo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer de Adicionar Linha */}
      {isDrawerOpen && (
        <div className="flora-modal-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="flora-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>Adicionar Nova Linha Telefônica (DID)</h4>
              <button type="button" className="close-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDID} className="drawer-form">
              <label>
                Número de telefone com DDD
                <input
                  type="text"
                  required
                  placeholder="Ex: (11) 3200-8800 ou 0800 800 1234"
                  value={formNumber}
                  onChange={e => setFormNumber(e.target.value)}
                />
              </label>

              <label>
                Localidade / Cobertura
                <input
                  type="text"
                  required
                  placeholder="Ex: São Paulo - SP ou Nacional"
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value)}
                />
              </label>

              <label>
                Operadora de conectividade
                <select value={formCarrier} onChange={e => setFormCarrier(e.target.value)}>
                  <option value="Tronco SIP Primário">Tronco SIP Primário</option>
                  <option value="Tronco SIP Secundário">Tronco SIP Secundário</option>
                  <option value="Embratel / Claro">Embratel / Claro</option>
                  <option value="Vivo Empresas">Vivo Empresas</option>
                </select>
              </label>

              <label>
                Destino das chamadas recebidas neste número
                <select value={formDestination} onChange={e => setFormDestination(e.target.value)}>
                  <option value="URA Principal">URA Principal (Autoatendimento)</option>
                  <option value="Fila 301 · Comercial & Vendas">Fila 301 · Comercial & Vendas</option>
                  <option value="Fila 302 · Suporte Técnico">Fila 302 · Suporte Técnico</option>
                  <option value="Ramal 201 · Recepção">Ramal 201 · Recepção</option>
                </select>
              </label>

              <div className="drawer-footer">
                <button type="button" className="secondary" onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary">
                  Cadastrar Linha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
