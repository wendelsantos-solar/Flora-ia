import {test,expect,Page,BrowserContext,TestInfo} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(__dirname,'../..');
const output=process.env.PHASE_01_1_EVIDENCE_DIR||path.join(root,'docs/evidence/phase-01-1');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split('=')));
type Stats=Record<string,unknown>[];
type Diagnostic={session:string|null;connectionState:string|null;localTracks:{id:string;enabled:boolean;readyState:string}[];health:{microphone:string;media:string};lastRelease:{tracksEnded:boolean;connectionClosed:boolean}|null;lastInputReplacement:{previousEnded:boolean;replacementLive:boolean}|null;outputRouted:boolean};
function record(info:TestInfo,name:string,data:unknown){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`${info.project.name}-${name}.json`),JSON.stringify({at:new Date().toISOString(),result:'PASS',audio_source:'native browser-generated test microphone; human speech not tested',data},null,2));}
async function login(page:Page,number:string){await page.goto('/');await page.getByLabel('Ramal',{exact:true}).selectOption(number);await page.getByLabel('Token de acesso').fill(env[`TOKEN_${number}`]);await page.getByLabel('Senha SIP').fill(env[`SIP_${number}_PASSWORD`]);await page.getByRole('button',{name:'Conectar ramal',exact:true}).click();await ready(page);}
async function ready(page:Page){await expect(page.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:20000});}
async function permission(page:Page,value:'granted'|'denied'){
 if(value==='granted'){await page.context().grantPermissions(['microphone'],{origin:'http://localhost:13400'});await expect.poll(()=>page.evaluate(async()=>(await navigator.permissions.query({name:'microphone' as PermissionName})).state)).toBe('granted');return;}
 const cdp=await page.context().newCDPSession(page);try{const {targetInfo}=await cdp.send('Target.getTargetInfo');await cdp.send('Browser.setPermission',{permission:{name:'microphone'},setting:value,origin:'http://localhost:13400',browserContextId:targetInfo.browserContextId});}finally{await cdp.detach();}
}
async function diagnostics(page:Page):Promise<Diagnostic>{return page.evaluate(()=>{const read=(window as Window&{floraMediaDiagnostics?:()=>unknown}).floraMediaDiagnostics;if(!read)throw new Error('Missing diagnostic hook');return read();}) as Promise<Diagnostic>;}
async function stats(page:Page):Promise<Stats>{return page.evaluate(async()=>{const read=(window as Window&{floraMediaStats?:()=>Promise<unknown>}).floraMediaStats;return read?await read():[];}) as Promise<Stats>;}
function rx(rows:Stats){return rows?.find(row=>row.type==='inbound-rtp'&&row.kind==='audio')||{};}
async function media(page:Page){await expect.poll(async()=>Number(rx(await stats(page)).packetsReceived||0),{timeout:15000}).toBeGreaterThan(5);await expect.poll(async()=>(await diagnostics(page)).health.media).toBe('connected');}
async function start(a:Page,b:Page){await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:15000});await b.getByRole('button',{name:'Atender',exact:true}).click();await expect(a.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:15000});await expect(b.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible();await Promise.all([media(a),media(b)]);}
async function released(page:Page){await expect.poll(async()=>(await diagnostics(page)).session).toBe(null);await expect.poll(async()=>(await diagnostics(page)).lastRelease).toEqual({tracksEnded:true,connectionClosed:true});}
async function finish(a:Page,b:Page){await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await Promise.all([ready(a),ready(b)]);await Promise.all([released(a),released(b)]);}
async function cleanup(contexts:BrowserContext[]){for(const context of contexts){for(const page of context.pages()){try{const end=page.getByRole('button',{name:'Encerrar chamada',exact:true});if(await end.isVisible()){await end.click({timeout:2000});await ready(page);}}catch{/* Preserve diagnostics; closing context is followed by native RTP timeout if needed. */}}}await Promise.all(contexts.map(c=>c.close()));}
const ast=(command:string)=>execFileSync('docker',['compose','exec','-T','asterisk','asterisk','-rx',command],{cwd:root,encoding:'utf8',timeout:15000});
const channels=()=>Number(ast('core show channels count').match(/(\d+) active channels/)?.[1]??-1);

