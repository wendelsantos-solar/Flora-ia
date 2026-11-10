'use client';

import {useEffect,useState,type FormEvent} from 'react';

type Policy = {
  enabled:boolean; trunk_enabled:boolean; allowed:string[]; blocked:string[]; lines:string[];
  tenant_limit:number; trunk_limit:number; line_limit:number; attempts:number; seconds:number; inbound_did:string; inbound_target:string;
};
type Usage = {direction:string; decision:string; result:string; calls:number; seconds:number};
type Lab = {policy:Policy; trunk:{inbound_did:string; transport:string}; usage:Usage[]};
const limits = [
  ['tenant_limit','Chamadas simultâneas da empresa',10],
  ['trunk_limit','Chamadas simultâneas do tronco',10],
  ['line_limit','Chamadas simultâneas por ramal',10],
  ['attempts','Tentativas por minuto e direção',60],
  ['seconds','Duração máxima (s)',120],
] as const;

export function SIPLab({extensions,queues}:{extensions:string[];queues:string[]}) {
  const [data,setData]=useState<Lab|null>(null);
  const [allowed,setAllowed]=useState('');
  const [blocked,setBlocked]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  async function load(signal?:AbortSignal) {
    const response=await fetch('/api/v1/sip-lab',{cache:'no-store',signal});
    if(response.status===404)return;
    if(!response.ok)throw new Error('Não foi possível consultar o tronco de laboratório.');
    const next:Lab=await response.json();
    if(signal?.aborted)return;
    setData(next);
    setAllowed(next.policy.allowed.join(', '));
    setBlocked(next.policy.blocked.join(', '));
  }

  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal).catch(error=>{
      if(!controller.signal.aborted)setMessage(error.message);
    });
    return ()=>controller.abort();
  },[]);

  if(!data)return message?<p role="alert" className="error">{message}</p>:null;
  const policy=data.policy;
  function edit(update:Partial<Policy>) {
    setData(current=>current&&({...current,policy:{...current.policy,...update}}));
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const numbers=(value:string)=>value.split(',').map(s=>s.trim()).filter(Boolean);
      const response=await fetch('/api/v1/sip-lab',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...policy,allowed:numbers(allowed),blocked:numbers(blocked)})});
      if(!response.ok)throw new Error(response.status===400?'Revise os números sintéticos, ramais e limites.':'Não foi possível salvar a política.');
      await load();
      setMessage('Política de laboratório salva.');
    }catch(error) {
      setMessage((error as Error).message);
    }finally {
      setBusy(false);
    }
  }

  return <details className="ops-row">
    <summary>Linhas telefônicas externas</summary>
    <p>Conexões com operadoras e número de telefone principal {data.trunk.inbound_did}.</p>
    <form className="ops-form" onSubmit={save}>
      <label>Regras de ligações externas<select value={String(policy.enabled)} onChange={e=>edit({enabled:e.target.value==='true'})}><option value="false">Bloqueadas</option><option value="true">Liberadas conforme as regras</option></select></label>
      <label>Status da linha externa<select value={String(policy.trunk_enabled)} onChange={e=>edit({trunk_enabled:e.target.value==='true'})}><option value="false">Desativada</option><option value="true">Ativa</option></select></label>
      <label>Números de telefone permitidos (separados por vírgulas)<input value={allowed} onChange={e=>setAllowed(e.target.value)} maxLength={239}/></label>
      <label>Números de telefone bloqueados (separados por vírgulas)<input value={blocked} onChange={e=>setBlocked(e.target.value)} maxLength={239}/></label>
      <label>Ramais autorizados a fazer ligações externas<select multiple value={policy.lines} onChange={e=>edit({lines:Array.from(e.target.selectedOptions,x=>x.value)})}>{extensions.filter(n=>!n.endsWith('3')).map(n=><option key={n}>{n}</option>)}</select></label>
      <label>Número de telefone da empresa<input required pattern="880[0-9]{7}" inputMode="numeric" value={policy.inbound_did} onChange={e=>edit({inbound_did:e.target.value})}/></label>
      <label>Para onde direcionar quem ligar<select value={policy.inbound_target} onChange={e=>edit({inbound_target:e.target.value})}><option value="">Sem rota definida</option>{extensions.map(n=><option key={n} value={n}>Ramal {n}</option>)}{queues.map(n=><option key={n} value={n}>Fila {n}</option>)}</select></label>
      {limits.map(([key,label,max])=><label key={key}>{label}<input required type="number" min={1} max={max} value={policy[key]} onChange={e=>edit({[key]:Number(e.target.value)})}/></label>)}
      <button className="primary" disabled={busy}>Salvar configurações de linhas</button>
    </form>
    {message&&<p role="status">{message}</p>}
    <h3>Uso das linhas nas últimas 24 horas</h3>
    {data.usage.length===0?<p className="empty-copy">Nenhuma ligação externa registrada hoje.</p>:<ul className="ops-list">{data.usage.map(row=>
      <li key={row.direction+row.decision+row.result}><span>{row.direction==='in'?'Recebida':'Realizada'} · {row.decision} {row.result}</span><span>{row.calls} chamadas · {row.seconds} s de conversa</span></li>
    )}</ul>}
  </details>;
}
