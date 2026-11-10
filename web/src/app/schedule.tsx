'use client';

import {useState} from 'react';

export type Schedule={department:string;timezone:string;days:number[];opens_at:string;closes_at:string;closed_destination:string};
const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const defaults=(department:string):Schedule=>({department,timezone:'America/Sao_Paulo',days:[1,2,3,4,5],opens_at:'08:00',closes_at:'18:00',closed_destination:''});
export function ScheduleForm({departments,schedules,ramais,busy,change}:{departments:{code:string;name:string}[];schedules:Schedule[];ramais:string[];busy:boolean;change:(path:string,method:string,body?:unknown)=>Promise<boolean>}){
 const [schedule,set]=useState<Schedule>(defaults(''));
 const existing=schedules.find(s=>s.department===schedule.department);
 return <details className="ops-row">
  <summary>Horários de atendimento</summary>
  {schedules.length===0?<p className="hint">Sem restrição de horário configurada.</p>:<ul className="ops-list">{schedules.map(s=><li key={s.department}><span>{departments.find(d=>d.code===s.department)?.name||s.department}</span><span>{s.days.map(d=>weekdays[d]).join(', ')} · {s.opens_at}–{s.closes_at}</span></li>)}</ul>}
  <form className="ops-form" onSubmit={async e=>{
   e.preventDefault();
   const {department,...body}=schedule;
   await change(`departments/${department}/schedule`,'PUT',body);
  }}>
   <label>Departamento do horário<select value={schedule.department} required onChange={e=>set(schedules.find(s=>s.department===e.target.value)||defaults(e.target.value))}><option value="">Selecione</option>{departments.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>
   <label>Fuso horário<input value={schedule.timezone} onChange={e=>set({...schedule,timezone:e.target.value})} required maxLength={64}/></label>
   <label>Abertura<input type="time" value={schedule.opens_at} onChange={e=>set({...schedule,opens_at:e.target.value})} required/></label>
   <label>Fechamento<input type="time" value={schedule.closes_at} onChange={e=>set({...schedule,closes_at:e.target.value})} required/></label>
   <label>Quando fechado<select value={schedule.closed_destination} onChange={e=>set({...schedule,closed_destination:e.target.value})}><option value="">Encerrar chamada</option>{ramais.map(n=><option key={n} value={n}>Encaminhar para Ramal {n}</option>)}</select></label>
   <fieldset className="schedule-days"><legend>Dias de atendimento</legend>{weekdays.map((label,i)=><label key={label}><input type="checkbox" checked={schedule.days.includes(i)} onChange={e=>set({...schedule,days:e.target.checked?[...schedule.days,i]:schedule.days.filter(d=>d!==i)})}/>{label}</label>)}</fieldset>
   <p className="schedule-days hint">Defina o período em que a sua equipe estará disponível para receber ligações.</p>
   <div className="ops-actions"><button className="primary" disabled={busy||!schedule.department||!schedule.days.length||schedule.opens_at>=schedule.closes_at}>Salvar horário</button>{existing&&<button className="text-button" type="button" disabled={busy} onClick={async()=>{if(await change(`departments/${schedule.department}/schedule`,'DELETE'))set(defaults(schedule.department));}}>Remover horário</button>}</div>
  </form>
 </details>;
}