test('three consecutive real calls, bidirectional media, mute, microphone replacement and cleanup',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();const measurements:unknown[]=[];
 const signals: {side:string; direction:string; kind:string; at:string}[]=[];
 for(const [side,page] of [['a',a],['b',b]] as const)page.on('websocket',socket=>{
  if(new URL(socket.url()).pathname!=='/ws')return;
  const recordFrame=(direction:string,payload:string|Buffer)=>{
   const kind=String(payload).match(/^(?:SIP\/2\.0 (\d{3})|([A-Z]+) )/);
   if(kind)signals.push({side,direction,kind:kind[1]||kind[2],at:new Date().toISOString()});
  };
  socket.on('framesent',event=>recordFrame('sent',event.payload));
  socket.on('framereceived',event=>recordFrame('received',event.payload));
 });
 try{await login(a,'201');await login(b,'202');const prior=(await (await a.request.get('/api/v1/calls?limit=100')).json()).items.map((c:{id:string})=>c.id);
 const total=process.env.FLORA_CONSECUTIVE_CALLS==='10'?10:3;
 for(let i=0;i<total;i++){
  const [caller,callee]=i%2?[b,a]:[a,b];console.log('Consecutive call '+(i+1)+' starting');await start(caller,callee);const before=await Promise.all([stats(caller),stats(callee)]);await caller.waitForTimeout(1300);const after=await Promise.all([stats(caller),stats(callee)]);
  for(let peer=0;peer<2;peer++){expect(Number(rx(after[peer]).packetsReceived)-Number(rx(before[peer]).packetsReceived||0)).toBeGreaterThan(20);expect(Number(rx(after[peer]).totalAudioEnergy)-Number(rx(before[peer]).totalAudioEnergy||0)).toBeGreaterThan(0.0001);}
  let controls:unknown=null;
  if(i===0){
   await caller.getByRole('button',{name:'Silenciar microfone',exact:true}).click();expect((await diagnostics(caller)).localTracks[0].enabled).toBe(false);await caller.waitForTimeout(500);const mutedBefore=rx(await stats(callee));await caller.waitForTimeout(1300);const mutedAfter=rx(await stats(callee));const silentEnergy=Number(mutedAfter.totalAudioEnergy)-Number(mutedBefore.totalAudioEnergy);expect(silentEnergy).toBeLessThan(0.001);
   await caller.getByRole('button',{name:'Reativar microfone',exact:true}).click();expect((await diagnostics(caller)).localTracks[0].enabled).toBe(true);const resumedBefore=rx(await stats(callee));await caller.waitForTimeout(1300);const resumedAfter=rx(await stats(callee));const resumedEnergy=Number(resumedAfter.totalAudioEnergy)-Number(resumedBefore.totalAudioEnergy);expect(resumedEnergy).toBeGreaterThan(0.0001);
   const original=(await diagnostics(caller)).localTracks[0].id;await caller.getByText('Dispositivo de áudio',{exact:true}).click();await caller.getByRole('button',{name:'Buscar microfones',exact:true}).click();const select=caller.getByLabel('Microfone da chamada',{exact:true});await expect(select.locator('option')).not.toHaveCount(1);const id=await select.locator('option').evaluateAll(options=>(options as HTMLOptionElement[]).find(o=>o.value)?.value||'');expect(id).not.toBe('');await select.selectOption(id);
   await expect.poll(async()=>(await diagnostics(caller)).localTracks[0].id).not.toBe(original);expect((await diagnostics(caller)).lastInputReplacement).toEqual({previousEnded:true,replacementLive:true});await media(callee);
   const outputSelect=caller.getByLabel('Saída de áudio',{exact:true});if(await outputSelect.isVisible()){const speakerId=await outputSelect.locator('option').evaluateAll(options=>(options as HTMLOptionElement[]).find(o=>o.value)?.value||'');if(speakerId){await outputSelect.selectOption(speakerId);await expect.poll(async()=>(await diagnostics(caller)).outputRouted).toBe(true);}}
   await expect.poll(async()=>(await diagnostics(caller)).health).toMatchObject({microphone:'active',media:'connected'});
   controls={silentEnergy,resumedEnergy,replacement:await diagnostics(caller)};
   if(info.project.name==='chromium'){await caller.screenshot({path:path.join(output,'call-desktop.png'),fullPage:true});await caller.setViewportSize({width:390,height:844});await caller.screenshot({path:path.join(output,'call-mobile.png'),fullPage:true});expect(await caller.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  }
  await finish(caller,callee);measurements.push({direction:i%2?'202-to-201':'201-to-202',before,after,controls,release:[await diagnostics(caller),await diagnostics(callee)]});
 }
 await expect.poll(async()=>{const json=await (await a.request.get('/api/v1/calls?limit=100')).json();return json.items.filter((c:{id:string;state:string})=>!prior.includes(c.id)&&c.state==='completed').length;},{timeout:15000}).toBe(total);
 expect(channels()).toBe(0);record(info,'consecutive',{browser:browser.version(),measurements});
 }finally{
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,`${info.project.name}-consecutive-signals.json`),JSON.stringify({completed:measurements.length,signals},null,2));
  await cleanup([ca,cb]);
 }
});

