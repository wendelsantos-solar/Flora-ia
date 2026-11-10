'use client';

import { useState } from 'react';
import { Search, Plus, X, Check, Shield, UserCheck, KeyRound } from 'lucide-react';

export type UserItem = {
  id: string;
  name: string;
  email: string;
  extension: string;
  role: 'admin' | 'supervisor' | 'agent';
  department: string;
  active: boolean;
};

const initialUsers: UserItem[] = [
  { id: '1', name: 'Ana Fonseca', email: 'ana.fonseca@flora.com.br', extension: '201', role: 'admin', department: 'Geral & Diretoria', active: true },
  { id: '2', name: 'Bruno Mendes', email: 'bruno.mendes@flora.com.br', extension: '202', role: 'agent', department: 'Comercial & Vendas', active: true },
  { id: '3', name: 'Carla Nogueira', email: 'carla.nogueira@flora.com.br', extension: '203', role: 'supervisor', department: 'Suporte Técnico', active: true },
  { id: '4', name: 'Diego Ramos', email: 'diego.ramos@flora.com.br', extension: '204', role: 'agent', department: 'Comercial & Vendas', active: true },
  { id: '5', name: 'Eduarda Luz', email: 'eduarda.luz@flora.com.br', extension: '205', role: 'agent', department: 'Suporte Técnico', active: false },
  { id: '6', name: 'Fabio Castro', email: 'fabio.castro@flora.com.br', extension: '211', role: 'agent', department: 'Financeiro', active: true },
];

export function UsersManager({ departments, ramais }: { departments: { code: string; name: string }[]; ramais: string[] }) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formExtension, setFormExtension] = useState('206');
  const [formRole, setFormRole] = useState<'admin' | 'supervisor' | 'agent'>('agent');
  const [formDept, setFormDept] = useState(departments[0]?.name || 'Comercial');
  const [formRecord, setFormRecord] = useState(true);

  function openCreate() {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormExtension(String(200 + users.length + 1));
    setFormRole('agent');
    setFormDept(departments[0]?.name || 'Geral');
    setFormRecord(true);
    setIsDrawerOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormExtension(user.extension);
    setFormRole(user.role);
    setFormDept(user.department);
    setFormRecord(true);
    setIsDrawerOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? {
        ...u,
        name: formName,
        email: formEmail,
        extension: formExtension,
        role: formRole,
        department: formDept
      } : u));
      setFeedback(`Colaborador ${formName} atualizado com sucesso.`);
    } else {
      const newUser: UserItem = {
        id: String(Date.now()),
        name: formName,
        email: formEmail,
        extension: formExtension,
        role: formRole,
        department: formDept,
        active: true
      };
      setUsers([...users, newUser]);
      setFeedback(`Novo ramal ${formExtension} cadastrado para ${formName}.`);
    }

    setIsDrawerOpen(false);
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleGenerateToken(user: UserItem) {
    setFeedback(`Novo token de acesso gerado para o ramal ${user.extension}. Enviado ao e-mail ${user.email}.`);
    setTimeout(() => setFeedback(null), 4000);
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
                          user.email.toLowerCase().includes(search.toLowerCase()) ||
                          user.extension.includes(search);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesDept = deptFilter === 'all' || user.department.includes(deptFilter);
    return matchesSearch && matchesRole && matchesDept;
  });

  const roleLabels = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    agent: 'Atendente'
  };

  return (
    <div className="flora-admin-section">
      <div className="flora-admin-header">
        <div>
          <h3>Usuários & Ramais da Central</h3>
          <p className="hint">Cadastre novos operadores, configure permissões de supervisão e credenciais de ramal.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          <Plus size={16} aria-hidden /> Novo Colaborador
        </button>
      </div>

      {feedback && (
        <div className="flora-success-banner" role="status">
          <Check size={16} aria-hidden />
          <span>{feedback}</span>
        </div>
      )}

      <div className="flora-filter-bar">
        <div className="search-box">
          <Search size={15} aria-hidden />
          <input
            type="text"
            placeholder="Buscar por nome, ramal ou e-mail corporativo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-role" className="sr-only">Perfil de acesso</label>
          <select id="filter-role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">Todos os perfis</option>
            <option value="admin">Administradores</option>
            <option value="supervisor">Supervisores</option>
            <option value="agent">Atendentes</option>
          </select>

          <label htmlFor="filter-dept" className="sr-only">Departamento</label>
          <select id="filter-dept" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="all">Todos os departamentos</option>
            {departments.map(d => (
              <option key={d.code} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>Ramal</th>
              <th>Colaborador</th>
              <th>Perfil</th>
              <th>Departamento</th>
              <th>Linha SIP</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">Nenhum colaborador encontrado com os filtros selecionados.</td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <span className="flora-ext-badge">{user.extension}</span>
                  </td>
                  <td>
                    <strong>{user.name}</strong>
                    <div className="secondary-text">{user.email}</div>
                  </td>
                  <td>
                    <span className={`flora-role-tag role-${user.role}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td>{user.department}</td>
                  <td>
                    <span className={`availability ${user.active ? 'online' : ''}`}>
                      {user.active ? 'Disponível' : 'Desconectado'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => openEdit(user)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        title="Gerar novo token"
                        onClick={() => handleGenerateToken(user)}
                      >
                        <KeyRound size={14} aria-hidden /> Token
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer lateral de criação/edição */}
      {isDrawerOpen && (
        <div className="flora-modal-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="flora-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>{editingUser ? `Editar Ramal ${editingUser.extension}` : 'Cadastrar Novo Colaborador'}</h4>
              <button type="button" className="close-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Fechar gaveta">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="drawer-form">
              <label>
                Nome completo
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Silva"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </label>

              <label>
                E-mail corporativo
                <input
                  type="email"
                  required
                  placeholder="mariana@suaempresa.com.br"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                />
              </label>

              <div className="form-row-2">
                <label>
                  Número do ramal
                  <input
                    type="text"
                    required
                    pattern="[0-9]{3}"
                    maxLength={3}
                    value={formExtension}
                    onChange={e => setFormExtension(e.target.value)}
                  />
                </label>

                <label>
                  Perfil de acesso
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as 'admin' | 'supervisor' | 'agent')}
                  >
                    <option value="agent">Atendente</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>

              <label>
                Departamento vinculado
                <select value={formDept} onChange={e => setFormDept(e.target.value)}>
                  {departments.length === 0 ? (
                    <option value="Geral">Geral</option>
                  ) : (
                    departments.map(d => (
                      <option key={d.code} value={d.name}>{d.name}</option>
                    ))
                  )}
                </select>
              </label>

              <div className="flora-checkbox-card">
                <input
                  type="checkbox"
                  id="chk-record"
                  checked={formRecord}
                  onChange={e => setFormRecord(e.target.checked)}
                />
                <label htmlFor="chk-record">
                  <strong>Gravação obrigatória de chamadas</strong>
                  <span>Garante gravação automática de todas as chamadas deste ramal para auditoria LGPD.</span>
                </label>
              </div>

              <div className="drawer-footer">
                <button type="button" className="secondary" onClick={() => setIsDrawerOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary">
                  <UserCheck size={16} aria-hidden /> Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
