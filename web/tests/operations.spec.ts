import {test,expect,Page,APIRequestContext} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(__dirname,'../..');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('=')));
const output=process.env.PHASE_02_EVIDENCE_DIR||path.join(root,'docs/evidence/phase-02');
const origin='http://localhost:13400';
const headers=(n:string)=>({Authorization:`Bearer ${env['TOKEN_'+n]}`,Origin:origin});
const ast=(command:string)=>execFileSync('docker',['compose','exec','-T','asterisk','asterisk','-rx',command],{cwd:root,encoding:'utf8',timeout:15000});
const channels=()=>Number(ast('core show channels count').match(/(\d+) active channels/)?.[1]??-1);
const writeEvidence=(name:string,data:unknown)=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify({at:new Date().toISOString(),data},null,2));};
async function connect(page:Page,n:string){
 await page.goto('/');
 await page.getByLabel('Ramal',{exact:true}).selectOption(n);
 await page.getByLabel('Token de acesso').fill(env['TOKEN_'+n]);
 await page.getByLabel('Senha SIP').fill(env['SIP_'+n+'_PASSWORD']);
 await page.getByRole('button',{name:'Conectar ramal',exact:true}).click();
 await ready(page);
}
const ready=(p:Page)=>expect(p.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:25000});
const inCall=(p:Page)=>expect(p.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:18000});
const dial=async(p:Page,n:string)=>{await p.getByLabel('Ramal ou fila de destino').fill(n);await p.getByRole('button',{name:'Ligar',exact:true}).click();};
const end=(p:Page)=>p.getByRole('button',{name:'Encerrar chamada',exact:true}).click();
const ops=async(request:APIRequestContext,n='201')=>{
 const r=await request.get('/api/v1/operations',{headers:headers(n)});expect(r.status()).toBe(200);return r.json();
};
const change=async(request:APIRequestContext,method:string,url:string,n:string,data?:unknown)=>{
 const r=await request.fetch('/api/v1/'+url,{method,headers:headers(n),data});return r.status();
};
const rx=(p:Page)=>p.evaluate(async()=>{
 const read=(window as Window&{floraMediaStats?:()=>Promise<Record<string,unknown>[]>}).floraMediaStats;
 const row=(await read?.()||[]).find(i=>i.type==='inbound-rtp'&&i.kind==='audio');
 return {packets:Number(row?.packetsReceived||0),energy:Number(row?.totalAudioEnergy||0)};
});
async function media(a:Page,b:Page){
 const before=await Promise.all([rx(a),rx(b)]);
 await expect.poll(async()=>{
  const after=await Promise.all([rx(a),rx(b)]);
  return after.every((m,i)=>m.packets-before[i].packets>20&&m.energy-before[i].energy>0.0001);
 },{timeout:12000}).toBe(true);
 return {before,after:await Promise.all([rx(a),rx(b)])};
}
test('real queue distribution, authorization, pause, timeout, and restart reconciliation',async({browser,request})=>{
 const key='homologacao-02a',n='391';
 const name=`Homologação de recepção ${n}`;
 const initial=await ops(request);
 expect(initial.catalog.departments.some((d:{code:string})=>d.code===key)).toBe(false);
 expect(initial.catalog.queues.some((q:{number:string})=>q.number===n)).toBe(false);
 expect(channels()).toBe(0);
 const c1=await browser.newContext({permissions:['microphone']});
 const c2=await browser.newContext({permissions:['microphone']});
 const c3=await browser.newContext({permissions:['microphone']});
 const a=await c1.newPage(),b=await c2.newPage(),supervisor=await c3.newPage();
 const operatorQueue=b.getByRole('article').filter({hasText:`${name} · ${n}`});
 const presence=()=>ops(request).then(d=>d.engine.queues[n]?.members['202']?.state);
 const waiting=()=>ops(request).then(d=>d.engine.queues[n]?.waiting);
 const metrics=async(user='203')=>{
  const r=await request.get('/api/v1/operations/metrics',{headers:headers(user)});
  expect(r.ok()).toBe(true);return r.json();
 };
 const filtered=async(outcome:string)=>{
  const r=await request.get(`/api/v1/calls?department=${key}&outcome=${outcome}`,{headers:headers('201')});
  expect(r.ok()).toBe(true);return (await r.json()).items;
 };
 try{
  expect(await change(request,'PUT','departments/'+key,'202',{name:'Proibido'})).toBe(403);
  expect(await change(request,'PUT','departments/'+key,'OTHER',{name:'Proibido'})).toBe(403);
  expect(await change(request,'PUT','departments/'+key,'201',{name:'Homologação'})).toBe(204);
  expect(await change(request,'PUT','departments/'+key,'201',{name})).toBe(204);
  expect(await change(request,'PUT','departments/'+key+'/supervisors/203','201')).toBe(202);
  const spec={department:key,strategy:'rrmemory',ring_seconds:3,wait_seconds:7,fallback:''};
  expect(await change(request,'PUT','queues/'+n,'201',{...spec,strategy:'arbitrary'})).toBe(400);
  expect(await change(request,'PUT','queues/'+n,'201',spec)).toBe(202);
  expect(await change(request,'PUT',`queues/${n}/members/999`,'201')).toBe(409);
  expect(await change(request,'PUT',`queues/${n}/members/202`,'201')).toBe(202);
  expect((await ops(request,'OTHER')).catalog).toEqual({departments:[],queues:[],members:[],schedules:[]});
  await expect.poll(waiting).toBe(0);
  expect((await request.get('/api/v1/operations/metrics',{headers:headers('202')})).status()).toBe(403);
  expect((await request.get('/api/v1/operations/metrics',{headers:headers('OTHER')})).status()).toBe(403);
  expect(await change(request,'PUT','departments/'+key,'203',{name:'Proibido'})).toBe(403);
  const baseline=await metrics();
  await connect(a,'201');await connect(b,'202');await connect(supervisor,'203');
  await supervisor.getByRole('link',{name:'Supervisão',exact:true}).click();
  await expect(supervisor.getByRole('heading',{name:'Últimas 24 horas'})).toBeVisible();
  await supervisor.reload();
  await expect(supervisor.getByText('Sessão da central ativa.',{exact:false})).toBeVisible();
  await supervisor.getByRole('link',{name:'Supervisão',exact:true}).click();
  await expect(supervisor.getByRole('heading',{name:'Últimas 24 horas'})).toBeVisible();
  await a.getByRole('link',{name:'Administração',exact:true}).click();
  const admin=a.locator('details').filter({has:a.getByText('Departamentos',{exact:true})});
  await admin.getByRole('button',{name:`Editar ${name}`,exact:true}).click();
  await admin.getByLabel('Nome do departamento').fill(name);
  await admin.getByRole('button',{name:'Salvar departamento'}).click();
  await expect(admin.getByLabel('Nome do departamento')).toHaveValue('');
  await a.getByRole('link',{name:'Atendimento',exact:true}).click();
  await operatorQueue.getByRole('button',{name:'Entrar na fila',exact:true}).click();
  await expect.poll(presence,{timeout:15000}).toBe('available');
  await dial(a,n);
  await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:12000});
  await expect.poll(waiting).toBe(1);
  await expect.poll(async()=>(await metrics()).live.calls.length).toBe(1);
  await expect(supervisor.getByRole('heading',{name:'Chamadas em andamento',exact:true}).locator('..').getByText('201 → 391',{exact:true})).toBeVisible();
  await b.getByRole('button',{name:'Atender',exact:true}).click();
  await Promise.all([inCall(a),inCall(b)]);
  const measured=await media(a,b);
  const shots=path.join(root,'.impeccable/review');fs.mkdirSync(shots,{recursive:true});
  await supervisor.screenshot({path:path.join(shots,'desktop.png'),fullPage:true});
  await supervisor.setViewportSize({width:390,height:844});
  await supervisor.screenshot({path:path.join(shots,'mobile.png'),fullPage:true});
  expect(await supervisor.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await a.getByRole('link',{name:'Supervisão',exact:true}).click();await inCall(a);
  await a.getByRole('link',{name:'Atendimento',exact:true}).click();await inCall(a);
  await expect.poll(presence).toBe('busy');
  await end(a);await Promise.all([ready(a),ready(b)]);
  await expect.poll(channels).toBe(0);
  await expect.poll(async()=>(await filtered('answered')).length).toBeGreaterThan(0);
  await supervisor.getByRole('link',{name:'Histórico',exact:true}).click();
  const rowAction=supervisor.getByRole('button',{name:'Ver detalhes da chamada 201 para 391',exact:true}).first();
  await rowAction.click();
  await expect(supervisor.getByRole('heading',{name:'Detalhes da chamada'})).toBeFocused();
  await expect(supervisor.getByRole('heading',{name:'Eventos e transferências'})).toBeVisible();
  await supervisor.getByRole('button',{name:'Fechar detalhes'}).click();
  await expect(rowAction).toBeFocused();
  await expect.poll(async()=>(await metrics()).totals.answered).toBe(baseline.totals.answered+1);
  await operatorQueue.getByRole('button',{name:'Pausar atendimento',exact:true}).click();
  await expect.poll(presence).toBe('paused');
  await dial(a,n);await ready(a);
  await expect(b.getByRole('button',{name:'Atender',exact:true})).toHaveCount(0);
  await operatorQueue.getByRole('button',{name:'Retomar atendimento',exact:true}).click();
  await expect.poll(presence).toBe('available');
  await dial(a,n);await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible();
  await ready(a);await ready(b);await expect.poll(channels).toBe(0);
  await expect.poll(async()=>(await filtered('timeout')).length).toBeGreaterThan(0);
  await dial(a,n);await expect.poll(waiting).toBe(1);await end(a);await ready(a);await ready(b);
  await expect.poll(async()=>(await metrics()).totals.abandoned).toBe(baseline.totals.abandoned+1);
  const beforeMetrics=await metrics();
  const beforeRestart=ast('queue show');
  execFileSync('docker',['compose','restart','asterisk'],{cwd:root,stdio:'pipe',timeout:30000});
  await expect.poll(presence,{timeout:35000}).toBe('available');
  await expect.poll(waiting).toBe(0);
  await operatorQueue.getByRole('button',{name:'Sair da fila',exact:true}).click();
  await expect.poll(presence).toBeUndefined();
  const afterRestart=ast('queue show');
  const afterMetrics=await metrics();
  expect(afterMetrics.totals).toEqual(beforeMetrics.totals);
  const answerHistory=await filtered('answered');const timeoutHistory=await filtered('timeout');const abandonHistory=await filtered('abandoned');
  expect(answerHistory[0]).toMatchObject({queue:n,agent:'202',department:key,outcome:'answered'});
  expect(timeoutHistory[0]).toMatchObject({queue:n,outcome:'timeout'});
  expect(abandonHistory[0]).toMatchObject({queue:n,outcome:'abandoned'});
  writeEvidence('02c-supervision',{result:'PASS',baseline:baseline.totals,beforeRestart:beforeMetrics.totals,afterRestart:afterMetrics.totals,answerHistory,timeoutHistory,abandonHistory});
  writeEvidence('02a-queue',{result:'PASS',strategy:'rrmemory',mediaSource:'native Chromium synthetic input via real SIP/WebRTC',measured,beforeRestart,afterRestart,activeChannels:channels()});
 }finally{
  await c1.close();await c2.close();await c3.close();
  await change(request,'DELETE','queues/'+n,'201');
  await change(request,'DELETE','departments/'+key,'201');
 }
});