test('revoking actual microphone permission warns, permission can be restored and input replaced',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();
 try{await login(a,'201');await login(b,'202');await start(a,b);await permission(a,'denied');await expect(a.getByRole('alert').filter({hasText:/microfone|permissão/i})).toContainText(/microfone|permissão/i,{timeout:8000});await expect.poll(async()=>(await diagnostics(a)).health.microphone).toBe('unavailable');const revoked=await diagnostics(a);
 await permission(a,'granted');await a.getByText('Dispositivo de áudio',{exact:true}).click();await a.getByRole('button',{name:'Buscar microfones',exact:true}).click();const select=a.getByLabel('Microfone da chamada',{exact:true});await expect(select.locator('option')).not.toHaveCount(1);const id=await select.locator('option').evaluateAll(options=>(options as HTMLOptionElement[]).find(o=>o.value)?.value||'');expect(id).not.toBe('');await select.selectOption(id);await expect.poll(async()=>(await diagnostics(a)).health.microphone).toBe('active');await media(b);await finish(a,b);record(info,'permission-revoked',{browser:browser.version(),revoked,recovered:await diagnostics(a)});
 }finally{await cleanup([ca,cb]);}
});

test('microphone permission denied before dialing and answering, then granted without reload',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();
 try{await login(a,'201');await login(b,'202');await permission(a,'denied');await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(a.getByRole('alert').filter({hasText:'Microfone bloqueado'})).toBeVisible();await ready(a);await released(a);
 await permission(a,'granted');await permission(b,'denied');await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:12000});await b.getByRole('button',{name:'Atender',exact:true}).click();await expect(b.getByRole('alert').filter({hasText:'Microfone bloqueado'})).toBeVisible();await Promise.all([ready(a),ready(b)]);await Promise.all([released(a),released(b)]);
 await permission(b,'granted');await start(a,b);await finish(a,b);expect(channels()).toBe(0);record(info,'permission-denied',{browser:browser.version(),outgoing:'denied then recovered',incoming:'denied then recovered',release:[await diagnostics(a),await diagnostics(b)]});
 }finally{await cleanup([ca,cb]);}
});

test('cancel while ringing and after the callee starts answering, without orphan sessions',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();const errors:string[]=[];for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
 try{await login(a,'201');await login(b,'202');await a.getByRole('button',{name:'Ligar',exact:true}).click();await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await ready(a);await released(a);await expect.poll(channels,{timeout:12000}).toBe(0);
 await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible();await b.getByRole('button',{name:'Atender',exact:true}).click({force:true,noWaitAfter:true});await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click({force:true,noWaitAfter:true});await Promise.all([ready(a),ready(b)]);await Promise.all([released(a),released(b)]);await expect.poll(channels,{timeout:12000}).toBe(0);expect(errors).toEqual([]);record(info,'cancel',{browser:browser.version(),release:[await diagnostics(a),await diagnostics(b)],errors});
 }finally{await cleanup([ca,cb]);}
});

test('temporary real media interruption recovers after Asterisk pause and resume',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();let paused=false;
 try{await login(a,'201');await login(b,'202');await start(a,b);
 try{execFileSync('docker',['compose','pause','asterisk'],{cwd:root,stdio:'pipe',timeout:15000});paused=true;await a.waitForTimeout(1800);const before=rx(await stats(b));await a.waitForTimeout(2200);const after=rx(await stats(b));expect(Number(after.packetsReceived)-Number(before.packetsReceived)).toBeLessThanOrEqual(2);}
 finally{if(paused){execFileSync('docker',['compose','unpause','asterisk'],{cwd:root,stdio:'pipe',timeout:15000});paused=false;}}
 const before=rx(await stats(b));await expect.poll(async()=>Number(rx(await stats(b)).packetsReceived)-Number(before.packetsReceived),{timeout:20000}).toBeGreaterThan(20);await media(a);await media(b);const after=rx(await stats(b));expect(Number(after.totalAudioEnergy)-Number(before.totalAudioEnergy)).toBeGreaterThan(0.0001);await finish(a,b);record(info,'interruption',{browser:browser.version(),before,after,release:[await diagnostics(a),await diagnostics(b)]});
 }finally{if(paused)execFileSync('docker',['compose','unpause','asterisk'],{cwd:root,stdio:'pipe',timeout:15000});await cleanup([ca,cb]);}
});

