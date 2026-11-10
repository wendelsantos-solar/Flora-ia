'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Check,Headphones,Mic,MicOff,Phone as PhoneIcon,PhoneIncoming,PhoneOff,RefreshCw} from 'lucide-react';
import type {Phone,PhoneState,AudioHealth,CallControls} from '../lib/phone';
import {CallDetails,HistoryFilterForm,emptyFilters,outcomeLabels,type HistoryFilters} from './history';
import {OperationsPanel,type Queue} from './operations';
import {AppShell,availableAreas,type Area,type Identity} from './app-shell';
import {audioErrorMessage} from '../lib/audio-health';
type Extension={id:string;number:string;registered:boolean};
type Call={id:string;source:string;destination:string;state:string;started_at:string;answered_at:string|null;ended_at:string|null;outcome?:string;department?:string;agent?:string;wait_seconds?:number;talk_seconds?:number};
type Engine={connected:boolean;journal_healthy:boolean};
const labels:Record<PhoneState,string>={offline:'Desconectado',connecting:'Conectando…',ready:'Disponível',calling:'Chamando…',incoming:'Chamada recebida',connected:'Em ligação',reconnecting:'Reconectando…',answering:'Atendendo…',ending:'Encerrando…'};
const callLabels:Record<string,string>={created:'Iniciada',ringing:'Chamando',answered:'Em ligação',completed:'Concluída',failed:'Não atendida',interrupted:'Interrompida'};
function duration(seconds:number){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
async function api<T>(path:string):Promise<T>{const response=await fetch(`/api/v1/${path}`,{cache:'no-store'});if(!response.ok)throw new Error(response.status===401?'Sua sessão expirou. Entre novamente.':'Não foi possível consultar a central. Tente atualizar.');return response.json();}
export default function Page(){
 const [controls,setControls]=useState<CallControls>({held:false,changingHold:false,consultation:'idle',transfer:'idle'});const [transferTo,setTransferTo]=useState('');
 const [historyPage,setHistoryPage]=useState(0);const [selectedCall,setSelectedCall]=useState('');const historyOpener=useRef<HTMLButtonElement|null>(null);const historyQuery=useRef({filters:emptyFilters,page:0});
 const [departments,setDepartments]=useState<{code:string;name:string}[]>([]);
 const [queues,setQueues]=useState<Queue[]>([]);
 const [me,setMe]=useState<Identity|null>(null);
 const [requestedArea,setRequestedArea]=useState('');const [sipLab,setSipLab]=useState(false);
 const [callReference,setCallReference]=useState<string>();const [phoneInView,setPhoneInView]=useState(true);
const [number,setNumber]=useState('201');const [token,setToken]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
 const [state,setState]=useState<PhoneState>('offline');const [destination,setDestination]=useState('202');const [peer,setPeer]=useState('');const [error,setError]=useState('');const [muted,setMuted]=useState(false);const [seconds,setSeconds]=useState(0);
 const [extensions,setExtensions]=useState<Extension[]>([]);const [calls,setCalls]=useState<Call[]>([]);const [engine,setEngine]=useState<Engine|null>(null);const [eventsConnected,setEventsConnected]=useState(false);const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);const [device,setDevice]=useState('');
 const [audio,setAudio]=useState<AudioHealth>({sip:'offline',media:'idle',microphone:'idle',playbackBlocked:false,levelsAvailable:false,inputLevel:0,outputLevel:0});const [deviceBusy,setDeviceBusy]=useState(false);
 const [speakers,setSpeakers]=useState<MediaDeviceInfo[]>([]);const [speaker,setSpeaker]=useState('');const [outputSelection,setOutputSelection]=useState(false);
 const phonePanel=useRef<HTMLElement|null>(null);
 const account=useRef<string|null>(null);const refreshGeneration=useRef(0);
 const phone=useRef<Phone|null>(null);const answerButton=useRef<HTMLButtonElement|null>(null);const started=useRef<number>(0);
 const refresh=useCallback(async()=>{const generation=refreshGeneration.current;if(!account.current)return;const {filters,page}=historyQuery.current;const query=new URLSearchParams({limit:'20',offset:String(page*20)});for(const key of ['department','agent','outcome'] as const){if(filters[key])query.set(key,filters[key]);}if(filters.from)query.set('from',new Date(filters.from+'T00:00:00').toISOString());if(filters.to){const until=new Date(filters.to+'T00:00:00');until.setDate(until.getDate()+1);query.set('to',until.toISOString());}try{const [e,c,t]=await Promise.all([api<{items:Extension[]}>('extensions'),api<{items:Call[]}>('calls?'+query),api<Engine>('telephony/status')]);if(generation!==refreshGeneration.current||!account.current||historyQuery.current.page!==page||historyQuery.current.filters!==filters)return;setExtensions(e.items);setCalls(c.items);setEngine(t);}catch(e){if(generation===refreshGeneration.current&&account.current)setError((e as Error).message);}},[]);
 useEffect(()=>{
  const record=()=>phone.current?.recordRenderedState(state,eventsConnected,answerButton.current!==null);
  record();
  document.addEventListener('visibilitychange',record);
  return()=>document.removeEventListener('visibilitychange',record);
 },[state,eventsConnected]);
 const receiveCatalog=useCallback((items:Queue[],groups:{code:string;name:string}[])=>{setQueues(items);setDepartments(groups);},[]);
 function applyHistory(filters:HistoryFilters,page=0){historyQuery.current={filters,page};setHistoryPage(page);setSelectedCall('');void refresh();}
 useEffect(()=>{if(state==='connected'){started.current=Date.now();setSeconds(0);const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started.current)/1000)),1000);return()=>clearInterval(timer);}setMuted(false);},[state]);
 useEffect(()=>{if(!me)return;let stopped=false;let ws:WebSocket|undefined;let retry:ReturnType<typeof setTimeout>;let refreshTimer:ReturnType<typeof setTimeout>|undefined;let cursor=0;
  const open=()=>{ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/v1/events?after=${cursor}`);ws.onopen=()=>{setEventsConnected(true);void refresh();};ws.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.sequence>cursor){cursor=message.sequence;if(!refreshTimer)refreshTimer=setTimeout(()=>{refreshTimer=undefined;if(!stopped)void refresh();},1200);}}catch{setError('A central enviou um evento inválido. Atualize a página.');}};ws.onclose=()=>{setEventsConnected(false);if(!stopped)retry=setTimeout(open,2500);};ws.onerror=()=>ws?.close();};void api<{sequence:number}>('events/cursor').then(c=>{cursor=c.sequence;}).catch(()=>{}).finally(()=>{if(!stopped)open();});void refresh();const poll=setInterval(()=>void refresh(),10000);
  return()=>{stopped=true;clearTimeout(retry);clearTimeout(refreshTimer);clearInterval(poll);ws?.close();};
 },[me,refresh]);
 useEffect(()=>{
  const controller=new AbortController();
  const generation=refreshGeneration.current;
  void fetch('/api/v1/me',{cache:'no-store',signal:controller.signal})
   .then(response=>response.ok?response.json():null)
   .then((session:Identity|null)=>{
    if(controller.signal.aborted||!session?.extension||refreshGeneration.current!==generation||account.current)return;
    account.current=session.extension;
    refreshGeneration.current++;
    setNumber(session.extension);
    setMe(session);
    setDestination(session.extension.endsWith('1')?session.extension.slice(0,2)+'2':session.extension.slice(0,2)+'1');
   }).catch(()=>{});
  return()=>{controller.abort();void phone.current?.dispose();};
 },[]);
 async function run(action:()=>Promise<unknown>){setError('');try{await action();}catch(e){setError(audioErrorMessage(e));}}
 async function connect(event:React.FormEvent){event.preventDefault();setBusy(true);await run(async()=>{
  if(phone.current){await phone.current.dispose();phone.current=null;}
  if(token||me?.extension!==number){
   const response=await fetch('/api/v1/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   if(!response.ok)throw new Error('Acesso recusado. Confira o token de desenvolvimento.');
  }
  const identity=await api<Identity>('me');if(identity.extension!==number)throw new Error('O token pertence a outro ramal. Selecione o ramal correspondente.');
  const {Phone}=await import('../lib/phone');const instance=new Phone(number,password,(s,p)=>{setState(s);if(p)setPeer(p);else setPeer('');},setError,setAudio,setControls);phone.current=instance;setOutputSelection(instance.supportsOutputSelection());await instance.setMicrophone(device);if(speaker&&instance.supportsOutputSelection())await instance.setSpeaker(speaker);account.current=identity.extension;refreshGeneration.current++;setMe(identity);setDestination(number.endsWith('1')?number.slice(0,2)+'2':number.slice(0,2)+'1');(window as Window&{floraSipDiagnostics?:()=>Promise<unknown>}).floraSipDiagnostics=async()=>{
   const status=await fetch('/api/v1/telephony/status',{cache:'no-store',signal:AbortSignal.timeout(2000)})
    .then(response=>response.ok?response.json() as Promise<Engine>:null).catch(()=>null);
   return {...await instance.signalingDiagnostics(),tenant:identity.tenant_id,engine:status?{connected:status.connected}:null};
  };await instance.start();setToken('');setPassword('');
  // Explicitly exposed diagnostics have no secrets and read genuine WebRTC counters.
  (window as Window&{floraMediaStats?:()=>Promise<unknown>}).floraMediaStats=()=>instance.mediaStats();
  (window as Window&{floraMediaDiagnostics?:()=>unknown}).floraMediaDiagnostics=()=>instance.mediaDiagnostics();
 });setBusy(false);}
 const updateDevices=useCallback(async()=>{const available=await navigator.mediaDevices.enumerateDevices();setDevices(available.filter(d=>d.kind==='audioinput'));setSpeakers(available.filter(d=>d.kind==='audiooutput'));},[]);
 useEffect(()=>{if(!me||!navigator.mediaDevices)return;const changed=()=>{void updateDevices().then(async()=>{const available=await navigator.mediaDevices.enumerateDevices();if(speaker&&!available.some(d=>d.kind==='audiooutput'&&d.deviceId===speaker))setError('Saída de áudio selecionada desconectada. Escolha outra saída ou Padrão do sistema.');}).catch(()=>setError('Não foi possível atualizar os dispositivos de áudio. Tente Buscar microfones.'));};navigator.mediaDevices.addEventListener('devicechange',changed);return()=>navigator.mediaDevices.removeEventListener('devicechange',changed);},[me,updateDevices,speaker]);
 async function listDevices(){await run(async()=>{if(!navigator.mediaDevices)throw new Error('Microfone indisponível nesta origem. Use localhost ou HTTPS confiável.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});try{await updateDevices();}finally{stream.getTracks().forEach(track=>track.stop());}});}
 async function changeDevice(id:string){setDeviceBusy(true);await run(async()=>{await phone.current?.setMicrophone(id);setDevice(id);});setDeviceBusy(false);}

 async function changeSpeaker(id:string){setDeviceBusy(true);await run(async()=>{await phone.current?.setSpeaker(id);setSpeaker(id);});setDeviceBusy(false);}
 async function logout(){account.current=null;refreshGeneration.current++;setMe(null);setControls({held:false,changingHold:false,consultation:'idle',transfer:'idle'});setTransferTo('');setQueues([]);setDepartments([]);historyQuery.current={filters:emptyFilters,page:0};setHistoryPage(0);setSelectedCall('');setCalls([]);setExtensions([]);setEngine(null);setEventsConnected(false);setPeer('');setSeconds(0);setMuted(false);setToken('');setPassword('');setOutputSelection(false);setSpeaker('');setSpeakers([]);setAudio({sip:'offline',media:'idle',microphone:'idle',playbackBlocked:false,levelsAvailable:false,inputLevel:0,outputLevel:0});delete (window as Window&{floraMediaDiagnostics?:unknown}).floraMediaDiagnostics;delete (window as Window&{floraMediaStats?:unknown}).floraMediaStats;delete (window as Window&{floraSipDiagnostics?:unknown}).floraSipDiagnostics;await run(async()=>{try{await phone.current?.dispose();await fetch('/api/v1/session',{method:'DELETE'});}finally{phone.current=null;setState('offline');}});}
 const active=['calling','incoming','answering','connected','ending'].includes(state);
 const adminSubAreas = ['departamentos', 'usuarios', 'filas', 'ura', 'gravacoes', 'relatorios', 'linhas', 'inteligencia'] as const;
 const isAdminSub = (adminSubAreas as readonly string[]).includes(requestedArea);
 const area=(isAdminSub && me?.role === 'admin') ? 'administracao' : (availableAreas(me,sipLab).find(item=>item.id===requestedArea)?.id??'atendimento');
 const initialAdminSubTab = isAdminSub ? (requestedArea as typeof adminSubAreas[number]) : undefined;
 const tab=area==='supervisao'?'supervision':area==='administracao'?'admin':area==='configuracoes'?'advanced':'queue';
 const showOperations=me&&area!=='historico'&&area!=='visao-geral';
 const queue=queues.find(item=>item.number===peer);
 const department=departments.find(item=>item.code===queue?.department);
 const validDestination=destination!==me?.extension&&(extensions.some(item=>item.number===destination)||queues.some(item=>item.number===destination));
 const consultation=controls.consultation!=='idle';
 const transferExtension=extensions.find(item=>item.number===transferTo&&item.number!==me?.extension&&item.number!==peer);
 const validTransfer=Boolean(transferExtension)||queues.some(item=>item.number===transferTo);
 const headings:Record<Area,[string,string]>={
  'visao-geral':['Visão geral','Confira sua equipe e o status da sua central de chamadas.'],
  atendimento:['Atendimento','Atenda clientes, gerencie suas filas e mantenha a ligação acessível.'],
  supervisao:['Supervisão','Acompanhe atendentes, clientes na espera e conversas em andamento.'],
  historico:['Histórico','Consulte chamadas e acompanhe a experiência de cada cliente.'],
  administracao:['Administração','Gerencie departamentos, equipes de atendimento e horários.'],
  configuracoes:['Configurações avançadas','Gerencie as linhas externas e regras de segurança da central.'],
 };
 useEffect(()=>{
  const update=()=>setRequestedArea(location.hash.slice(1));
  update();
  window.addEventListener('hashchange',update);
  return()=>window.removeEventListener('hashchange',update);
 },[]);
 useEffect(()=>{
  setSipLab(false);
  if(me?.role!=='admin')return;
  const controller=new AbortController();
  void fetch('/api/v1/sip-lab',{cache:'no-store',signal:controller.signal})
   .then(response=>{if(!controller.signal.aborted)setSipLab(response.ok);}).catch(()=>{});
  return()=>controller.abort();
 },[me]);
 useEffect(()=>{
  const panel=answerButton.current??phonePanel.current?.querySelector('.panel-heading');
  if(!panel)return;
  const observer=new IntersectionObserver(([entry])=>setPhoneInView(entry.isIntersecting),{threshold:0.05});
  observer.observe(panel);
  return()=>observer.disconnect();
 },[state]);
 useEffect(()=>{
  setCallReference(undefined);
  if(!active)return;
  let current=true;
  void phone.current?.currentCallReference().then(reference=>{if(current)setCallReference(reference);}).catch(()=>{});
  return()=>{current=false;};
 },[active,peer]);
 useEffect(()=>{if(active)setTransferTo('');},[active]);
 function focusPhone(){
  const target=answerButton.current??phonePanel.current;
  target?.focus();
 }
 return <AppShell identity={me} area={area} sipLab={sipLab} logout={()=>void logout()}>
  <div className="flora-layout">
  {error&&<div className="error flora-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Fechar mensagem">Fechar</button></div>}
  <section ref={phonePanel} tabIndex={-1} className={`phone-panel flora-phone${state==='incoming'?' phone-incoming':''}`} aria-labelledby="phone-title">
   <div className="panel-heading"><h2 id="phone-title">{me?`Ramal ${me.extension}`:'Conectar seu ramal'}</h2><span className={`status ${state==='ready'||state==='connected'?'positive':''}`} role="status"><span/>{labels[state]}</span></div>
   {!me||state==='offline'?<form onSubmit={event=>void connect(event)} className="connect-form"><p className="hint">{me?'Sessão da central ativa. Informe sua senha para reconectar o telefone.':'Informe seus dados de acesso para entrar no ramal.'}</p><label htmlFor="extension">Ramal</label><select id="extension" value={number} onChange={e=>setNumber(e.target.value)}><option>201</option><option>202</option><option>203</option><option>211</option><option>212</option><option>213</option></select><label htmlFor="api-token">Token de acesso</label><input id="api-token" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required={me?.extension!==number}/><label htmlFor="sip-password">Senha SIP</label><input id="sip-password" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary" disabled={busy}>{busy?'Conectando…':'Conectar ramal'}<ArrowUpRight size={18}/></button><p className="hint small">Seus dados de acesso ficam protegidos e salvos somente neste navegador.</p></form>:
   <div className="dialer">
    <div className="call-display">
     {active?<><span className="peer-label">{state==='incoming'?'Ligação de':state==='connected'?'Chamada original':'Ligação para'}</span>
      <strong data-testid="peer">{peer||'Origem indisponível'}</strong>
      {queue&&<span className="call-context">Fila {queue.number}{department?` · ${department.name}`:''}</span>}
      <span className="call-time">{state==='connected'?`${controls.held?'Em espera · ':''}${duration(seconds)}`:labels[state]}</span>
      {callReference&&<span className="call-context" title={callReference}>Identificador #{callReference.slice(0,8)}</span>}
     </>:<><Headphones size={24} strokeWidth={1.5} aria-hidden/><h3>{state==='ready'?'Pronto para conversar':labels[state]}</h3><p>{state==='ready'?'Disque um ramal ou escolha um colega da equipe.':'Aguardando conexão da linha para ligar.'}</p></>}
    </div>
    {!active&&<><label htmlFor="destination">Ramal ou fila de destino</label><input id="destination" className="destination" inputMode="numeric" maxLength={3} value={destination} aria-describedby={validDestination?undefined:"dial-guidance"} onChange={e=>setDestination(e.target.value.replace(/\D/g,''))}/>
     {!validDestination&&<p id="dial-guidance" className="hint">{destination===me.extension?'Escolha um ramal diferente do seu.':'Informe um ramal ou fila disponível na central.'}</p>}
     <div className="flora-dialpad" aria-label="Teclado numérico">
       {['1','2','3','4','5','6','7','8','9','*','0','#'].map(key=>
         <button key={key} type="button" className="dialpad-key" onClick={()=>setDestination(prev=>prev.length<3?prev+key.replace(/\D/g,''):prev)} aria-label={`Dígito ${key}`}>{key}</button>
       )}
     </div>
     <button className="primary" disabled={state!=='ready'||controls.transfer==='pending'||!validDestination} onClick={()=>void run(()=>phone.current!.call(destination))}><PhoneIcon size={19} aria-hidden/> Ligar</button></>}
    {state==='incoming'&&<button ref={answerButton} className="primary" onClick={()=>void run(()=>phone.current!.answer())}><PhoneIncoming size={19}/> Atender</button>}
    {state==='connected'&&<button className={`secondary ${muted?'selected':''}`} aria-pressed={muted} disabled={audio.microphone==='unavailable'||controls.held||controls.changingHold||consultation||controls.transfer==='pending'} onClick={()=>void run(async()=>{phone.current?.mute(!muted);setMuted(!muted);})}>{muted?<MicOff size={18}/>:<Mic size={18}/>} {muted?'Reativar microfone':'Silenciar microfone'}</button>}
    {state==='connected'&&<>
      <button className="secondary" aria-pressed={controls.held} disabled={controls.changingHold||controls.consultation!=='idle'||controls.transfer==='pending'} onClick={()=>void run(()=>phone.current!.setHold(!controls.held))}>{controls.changingHold?'Aguardando a central…':controls.held?'Retomar ligação':'Colocar em espera'}</button>
      <details className="audio-settings transfer-settings">
        <summary>Transferência</summary>
        <label htmlFor="transfer-to">Destino da transferência</label>
        <select id="transfer-to" value={validTransfer?transferTo:''} disabled={controls.consultation!=='idle'||controls.transfer==='pending'} onChange={e=>setTransferTo(e.target.value)}><option value="">Selecione um destino</option>{extensions.filter(e=>e.number!==me.extension&&e.number!==peer).map(e=><option key={e.number} value={e.number}>Ramal {e.number}{e.registered?'':' · sem registro'}</option>)}{queues.map(q=><option key={q.number} value={q.number}>Fila {q.number}</option>)}</select>
        {controls.consultation==='idle'&&transferExtension&&!transferExtension.registered&&<p className="transfer-warning">O ramal escolhido está desconectado no momento.</p>}
        {controls.consultation==='idle'?<div className="ops-actions">
          <button className="secondary" disabled={!validTransfer||controls.changingHold||controls.transfer==='pending'} onClick={()=>void run(()=>phone.current!.transfer(transferTo))}>Transferir direto</button>
          <button className="secondary" disabled={!transferExtension||controls.changingHold||controls.transfer==='pending'} onClick={()=>void run(()=>phone.current!.startConsultation(transferTo))}>Consultar ramal</button>
        </div>:<><div className="consultation-leg">
          <h3>Chamada de consulta</h3><strong>Ramal {transferTo}</strong>
          <p role="status">{controls.consultation==='calling'?'Aguardando atendimento':'Consulta conectada'}</p>
          <p className="hint">Ao cancelar, a central tenta retomar a chamada original.</p>
        </div><div className="ops-actions">
          <button className="secondary" disabled={controls.consultation!=='connected'||controls.transfer==='pending'} onClick={()=>void run(()=>phone.current!.transfer())}>Confirmar transferência</button>
          <button className="secondary" disabled={controls.transfer==='pending'} onClick={()=>void run(()=>phone.current!.cancelConsultation())}>Cancelar consulta</button>
        </div></>}
      </details>
    </>}
    {controls.transfer!=='idle'&&<p className="transfer-feedback" role="status">{transferTo&&<strong>{/^3/.test(transferTo)?'Fila':'Ramal'} {transferTo} · </strong>}{controls.transfer==='pending'?'Aguardando confirmação da central…':controls.transfer==='accepted'?'Transferência encaminhada com sucesso.':controls.transfer==='failed'?'Transferência recusada pelo destino.':'Transferência sem confirmação.'}</p>}
    {consultation&&<p className="hint">Encerrar chamada termina a ligação original e a consulta.</p>}
    {active&&<button className="danger" disabled={state==='ending'} onClick={()=>void run(()=>phone.current!.hangup())}><PhoneOff size={19}/>{state==='incoming'?'Rejeitar':state==='ending'?'Encerrando…':'Encerrar chamada'}</button>}
    <div className="audio-health" aria-live="polite"><span>Linha: {audio.sip==='registered'?'ativa':audio.sip==='reconnecting'?'reconectando…':audio.sip==='connecting'?'conectando…':'desconectada'}</span>{active&&<span>Áudio: {audio.media==='connected'?'alta definição':audio.media==='interrupted'?'reconectando som…':audio.media==='failed'?'conexão perdida':'ajustando áudio…'}</span>}{state==='connected'&&<span>Microfone: {audio.microphone==='active'?'captando voz':audio.microphone==='muted'?'silenciado':audio.microphone==='unavailable'?'indisponível':'aguardando microfone'}</span>}</div>
    {state==='connected'&&<div className="audio-levels"><label>Nível do microfone<meter aria-label="Nível do microfone" min={0} max={1} value={audio.inputLevel}/></label><label>Áudio recebido<meter aria-label="Áudio recebido" min={0} max={1} value={audio.outputLevel}/></label><p>{audio.levelsAvailable?'Voz com áudio nítido.':'Indicadores de áudio em repouso.'}</p></div>}
    {audio.playbackBlocked&&<button className="secondary" onClick={()=>void run(()=>phone.current!.resumeAudio())}>Reproduzir áudio</button>}
    <details className="audio-settings"><summary>Dispositivo de áudio</summary><button className="text-button" disabled={deviceBusy||state==='answering'||state==='ending'} onClick={()=>void listDevices()}>Buscar microfones</button><label htmlFor="microphone">{state==='connected'?'Microfone da chamada':'Microfone para a próxima ligação'}</label><select id="microphone" value={device} disabled={deviceBusy||['calling','incoming','answering','ending'].includes(state)} onChange={e=>void changeDevice(e.target.value)}><option value="">Padrão do sistema</option>{device&&!devices.some(d=>d.deviceId===device)&&<option value={device}>Microfone anterior indisponível</option>}{devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Microfone'}</option>)}</select>{outputSelection?<><label htmlFor="speaker">Saída de áudio</label><select id="speaker" value={speaker} disabled={deviceBusy||state==='ending'} onChange={e=>void changeSpeaker(e.target.value)}><option value="">Padrão do sistema</option>{speaker&&!speakers.some(d=>d.deviceId===speaker)&&<option value={speaker}>Saída anterior indisponível</option>}{speakers.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Saída de áudio'}</option>)}</select></>:<p className="hint small">Este navegador usa a saída de áudio escolhida no sistema.</p>}<p className="hint small">{deviceBusy?'Atualizando dispositivo…':'Dica: use headset com microfone para maior clareza na conversa.'}</p></details>
   </div>}
   <div className="phone-footer"><Check size={14} aria-hidden/> Telefonia corporativa segura<span className="mobile-support">Chamadas em navegador móvel ainda em homologação.</span></div>
  </section>
  {me&&!phoneInView&&<button type="button" className="primary phone-jump" onClick={focusPhone}><PhoneIncoming size={18} aria-hidden/>{state==='incoming'?'Chamada recebida · abrir discador':'Ir ao discador'}</button>}
  <main id="conteudo" tabIndex={-1} className="activity-panel flora-content">
  <div className="page-heading"><div><h1>{me?headings[area][0]:'Sua mesa de atendimento'}</h1><p>{me?headings[area][1]:'Conecte seu ramal para trabalhar na central.'}</p></div></div>
  {me&&<div className="system-status flora-system" role="status"><span className={engine?.connected?'live-dot':'idle-dot'}/>{engine?.connected?'Central de atendimento conectada':'Aguardando conexão com a central'}{!engine?.journal_healthy&&<span> · Histórico indisponível</span>}<span className="flora-events">{eventsConnected?'Eventos ao vivo':'Eventos desconectados'}</span></div>}
  {!me&&<p className="flora-login-note">Atenda chamadas, acompanhe suas filas e consulte o histórico da sua organização.</p>}
  {me&&area==='visao-geral'&&<section className="team" aria-labelledby="team-title"><div className="section-heading"><h2 id="team-title">Na sua central</h2><button className="text-button" disabled={!me} onClick={()=>void refresh()} aria-label="Atualizar central"><RefreshCw size={16}/></button></div>
   {me?<div className="extension-list">{extensions.map(e=><div className="extension-row" key={e.id}><span className="extension-number">{e.number}</span><div><strong>{e.number===me.extension?'Seu ramal':'Outro operador'}</strong><span>{e.registered?'Registrado na central':'Sem registro SIP'}</span></div><span className={`availability ${e.registered?'online':''}`}>{e.registered?'Conectado':'Offline'}</span>{e.number!==me.extension&&<button type="button" className="text-button" onClick={()=>{setDestination(e.number);focusPhone();}}>Discar</button>}</div>)}</div>:<p className="empty-copy">Conecte seu ramal para ver a disponibilidade da equipe.</p>}
  </section>}
  {me&&<div hidden={!showOperations}><OperationsPanel tab={tab} extension={me.extension} ramais={extensions.map(e=>e.number)} onQueues={receiveCatalog} initialSubTab={initialAdminSubTab}/></div>}
  {me&&area==='historico'&&<section className="history" aria-labelledby="history-title"><div className="section-heading"><h2 id="history-title">Últimas chamadas</h2></div>
   {me&&<HistoryFilterForm departments={departments} ramais={extensions.map(e=>e.number)} onChange={applyHistory}/>}
   {!me||calls.length===0?<div className="empty-history"><PhoneIcon size={27} strokeWidth={1.3}/><h3>{me?'Nenhuma chamada encontrada.':'Seu histórico, em um só lugar.'}</h3><p>{me?'As ligações aparecerão aqui quando corresponderem aos filtros.':'Entre para acompanhar as chamadas da sua empresa.'}</p></div>:<div className="table-wrap history-table" role="region" aria-label="Tabela do histórico" tabIndex={0}><table><thead><tr><th>Chamada</th><th>Início</th><th className="history-duration">Espera</th><th className="history-duration">Conversa</th><th>Estado</th><th>Detalhes</th></tr></thead><tbody>{calls.map(c=><tr key={c.id}><td><span className="call-route">{c.source===me?.extension?<ArrowUpRight size={17} aria-hidden/>:c.destination===me?.extension?<ArrowDownLeft size={17} aria-hidden/>:<PhoneIcon size={17} aria-hidden/>} {c.source} <span>→</span> {c.destination}</span></td><td>{new Date(c.started_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td><td className="history-duration">{c.wait_seconds==null?'—':duration(c.wait_seconds)}</td><td className="history-duration">{c.talk_seconds==null?'—':duration(c.talk_seconds)}</td><td><span className={`call-state ${c.state==='completed'?'completed':''}`}>{c.ended_at&&c.outcome?outcomeLabels[c.outcome]||callLabels[c.state]:callLabels[c.state]||c.state}</span></td><td><button className="text-button" aria-label={`Ver detalhes da chamada ${c.source} para ${c.destination}`} onClick={e=>{historyOpener.current=e.currentTarget;setSelectedCall(c.id);}}>Ver</button></td></tr>)}</tbody></table></div>}
  {me&&(historyPage>0||calls.length===20)&&<div className="ops-actions"><button className="secondary" disabled={historyPage===0} onClick={()=>applyHistory(historyQuery.current.filters,historyPage-1)}>Página anterior</button><span>Página {historyPage+1}</span><button className="secondary" disabled={calls.length<20} onClick={()=>applyHistory(historyQuery.current.filters,historyPage+1)}>Próxima página</button></div>}
  {selectedCall&&<CallDetails key={selectedCall} id={selectedCall} onClose={()=>{setSelectedCall('');requestAnimationFrame(()=>historyOpener.current?.focus());}}/>}
  </section>}
  </main>
  </div>
 </AppShell>;
}