async function answer(p:Page){
 const button=p.getByRole('button',{name:'Atender',exact:true});
 await expect(button).toBeVisible({timeout:12000});await button.click();await inCall(p);
}
async function target(p:Page,n:string){
 await p.getByText('Transferência',{exact:true}).click();
 await p.getByLabel('Destino da transferência').selectOption(n);
}
async function transferEvents(request:APIRequestContext,source:string,destination:string,prior:Set<string>,kind:string){
 const list=await request.get('/api/v1/calls?limit=100',{headers:headers('201')});
 const candidates=(await list.json()).items.filter((c:{id:string;source:string;destination:string})=>!prior.has(c.id)&&c.source===source&&c.destination===destination);
 const results=[];
 for(const c of candidates){
  const detail=await (await request.get('/api/v1/calls/'+c.id,{headers:headers('201')})).json();
  if(detail.events?.some((e:{type:string})=>e.type===kind))results.push(detail);
 }
 return results;
}

test('real hold, consultation rejection and cancellation, and attended REFER with media',async({browser,request})=>{
 const contexts=await Promise.all([1,2,3].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c]=await Promise.all(contexts.map(x=>x.newPage()));
 const prior=new Set<string>((await (await request.get('/api/v1/calls?limit=100',{headers:headers('201')})).json()).items.map((x:{id:string})=>x.id));
 try{
  expect(channels()).toBe(0);
  await connect(a,'203');await connect(b,'201');await connect(c,'202');
  await dial(a,'201');await answer(b);await inCall(a);await media(a,b);
  await b.getByRole('button',{name:'Colocar em espera'}).click();
  await expect(b.getByRole('button',{name:'Retomar ligação'})).toBeVisible();
  await b.waitForTimeout(700);
  const before=await rx(a);await b.waitForTimeout(1500);const after=await rx(a);
  expect(after.energy-before.energy).toBeLessThan(0.001);
  await b.getByRole('button',{name:'Retomar ligação'}).click();
  await expect(b.getByRole('button',{name:'Colocar em espera'})).toBeVisible();
  const resumed=await media(a,b);
  await target(b,'202');
  const consult=b.getByRole('button',{name:'Consultar ramal'});
  await consult.click();await expect(c.getByRole('button',{name:'Rejeitar'})).toBeVisible();await c.getByRole('button',{name:'Rejeitar'}).click();
  await expect(b.getByRole('button',{name:'Colocar em espera'})).toBeVisible();await media(a,b);
  await consult.click();await answer(c);await media(b,c);
  await b.getByRole('button',{name:'Cancelar consulta'}).click();await ready(c);
  await expect(b.getByRole('button',{name:'Colocar em espera'})).toBeVisible();await media(a,b);
  await consult.click();await answer(c);const consulted=await media(b,c);
  await b.getByRole('button',{name:'Confirmar transferência'}).click();
  await ready(b);
  await Promise.all([inCall(a),inCall(c)]);
  const transferred=await media(a,c);
  const stableBefore=await Promise.all([rx(a),rx(c)]);
  await a.waitForTimeout(2200);
  const stableAfter=await Promise.all([rx(a),rx(c)]);
  for(let peer=0;peer<2;peer++){
   expect(stableAfter[peer].packets-stableBefore[peer].packets).toBeGreaterThan(50);
   expect(stableAfter[peer].energy-stableBefore[peer].energy).toBeGreaterThan(0.005);
  }
  await end(a);await Promise.all([ready(a),ready(c)]);
  await expect.poll(channels).toBe(0);
  const records=()=>transferEvents(request,'203','201',prior,'call.transfer.attended');
  await expect.poll(async()=>(await records()).length,{timeout:12000}).toBe(1);
  writeEvidence('02b-attended',{result:'PASS',hold:{before,after,resumed},consulted,transferred,stableAfterTransfer:{before:stableBefore,after:stableAfter},history:await records(),activeChannels:channels()});
 }finally{await Promise.all(contexts.map(x=>x.close()));}
});