test('abrupt browser closure is cleared by real RTP timeout and history remains consistent',async({browser,request},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});const a=await ca.newPage();const b=await cb.newPage();let id='';
 try{await login(a,'201');await login(b,'202');const previous=(await (await a.request.get('/api/v1/calls')).json()).items.map((c:{id:string})=>c.id);await start(a,b);
 await expect.poll(async()=>{const list=(await (await a.request.get('/api/v1/calls')).json()).items;const current=list.find((c:{id:string;state:string})=>!previous.includes(c.id)&&c.state==='answered');id=current?.id||'';return Boolean(id);},{timeout:12000}).toBe(true);
 await ca.close();await cb.close();await expect.poll(channels,{timeout:45000,intervals:[1000,2000]}).toBe(0);
 const headers={Authorization:`Bearer ${env.TOKEN_201}`};await expect.poll(async()=>{const response=await request.get(`/api/v1/calls/${id}`,{headers});return (await response.json()).call.state;},{timeout:12000}).toBe('completed');const detail=await (await request.get(`/api/v1/calls/${id}`,{headers})).json();expect(detail.call.ended_at).not.toBe(null);expect(detail.legs.every((leg:{ended_at:string|null})=>leg.ended_at!==null)).toBe(true);record(info,'abrupt-close',{browser:browser.version(),detail,active_channels:channels()});
 }finally{await cleanup([ca,cb]);}
});

test('incoming INVITE renders Atender after navigation, operational outage and SIP reconnect',async({browser},info)=>{
 const ca=await browser.newContext({permissions:['microphone']});const cb=await browser.newContext({permissions:['microphone']});
 const a=await ca.newPage();const b=await cb.newPage();
 const answer=a.getByRole('button',{name:'Atender',exact:true});
 type SipEvent={event:string;detail?:string;callRef?:string};
 const read=()=>a.evaluate(()=> (window as Window&{floraSipDiagnostics?:()=>Promise<{events:SipEvent[]}>}).floraSipDiagnostics?.());
 const samples:unknown[]=[];
 const compose=(action:string,service:string)=>execFileSync('docker',['compose',action,service],{cwd:root,stdio:'pipe',timeout:30000});
 const ring=async(stage:string)=>{
  await expect(answer).toHaveCount(0);
  await b.getByRole('button',{name:'Ligar',exact:true}).click();
  await expect(answer).toBeVisible({timeout:15000});
  const trace=await read();
  const events=trace?.events??[];
  const invite=events.filter(event=>event.event==='invite_received').at(-1);
  expect(invite?.callRef).toMatch(/^[0-9a-f]{64}$/);
  expect(events).toContainEqual(expect.objectContaining({event:'invite_bound',callRef:invite?.callRef}));
  const bound=events.findIndex(event=>event.event==='invite_bound'&&event.callRef===invite?.callRef);
  expect(events.slice(bound+1)).toContainEqual(expect.objectContaining({event:'ui_state',detail:expect.stringMatching(/^incoming\/.*\/answer_rendered$/)}));
  samples.push({stage,trace});
  await a.getByRole('button',{name:'Rejeitar',exact:true}).click();
  await Promise.all([ready(a),ready(b)]);
  await expect(answer).toHaveCount(0);
  await expect.poll(channels,{timeout:12000}).toBe(0);
 };
 let stopped=false;
 try{
  await login(a,'201');await login(b,'202');
  await ring('login');
  await a.getByRole('link',{name:'Supervisão',exact:true}).click();
  const otherTab=await ca.newPage();await otherTab.bringToFront();
  await ring('navigation_and_second_tab');
  await otherTab.close();
  compose('stop','backend');stopped=true;
  await expect(a.getByText('Eventos desconectados',{exact:true})).toBeVisible();
  await ring('operational_websocket_unavailable');
  compose('start','backend');stopped=false;
  await expect(a.getByText('Eventos ao vivo',{exact:true})).toBeVisible({timeout:25000});
  await ring('operational_websocket_recovered');
  compose('restart','asterisk');
  await expect.poll(async()=>(await read())?.events.filter(event=>event.event==='sip_registered').length,{timeout:35000}).toBeGreaterThanOrEqual(2);
  await Promise.all([ready(a),ready(b)]);
  await ring('sip_reconnected');
 }finally{
  if(stopped)compose('start','backend');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,`${info.project.name}-incoming-trace.json`),JSON.stringify({samples,finalTrace:await read().catch(()=>null)},null,2));
  await cleanup([ca,cb]);
 }
});
