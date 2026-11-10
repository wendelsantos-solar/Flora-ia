'use client';

import {useEffect,useState} from 'react';

type Member={state:string};
type Live={fresh:boolean;connected:string[]|null;calls:{linked_id:string;source:string;destination:string}[]|null;queues:Record<string,{waiting:number;members:Record<string,Member>}>};
type Metrics={since:string;journal_healthy:boolean;totals:{answered:number;abandoned:number;average_wait_seconds:number|null};live:Live};
const rank:Record<string,number>={disconnected:0,unavailable:1,paused:2,available:3,busy:4};
const stateLabel:Record<string,string>={disconnected:'Desconectado',unavailable:'Fora da distribuição',paused:'Pausado',available:'Disponível para fila',busy:'Em atendimento'};

export function Supervision({queues}:{queues:{number:string;department:string}[]}){
 const [data,setData]=useState<Metrics|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  const fetchMetrics=async()=>{
   try{
    const r=await fetch('/api/v1/operations/metrics',{cache:'no-store',signal:controller.signal});
    if(!r.ok)throw new Error();
    const value:Metrics=await r.json();
    if(!controller.signal.aborted){setData(value);setFailed(false);}
   }catch{if(!controller.signal.aborted)setFailed(true);}
  };
  void fetchMetrics();
  const timer=setInterval(()=>void fetchMetrics(),3000);
  return()=>{controller.abort();clearInterval(timer);};
 },[]);
 if(!data)return <p className="empty-copy">{failed?'Não foi possível consultar a supervisão.':'Carregando supervisão…'}</p>;
 const live=!failed&&data.live.fresh?data.live:null;
 const agents=new Map<string,string>((live?.connected||[]).map(n=>[n,'unavailable']));
 for(const queue of Object.values(live?.queues||{})){
  for(const [n,m] of Object.entries(queue.members)){
   if((rank[m.state]??0)>(rank[agents.get(n)||'']??-1))agents.set(n,m.state);
  }
 }
 const counts=Object.values(live?.queues||{});
 const stats=[
  ['Atendentes conectados',live?.connected?.length],
  ['Prontos para atender',[...agents.values()].filter(s=>s==='available').length],
  ['Em atendimento',[...agents.values()].filter(s=>s==='busy').length],
  ['Em pausa',[...agents.values()].filter(s=>s==='paused').length],
  ['Chamadas em andamento',live?.calls?.length],
  ['Clientes aguardando em filas',counts.reduce((n,q)=>n+q.waiting,0)],
  ['Equipes ativas',counts.length],
 ] as const;
 return <div>
  {!live&&<p className="hint">Central temporariamente indisponível. As informações ao vivo serão atualizadas automaticamente assim que restabelecer.</p>}
  <dl className="ops-metrics">{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{live?value??'—':'—'}</dd></div>)}</dl>
  <div className="ops-row"><h3>Últimas 24 horas</h3>
   {!data.journal_healthy||failed?<p>Histórico recente temporariamente indisponível.</p>:<dl className="ops-metrics">
    <div><dt>Atendidas pela fila</dt><dd>{data.totals.answered}</dd></div>
    <div><dt>Clientes que desligaram na espera</dt><dd>{data.totals.abandoned}</dd></div>
    <div><dt>Tempo médio até atender</dt><dd>{data.totals.average_wait_seconds===null?'—':`${Math.round(data.totals.average_wait_seconds)} s`}</dd></div>
   </dl>}
  </div>
  {live&&<>
   <div className="ops-row"><h3>Atendentes</h3>{agents.size===0?<p>Nenhum ramal alcançável.</p>:<ul className="ops-list">{[...agents.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([n,state])=><li key={n}><span>Ramal {n}</span><span>{stateLabel[state]}</span></li>)}</ul>}</div>
   <div className="ops-row"><h3>Chamadas em andamento</h3>{!live.calls?.length?<p>Nenhuma chamada em andamento.</p>:<ul className="ops-list">{live.calls.map(c=><li key={c.linked_id}><span>{c.source||'Origem interna'} → {c.destination||'Destino interno'}</span><span>{queues.find(q=>q.number===c.destination)?.department||'Ligação interna'}</span></li>)}</ul>}</div>
  </>}
 </div>;
}