test('real blind REFER from 201 to 202 preserves the caller and closes all channels',async({browser,request})=>{
 const contexts=await Promise.all([1,2,3].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c]=await Promise.all(contexts.map(x=>x.newPage()));
 const prior=new Set<string>((await (await request.get('/api/v1/calls?limit=100',{headers:headers('201')})).json()).items.map((x:{id:string})=>x.id));
 try{
  expect(channels()).toBe(0);
  await connect(a,'203');await connect(b,'201');await connect(c,'202');
  await dial(a,'201');await answer(b);await inCall(a);await media(a,b);
  await target(b,'202');
  await b.getByRole('button',{name:'Transferir direto'}).click();
  await answer(c);await ready(b);
  const transferred=await media(a,c);
  await end(c);await ready(a);await expect.poll(channels).toBe(0);
  const records=()=>transferEvents(request,'203','201',prior,'call.transfer.blind');
  await expect.poll(async()=>(await records()).length,{timeout:12000}).toBe(1);
  writeEvidence('02b-blind',{result:'PASS',transferred,history:await records(),activeChannels:channels()});
 }finally{await Promise.all(contexts.map(x=>x.close()));}
});

test('department-to-department REFER, schedule and real internal contingency',async({browser,request})=>{
 const contexts=await Promise.all([1,2,3].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c]=await Promise.all(contexts.map(x=>x.newPage()));
 const first='homologacao-origem',second='homologacao-destino';
 const initial=await ops(request);
 expect(initial.catalog.queues.some((q:{number:string})=>['392','393'].includes(q.number))).toBe(false);
 expect(initial.catalog.departments.some((d:{code:string})=>[first,second].includes(d.code))).toBe(false);
 const readQueue=async(n:string)=>((await ops(request)).engine.queues[n]);
 const date=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'America/Sao_Paulo'}).format(new Date());
 const today=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(date);
 expect(today).toBeGreaterThanOrEqual(0);
 try{
  expect(channels()).toBe(0);
  expect(await change(request,'PUT','departments/'+first,'201',{name:'Origem da homologação'})).toBe(204);
  expect(await change(request,'PUT','departments/'+second,'201',{name:'Destino da homologação'})).toBe(204);
  expect(await change(request,'PUT','departments/'+first+'/supervisors/203','201')).toBe(202);
  expect(await change(request,'PUT','departments/'+second+'/supervisors/203','201')).toBe(202);
  const common={strategy:'ringall',ring_seconds:3,wait_seconds:7,fallback:''};
  expect(await change(request,'PUT','queues/392','201',{...common,department:first})).toBe(202);
  expect(await change(request,'PUT','queues/393','201',{...common,department:second,fallback:'201',strategy:'fewestcalls'})).toBe(202);
  expect(await change(request,'PUT','queues/392/members/201','201')).toBe(202);
  expect(await change(request,'PUT','queues/393/members/202','201')).toBe(202);
  expect(await change(request,'PUT','queues/392/presence','201',{joined:true,paused:false})).toBe(202);
  expect(await change(request,'PUT','queues/393/presence','202',{joined:true,paused:false})).toBe(202);
  await connect(a,'203');await connect(b,'201');await connect(c,'202');
  await expect.poll(async()=>(await readQueue('392'))?.members['201']?.state).toBe('available');
  await expect.poll(async()=>(await readQueue('393'))?.members['202']?.state).toBe('available');
  await dial(a,'392');await answer(b);await inCall(a);await media(a,b);
  await target(b,'393');await b.getByRole('button',{name:'Transferir direto'}).click();
  await answer(c);await ready(b);const transferred=await media(a,c);await end(a);await ready(c);
  await expect.poll(channels).toBe(0);
  const timezone='America/Sao_Paulo';
  const closed={timezone,days:[0,1,2,3,4,5,6].filter(d=>d!==today),opens_at:'00:00',closes_at:'23:59',closed_destination:'201'};
  expect(await change(request,'PUT','departments/'+second+'/schedule','202',closed)).toBe(403);
  expect(await change(request,'PUT','departments/'+second+'/schedule','201',{...closed,timezone:'Invalid/Zone'})).toBe(400);
  expect(await change(request,'PUT','departments/'+second+'/schedule','201',closed)).toBe(202);
  const config=()=>ast('dialplan show 393@internal-only');
  await expect.poll(config).toContain('GotoIfTime(00:00-23:58');
  expect(config()).toContain('America/Sao_Paulo');
  await dial(a,'393');await answer(b);await inCall(a);
  await expect(c.getByRole('button',{name:'Atender',exact:true})).toHaveCount(0);
  const closedMedia=await media(a,b);await end(a);await ready(b);
  const open={...closed,days:[today]};
  expect(await change(request,'PUT','departments/'+second+'/schedule','201',open)).toBe(202);
  const weekday=['sun','mon','tue','wed','thu','fri','sat'][today];
  await expect.poll(config).toContain(`00:00-23:58,${weekday},`);
  await dial(a,'393');await answer(c);await inCall(a);const openMedia=await media(a,c);await end(a);await ready(c);
  expect(await change(request,'DELETE','departments/'+second+'/schedule','201')).toBe(202);
  await expect.poll(config).not.toContain('GotoIfTime');
  expect(await change(request,'PUT','queues/393/presence','202',{joined:true,paused:true})).toBe(202);
  await expect.poll(async()=>(await readQueue('393'))?.members['202']?.state).toBe('paused');
  await dial(a,'393');await answer(b);await inCall(a);const unavailableMedia=await media(a,b);await end(a);await ready(b);
  expect(await change(request,'PUT','queues/393/presence','202',{joined:true,paused:false})).toBe(202);
  await expect.poll(async()=>(await readQueue('393'))?.members['202']?.state).toBe('available');
  await dial(a,'393');
  await expect(c.getByRole('button',{name:'Atender',exact:true})).toBeVisible();
  await answer(b);await inCall(a);const timeoutMedia=await media(a,b);await end(a);await ready(b);await ready(c);
  await expect.poll(channels).toBe(0);
  const evidence=async()=>{
   const history=await request.get('/api/v1/calls?department='+second,{headers:headers('201')});
   expect(history.ok()).toBe(true);
   const list=(await history.json()).items.slice(0,6);
   const details=[];
   for(const call of list)details.push(await (await request.get('/api/v1/calls/'+call.id,{headers:headers('201')})).json());
   return details;
  };
  await expect.poll(async()=>(await evidence()).flatMap(x=>x.queue_events||[]).some(e=>e.kind==='FLORA_CLOSED')).toBe(true);
  await expect.poll(async()=>(await evidence()).flatMap(x=>x.queue_events||[]).some(e=>e.routing_status==='JOINEMPTY'||e.routing_status==='JOINUNAVAIL')).toBe(true);
  await expect.poll(async()=>(await evidence()).flatMap(x=>x.queue_events||[]).some(e=>e.routing_status==='TIMEOUT')).toBe(true);
  writeEvidence('02d-routing',{result:'PASS',transferred,closedMedia,openMedia,unavailableMedia,timeoutMedia,timezone,history:await evidence(),activeChannels:channels()});
 }finally{
  await Promise.all(contexts.map(x=>x.close()));
  await change(request,'DELETE','queues/392','201');await change(request,'DELETE','queues/393','201');
  await change(request,'DELETE','departments/'+first,'201');await change(request,'DELETE','departments/'+second,'201');
 }
});

