'use client';

import {Activity, BriefcaseBusiness, Clock3, LayoutDashboard, LogOut, Phone, Settings2, Sprout} from 'lucide-react';
import type {ReactNode} from 'react';

export type Area = 'visao-geral' | 'atendimento' | 'supervisao' | 'historico' | 'administracao' | 'configuracoes';
export type Identity = {extension:string; tenant_id:string; role:string};

const areas = [
  {id:'visao-geral', label:'Visão geral', icon:LayoutDashboard},
  {id:'atendimento', label:'Atendimento', icon:Phone},
  {id:'supervisao', label:'Supervisão', icon:Activity},
  {id:'historico', label:'Histórico', icon:Clock3},
  {id:'administracao', label:'Administração', icon:BriefcaseBusiness},
  {id:'configuracoes', label:'Configurações avançadas', icon:Settings2},
] as const;

export function availableAreas(identity:Identity|null, sipLab:boolean) {
  return areas.filter(({id}) => {
    if (!identity) return false;
    if (id === 'supervisao') return ['admin','supervisor'].includes(identity.role);
    if (id === 'administracao') return identity.role === 'admin';
    if (id === 'configuracoes') return identity.role === 'admin' && sipLab;
    return true;
  });
}

export function AppShell({identity, area, sipLab, logout, children}:{
  identity:Identity|null; area:Area; sipLab:boolean; logout:()=>void; children:ReactNode;
}) {
  const navigation = availableAreas(identity, sipLab);
  const title = navigation.find(item => item.id === area)?.label;
  const role = identity?.role === 'admin' ? 'Administrador' : identity?.role === 'supervisor' ? 'Supervisor' : 'Atendente';
  return <div className={`app-shell flora-shell${identity?' has-session':''}`}>
    <a href="#conteudo" className="skip-content" onClick={event=>{
      event.preventDefault();
      document.getElementById('conteudo')?.focus();
    }}>Pular para o conteúdo</a>
    <aside className="flora-rail">
      <a href="#visao-geral" className="flora-brand" aria-label="Flora IA — visão geral"><Sprout aria-hidden/><span>Flora <strong>IA</strong><small>Central de telefonia</small></span></a>
      {identity&&<>
        <div className="flora-account"><span className="flora-extension">{identity.extension}</span><div><strong>Ramal {identity.extension}</strong><small>{role}</small></div></div>
        <nav aria-label="Áreas da central">{navigation.map(({id,label,icon:Icon})=>
          <a href={`#${id}`} key={id} aria-current={area===id?'page':undefined}><Icon size={18} aria-hidden/>{label}</a>
        )}</nav>
      </>}
    </aside>
    <div className="flora-workspace">
      <header className="flora-topbar"><span>{title??'Central de telefonia'}</span><div><span className="flora-environment">Ambiente de desenvolvimento</span>{identity&&<button className="text-button" onClick={logout}><LogOut size={16} aria-hidden/> Sair</button>}</div></header>
      {children}
    </div>
  </div>;
}