test('transfer edge cases: unavailable and rejecting target, ending, and origin disconnect',async({browser,request})=>{
 const [ca,cb,cc]=await Promise.all([1,2,3].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c]=await Promise.all([ca,cb,cc].map(ctx=>ctx.newPage()));
 const prior=new Set<string>((await (await request.get('/api/v1/calls?limit=100',{headers:headers('201')})).json()).items.map((x:{id:string})=>x.id));
 const original=async()=>{await dial(a,'201');await answer(b);await inCall(a);await media(a,b);};
 try{
  expect(channels()).toBe(0);
  await connect(a,'203');await connect(b,'201');
  await expect.poll(async()=>{
   const r=await request.get('/api/v1/extensions',{headers:headers('201')});
   return (await r.json()).items.find((e:{number:string})=>e.number==='202')?.registered;
  },{timeout:20000}).toBe(false);
  await original();await target(b,'202');
  await b.getByRole('button',{name:'Transferir direto'}).click();
  await ready(a);await ready(b);await expect.poll(channels).toBe(0);
  await connect(c,'202');
  await original();await target(b,'202');
  await b.getByRole('button',{name:'Transferir direto'}).click();
  await expect(c.getByRole('button',{name:'Rejeitar'})).toBeVisible();await c.getByRole('button',{name:'Rejeitar'}).click();
  await Promise.all([ready(a),ready(b),ready(c)]);await expect.poll(channels).toBe(0);
  await original();await target(b,'202');
  await b.getByRole('button',{name:'Colocar em espera'}).click();
  await expect(b.getByRole('button',{name:'Retomar ligação'})).toBeVisible();
  await end(b);
  await expect(b.getByRole('button',{name:'Transferir direto'})).toHaveCount(0);
  await Promise.all([ready(a),ready(b)]);
  await expect.poll(channels).toBe(0);
  await original();await target(b,'202');
  await b.getByRole('button',{name:'Consultar ramal'}).click();await answer(c);await media(b,c);
  await ca.close();
  await expect.poll(channels,{timeout:75000,intervals:[1000,2000]}).toBe(0);
  await Promise.all([ready(b),ready(c)]);
  const records=()=>transferEvents(request,'203','201',prior,'call.transfer.blind');
  await expect.poll(async()=>(await records()).length,{timeout:12000}).toBe(2);
  writeEvidence('02b-edges',{result:'PASS',unavailable:'original ends after redirect; no answer at destination',rejection:'202 rejected real INVITE',ending:'call ended during hold; transfer controls removed',originDisconnect:'203 context closed during consultation; no remaining channels',history:await records(),activeChannels:channels()});
 }finally{await Promise.all([ca,cb,cc].map(ctx=>ctx.close().catch(()=>{})));}
});
